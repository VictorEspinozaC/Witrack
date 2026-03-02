import { useState, useEffect, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
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

export function BranchManagement() {
  const [branches, setBranches] = useState<Tables<'branches'>[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Form fields
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [region, setRegion] = useState('')
  const [comuna, setComuna] = useState('')
  const [street, setStreet] = useState('')
  const [streetNumber, setStreetNumber] = useState('')
  const [addressNotes, setAddressNotes] = useState('')
  const [pendingContacts, setPendingContacts] = useState<PendingContact[]>([])

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .order('name')
    setBranches(data ?? [])
  }

  function openNew() {
    setEditId(null)
    setCode('')
    setName('')
    setRegion('')
    setComuna('')
    setStreet('')
    setStreetNumber('')
    setAddressNotes('')
    setPendingContacts([])
    setShowForm(true)
  }

  function openEdit(b: Tables<'branches'>) {
    setEditId(b.id)
    setCode(b.code)
    setName(b.name)
    setRegion(b.region ?? '')
    setComuna(b.comuna ?? '')
    setStreet(b.street ?? '')
    setStreetNumber(b.street_number ?? '')
    setAddressNotes(b.address_notes ?? '')
    setPendingContacts([])
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const payload = {
      code,
      name,
      region: region || null,
      comuna: comuna || null,
      street: street || null,
      street_number: streetNumber || null,
      address_notes: addressNotes || null,
    }

    if (editId) {
      await supabase.from('branches').update(payload).eq('id', editId)
    } else {
      const { data } = await supabase.from('branches').insert(payload).select().single()
      if (data) {
        await savePendingContacts('branch', data.id, pendingContacts)
      }
    }
    setShowForm(false)
    load()
  }

  async function toggleActive(b: Tables<'branches'>) {
    await supabase.from('branches').update({ is_active: !b.is_active }).eq('id', b.id)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{branches.length} sucursales registradas</p>
        <Button onClick={openNew}>+ Nueva Sucursal</Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Codigo</th>
              <th className="text-left p-3 font-medium">Nombre</th>
              <th className="text-left p-3 font-medium">Region</th>
              <th className="text-left p-3 font-medium">Comuna</th>
              <th className="text-left p-3 font-medium">Estado</th>
              <th className="text-left p-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {branches.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Sin sucursales registradas
                </td>
              </tr>
            ) : (
              branches.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="p-3 font-mono text-xs">{b.code}</td>
                  <td className="p-3">{b.name}</td>
                  <td className="p-3 text-muted-foreground">{b.region ?? '-'}</td>
                  <td className="p-3 text-muted-foreground">{b.comuna ?? '-'}</td>
                  <td className="p-3">
                    <Badge
                      variant={b.is_active ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => toggleActive(b)}
                    >
                      {b.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(b)}>
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
            <DialogTitle>{editId ? 'Editar Sucursal' : 'Nueva Sucursal'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Codigo Sucursal *</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="Ej: SUC-001" />
              </div>
              <div>
                <Label>Nombre Sucursal *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej: Sucursal Central" />
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
              entityType="branch"
              entityId={editId}
              pendingContacts={pendingContacts}
              onPendingContactsChange={setPendingContacts}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
