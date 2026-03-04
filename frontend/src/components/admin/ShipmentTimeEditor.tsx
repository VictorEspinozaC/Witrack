import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Search, Pencil, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { SHIPMENT_STATES, STATUS_LABELS } from '@/lib/constants'
import type { Tables } from '@/lib/types'

type ShipmentForEdit = Tables<'shipments'> & {
  truck: { id: string; plate: string } | null
  driver: { id: string; name: string } | null
  branch: { id: string; name: string } | null
}

const TIMESTAMP_FIELDS = [
  { key: 'arrival_time', label: 'Hora de Llegada' },
  { key: 'yard_entry_time', label: 'Ingreso al Patio' },
  { key: 'load_start', label: 'Inicio de Carga' },
  { key: 'load_end', label: 'Fin de Carga' },
  { key: 'emision_guia_time', label: 'Emision Guia' },
  { key: 'espera_salida_time', label: 'Espera Salida' },
  { key: 'dispatch_time', label: 'Despacho' },
  { key: 'recepcion_time', label: 'Recepcion' },
] as const

type TimestampKey = typeof TIMESTAMP_FIELDS[number]['key']

function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  return format(new Date(iso), "yyyy-MM-dd'T'HH:mm")
}

function formatTs(ts: string | null) {
  if (!ts) return '---'
  return format(new Date(ts), 'dd/MM HH:mm', { locale: es })
}

export function ShipmentTimeEditor() {
  // Filtros
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [plateFilter, setPlateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')

  // Datos
  const [shipments, setShipments] = useState<ShipmentForEdit[]>([])
  const [branches, setBranches] = useState<Tables<'branches'>[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  // Edicion
  const [editing, setEditing] = useState<ShipmentForEdit | null>(null)
  const [editFields, setEditFields] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadBranches()
  }, [])

  async function loadBranches() {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('name')
    setBranches(data ?? [])
  }

  async function handleSearch() {
    setLoading(true)
    setSearched(true)

    // Si hay filtro de patente, buscar truck IDs primero
    let truckIds: string[] | null = null
    if (plateFilter.trim()) {
      const { data: trucks } = await supabase
        .from('trucks')
        .select('id')
        .ilike('plate', `%${plateFilter.trim()}%`)
      truckIds = trucks?.map((t) => t.id) ?? []
      if (truckIds.length === 0) {
        setShipments([])
        setLoading(false)
        return
      }
    }

    let query = supabase
      .from('shipments')
      .select('*, truck:trucks(id, plate), driver:drivers(id, name), branch:branches(id, name)')
      .order('created_at', { ascending: false })
      .limit(50)

    if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`)
    if (truckIds) query = query.in('truck_id', truckIds)
    if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    if (branchFilter !== 'all') query = query.eq('branch_id', branchFilter)

    const { data, error } = await query
    if (error) {
      toast.error(`Error: ${error.message}`)
    }
    setShipments((data as unknown as ShipmentForEdit[]) ?? [])
    setLoading(false)
  }

  function openEdit(s: ShipmentForEdit) {
    setEditing(s)
    const fields: Record<string, string> = {}
    for (const f of TIMESTAMP_FIELDS) {
      fields[f.key] = isoToDatetimeLocal(s[f.key as TimestampKey] as string | null)
    }
    setEditFields(fields)
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)

    const payload: Record<string, string | null> = {}
    for (const f of TIMESTAMP_FIELDS) {
      const val = editFields[f.key]
      payload[f.key] = val ? new Date(val).toISOString() : null
    }

    const { error } = await supabase
      .from('shipments')
      .update(payload)
      .eq('id', editing.id)

    if (error) {
      toast.error(`Error al guardar: ${error.message}`)
      setSaving(false)
      return
    }

    toast.success('Horas actualizadas correctamente')
    setEditing(null)
    setSaving(false)
    handleSearch()
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Fecha desde</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-36"
          />
        </div>
        <div>
          <Label className="text-xs">Fecha hasta</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-36"
          />
        </div>
        <div>
          <Label className="text-xs">Patente</Label>
          <Input
            value={plateFilter}
            onChange={(e) => setPlateFilter(e.target.value)}
            placeholder="Ej: ABCD12"
            className="w-32"
          />
        </div>
        <div>
          <Label className="text-xs">Estado</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {SHIPMENT_STATES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Sucursal</Label>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSearch} disabled={loading} className="gap-1">
          <Search className="h-4 w-4" /> Buscar
        </Button>
      </div>

      {/* Resultados */}
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : !searched ? (
        <p className="py-8 text-center text-muted-foreground text-sm">
          Utiliza los filtros y presiona Buscar para encontrar embarques
        </p>
      ) : shipments.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground text-sm">
          No se encontraron embarques con los filtros seleccionados
        </p>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium whitespace-nowrap">Patente</th>
                <th className="text-left p-2 font-medium whitespace-nowrap">Conductor</th>
                <th className="text-left p-2 font-medium whitespace-nowrap">Sucursal</th>
                <th className="text-left p-2 font-medium whitespace-nowrap">Estado</th>
                {TIMESTAMP_FIELDS.map((f) => (
                  <th key={f.key} className="text-center p-2 font-medium whitespace-nowrap">{f.label}</th>
                ))}
                <th className="text-center p-2 font-medium">Accion</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => (
                <tr key={s.id} className="border-t hover:bg-muted/30">
                  <td className="p-2 font-bold whitespace-nowrap">{s.truck?.plate ?? '---'}</td>
                  <td className="p-2 whitespace-nowrap">{s.driver?.name ?? '---'}</td>
                  <td className="p-2 whitespace-nowrap">{s.branch?.name ?? '---'}</td>
                  <td className="p-2">
                    <Badge variant="outline" className="text-[10px]">
                      {STATUS_LABELS[s.status as keyof typeof STATUS_LABELS] ?? s.status}
                    </Badge>
                  </td>
                  {TIMESTAMP_FIELDS.map((f) => (
                    <td key={f.key} className="p-2 text-center font-mono whitespace-nowrap">
                      {formatTs(s[f.key as TimestampKey] as string | null)}
                    </td>
                  ))}
                  <td className="p-2 text-center">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(s)} title="Editar horas">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">Maximo 50 resultados por busqueda</p>

      {/* Dialog de edicion */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent
          className="sm:max-w-lg"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Editar Horas
              {editing?.truck?.plate && (
                <Badge variant="outline">{editing.truck.plate}</Badge>
              )}
              {editing && (
                <Badge variant="secondary" className="text-[10px]">
                  {STATUS_LABELS[editing.status as keyof typeof STATUS_LABELS] ?? editing.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {TIMESTAMP_FIELDS.map((f) => (
              <div key={f.key} className="grid grid-cols-[160px_1fr] items-center gap-3">
                <Label className="text-sm">{f.label}</Label>
                <Input
                  type="datetime-local"
                  value={editFields[f.key] ?? ''}
                  onChange={(e) => setEditFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1">
              <Save className="h-4 w-4" /> Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
