import { useState, useEffect, type FormEvent } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Tables, TablesInsert } from '@/lib/types'

// Generate 30-minute time slots from 06:00 to 22:00
const ALL_TIME_SLOTS: string[] = []
for (let h = 6; h <= 22; h++) {
  ALL_TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`)
  if (h < 22) ALL_TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`)
}

interface ScheduleFormProps {
  open: boolean
  onClose: () => void
  onCreate: (data: TablesInsert<'schedules'>) => Promise<void>
  defaultDate?: string
}

export function ScheduleForm({ open, onClose, onCreate, defaultDate }: ScheduleFormProps) {
  const { user } = useAuth()
  const [branches, setBranches] = useState<Tables<'branches'>[]>([])
  const [suppliers, setSuppliers] = useState<Tables<'suppliers'>[]>([])
  const [clients, setClients] = useState<Tables<'clients'>[]>([])

  const today = format(new Date(), 'yyyy-MM-dd')

  const [date, setDate] = useState(defaultDate ?? '')
  const [time, setTime] = useState('')
  const [operationType, setOperationType] = useState('')
  const [destinationType, setDestinationType] = useState('')
  const [destinationBranchId, setDestinationBranchId] = useState('')
  const [transportSupplierId, setTransportSupplierId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [maquilaId, setMaquilaId] = useState('')
  const [clientId, setClientId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    supabase.from('branches').select('*').eq('is_active', true).order('name').then(({ data }) => setBranches(data ?? []))
    supabase.from('suppliers').select('*').eq('is_active', true).order('name').then(({ data }) => setSuppliers(data ?? []))
    supabase.from('clients').select('*').eq('is_active', true).order('name').then(({ data }) => setClients(data ?? []))
    if (defaultDate) setDate(defaultDate)
  }, [open, defaultDate])

  // Limpiar campos condicionales cuando cambia el tipo de destino
  useEffect(() => {
    setDestinationBranchId('')
    setTransportSupplierId('')
    setSupplierId('')
    setMaquilaId('')
    setClientId('')
    setTime('')
  }, [destinationType])

  // Filtered time slots: if date is today, only show future slots (+30 min)
  const timeSlots = (() => {
    if (date !== today) return ALL_TIME_SLOTS
    const now = new Date()
    const minMinutes = now.getHours() * 60 + now.getMinutes() + 30
    return ALL_TIME_SLOTS.filter((slot) => {
      const [h, m] = slot.split(':').map(Number)
      return h * 60 + m >= minMinutes
    })
  })()

  // Filtros de proveedores por tipo (array)
  const proveedorSuppliers = suppliers.filter(
    (s) => s.types?.includes('compra_local') || s.types?.includes('servicios')
  )
  const maquilaSuppliers = suppliers.filter(
    (s) => s.types?.includes('maquila')
  )
  const transportSuppliers = suppliers.filter(
    (s) => s.types?.includes('transporte')
  )

  function isFormValid(): boolean {
    if (!date || !operationType || !destinationType) return false
    if (destinationType === 'sucursal' && !destinationBranchId) return false
    if (destinationType === 'proveedor' && !supplierId) return false
    if (destinationType === 'maquila' && !maquilaId) return false
    if (destinationType === 'cliente' && !clientId) return false
    return true
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isFormValid() || !user?.branch_id) return

    setSubmitting(true)
    try {
      await onCreate({
        branch_id: user.branch_id,
        scheduled_date: date,
        scheduled_time: time || null,
        operation_type: operationType,
        destination_type: destinationType,
        destination_branch_id: destinationType === 'sucursal' ? (destinationBranchId || null) : null,
        transport_supplier_id: destinationType === 'sucursal' ? (transportSupplierId || null) : null,
        supplier_id: destinationType === 'proveedor' ? (supplierId || null) : null,
        maquila_supplier_id: destinationType === 'maquila' ? (maquilaId || null) : null,
        client_id: destinationType === 'cliente' ? (clientId || null) : null,
        transport_company: null,
        truck_id: null,
        driver_id: null,
      })
      toast.success('Agenda creada')
      resetForm()
      onClose()
    } catch {
      toast.error('Error al crear agenda')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setDate('')
    setTime('')
    setOperationType('')
    setDestinationType('')
    setDestinationBranchId('')
    setTransportSupplierId('')
    setSupplierId('')
    setMaquilaId('')
    setClientId('')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Nueva Agenda</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Fecha */}
          <div className="space-y-2">
            <Label>Fecha *</Label>
            <Input
              type="date"
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* 2. Hora - Selector en rangos de 30 min */}
          <div className="space-y-2">
            <Label>Hora</Label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar horario" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {timeSlots.map((slot) => (
                  <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 3. Tipo de Operacion */}
          <div className="space-y-2">
            <Label>Tipo de Operacion *</Label>
            <Select value={operationType} onValueChange={setOperationType}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar operacion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="despacho">Despacho</SelectItem>
                <SelectItem value="recepcion">Recepcion</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 4. Destino u Origen */}
          <div className="space-y-2">
            <Label>{operationType === 'despacho' ? 'Destino' : operationType === 'recepcion' ? 'Origen' : 'Destino u Origen'} *</Label>
            <Select value={destinationType} onValueChange={setDestinationType}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar destino/origen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sucursal">Sucursal</SelectItem>
                <SelectItem value="proveedor">Proveedor</SelectItem>
                <SelectItem value="maquila">Maquila</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 5. Campos condicionales */}
          {destinationType === 'sucursal' && (
            <>
              <div className="space-y-2">
                <Label>Sucursal *</Label>
                <Select value={destinationBranchId} onValueChange={setDestinationBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Proveedor de Transporte</Label>
                <Select value={transportSupplierId} onValueChange={setTransportSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar transporte" />
                  </SelectTrigger>
                  <SelectContent>
                    {transportSuppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {destinationType === 'proveedor' && (
            <div className="space-y-2">
              <Label>Proveedor *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {proveedorSuppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {destinationType === 'maquila' && (
            <div className="space-y-2">
              <Label>Proveedor Maquila *</Label>
              <Select value={maquilaId} onValueChange={setMaquilaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar maquila" />
                </SelectTrigger>
                <SelectContent>
                  {maquilaSuppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {destinationType === 'cliente' && (
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={submitting || !isFormValid()}>
              {submitting ? 'Creando...' : 'Crear Agenda'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
