import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/types'

export interface PendingContact {
  tempId: string
  contact_name: string
  email: string
  phone: string
  observations: string
}

interface ContactsManagerProps {
  entityType: 'branch' | 'supplier' | 'client'
  entityId: string | null
  pendingContacts: PendingContact[]
  onPendingContactsChange: (contacts: PendingContact[]) => void
}

function createEmptyContact(): PendingContact {
  return {
    tempId: crypto.randomUUID(),
    contact_name: '',
    email: '',
    phone: '',
    observations: '',
  }
}

/** Auto-crea un usuario en public.users si el contacto tiene email */
async function ensureUserFromContact(contact: {
  contact_name: string
  email: string | null
  phone: string | null
}) {
  const email = contact.email?.trim()
  if (!email) return // Solo si tiene email

  // Verificar si ya existe
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) return // Ya existe, no duplicar

  await supabase.from('users').insert({
    id: crypto.randomUUID(),
    email,
    full_name: contact.contact_name || null,
    phone: contact.phone || null,
    role: 'sucursal',
  })
}

export function ContactsManager({
  entityType,
  entityId,
  pendingContacts,
  onPendingContactsChange,
}: ContactsManagerProps) {
  const [dbContacts, setDbContacts] = useState<Tables<'contacts'>[]>([])

  // Load contacts from DB when editing an existing entity
  useEffect(() => {
    if (entityId) {
      loadContacts()
    }
  }, [entityId])

  async function loadContacts() {
    if (!entityId) return
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at')
    setDbContacts(data ?? [])
  }

  // --- DB contact handlers (edit mode) ---
  async function updateDbContact(id: string, field: string, value: string) {
    const updated = dbContacts.map((c) =>
      c.id === id ? { ...c, [field]: value } : c
    )
    setDbContacts(updated)
  }

  async function saveDbContact(contact: Tables<'contacts'>) {
    await supabase
      .from('contacts')
      .update({
        contact_name: contact.contact_name,
        email: contact.email || null,
        phone: contact.phone || null,
        observations: contact.observations || null,
      })
      .eq('id', contact.id)

    // Auto-crear usuario si tiene email
    await ensureUserFromContact({
      contact_name: contact.contact_name,
      email: contact.email,
      phone: contact.phone,
    })
  }

  async function deleteDbContact(id: string) {
    await supabase.from('contacts').delete().eq('id', id)
    setDbContacts((prev) => prev.filter((c) => c.id !== id))
  }

  async function addDbContact() {
    if (!entityId) return
    const { data } = await supabase
      .from('contacts')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        contact_name: '',
      })
      .select()
      .single()
    if (data) {
      setDbContacts((prev) => [...prev, data])
    }
  }

  // --- Pending contact handlers (create mode) ---
  function addPendingContact() {
    onPendingContactsChange([...pendingContacts, createEmptyContact()])
  }

  function updatePendingContact(tempId: string, field: keyof PendingContact, value: string) {
    onPendingContactsChange(
      pendingContacts.map((c) =>
        c.tempId === tempId ? { ...c, [field]: value } : c
      )
    )
  }

  function removePendingContact(tempId: string) {
    onPendingContactsChange(pendingContacts.filter((c) => c.tempId !== tempId))
  }

  // --- Render ---
  const isEditMode = !!entityId

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b pb-1">
        <h4 className="text-sm font-semibold text-muted-foreground">Contactos</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={isEditMode ? addDbContact : addPendingContact}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Agregar Contacto
        </Button>
      </div>

      {isEditMode ? (
        dbContacts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">Sin contactos registrados</p>
        ) : (
          dbContacts.map((contact) => (
            <div key={contact.id} className="border rounded-lg p-3 space-y-2 bg-muted/20">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Nombre</Label>
                  <Input
                    value={contact.contact_name}
                    onChange={(e) => updateDbContact(contact.id, 'contact_name', e.target.value)}
                    onBlur={() => saveDbContact(contact)}
                    placeholder="Nombre del contacto"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input
                    type="email"
                    value={contact.email ?? ''}
                    onChange={(e) => updateDbContact(contact.id, 'email', e.target.value)}
                    onBlur={() => saveDbContact(contact)}
                    placeholder="correo@ejemplo.com"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Telefono</Label>
                  <Input
                    value={contact.phone ?? ''}
                    onChange={(e) => updateDbContact(contact.id, 'phone', e.target.value)}
                    onBlur={() => saveDbContact(contact)}
                    placeholder="+56 9 1234 5678"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Observaciones</Label>
                    <Input
                      value={contact.observations ?? ''}
                      onChange={(e) => updateDbContact(contact.id, 'observations', e.target.value)}
                      onBlur={() => saveDbContact(contact)}
                      placeholder="Notas..."
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => deleteDbContact(contact.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )
      ) : (
        pendingContacts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">Sin contactos agregados</p>
        ) : (
          pendingContacts.map((contact) => (
            <div key={contact.tempId} className="border rounded-lg p-3 space-y-2 bg-muted/20">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Nombre</Label>
                  <Input
                    value={contact.contact_name}
                    onChange={(e) => updatePendingContact(contact.tempId, 'contact_name', e.target.value)}
                    placeholder="Nombre del contacto"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input
                    type="email"
                    value={contact.email}
                    onChange={(e) => updatePendingContact(contact.tempId, 'email', e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Telefono</Label>
                  <Input
                    value={contact.phone}
                    onChange={(e) => updatePendingContact(contact.tempId, 'phone', e.target.value)}
                    placeholder="+56 9 1234 5678"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Observaciones</Label>
                    <Input
                      value={contact.observations}
                      onChange={(e) => updatePendingContact(contact.tempId, 'observations', e.target.value)}
                      placeholder="Notas..."
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => removePendingContact(contact.tempId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )
      )}
    </div>
  )
}

// Helper to save pending contacts after entity creation
export async function savePendingContacts(
  entityType: string,
  entityId: string,
  contacts: PendingContact[]
) {
  const rows = contacts
    .filter((c) => c.contact_name.trim() !== '')
    .map((c) => ({
      entity_type: entityType,
      entity_id: entityId,
      contact_name: c.contact_name,
      email: c.email || null,
      phone: c.phone || null,
      observations: c.observations || null,
    }))
  if (rows.length > 0) {
    await supabase.from('contacts').insert(rows)
  }

  // Auto-crear usuarios para contactos con email
  for (const contact of contacts) {
    await ensureUserFromContact({
      contact_name: contact.contact_name,
      email: contact.email || null,
      phone: contact.phone || null,
    })
  }
}
