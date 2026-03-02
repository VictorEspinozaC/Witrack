import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Clock, Truck, MapPin, FileText, RefreshCw } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { supabase } from '@/lib/supabase'
import { STATUS_LABELS, type ShipmentStatus } from '@/lib/constants'
import { useAuth } from '@/context/AuthContext'
import { formatRut, validateRut, cleanRut } from '@/lib/rut'
import { toast } from 'sonner'
import type { ShipmentWithRelations } from '@/hooks/useShipments'
import type { Tables } from '@/lib/types'

interface TruckDetailPanelProps {
  shipment: ShipmentWithRelations | null
  open: boolean
  onClose: () => void
}

export function TruckDetailPanel({ shipment, open, onClose }: TruckDetailPanelProps) {
  const { user } = useAuth()
  const [logs, setLogs] = useState<Tables<'shipment_status_log'>[]>([])
  const [branches, setBranches] = useState<Tables<'branches'>[]>([])

  // Reassign mode
  const [reassigning, setReassigning] = useState(false)
  const [raBranchId, setRaBranchId] = useState('')
  const [raRutInput, setRaRutInput] = useState('')
  const [raFoundDriver, setRaFoundDriver] = useState<Tables<'drivers'> | null>(null)
  const [raRutError, setRaRutError] = useState('')
  const [raPlateInput, setRaPlateInput] = useState('')
  const [raFoundTruck, setRaFoundTruck] = useState<Tables<'trucks'> | null>(null)
  const [raSaving, setRaSaving] = useState(false)

  useEffect(() => {
    if (!shipment) return
    supabase
      .from('shipment_status_log')
      .select('*')
      .eq('shipment_id', shipment.id)
      .order('changed_at', { ascending: true })
      .then(({ data }) => setLogs(data ?? []))
  }, [shipment])

  useEffect(() => {
    if (!open) return
    supabase.from('branches').select('*').eq('is_active', true).order('name').then(({ data }) => setBranches(data ?? []))
  }, [open])

  if (!shipment) return null

  function formatTime(ts: string | null) {
    if (!ts) return '---'
    return format(new Date(ts), "HH:mm - dd MMM", { locale: es })
  }

  function openReassign() {
    setRaBranchId(shipment?.branch_id ?? '')
    setRaRutInput('')
    setRaFoundDriver(null)
    setRaRutError('')
    setRaPlateInput('')
    setRaFoundTruck(null)
    setReassigning(true)
  }

  async function handleRaRutBlur() {
    const raw = raRutInput.trim()
    if (!raw) { setRaFoundDriver(null); setRaRutError(''); return }
    const formatted = formatRut(raw)
    setRaRutInput(formatted)
    if (!validateRut(raw)) { setRaRutError('RUT invalido'); setRaFoundDriver(null); return }
    setRaRutError('')
    const cleaned = cleanRut(raw)
    const { data } = await supabase
      .from('drivers')
      .select('*')
      .or(`rut.eq.${formatted},rut.eq.${cleaned}`)
      .limit(1)
    if (data && data.length > 0) {
      setRaFoundDriver(data[0])
    } else {
      setRaFoundDriver(null)
      toast.error('Conductor no encontrado')
    }
  }

  async function handleRaPlatBlur() {
    const raw = raPlateInput.trim().toUpperCase()
    if (!raw) { setRaFoundTruck(null); return }
    setRaPlateInput(raw)
    const { data } = await supabase.from('trucks').select('*').ilike('plate', raw).limit(1)
    if (data && data.length > 0) {
      setRaFoundTruck(data[0])
    } else {
      setRaFoundTruck(null)
      toast.error('Camion no encontrado')
    }
  }

  async function handleRaSave() {
    if (!raFoundDriver || !raFoundTruck || !raBranchId) return
    setRaSaving(true)
    const { error } = await supabase
      .from('shipments')
      .update({ driver_id: raFoundDriver.id, truck_id: raFoundTruck.id, branch_id: raBranchId })
      .eq('id', shipment.id)
    setRaSaving(false)
    if (error) { toast.error('Error al reasignar'); return }
    toast.success('Reasignación guardada')
    setReassigning(false)
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[450px] overflow-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <Truck className="h-5 w-5" />
            {shipment.truck?.plate}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={shipment.status as ShipmentStatus} />
            {shipment.ramp_assignment && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" /> {shipment.ramp_assignment}
              </span>
            )}
            {user?.role === 'admin' && !reassigning && (
              <Button variant="outline" size="sm" className="ml-auto gap-1" onClick={openReassign}>
                <RefreshCw className="h-3 w-3" /> Reasignar
              </Button>
            )}
          </div>

          {reassigning ? (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium">Reasignar Envío</p>

              <div className="space-y-1">
                <Label className="text-xs">Sucursal</Label>
                <Select value={raBranchId} onValueChange={setRaBranchId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Seleccionar sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">RUT Conductor</Label>
                <Input
                  className="h-8 text-sm"
                  value={raRutInput}
                  onChange={(e) => { setRaRutInput(e.target.value); setRaRutError(''); setRaFoundDriver(null) }}
                  onBlur={handleRaRutBlur}
                  placeholder="12.345.678-9"
                />
                {raRutError && <p className="text-xs text-red-500">{raRutError}</p>}
                {raFoundDriver && <p className="text-xs text-green-600">{raFoundDriver.name}</p>}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Patente Camion</Label>
                <Input
                  className="h-8 text-sm"
                  value={raPlateInput}
                  onChange={(e) => { setRaPlateInput(e.target.value.toUpperCase()); setRaFoundTruck(null) }}
                  onBlur={handleRaPlatBlur}
                  placeholder="ABCD12"
                />
                {raFoundTruck && <p className="text-xs text-green-600">{raFoundTruck.plate} ({raFoundTruck.type})</p>}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setReassigning(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={raSaving || !raFoundDriver || !raFoundTruck || !raBranchId}
                  onClick={handleRaSave}
                >
                  {raSaving ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Separator />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Conductor</p>
                  <p className="font-medium">{shipment.driver?.name ?? '---'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">RUT</p>
                  <p className="font-medium">{shipment.driver?.rut ?? '---'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Empresa</p>
                  <p className="font-medium">{shipment.transport_company ?? '---'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tipo Carga</p>
                  <p className="font-medium">{shipment.cargo_type ?? '---'}</p>
                </div>
                {shipment.seal_number && (
                  <div>
                    <p className="text-muted-foreground">N Sello</p>
                    <p className="font-medium">{shipment.seal_number}</p>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h4 className="mb-2 flex items-center gap-2 font-semibold">
                  <Clock className="h-4 w-4" /> Tiempos
                </h4>
                <div className="space-y-1 text-sm">
                  <TimeRow label="Llegada" time={shipment.arrival_time ?? shipment.gate_entry_time} />
                  <TimeRow label="Ingreso Patio" time={shipment.yard_entry_time} />
                  <TimeRow label="Inicio Carga" time={shipment.load_start} />
                  <TimeRow label="Fin Carga" time={shipment.load_end} />
                  <TimeRow label="Emisión Guía" time={shipment.emision_guia_time ?? null} />
                  <TimeRow label="Espera Salida" time={shipment.espera_salida_time ?? null} />
                  <TimeRow label="Despacho" time={shipment.dispatch_time} />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="mb-2 flex items-center gap-2 font-semibold">
                  <FileText className="h-4 w-4" /> Historial de Estados
                </h4>
                {logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin cambios registrados</p>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-center gap-2 text-sm">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTime(log.changed_at)}
                        </span>
                        <span className="font-medium">
                          {STATUS_LABELS[log.new_status as ShipmentStatus] ?? log.new_status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {shipment.notes && (
                <>
                  <Separator />
                  <div>
                    <h4 className="mb-1 font-semibold">Notas</h4>
                    <p className="text-sm text-muted-foreground">{shipment.notes}</p>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function TimeRow({ label, time }: { label: string; time: string | null }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">
        {time ? format(new Date(time), "HH:mm - dd MMM", { locale: es }) : '---'}
      </span>
    </div>
  )
}
