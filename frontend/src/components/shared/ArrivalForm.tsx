import { useState, useEffect, type FormEvent } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, UserPlus } from 'lucide-react'
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
import type { Tables } from '@/lib/types'
import { formatRut, validateRut, cleanRut } from '@/lib/rut'
import type { ScheduleWithRelations } from '@/hooks/useSchedules'

interface ArrivalFormProps {
  open: boolean
  onClose: () => void
  onConfirm: (driverId: string, truckId: string) => Promise<void>
  schedule?: ScheduleWithRelations | null
  title?: string
}

export function ArrivalForm({ open, onClose, onConfirm, schedule, title = 'Registrar Llegada' }: ArrivalFormProps) {
  // RUT / Driver lookup
  const [rutInput, setRutInput] = useState('')
  const [rutError, setRutError] = useState('')
  const [foundDriver, setFoundDriver] = useState<Tables<'drivers'> | null>(null)
  const [driverNotFound, setDriverNotFound] = useState(false)
  const [searching, setSearching] = useState(false)
  const [licenseWarning, setLicenseWarning] = useState('')

  // Truck / Plate lookup
  const [plateInput, setPlateInput] = useState('')
  const [foundTruck, setFoundTruck] = useState<Tables<'trucks'> | null>(null)
  const [truckNotFound, setTruckNotFound] = useState(false)

  // Create driver inline
  const [showCreateDriver, setShowCreateDriver] = useState(false)
  const [newDriverName, setNewDriverName] = useState('')
  const [newDriverBirthDate, setNewDriverBirthDate] = useState('')
  const [newDriverLicenseExpiry, setNewDriverLicenseExpiry] = useState('')
  const [newDriverSupplierId, setNewDriverSupplierId] = useState('')
  const [transportSuppliers, setTransportSuppliers] = useState<Tables<'suppliers'>[]>([])
  const [savingDriver, setSavingDriver] = useState(false)

  // Submit
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    resetAll()
    // Load transport suppliers for create driver form
    supabase
      .from('suppliers')
      .select('*')
      .contains('types', ['transporte'])
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setTransportSuppliers(data ?? []))
  }, [open])

  function resetAll() {
    setRutInput('')
    setRutError('')
    setFoundDriver(null)
    setDriverNotFound(false)
    setLicenseWarning('')
    setPlateInput('')
    setFoundTruck(null)
    setTruckNotFound(false)
    setShowCreateDriver(false)
    setNewDriverName('')
    setNewDriverBirthDate('')
    setNewDriverLicenseExpiry('')
    setNewDriverSupplierId('')
    setSavingDriver(false)
    setSubmitting(false)
    setSearching(false)
  }

  // --- RUT lookup ---
  async function handleRutBlur() {
    const raw = rutInput.trim()
    if (!raw) {
      setRutError('')
      setFoundDriver(null)
      setDriverNotFound(false)
      setLicenseWarning('')
      return
    }

    const formatted = formatRut(raw)
    setRutInput(formatted)

    if (!validateRut(raw)) {
      setRutError('RUT invalido')
      setFoundDriver(null)
      setDriverNotFound(false)
      return
    }
    setRutError('')
    setSearching(true)

    // Search by cleaned RUT (try both formatted and cleaned variants)
    const cleaned = cleanRut(raw)
    const { data } = await supabase
      .from('drivers')
      .select('*')
      .or(`rut.eq.${formatted},rut.eq.${cleaned}`)
      .limit(1)

    setSearching(false)

    if (data && data.length > 0) {
      const driver = data[0]
      setFoundDriver(driver)
      setDriverNotFound(false)
      // Check license expiry
      checkLicense(driver)
      // Validate driver belongs to transport company of schedule
      if (schedule?.transport_supplier_id && driver.supplier_id !== schedule.transport_supplier_id) {
        toast.warning('El conductor no pertenece a la empresa de transporte del agendamiento')
      }
    } else {
      setFoundDriver(null)
      setDriverNotFound(true)
      setLicenseWarning('')
    }
  }

  function checkLicense(driver: Tables<'drivers'>) {
    if (driver.license_expiry_date) {
      const expiry = new Date(driver.license_expiry_date + 'T00:00:00')
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (expiry < today) {
        setLicenseWarning(`Licencia vencida el ${driver.license_expiry_date}`)
      } else {
        setLicenseWarning('')
      }
    } else {
      setLicenseWarning('')
    }
  }

  // --- Plate lookup ---
  async function handlePlateBlur() {
    const raw = plateInput.trim().toUpperCase()
    if (!raw) {
      setFoundTruck(null)
      setTruckNotFound(false)
      return
    }
    setPlateInput(raw)

    const { data } = await supabase
      .from('trucks')
      .select('*')
      .ilike('plate', raw)
      .limit(1)

    if (data && data.length > 0) {
      setFoundTruck(data[0])
      setTruckNotFound(false)
    } else {
      // Auto-create truck with the plate
      const { data: newTruck, error } = await supabase
        .from('trucks')
        .insert({ plate: raw, type: 'camion' })
        .select('*')
        .single()
      if (!error && newTruck) {
        setFoundTruck(newTruck)
        setTruckNotFound(false)
        toast.info(`Camion ${raw} creado automaticamente`)
      } else {
        setFoundTruck(null)
        setTruckNotFound(true)
      }
    }
  }

  // --- Create driver inline ---
  function openCreateDriver() {
    setShowCreateDriver(true)
    setNewDriverName('')
    setNewDriverBirthDate('')
    setNewDriverLicenseExpiry('')
    // Pre-select transport supplier from schedule if available
    if (schedule?.transport_supplier_id) {
      setNewDriverSupplierId(schedule.transport_supplier_id)
    } else {
      setNewDriverSupplierId('')
    }
  }

  async function handleSaveDriver(e: FormEvent) {
    e.preventDefault()
    if (!newDriverName || !rutInput) return

    const formatted = formatRut(rutInput)
    if (!validateRut(rutInput)) {
      toast.error('RUT invalido')
      return
    }

    // Validate license expiry
    if (newDriverLicenseExpiry) {
      const expiry = new Date(newDriverLicenseExpiry + 'T00:00:00')
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (expiry < today) {
        setLicenseWarning(`Licencia vencida el ${newDriverLicenseExpiry}`)
      }
    }

    setSavingDriver(true)
    const { data, error } = await supabase
      .from('drivers')
      .insert({
        rut: formatted,
        name: newDriverName,
        birth_date: newDriverBirthDate || null,
        license_expiry_date: newDriverLicenseExpiry || null,
        supplier_id: newDriverSupplierId || null,
      })
      .select('*')
      .single()

    setSavingDriver(false)

    if (error) {
      toast.error('Error al crear conductor: ' + error.message)
      return
    }

    toast.success(`Conductor ${data.name} creado`)
    setFoundDriver(data)
    setDriverNotFound(false)
    setShowCreateDriver(false)
    checkLicense(data)
  }

  // --- Submit arrival ---
  async function handleSubmit() {
    if (!foundDriver || !foundTruck) {
      toast.error('El agendamiento debe tener camion y conductor asignado')
      return
    }

    setSubmitting(true)
    try {
      await onConfirm(foundDriver.id, foundTruck.id)
      onClose()
    } catch {
      toast.error('Error al registrar')
    } finally {
      setSubmitting(false)
    }
  }

  // Determine if transport supplier select should show
  const showTransportSupplier = schedule
    ? (schedule.destination_type === 'sucursal' || schedule.destination_type === 'maquila')
    : true

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {!showCreateDriver ? (
          <div className="space-y-4">
            {/* RUT del Conductor */}
            <div className="space-y-2">
              <Label>RUT del Conductor *</Label>
              <Input
                value={rutInput}
                onChange={(e) => { setRutInput(e.target.value); setRutError(''); setFoundDriver(null); setDriverNotFound(false); setLicenseWarning('') }}
                onBlur={handleRutBlur}
                placeholder="12.345.678-9"
                autoFocus
              />
              {rutError && <p className="text-xs text-red-500">{rutError}</p>}
              {searching && <p className="text-xs text-muted-foreground">Buscando conductor...</p>}

              {foundDriver && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="text-sm font-medium text-green-800">{foundDriver.name}</p>
                  <p className="text-xs text-green-600">RUT: {formatRut(foundDriver.rut)}</p>
                  {foundDriver.supplier_id && (
                    <p className="text-xs text-green-600">Empresa asociada</p>
                  )}
                </div>
              )}

              {licenseWarning && (
                <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
                  <p className="text-sm text-yellow-700 font-medium">{licenseWarning}</p>
                </div>
              )}

              {driverNotFound && !rutError && (
                <div className="space-y-2">
                  <p className="text-xs text-orange-600">Conductor no encontrado en el sistema</p>
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={openCreateDriver}>
                    <UserPlus className="h-3 w-3" /> Crear Conductor
                  </Button>
                </div>
              )}
            </div>

            {/* Patente */}
            <div className="space-y-2">
              <Label>Patente del Camion *</Label>
              <Input
                value={plateInput}
                onChange={(e) => { setPlateInput(e.target.value.toUpperCase()); setFoundTruck(null); setTruckNotFound(false) }}
                onBlur={handlePlateBlur}
                placeholder="Ej: ABCD12"
              />
              {foundTruck && (
                <p className="text-xs text-green-600">Camion encontrado: {foundTruck.plate} ({foundTruck.type})</p>
              )}
              {truckNotFound && (
                <p className="text-xs text-orange-600">No se pudo registrar el camion</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !foundDriver || !foundTruck}
              >
                {submitting ? 'Registrando...' : 'Confirmar'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* --- Create Driver Inline Form --- */
          <form onSubmit={handleSaveDriver} className="space-y-4">
            <p className="text-sm text-muted-foreground">Crear nuevo conductor</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>RUT</Label>
                <Input value={formatRut(rutInput)} readOnly className="bg-muted" />
              </div>
              <div>
                <Label>Nombre Completo *</Label>
                <Input
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha Nacimiento</Label>
                <Input
                  type="date"
                  value={newDriverBirthDate}
                  onChange={(e) => setNewDriverBirthDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Venc. Licencia</Label>
                <Input
                  type="date"
                  value={newDriverLicenseExpiry}
                  onChange={(e) => setNewDriverLicenseExpiry(e.target.value)}
                />
              </div>
            </div>

            {showTransportSupplier && (
              <div className="space-y-2">
                <Label>Empresa de Transporte</Label>
                <Select value={newDriverSupplierId} onValueChange={setNewDriverSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {transportSuppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {licenseWarning && (
              <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-3">
                <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
                <p className="text-sm text-yellow-700 font-medium">{licenseWarning}</p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDriver(false)}>Volver</Button>
              <Button type="submit" disabled={savingDriver || !newDriverName}>
                {savingDriver ? 'Guardando...' : 'Guardar Conductor'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
