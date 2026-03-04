import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, CheckCircle, Image } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { ReadOnlyBanner } from '@/components/shared/ReadOnlyBanner'
import { INCIDENT_TYPES } from '@/lib/constants'
import type { Tables } from '@/lib/types'

type IncidentWithShipment = Tables<'incidents'> & {
  shipment: { id: string; truck_id: string; truck: { plate: string } | null } | null
}

export default function IncidenciasPage() {
  const { user } = useAuth()
  const { canWrite } = usePermissions()
  const readOnly = !canWrite('incidencias')
  const [incidents, setIncidents] = useState<IncidentWithShipment[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [resolveId, setResolveId] = useState<string | null>(null)
  const [resolution, setResolution] = useState('')

  async function fetchIncidents() {
    let query = supabase
      .from('incidents')
      .select('*, shipment:shipments(id, truck_id, truck:trucks(plate))')
      .order('created_at', { ascending: false })

    if (statusFilter !== 'all') query = query.eq('status', statusFilter)

    const { data } = await query
    setIncidents((data as unknown as IncidentWithShipment[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchIncidents() }, [statusFilter, user?.branch_id])

  async function handleResolve() {
    if (!resolveId || !resolution) return
    const { error } = await supabase
      .from('incidents')
      .update({ status: 'resuelta', resolution, resolved_at: new Date().toISOString() })
      .eq('id', resolveId)
    if (error) { toast.error('Error'); return }
    toast.success('Incidencia resuelta')
    setResolveId(null)
    setResolution('')
    fetchIncidents()
  }

  const typeLabel = (val: string) => INCIDENT_TYPES.find((t) => t.value === val)?.label ?? val

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Incidencias</h1>
          <p className="text-sm text-muted-foreground mt-1">Registro y seguimiento de incidencias</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="abierta">Abiertas</SelectItem>
            <SelectItem value="resuelta">Resueltas</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {readOnly && <ReadOnlyBanner />}

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : incidents.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Sin incidencias</p>
      ) : (
        <div className="space-y-2">
          {incidents.map((inc) => (
            <Card key={inc.id}>
              <CardContent className="flex items-start gap-4 p-4">
                <div className="shrink-0 pt-1">
                  {inc.status === 'abierta' ? (
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={inc.status === 'abierta' ? 'destructive' : 'secondary'}>
                      {inc.status === 'abierta' ? 'Abierta' : 'Resuelta'}
                    </Badge>
                    <Badge variant="outline">{typeLabel(inc.type)}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {inc.shipment?.truck?.plate ?? '---'}
                    </span>
                  </div>
                  <p className="text-sm">{inc.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {inc.created_at ? format(new Date(inc.created_at), "dd MMM yyyy HH:mm", { locale: es }) : ''}
                  </p>
                  {inc.resolution && (
                    <p className="text-sm mt-2 text-green-700 bg-green-50 rounded p-2">
                      Resolucion: {inc.resolution}
                    </p>
                  )}
                  {inc.photo_url && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Image className="h-3 w-3" /> Foto adjunta
                    </div>
                  )}
                </div>
                {inc.status === 'abierta' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setResolveId(inc.id)}
                  >
                    Resolver
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!resolveId} onOpenChange={() => setResolveId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resolver Incidencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Descripcion de la resolucion..."
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveId(null)}>Cancelar</Button>
            <Button onClick={handleResolve} disabled={!resolution}>Resolver</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
