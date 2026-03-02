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
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/types'

type TruckWithSupplier = Tables<'trucks'> & {
  supplier?: { id: string; name: string } | null
}

export function TruckManagement() {
  const [trucks, setTrucks] = useState<TruckWithSupplier[]>([])
  const [transportSuppliers, setTransportSuppliers] = useState<Tables<'suppliers'>[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Form fields
  const [plate, setPlate] = useState('')
  const [type, setType] = useState('Rampla')
  const [supplierId, setSupplierId] = useState('')
  const [observations, setObservations] = useState('')

  async function load() {
    const { data } = await supabase
      .from('trucks')
      .select('*, supplier:suppliers!trucks_supplier_id_fkey(id, name)')
      .order('plate')
    setTrucks((data as TruckWithSupplier[]) ?? [])
  }

  async function loadSuppliers() {
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .contains('types', ['transporte'])
      .eq('is_active', true)
      .order('name')
    setTransportSuppliers(data ?? [])
  }

  useEffect(() => {
    load()
    loadSuppliers()
  }, [])

  function openEdit(t: TruckWithSupplier) {
    setEditId(t.id)
    setPlate(t.plate)
    setType(t.type)
    setSupplierId(t.supplier_id ?? '')
    setObservations(t.observations ?? '')
    setShowForm(true)
  }

  function openNew() {
    setEditId(null)
    setPlate('')
    setType('Rampla')
    setSupplierId('')
    setObservations('')
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!plate || !type) return

    const payload = {
      plate,
      type,
      supplier_id: supplierId || null,
      observations: observations || null,
    }

    if (editId) {
      await supabase.from('trucks').update(payload).eq('id', editId)
    } else {
      await supabase.from('trucks').insert(payload)
    }
    setShowForm(false)
    load()
  }

  async function toggleActive(t: Tables<'trucks'>) {
    await supabase.from('trucks').update({ is_active: !t.is_active }).eq('id', t.id)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{trucks.length} camiones registrados</p>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo Camion
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Patente</th>
              <th className="text-left p-3 font-medium">Tipo</th>
              <th className="text-left p-3 font-medium">Proveedor Transporte</th>
              <th className="text-left p-3 font-medium">Estado</th>
              <th className="text-left p-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {trucks.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Sin camiones registrados
                </td>
              </tr>
            ) : (
              trucks.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-3 font-bold">{t.plate}</td>
                  <td className="p-3">{t.type}</td>
                  <td className="p-3 text-muted-foreground">
                    {t.supplier?.name ?? t.transport_company ?? '---'}
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={t.is_active ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => toggleActive(t)}
                    >
                      {t.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
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
            <DialogTitle>{editId ? 'Editar Camion' : 'Nuevo Camion'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Patente *</Label>
                <Input
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  placeholder="AA-BB-11"
                  required
                />
              </div>
              <div>
                <Label>Tipo *</Label>
                <Input
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="Ej: Rampla"
                  required
                />
              </div>
            </div>

            <div>
              <Label>Proveedor de Transporte</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proveedor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Sin proveedor --</SelectItem>
                  {transportSuppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Button type="submit" disabled={!plate || !type}>Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
