import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/types'
import { formatRut, validateRut } from '@/lib/rut'

export function DriverManagement() {
  const [drivers, setDrivers] = useState<(Tables<'drivers'> & { supplier?: Tables<'suppliers'> | null })[]>([])
  const [suppliers, setSuppliers] = useState<Tables<'suppliers'>[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Form fields
  const [rut, setRut] = useState('')
  const [rutError, setRutError] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [licenseExpiry, setLicenseExpiry] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [observations, setObservations] = useState('')

  async function load() {
    const { data } = await supabase
      .from('drivers')
      .select('*, supplier:suppliers(*)')
      .order('name')
    setDrivers(data ?? [])
  }

  async function loadSuppliers() {
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .contains('types', ['transporte'])
      .eq('is_active', true)
      .order('name')
    setSuppliers(data ?? [])
  }

  useEffect(() => { load(); loadSuppliers() }, [])

  function handleRutBlur() {
    if (!rut.trim()) {
      setRutError('')
      return
    }
    const formatted = formatRut(rut)
    setRut(formatted)
    if (!validateRut(rut)) {
      setRutError('RUT invalido')
    } else {
      setRutError('')
    }
  }

  function openEdit(d: Tables<'drivers'>) {
    setEditId(d.id)
    setRut(d.rut)
    setName(d.name)
    setPhone(d.phone ?? '')
    setBirthDate(d.birth_date ?? '')
    setLicenseExpiry(d.license_expiry_date ?? '')
    setSupplierId(d.supplier_id ?? '')
    setObservations(d.observations ?? '')
    setRutError('')
    setShowForm(true)
  }

  function openNew() {
    setEditId(null)
    setRut('')
    setName('')
    setPhone('')
    setBirthDate('')
    setLicenseExpiry('')
    setSupplierId('')
    setObservations('')
    setRutError('')
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name || !rut) return

    // Validar RUT antes de guardar (requerido para conductores)
    if (!validateRut(rut)) {
      setRutError('RUT invalido')
      return
    }

    const payload = {
      name,
      rut: formatRut(rut),
      phone: phone || null,
      birth_date: birthDate || null,
      license_expiry_date: licenseExpiry || null,
      supplier_id: supplierId || null,
      observations: observations || null,
    }

    if (editId) {
      await supabase.from('drivers').update(payload).eq('id', editId)
    } else {
      await supabase.from('drivers').insert(payload)
    }
    setShowForm(false)
    load()
  }

  async function toggleActive(d: Tables<'drivers'>) {
    await supabase.from('drivers').update({ is_active: !d.is_active }).eq('id', d.id)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{drivers.length} conductores registrados</p>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo Conductor
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">RUT</th>
              <th className="text-left p-3 font-medium">Nombre</th>
              <th className="text-left p-3 font-medium">Empresa Transporte</th>
              <th className="text-left p-3 font-medium">Telefono</th>
              <th className="text-left p-3 font-medium">Venc. Licencia</th>
              <th className="text-left p-3 font-medium">Estado</th>
              <th className="text-left p-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {drivers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Sin conductores registrados
                </td>
              </tr>
            ) : (
              drivers.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="p-3 font-mono text-xs">{formatRut(d.rut)}</td>
                  <td className="p-3 font-medium">{d.name}</td>
                  <td className="p-3 text-xs">{(d as any).supplier?.name ?? '---'}</td>
                  <td className="p-3">{d.phone ?? '---'}</td>
                  <td className="p-3">{d.license_expiry_date ?? '---'}</td>
                  <td className="p-3">
                    <Badge
                      variant={d.is_active ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => toggleActive(d)}
                    >
                      {d.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent
          className="sm:max-w-lg"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Conductor' : 'Nuevo Conductor'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>RUT *</Label>
                <Input
                  value={rut}
                  onChange={(e) => { setRut(e.target.value); setRutError('') }}
                  onBlur={handleRutBlur}
                  placeholder="12.345.678-9"
                  required
                />
                {rutError && <p className="text-xs text-red-500 mt-1">{rutError}</p>}
              </div>
              <div>
                <Label>Nombre Completo *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha Nacimiento</Label>
                <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </div>
              <div>
                <Label>Vencimiento Licencia</Label>
                <Input type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefono</Label>
                <PhoneInput value={phone} onChange={setPhone} />
              </div>
              <div>
                <Label>Empresa de Transporte</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Observaciones</Label>
              <Input
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Notas adicionales..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={!name || !rut || !!rutError}>Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
