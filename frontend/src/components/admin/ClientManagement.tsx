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
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/types'
import { AddressFields } from './AddressFields'
import { ContactsManager, savePendingContacts, type PendingContact } from './ContactsManager'
import { formatRut, validateRut } from '@/lib/rut'

export function ClientManagement() {
  const [clients, setClients] = useState<Tables<'clients'>[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Form fields
  const [name, setName] = useState('')
  const [rut, setRut] = useState('')
  const [rutError, setRutError] = useState('')
  // Address fields
  const [region, setRegion] = useState('')
  const [comuna, setComuna] = useState('')
  const [street, setStreet] = useState('')
  const [streetNumber, setStreetNumber] = useState('')
  const [addressNotes, setAddressNotes] = useState('')
  // Contacts
  const [pendingContacts, setPendingContacts] = useState<PendingContact[]>([])

  async function load() {
    const { data } = await supabase.from('clients').select('*').order('name')
    setClients(data ?? [])
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

  function openEdit(c: Tables<'clients'>) {
    setEditId(c.id)
    setName(c.name)
    setRut(c.rut ?? '')
    setRegion(c.region ?? '')
    setComuna(c.comuna ?? '')
    setStreet(c.street ?? '')
    setStreetNumber(c.street_number ?? '')
    setAddressNotes(c.address_notes ?? '')
    setPendingContacts([])
    setRutError('')
    setShowForm(true)
  }

  function openNew() {
    setEditId(null)
    setName('')
    setRut('')
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
    if (!name) return

    // Validar RUT solo si se ingreso
    if (rut.trim() && !validateRut(rut)) {
      setRutError('RUT invalido')
      return
    }

    const payload = {
      name,
      rut: rut.trim() ? formatRut(rut) : null,
      region: region || null,
      comuna: comuna || null,
      street: street || null,
      street_number: streetNumber || null,
      address_notes: addressNotes || null,
    }

    if (editId) {
      await supabase.from('clients').update(payload).eq('id', editId)
    } else {
      const { data } = await supabase.from('clients').insert(payload).select().single()
      if (data) {
        await savePendingContacts('client', data.id, pendingContacts)
      }
    }
    setShowForm(false)
    load()
  }

  async function toggleActive(c: Tables<'clients'>) {
    await supabase.from('clients').update({ is_active: !c.is_active }).eq('id', c.id)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{clients.length} clientes registrados</p>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo Cliente
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Razon Social</th>
              <th className="text-left p-3 font-medium">RUT</th>
              <th className="text-left p-3 font-medium">Region</th>
              <th className="text-left p-3 font-medium">Estado</th>
              <th className="text-left p-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Sin clientes registrados
                </td>
              </tr>
            ) : (
              clients.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3">{c.rut ? formatRut(c.rut) : '---'}</td>
                  <td className="p-3 text-muted-foreground">{c.region ?? '-'}</td>
                  <td className="p-3">
                    <Badge
                      variant={c.is_active ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => toggleActive(c)}
                    >
                      {c.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
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
            <DialogTitle>{editId ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
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
                <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej: Cliente XYZ S.A." />
              </div>
            </div>

            <AddressFields
              region={region} onRegionChange={setRegion}
              comuna={comuna} onComunaChange={setComuna}
              street={street} onStreetChange={setStreet}
              streetNumber={streetNumber} onStreetNumberChange={setStreetNumber}
              addressNotes={addressNotes} onAddressNotesChange={setAddressNotes}
            />

            <ContactsManager
              entityType="client"
              entityId={editId}
              pendingContacts={pendingContacts}
              onPendingContactsChange={setPendingContacts}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={!name || !!rutError}>Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
