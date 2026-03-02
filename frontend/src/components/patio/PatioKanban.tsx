import { useState, useEffect, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { KanbanColumn } from './KanbanColumn'
import { TruckDetailPanel } from './TruckDetailPanel'
import { CreateShipmentDialog } from './CreateShipmentDialog'
import { StateTransitionModal } from '@/components/shared/StateTransitionModal'
import { useShipments, type ShipmentWithRelations } from '@/hooks/useShipments'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { SHIPMENT_STATES } from '@/lib/constants'

const ACTIVE_STATES = SHIPMENT_STATES.filter((s) => s !== 'en_ruta' && s !== 'en_recepcion')

export function PatioKanban() {
  const { shipments, loading, createShipment, transitionStatus } = useShipments()
  const { user } = useAuth()
  const [selectedShipment, setSelectedShipment] = useState<ShipmentWithRelations | null>(null)
  const [transitionShipment, setTransitionShipment] = useState<ShipmentWithRelations | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [ramps, setRamps] = useState<string[]>(['Rampa 1', 'Rampa 2', 'Rampa 3'])

  useEffect(() => {
    if (!user?.branch_id) return
    supabase
      .from('yard_config')
      .select('ramps')
      .eq('branch_id', user.branch_id)
      .limit(1)
      .then(({ data }) => {
        const row = data?.[0]
        if (row?.ramps && Array.isArray(row.ramps)) {
          setRamps(row.ramps as string[])
        }
      })
  }, [user?.branch_id])

  const grouped = useMemo(() => {
    const map: Record<string, ShipmentWithRelations[]> = {}
    for (const s of ACTIVE_STATES) map[s] = []
    for (const s of shipments) {
      if (map[s.status]) map[s.status].push(s)
    }
    return map
  }, [shipments])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {shipments.length} camion{shipments.length !== 1 ? 'es' : ''} en patio
        </p>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Registrar Camion
        </Button>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4" style={{ minHeight: '60vh' }}>
          {ACTIVE_STATES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              shipments={grouped[status]}
              onTransition={setTransitionShipment}
              onCardClick={setSelectedShipment}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <TruckDetailPanel
        shipment={selectedShipment}
        open={!!selectedShipment}
        onClose={() => setSelectedShipment(null)}
      />

      <StateTransitionModal
        shipment={transitionShipment}
        ramps={ramps}
        open={!!transitionShipment}
        onClose={() => setTransitionShipment(null)}
        onConfirm={async (id, newStatus, extra) => {
          await transitionStatus(id, newStatus, extra)
        }}
      />

      <CreateShipmentDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={createShipment}
      />
    </>
  )
}
