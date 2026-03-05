import { useState, useEffect, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { Plus, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { KanbanColumn } from './KanbanColumn'
import { ScheduleColumn } from './ScheduleColumn'
import { TruckDetailPanel } from './TruckDetailPanel'
import { CreateShipmentDialog } from './CreateShipmentDialog'
import { StateTransitionModal } from '@/components/shared/StateTransitionModal'
import { useShipments, type ShipmentWithRelations } from '@/hooks/useShipments'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { SHIPMENT_STATES } from '@/lib/constants'
import type { ScheduleWithRelations } from '@/hooks/useSchedules'

// Columnas de shipments: sin 'agendado' (esos vienen de schedules) ni terminales
const SHIPMENT_COLUMNS = SHIPMENT_STATES.filter(
  (s) => s !== 'agendado' && s !== 'en_ruta' && s !== 'en_recepcion'
)

const SCHEDULE_SELECT = `
  *,
  truck:trucks(*),
  driver:drivers(*),
  destination_branch:branches!schedules_destination_branch_id_fkey(*),
  transport_supplier:suppliers!schedules_transport_supplier_id_fkey(*),
  supplier:suppliers!schedules_supplier_id_fkey(*),
  maquila_supplier:suppliers!schedules_maquila_supplier_id_fkey(*),
  client:clients!schedules_client_id_fkey(*)
`

export function PatioKanban() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [dateFilter, setDateFilter] = useState(today)

  const { shipments, loading, createShipment, transitionStatus } = useShipments({ dateFilter })
  const { user } = useAuth()
  const [selectedShipment, setSelectedShipment] = useState<ShipmentWithRelations | null>(null)
  const [transitionShipment, setTransitionShipment] = useState<ShipmentWithRelations | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [ramps, setRamps] = useState<string[]>(['Rampa 1', 'Rampa 2', 'Rampa 3'])

  // Schedules pendientes del dia seleccionado
  const [pendingSchedules, setPendingSchedules] = useState<ScheduleWithRelations[]>([])
  const [schedulesLoading, setSchedulesLoading] = useState(true)

  // Fetch ramps config
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

  // Fetch pending schedules for selected date
  const fetchSchedules = useCallback(async () => {
    setSchedulesLoading(true)
    let query = supabase
      .from('schedules')
      .select(SCHEDULE_SELECT)
      .eq('scheduled_date', dateFilter)
      .eq('status', 'pending')
      .order('scheduled_time', { ascending: true })

    if (user?.branch_id) {
      query = query.eq('branch_id', user.branch_id)
    }

    const { data } = await query
    setPendingSchedules((data ?? []) as unknown as ScheduleWithRelations[])
    setSchedulesLoading(false)
  }, [dateFilter, user?.branch_id])

  useEffect(() => {
    fetchSchedules()

    // Realtime para schedules
    const channel = supabase
      .channel(`schedules-patio:${user?.branch_id ?? 'all'}:${dateFilter}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules' },
        () => fetchSchedules()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchSchedules, user?.branch_id, dateFilter])

  // Group shipments by status
  const grouped = useMemo(() => {
    const map: Record<string, ShipmentWithRelations[]> = {}
    for (const s of SHIPMENT_COLUMNS) map[s] = []
    for (const s of shipments) {
      if (map[s.status]) map[s.status].push(s)
    }
    return map
  }, [shipments])

  const totalInPatio = shipments.length
  const isToday = dateFilter === today

  if (loading && schedulesLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <>
      {/* Barra superior: filtro de fecha + conteo + registrar */}
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-auto h-8 text-sm"
            />
          </div>
          {!isToday && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setDateFilter(today)}>
              Hoy
            </Button>
          )}
          <p className="text-sm text-muted-foreground">
            {pendingSchedules.length} agendado{pendingSchedules.length !== 1 ? 's' : ''} · {totalInPatio} en patio
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Registrar Camion
        </Button>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4" style={{ minHeight: '60vh' }}>
          {/* Columna Agendado — desde schedules pendientes */}
          <ScheduleColumn schedules={pendingSchedules} />

          {/* Columnas de shipments */}
          {SHIPMENT_COLUMNS.map((status) => (
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
