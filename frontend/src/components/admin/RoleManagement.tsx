import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Copy } from 'lucide-react'
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
import {
  type RolePermissions,
  type PermissionModule,
  DEFAULT_PERMISSIONS,
  MODULE_CONFIG,
  parsePermissions,
} from '@/lib/permissions'

const MODULES = Object.entries(MODULE_CONFIG) as [PermissionModule, { label: string; route: string }][]

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

  function openDuplicate(r: Tables<'roles'>) {
    setEditId(null)
    setRoleName(r.name + '_copia')
    setRoleDescription(r.description ?? '')
    setPermissions(parsePermissions(r.permissions))
    setShowForm(true)
  }

  function setModuleRead(key: PermissionModule, val: boolean) {
    setPermissions((p) => ({
      ...p,
      [key]: { ...p[key], read: val, write: val ? p[key].write : false },
    }))
  }

  function setModuleWrite(key: PermissionModule, val: boolean) {
    setPermissions((p) => ({
      ...p,
      [key]: { read: val ? true : p[key].read, write: val },
    }))
  }

  function setAllRead(val: boolean) {
    setPermissions((p) => {
      const next = { ...p }
      for (const [key] of MODULES) {
        next[key] = { read: val, write: val ? p[key].write : false }
      }
      return next
    })
  }

  function setAllWrite(val: boolean) {
    setPermissions((p) => {
      const next = { ...p }
      for (const [key] of MODULES) {
        next[key] = { read: val ? true : p[key].read, write: val }
      }
      return next
    })
  }

  const allRead = MODULES.every(([key]) => permissions[key].read)
  const allWrite = MODULES.every(([key]) => permissions[key].write)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!roleName.trim()) return

    const payload = {
      name: roleName.trim().toLowerCase(),
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
              <th className="text-left p-3 font-medium">Descripcion</th>
              <th className="text-left p-3 font-medium">Permisos</th>
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
                    <td className="p-3">
                      <span className="font-medium">{r.name}</span>
                      {p.admin && <Badge variant="default" className="ml-2 text-[10px]">Admin</Badge>}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">{r.description ?? '---'}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {MODULES.map(([key, { label }]) => {
                          const mod = p[key]
                          if (!mod.read && !mod.write) return null
                          return (
                            <Badge
                              key={key}
                              variant="outline"
                              className={`text-[10px] ${mod.write ? 'border-primary/40 bg-primary/5' : 'border-muted-foreground/30'}`}
                            >
                              {label.length > 12 ? label.slice(0, 10) + '..' : label}
                              <span className="ml-0.5 opacity-60">{mod.write ? 'RW' : 'R'}</span>
                            </Badge>
                          )
                        })}
                        {MODULES.every(([key]) => !p[key].read && !p[key].write) && !p.admin && (
                          <span className="text-xs text-muted-foreground">Sin permisos</span>
                        )}
                      </div>
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
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openDuplicate(r)} title="Duplicar">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
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
                <Label>Descripcion</Label>
                <Input value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} placeholder="Breve descripcion" />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Permisos por Modulo</Label>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">Modulo</th>
                      <th className="text-center p-2 font-medium">
                        <div className="flex flex-col items-center gap-1">
                          <span>Leer</span>
                          <Checkbox
                            checked={allRead}
                            onCheckedChange={(v) => setAllRead(!!v)}
                            className="h-3 w-3"
                          />
                        </div>
                      </th>
                      <th className="text-center p-2 font-medium">
                        <div className="flex flex-col items-center gap-1">
                          <span>Escribir</span>
                          <Checkbox
                            checked={allWrite}
                            onCheckedChange={(v) => setAllWrite(!!v)}
                            className="h-3 w-3"
                          />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES.map(([key, { label }]) => (
                      <tr key={key} className="border-t">
                        <td className="p-2">{label}</td>
                        <td className="p-2 text-center">
                          <Checkbox
                            checked={permissions[key].read}
                            onCheckedChange={(v) => setModuleRead(key, !!v)}
                          />
                        </td>
                        <td className="p-2 text-center">
                          <Checkbox
                            checked={permissions[key].write}
                            onCheckedChange={(v) => setModuleWrite(key, !!v)}
                          />
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t bg-muted/30">
                      <td className="p-2 font-medium">Administracion (acceso total)</td>
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
              {permissions.admin && (
                <p className="text-xs text-amber-600 mt-1">El permiso de administracion otorga acceso total a todos los modulos.</p>
              )}
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
