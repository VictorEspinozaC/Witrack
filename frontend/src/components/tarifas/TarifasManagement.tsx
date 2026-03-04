import { useEffect, useMemo, useState } from 'react'
import { Plus, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/types'

interface TarifasManagementProps {
  readOnly?: boolean
}

type TariffRow = Tables<'tariffs'>

const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'decimal',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatNumber(value: string): string {
  const num = Number(value)
  if (!value || isNaN(num)) return ''
  return clpFormatter.format(num)
}

function parseFormattedNumber(display: string): string {
  // Quitar puntos separadores de miles
  return display.replace(/\./g, '')
}

export function TarifasManagement({ readOnly }: TarifasManagementProps) {
  const [tariffs, setTariffs] = useState<TariffRow[]>([])
  const [branches, setBranches] = useState<Tables<'branches'>[]>([])
  const [transportNames, setTransportNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Edicion inline: mapa de celdas modificadas { "branchId::transport" : valor numerico string }
  const [editedCells, setEditedCells] = useState<Record<string, string>>({})

  // Celda en foco (para mostrar valor raw vs formateado)
  const [focusedCell, setFocusedCell] = useState<string | null>(null)

  // Dialog para agregar empresa de transporte
  const [showAddTransport, setShowAddTransport] = useState(false)
  const [newTransportName, setNewTransportName] = useState('')

  async function load() {
    const { data } = await supabase
      .from('tariffs')
      .select('*')
      .eq('is_active', true)
    setTariffs(data ?? [])
    setLoading(false)
  }

  async function loadBranches() {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('name')
    setBranches(data ?? [])
  }

  async function loadTransportNames() {
    const { data } = await supabase
      .from('suppliers')
      .select('name')
      .contains('types', ['transporte'])
      .eq('is_active', true)
      .order('name')
    setTransportNames(data?.map((s) => s.name) ?? [])
  }

  useEffect(() => {
    loadBranches()
    loadTransportNames()
    load()
  }, [])

  // Lista unica de empresas de transporte
  const transportCompanies = useMemo(() => {
    const set = new Set(tariffs.map((t) => t.transport_company))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [tariffs])

  // Mapa rapido: "branchId::transport" → tariff
  const tariffMap = useMemo(() => {
    const map = new Map<string, TariffRow>()
    for (const t of tariffs) {
      map.set(`${t.branch_id}::${t.transport_company}`, t)
    }
    return map
  }, [tariffs])

  function cellKey(branchId: string, transport: string) {
    return `${branchId}::${transport}`
  }

  function getCellRawValue(branchId: string, transport: string): string {
    const key = cellKey(branchId, transport)
    if (key in editedCells) return editedCells[key]
    const tariff = tariffMap.get(key)
    if (!tariff) return ''
    // Normalizar: quitar decimales ".00" para comparación limpia
    const num = Number(tariff.price)
    return isNaN(num) ? '' : String(Math.round(num))
  }

  function handleCellChange(branchId: string, transport: string, displayValue: string) {
    const key = cellKey(branchId, transport)
    const raw = parseFormattedNumber(displayValue)
    if (raw && isNaN(Number(raw))) return
    setEditedCells((prev) => ({ ...prev, [key]: raw }))
  }

  function getOriginalValue(key: string): string {
    const tariff = tariffMap.get(key)
    if (!tariff) return ''
    const num = Number(tariff.price)
    return isNaN(num) ? '' : String(Math.round(num))
  }

  function isCellDirty(branchId: string, transport: string): boolean {
    const key = cellKey(branchId, transport)
    if (!(key in editedCells)) return false
    return editedCells[key] !== getOriginalValue(key)
  }

  const hasChanges = useMemo(() => {
    return Object.keys(editedCells).some((key) => {
      return editedCells[key] !== getOriginalValue(key)
    })
  }, [editedCells, tariffMap])

  async function handleSave() {
    setSaving(true)
    const upserts: { branch_id: string; transport_company: string; price: number }[] = []
    const deleteIds: string[] = []

    for (const [key, value] of Object.entries(editedCells)) {
      const original = getOriginalValue(key)
      if (value === original) continue

      const [branchId, ...rest] = key.split('::')
      const transport = rest.join('::')

      // Si el usuario borró el valor, eliminar la tarifa
      if (value === '') {
        const tariff = tariffMap.get(key)
        if (tariff) deleteIds.push(tariff.id)
        continue
      }

      const numValue = Number(value)
      if (isNaN(numValue)) continue

      upserts.push({
        branch_id: branchId,
        transport_company: transport,
        price: numValue,
      })
    }

    if (upserts.length === 0 && deleteIds.length === 0) {
      setSaving(false)
      return
    }

    let hasError = false
    let totalChanges = 0

    // Upserts
    if (upserts.length > 0) {
      const { error } = await supabase
        .from('tariffs')
        .upsert(upserts, { onConflict: 'branch_id,transport_company' })
      if (error) {
        toast.error(`Error al guardar: ${error.message}`)
        hasError = true
      } else {
        totalChanges += upserts.length
      }
    }

    // Deletes (valores vaciados)
    if (deleteIds.length > 0 && !hasError) {
      const { error } = await supabase
        .from('tariffs')
        .delete()
        .in('id', deleteIds)
      if (error) {
        toast.error(`Error al eliminar: ${error.message}`)
        hasError = true
      } else {
        totalChanges += deleteIds.length
      }
    }

    if (!hasError && totalChanges > 0) {
      toast.success(`${totalChanges} tarifa${totalChanges > 1 ? 's' : ''} actualizada${totalChanges > 1 ? 's' : ''}`)
    }

    setEditedCells({})
    setSaving(false)
    load()
  }

  function handleDiscard() {
    setEditedCells({})
  }

  async function handleAddTransport() {
    const name = newTransportName.trim()
    if (!name) return

    if (transportCompanies.includes(name)) {
      toast.error('Esta empresa de transporte ya existe en la tabla.')
      return
    }

    if (branches.length === 0) return

    const { error } = await supabase.from('tariffs').insert({
      branch_id: branches[0].id,
      transport_company: name,
      price: 0,
    })

    if (error) {
      toast.error(`Error: ${error.message}`)
      return
    }

    toast.success(`Empresa "${name}" agregada`)
    setShowAddTransport(false)
    setNewTransportName('')
    load()
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Barra de acciones */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {branches.length} sucursales &times; {transportCompanies.length} empresas de transporte
        </p>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <>
              <Button variant="outline" size="sm" onClick={handleDiscard} className="gap-1">
                <X className="h-4 w-4" /> Descartar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
                <Save className="h-4 w-4" /> Guardar Cambios
              </Button>
            </>
          )}
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={() => setShowAddTransport(true)} className="gap-1">
              <Plus className="h-4 w-4" /> Agregar Transporte
            </Button>
          )}
        </div>
      </div>

      {/* Tabla de doble entrada: Sucursales (filas) x Transportes (columnas) */}
      {transportCompanies.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          Sin tarifas registradas. Agrega una empresa de transporte para comenzar.
        </div>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0 z-20">
              <tr>
                <th className="text-left p-3 font-semibold whitespace-nowrap border-r bg-muted/50 sticky left-0 z-30 min-w-[180px]">
                  Sucursal
                </th>
                {transportCompanies.map((transport) => (
                  <th key={transport} className="text-center p-3 font-medium whitespace-nowrap min-w-[140px]">
                    {transport}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <tr key={branch.id} className="border-t hover:bg-muted/20">
                  <td className="p-3 font-medium whitespace-nowrap border-r bg-background sticky left-0 z-10">
                    {branch.name}
                  </td>
                  {transportCompanies.map((transport) => {
                    const key = cellKey(branch.id, transport)
                    const raw = getCellRawValue(branch.id, transport)
                    const dirty = isCellDirty(branch.id, transport)
                    const isFocused = focusedCell === key

                    return (
                      <td key={transport} className="p-1.5 text-center">
                        {readOnly ? (
                          <span className="font-mono text-sm">
                            {raw ? formatNumber(raw) : '---'}
                          </span>
                        ) : (
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={isFocused ? raw : (raw ? formatNumber(raw) : '')}
                            onChange={(e) => handleCellChange(branch.id, transport, e.target.value)}
                            onFocus={() => setFocusedCell(key)}
                            onBlur={() => setFocusedCell(null)}
                            className={`text-center font-mono h-8 text-sm ${dirty ? 'border-amber-400 bg-amber-50' : ''}`}
                            placeholder="---"
                          />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasChanges && (
        <p className="text-xs text-amber-600">
          Hay cambios sin guardar. Las celdas marcadas en amarillo han sido modificadas.
        </p>
      )}

      {/* Dialog agregar empresa de transporte */}
      <Dialog open={showAddTransport} onOpenChange={setShowAddTransport}>
        <DialogContent className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Agregar Empresa de Transporte</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={newTransportName}
                onChange={(e) => setNewTransportName(e.target.value)}
                placeholder="Nombre de la empresa"
                list="transport-suggestions"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTransport() } }}
              />
              <datalist id="transport-suggestions">
                {transportNames
                  .filter((n) => !transportCompanies.includes(n))
                  .map((name) => (
                    <option key={name} value={name} />
                  ))}
              </datalist>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTransport(false)}>Cancelar</Button>
            <Button onClick={handleAddTransport} disabled={!newTransportName.trim()}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
