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

type RolePermissions = {
  agendamiento: { read: boolean; write: boolean }
  patio:        { read: boolean; write: boolean }
  en_ruta:      { read: boolean; write: boolean }
  incidencias:  { read: boolean; write: boolean }
  admin:        boolean
}

const DEFAULT_PERMISSIONS: RolePermissions = {
  agendamiento: { read: false, write: false },
  patio:        { read: false, write: false },
  en_ruta:      { read: false, write: false },
  incidencias:  { read: false, write: false },
  admin:        false,
}

const MODULES: { key: keyof Omit<RolePermissions, 'admin'>; label: string }[] = [
  { key: 'agendamiento', label: 'Agendamiento' },
  { key: 'patio',        label: 'Control de Patio' },
  { key: 'en_ruta',      label: 'En Ruta' },
  { key: 'incidencias',  label: 'Incidencias' },
]

function parsePermissions(raw: unknown): RolePermissions {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PERMISSIONS }
  const p = raw as Record<string, unknown>
  return {
    agendamiento: { read: !!(p.agendamiento as Record<string,boolean>)?.read, write: !!(p.agendamiento as Record<string,boolean>)?.write },
    patio:        { read: !!(p.patio as Record<string,boolean>)?.read,        write: !!(p.patio as Record<string,boolean>)?.write },
    en_ruta:      { read: !!(p.en_ruta as Record<string,boolean>)?.read,      write: !!(p.en_ruta as Record<string,boolean>)?.write },
    incidencias:  { read: !!(p.incidencias as Record<string,boolean>)?.read,  write: !!(p.incidencias as Record<string,boolean>)?.write },
    admin:        !!(p.admin),
  }
}

export function RoleManagement() {
  const [roles, setRoles] = useState<Tables<'roles'>[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const [roleName, setRoleName] = useState('')
  const [roleDescription, setRoleDescription] = useState('')
  const [permissions, setPermissions] = useState<RolePermissions>({ ...DEFAULT_PERMISSIONS })

  async function load() {
    const { data } = await supabase.from('roles').select('*').order('name')
    setRoles(data ?? [])
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditId(null)
    setRoleName('')
    setRoleDescription('')
    setPermissions({ ...DEFAULT_PERMISSIONS })
    setShowForm(true)
  }

  function openEdit(r: Tables<'roles'>) {
    setEditId(r.id)
    setRoleName(r.name)
    setRoleDescription(r.description ?? '')
    setPermissions(parsePermissions(r.permissions))
    setShowForm(true)
  }

  function setModuleRead(key: keyof Omit<RolePermissions, 'admin'>, val: boolean) {
    setPermissions((p) => ({ ...p, [key]: { ...p[key], read: val } }))
  }

  function setModuleWrite(key: keyof Omit<RolePermissions, 'admin'>, val: boolean) {
    setPermissions((p) => ({ ...p, [key]: { ...p[key], write: val } }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!roleName.trim()) return

    const payload = {
      name: roleName.trim(),
      description: roleDescription.trim() || null,
      permissions: permissions as unknown as import('@/lib/types').Json,
    }

    if (editId) {
      await supabase.from('roles').update(payload).eq('id', editId)
    } else {
      await supabase.from('roles').insert(payload)
    }
    setShowForm(false)
    load()
  }

  async function toggleActive(r: Tables<'roles'>) {
    await supabase.from('roles').update({ is_active: !r.is_active }).eq('id', r.id)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{roles.length} roles registrados</p>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo Rol
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Nombre</th>
              <th className="text-left p-3 font-medium">Descripción</th>
              <th className="text-left p-3 font-medium">Admin</th>
              <th className="text-left p-3 font-medium">Estado</th>
              <th className="text-left p-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Sin roles registrados
                </td>
              </tr>
            ) : (
              roles.map((r) => {
                const p = parsePermissions(r.permissions)
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3 text-muted-foreground">{r.description ?? '---'}</td>
                    <td className="p-3">
                      {p.admin ? <Badge variant="default">Sí</Badge> : <Badge variant="outline">No</Badge>}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={r.is_active ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => toggleActive(r)}
                      >
                        {r.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                )
              })
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
            <DialogTitle>{editId ? 'Editar Rol' : 'Nuevo Rol'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre *</Label>
                <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} required placeholder="Ej: supervisor" />
              </div>
              <div>
                <Label>Descripción</Label>
                <Input value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} placeholder="Breve descripción" />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Permisos por Módulo</Label>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">Módulo</th>
                      <th className="text-center p-2 font-medium">Leer</th>
                      <th className="text-center p-2 font-medium">Escribir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES.map((m) => (
                      <tr key={m.key} className="border-t">
                        <td className="p-2">{m.label}</td>
                        <td className="p-2 text-center">
                          <Checkbox
                            checked={permissions[m.key].read}
                            onCheckedChange={(v) => setModuleRead(m.key, !!v)}
                          />
                        </td>
                        <td className="p-2 text-center">
                          <Checkbox
                            checked={permissions[m.key].write}
                            onCheckedChange={(v) => setModuleWrite(m.key, !!v)}
                          />
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t">
                      <td className="p-2 font-medium">Administración</td>
                      <td className="p-2 text-center" colSpan={2}>
                        <Checkbox
                          checked={permissions.admin}
                          onCheckedChange={(v) => setPermissions((p) => ({ ...p, admin: !!v }))}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={!roleName.trim()}>Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
