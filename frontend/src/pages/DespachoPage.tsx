import { useEffect, useState } from 'react'
import { format, differenceInMinutes } from 'date-fns'
import { es } from 'date-fns/locale'
import { Truck, Clock, Printer, PackageCheck } from 'lucide-react'
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
import { toast } from 'sonner'
import type { Tables } from '@/lib/types'

type DispatchedShipment = Tables<'shipments'> & {
  truck: Tables<'trucks'> | null
  driver: Tables<'drivers'> | null
}

export default function DespachoPage() {
  const { user } = useAuth()
  const [enRuta, setEnRuta] = useState<DispatchedShipment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [user?.branch_id])

  async function load() {
    const today = format(new Date(), 'yyyy-MM-dd')
    let q = supabase
      .from('shipments')
      .select('*, truck:trucks(*), driver:drivers(*)')
      .eq('status', 'en_ruta')
      .gte('dispatch_time', `${today}T00:00:00`)
      .order('dispatch_time', { ascending: false })

    if (user?.branch_id) q = q.eq('branch_id', user.branch_id)

    const { data } = await q
    setEnRuta((data as unknown as DispatchedShipment[]) ?? [])
    setLoading(false)
  }

  async function handleLlegoDestino(id: string) {
    const now = new Date().toISOString()

    // Intentar obtener ubicación GPS del dispositivo
    let latitude: number | null = null
    let longitude: number | null = null

    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000,
          })
        })
        latitude = position.coords.latitude
        longitude = position.coords.longitude
      } catch {
        toast.warning('No se pudo obtener la ubicación GPS')
      }
    }

    const updateData: Record<string, unknown> = {
      status: 'en_recepcion',
      recepcion_time: now,
    }
    if (latitude !== null && longitude !== null) {
      updateData.latitude = latitude
      updateData.longitude = longitude
    }

    const { error } = await supabase
      .from('shipments')
      .update(updateData)
      .eq('id', id)
    if (error) { toast.error('Error al actualizar'); return }

    const locationMsg = latitude !== null ? ` (${latitude.toFixed(4)}, ${longitude!.toFixed(4)})` : ''
    toast.success(`Camión llegó al destino${locationMsg}`)
    load()
  }

  function totalTime(s: DispatchedShipment) {
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

  function handlePrint(s: DispatchedShipment) {
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
        <tr><th>Llegada</th><th>Ingreso Patio</th><th>Inicio Carga</th><th>Fin Carga</th><th>Despacho</th><th>Tiempo Total</th></tr>
        <tr>
          <td>${formatTs(s.arrival_time)}</td>
          <td>${formatTs(s.yard_entry_time)}</td>
          <td>${formatTs(s.load_start)}</td>
          <td>${formatTs(s.load_end)}</td>
          <td>${formatTs(s.dispatch_time)}</td>
          <td><strong>${totalTime(s)}</strong></td>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">En Ruta</h1>
        <Badge variant="secondary" className="gap-1">
          <Truck className="h-3 w-3" /> {enRuta.length} despachos hoy
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
              <Truck className="h-4 w-4 text-emerald-500" />
              Camiones en ruta
              <Badge variant="secondary">{enRuta.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {enRuta.length === 0 ? (
              <p className="p-4 text-sm text-center text-muted-foreground">Sin camiones en ruta</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patente</TableHead>
                    <TableHead>Conductor</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Carga</TableHead>
                    <TableHead>Despacho</TableHead>
                    <TableHead>Tiempo</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enRuta.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-bold">{s.truck?.plate ?? '---'}</TableCell>
                      <TableCell>{s.driver?.name ?? '---'}</TableCell>
                      <TableCell>{s.transport_company ?? '---'}</TableCell>
                      <TableCell>{s.cargo_type ?? '---'}</TableCell>
                      <TableCell className="font-mono text-sm">{formatTs(s.dispatch_time)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono text-sm">{totalTime(s)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-sky-600 border-sky-300 hover:bg-sky-50"
                            onClick={() => handleLlegoDestino(s.id)}
                          >
                            <PackageCheck className="h-3 w-3" /> Llegó
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handlePrint(s)}>
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
