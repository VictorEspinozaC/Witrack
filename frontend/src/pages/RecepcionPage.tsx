import { useEffect, useState } from 'react'
import { format, differenceInMinutes } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { PackageCheck, Clock, Printer, CheckCircle, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { RecepcionIncidentDialog } from '@/components/recepcion/RecepcionIncidentDialog'
import type { Tables } from '@/lib/types'

type ReceivedShipment = Tables<'shipments'> & {
  truck: Tables<'trucks'> | null
  driver: Tables<'drivers'> | null
}

export default function RecepcionPage() {
  const { user } = useAuth()
  const [shipments, setShipments] = useState<ReceivedShipment[]>([])
  const [loading, setLoading] = useState(true)
  const [incidenciaShipment, setIncidenciaShipment] = useState<ReceivedShipment | null>(null)

  useEffect(() => {
    load()
  }, [user?.branch_id])

  async function load() {
    const today = format(new Date(), 'yyyy-MM-dd')
    let q = supabase
      .from('shipments')
      .select('*, truck:trucks(*), driver:drivers(*)')
      .eq('status', 'en_recepcion')
      .gte('dispatch_time', `${today}T00:00:00`)
      .order('recepcion_time', { ascending: false })

    if (user?.branch_id) q = q.eq('branch_id', user.branch_id)

    const { data } = await q
    setShipments((data as unknown as ReceivedShipment[]) ?? [])
    setLoading(false)
  }

  function totalTime(s: ReceivedShipment) {
    if (!s.arrival_time || !s.dispatch_time) return '---'
    const mins = differenceInMinutes(new Date(s.dispatch_time), new Date(s.arrival_time))
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}m`
  }

  function formatTs(ts: string | null) {
    if (!ts) return '---'
    return format(new Date(ts), 'HH:mm', { locale: es })
  }

  function handlePrint(s: ReceivedShipment) {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>Guia de Despacho</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        h1 { font-size: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        td, th { border: 1px solid #ccc; padding: 8px; text-align: left; }
        th { background: #f5f5f5; }
        .sig { margin-top: 60px; display: flex; justify-content: space-between; }
        .sig-line { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px; }
      </style>
      </head><body>
      <h1>Guia de Despacho</h1>
      <table>
        <tr><th>Patente</th><td>${s.truck?.plate ?? '---'}</td><th>Tipo</th><td>${s.truck?.type ?? '---'}</td></tr>
        <tr><th>Conductor</th><td>${s.driver?.name ?? '---'}</td><th>RUT</th><td>${s.driver?.rut ?? '---'}</td></tr>
        <tr><th>Empresa</th><td>${s.transport_company ?? '---'}</td><th>Carga</th><td>${s.cargo_type ?? '---'}</td></tr>
        <tr><th>N Sello</th><td>${s.seal_number ?? '---'}</td><th>Rampa</th><td>${s.ramp_assignment ?? '---'}</td></tr>
      </table>
      <table style="margin-top: 20px">
        <tr><th>Llegada</th><th>Ingreso Patio</th><th>Inicio Carga</th><th>Fin Carga</th><th>Despacho</th><th>Recepción</th></tr>
        <tr>
          <td>${formatTs(s.arrival_time)}</td>
          <td>${formatTs(s.yard_entry_time)}</td>
          <td>${formatTs(s.load_start)}</td>
          <td>${formatTs(s.load_end)}</td>
          <td>${formatTs(s.dispatch_time)}</td>
          <td>${formatTs(s.recepcion_time)}</td>
        </tr>
      </table>
      ${s.notes ? `<p style="margin-top: 20px"><strong>Notas:</strong> ${s.notes}</p>` : ''}
      <div class="sig">
        <div class="sig-line">Firma Conductor</div>
        <div class="sig-line">Firma Responsable</div>
      </div>
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  async function handleRecepcionConforme(s: ReceivedShipment) {
    const { error } = await supabase
      .from('shipments')
      .update({
        reception_confirmed: true,
        reception_confirmed_at: new Date().toISOString(),
        reception_confirmed_by: user?.id ?? null,
      })
      .eq('id', s.id)

    if (error) {
      toast.error('Error al confirmar recepcion')
      return
    }
    toast.success('Recepcion confirmada correctamente')
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">En Recepcion</h1>
          <p className="text-sm text-muted-foreground mt-1">Verificacion de entregas y recepcion de carga</p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <PackageCheck className="h-3 w-3" /> {shipments.length} recepciones hoy
        </Badge>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PackageCheck className="h-4 w-4 text-sky-500" />
              Camiones en recepción
              <Badge variant="secondary">{shipments.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {shipments.length === 0 ? (
              <p className="p-4 text-sm text-center text-muted-foreground">Sin camiones en recepción</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patente</TableHead>
                    <TableHead>Conductor</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Carga</TableHead>
                    <TableHead>Despacho</TableHead>
                    <TableHead>Recepción</TableHead>
                    <TableHead>Tiempo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipments.map((s) => (
                    <TableRow key={s.id} className="bg-sky-50/50">
                      <TableCell className="font-bold">{s.truck?.plate ?? '---'}</TableCell>
                      <TableCell>{s.driver?.name ?? '---'}</TableCell>
                      <TableCell>{s.transport_company ?? '---'}</TableCell>
                      <TableCell>{s.cargo_type ?? '---'}</TableCell>
                      <TableCell className="font-mono text-sm">{formatTs(s.dispatch_time)}</TableCell>
                      <TableCell className="font-mono text-sm">{formatTs(s.recepcion_time)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono text-sm">{totalTime(s)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {s.reception_confirmed ? (
                          <Badge className="gap-1 bg-green-100 text-green-800 border-green-300 hover:bg-green-100">
                            <CheckCircle className="h-3 w-3" /> Conforme
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleRecepcionConforme(s)}
                            >
                              <CheckCircle className="h-3.5 w-3.5" /> Conforme
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="gap-1"
                              onClick={() => setIncidenciaShipment(s)}
                            >
                              <AlertTriangle className="h-3.5 w-3.5" /> Incidencia
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handlePrint(s)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <RecepcionIncidentDialog
        open={!!incidenciaShipment}
        onClose={() => setIncidenciaShipment(null)}
        shipment={incidenciaShipment}
        onCreated={() => load()}
      />
    </div>
  )
}
