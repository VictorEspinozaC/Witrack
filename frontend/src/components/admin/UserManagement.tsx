import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { PhoneInput } from '@/components/ui/PhoneInput'
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
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/types'

type UserWithBranch = Tables<'users'> & {
  branch?: { id: string; name: string } | null
}

export function UserManagement() {
  const [users, setUsers] = useState<UserWithBranch[]>([])
  const [branches, setBranches] = useState<Tables<'branches'>[]>([])
  const [dbRoles, setDbRoles] = useState<Tables<'roles'>[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Form fields
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('sucursal')
  const [branchId, setBranchId] = useState('')
  const [phone, setPhone] = useState('')

  async function load() {
    const { data } = await supabase
      .from('users')
      .select('*, branch:branches!users_branch_id_fkey(id, name)')
      .order('full_name')
    setUsers((data as UserWithBranch[]) ?? [])
  }

  async function loadBranches() {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('name')
    setBranches(data ?? [])
  }

  async function loadRoles() {
    const { data } = await supabase
      .from('roles')
      .select('*')
      .eq('is_active', true)
      .order('name')
    setDbRoles(data ?? [])
  }

  useEffect(() => {
    load()
    loadBranches()
    loadRoles()
  }, [])

  function openEdit(u: UserWithBranch) {
    setEditId(u.id)
    setEmail(u.email)
    setFullName(u.full_name ?? '')
    setRole(u.role)
    setBranchId(u.branch_id ?? '')
    setPhone(u.phone ?? '')
    setShowForm(true)
  }

  function openNew() {
    setEditId(null)
    setEmail('')
    setFullName('')
    setRole('sucursal')
    setBranchId('')
    setPhone('')
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email) return

    const payload = {
      email,
      full_name: fullName || null,
      role,
      branch_id: branchId || null,
      phone: phone || null,
    }

    if (editId) {
      await supabase.from('users').update(payload).eq('id', editId)
    } else {
      // Crear usuario sin cuenta auth (ID temporal)
      await supabase.from('users').insert({
        ...payload,
        id: crypto.randomUUID(),
      })
    }
    setShowForm(false)
    load()
  }

  async function toggleActive(u: Tables<'users'>) {
    await supabase.from('users').update({ is_active: !u.is_active }).eq('id', u.id)
    load()
  }

  const roleLabel = (val: string) => dbRoles.find((r) => r.name === val)?.name ?? val

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{users.length} usuarios registrados</p>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo Usuario
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Email</th>
              <th className="text-left p-3 font-medium">Nombre</th>
              <th className="text-left p-3 font-medium">Rol</th>
              <th className="text-left p-3 font-medium">Sucursal</th>
              <th className="text-left p-3 font-medium">Telefono</th>
              <th className="text-left p-3 font-medium">Estado</th>
              <th className="text-left p-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Sin usuarios registrados
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-3">{u.email}</td>
                  <td className="p-3 font-medium">{u.full_name ?? '---'}</td>
                  <td className="p-3">
                    <Badge variant="outline">{roleLabel(u.role)}</Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{u.branch?.name ?? '---'}</td>
                  <td className="p-3">{u.phone ?? '---'}</td>
                  <td className="p-3">
                    <Badge
                      variant={u.is_active ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => toggleActive(u)}
                    >
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
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
            <DialogTitle>{editId ? 'Editar Usuario' : 'Nuevo Usuario'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  required
                  disabled={!!editId}
                />
              </div>
              <div>
                <Label>Nombre Completo</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nombre y Apellido"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Rol *</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dbRoles.map((r) => (
                      <SelectItem key={r.id} value={r.name}>
                        {r.name}{r.description ? ` - ${r.description}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sucursal</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar sucursal..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Sin sucursal --</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Telefono</Label>
              <PhoneInput value={phone} onChange={setPhone} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={!email}>Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
