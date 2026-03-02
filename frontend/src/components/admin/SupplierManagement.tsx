import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/types'
import { AddressFields } from './AddressFields'
import { ContactsManager, savePendingContacts, type PendingContact } from './ContactsManager'
import { formatRut, validateRut } from '@/lib/rut'

const SUPPLIER_TYPES = [
  { value: 'comercializacion', label: 'Comercializacion' },
  { value: 'compra_local', label: 'Compra Local' },
  { value: 'importacion', label: 'Importacion' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'activo_fijo', label: 'Activo Fijo' },
  { value: 'maquila', label: 'Maquila' },
  { value: 'transporte', label: 'Transporte' },
]

export function SupplierManagement() {
  const [suppliers, setSuppliers] = useState<Tables<'suppliers'>[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Form fields
  const [name, setName] = useState('')
  const [rut, setRut] = useState('')
  const [rutError, setRutError] = useState('')
  const [types, setTypes] = useState<string[]>([])
  // Address fields
  const [region, setRegion] = useState('')
  const [comuna, setComuna] = useState('')
  const [street, setStreet] = useState('')
  const [streetNumber, setStreetNumber] = useState('')
  const [addressNotes, setAddressNotes] = useState('')
  // Contacts
  const [pendingContacts, setPendingContacts] = useState<PendingContact[]>([])

  async function load() {
    const { data } = await supabase.from('suppliers').select('*').order('name')
    setSuppliers(data ?? [])
  }

  useEffect(() => { load() }, [])

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

  function toggleType(value: string) {
    setTypes((prev) =>
      prev.includes(value)
        ? prev.filter((t) => t !== value)
        : [...prev, value]
    )
  }

  function openEdit(s: Tables<'suppliers'>) {
    setEditId(s.id)
    setName(s.name)
    setRut(s.rut ?? '')
    setTypes(s.types ?? [])
    setRegion(s.region ?? '')
    setComuna(s.comuna ?? '')
    setStreet(s.street ?? '')
    setStreetNumber(s.street_number ?? '')
    setAddressNotes(s.address_notes ?? '')
    setPendingContacts([])
    setRutError('')
    setShowForm(true)
  }

  function openNew() {
    setEditId(null)
    setName('')
    setRut('')
    setTypes([])
    setRegion('')
    setComuna('')
    setStreet('')
    setStreetNumber('')
    setAddressNotes('')
    setPendingContacts([])
    setRutError('')
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name || types.length === 0) return

    // Validar RUT solo si se ingreso
    if (rut.trim() && !validateRut(rut)) {
      setRutError('RUT invalido')
      return
    }

    const payload = {
      name,
      rut: rut.trim() ? formatRut(rut) : null,
      types,
      region: region || null,
      comuna: comuna || null,
      street: street || null,
      street_number: streetNumber || null,
      address_notes: addressNotes || null,
    }

    if (editId) {
      await supabase.from('suppliers').update(payload).eq('id', editId)
    } else {
      const { data } = await supabase.from('suppliers').insert(payload).select().single()
      if (data) {
        await savePendingContacts('supplier', data.id, pendingContacts)
      }
    }
    setShowForm(false)
    load()
  }

  async function toggleActive(s: Tables<'suppliers'>) {
    await supabase.from('suppliers').update({ is_active: !s.is_active }).eq('id', s.id)
    load()
  }

  const typeLabel = (val: string) => SUPPLIER_TYPES.find((t) => t.value === val)?.label ?? val

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{suppliers.length} proveedores registrados</p>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo Proveedor
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Razon Social</th>
              <th className="text-left p-3 font-medium">RUT</th>
              <th className="text-left p-3 font-medium">Tipos</th>
              <th className="text-left p-3 font-medium">Region</th>
              <th className="text-left p-3 font-medium">Estado</th>
              <th className="text-left p-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Sin proveedores registrados
                </td>
              </tr>
            ) : (
              suppliers.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3">{s.rut ? formatRut(s.rut) : '---'}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {(s.types ?? []).map((t) => (
                        <Badge key={t} variant="outline" className="text-xs">{typeLabel(t)}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{s.region ?? '-'}</td>
                  <td className="p-3">
                    <Badge
                      variant={s.is_active ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => toggleActive(s)}
                    >
                      {s.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
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
          className="sm:max-w-2xl max-h-[85vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>RUT</Label>
                <Input
                  value={rut}
                  onChange={(e) => { setRut(e.target.value); setRutError('') }}
                  onBlur={handleRutBlur}
                  placeholder="12.345.678-9"
                />
                {rutError && <p className="text-xs text-red-500 mt-1">{rutError}</p>}
              </div>
              <div>
                <Label>Razon Social *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej: Proveedor ABC Ltda." />
              </div>
            </div>

            <div>
              <Label>Tipo Proveedor * (seleccione uno o mas)</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {SUPPLIER_TYPES.map((t) => (
                  <label key={t.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={types.includes(t.value)}
                      onCheckedChange={() => toggleType(t.value)}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
              {types.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Seleccione al menos un tipo</p>
              )}
            </div>

            <AddressFields
              region={region} onRegionChange={setRegion}
              comuna={comuna} onComunaChange={setComuna}
              street={street} onStreetChange={setStreet}
              streetNumber={streetNumber} onStreetNumberChange={setStreetNumber}
              addressNotes={addressNotes} onAddressNotesChange={setAddressNotes}
            />

            <ContactsManager
              entityType="supplier"
              entityId={editId}
              pendingContacts={pendingContacts}
              onPendingContactsChange={setPendingContacts}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={!name || types.length === 0 || !!rutError}>Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
