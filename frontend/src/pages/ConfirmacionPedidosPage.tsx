import { useState, useMemo, useEffect } from 'react'
import { format, startOfWeek, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Truck, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSchedules, type ScheduleWithRelations } from '@/hooks/useSchedules'
import { OrderConfirmationDialog } from '@/components/confirmacion/OrderConfirmationDialog'
import { getNextBusinessDay } from '@/lib/businessDays'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/types'

const operationTypeMap: Record<string, string> = {
  despacho: 'Despacho',
  recepcion: 'Recepcion',
}

const destinationTypeMap: Record<string, string> = {
  sucursal: 'Sucursal',
  proveedor: 'Proveedor',
  maquila: 'Maquila',
  cliente: 'Cliente',
}

function getDestinationLabel(s: ScheduleWithRelations): string {
  switch (s.destination_type) {
    case 'sucursal':
      return s.destination_branch?.name ?? 'Sucursal no asignada'
    case 'proveedor':
      return s.supplier?.name ?? 'Proveedor no asignado'
    case 'maquila':
      return s.maquila_supplier?.name ?? 'Maquila no asignada'
    case 'cliente':
      return s.client?.name ?? 'Cliente no asignado'
    default:
      return '---'
  }
}

const COLUMNS: { key: string; label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }[] = [
  { key: 'pending',   label: 'Pendiente',  variant: 'outline' },
  { key: 'confirmed', label: 'Confirmado', variant: 'default' },
  { key: 'cancelled', label: 'Cancelado',  variant: 'destructive' },
]

export default function ConfirmacionPedidosPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState<string | undefined>()
  const [branchFilter, setBranchFilter] = useState<string>('all')
  const [branches, setBranches] = useState<Tables<'branches'>[]>([])

  // Dialog state
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleWithRelations | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)

  // Confirmation statuses for visual badges
  const [confirmationStatuses, setConfirmationStatuses] = useState<
    Record<string, { status: string }>
  >({})

  // Next business day
  const nextBizDay = useMemo(() => getNextBusinessDay(new Date()), [])
  const nextBizDayStr = format(nextBizDay, 'yyyy-MM-dd')

  // Load branches
  useEffect(() => {
    supabase
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setBranches(data ?? []))
  }, [])

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 })
    return addDays(base, weekOffset * 7)
  }, [weekOffset])

  const weekEnd = addDays(weekStart, 6)

  const dateRange = useMemo(() => ({
    from: format(weekStart, 'yyyy-MM-dd'),
    to: format(weekEnd, 'yyyy-MM-dd'),
  }), [weekStart, weekEnd])

  // branchId: null = all branches, string = specific branch
  const branchId = branchFilter === 'all' ? null : branchFilter

  const { schedules, loading, cancelSchedule } = useSchedules({
    dateRange,
    branchId,
  })

  // Fetch confirmation statuses for pending schedules
  useEffect(() => {
    const pendingIds = schedules
      .filter((s) => s.status === 'pending')
      .map((s) => s.id)
    if (pendingIds.length === 0) {
      setConfirmationStatuses({})
      return
    }

    supabase
      .from('order_confirmations')
      .select('schedule_id, status')
      .in('schedule_id', pendingIds)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, { status: string }> = {}
        for (const row of data) {
          if (!map[row.schedule_id]) {
            map[row.schedule_id] = { status: row.status }
          }
        }
        setConfirmationStatuses(map)
      })
  }, [schedules])

  // Tomorrow's pending schedules
  const tomorrowPending = useMemo(
    () => schedules.filter((s) => s.scheduled_date === nextBizDayStr && s.status === 'pending'),
    [schedules, nextBizDayStr]
  )

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const daySchedules = schedules.filter((s) => s.scheduled_date === dateStr)
      return {
        date,
        dateStr,
        label: format(date, 'EEE dd', { locale: es }),
        schedules: daySchedules,
        pending:   daySchedules.filter((s) => s.status === 'pending').length,
        confirmed: daySchedules.filter((s) => s.status === 'confirmed').length,
        cancelled: daySchedules.filter((s) => s.status === 'cancelled').length,
      }
    })
  }, [weekStart, schedules])

  const filteredSchedules = selectedDate
    ? schedules.filter((s) => s.scheduled_date === selectedDate)
    : schedules

  function handleCardClick(dateStr: string) {
    setSelectedDate((prev) => (prev === dateStr ? undefined : dateStr))
  }

  function openConfirmDialog(schedule: ScheduleWithRelations) {
    setSelectedSchedule(schedule)
    setConfirmDialogOpen(true)
  }

  function handleScheduleDoubleClick(schedule: ScheduleWithRelations) {
    if (schedule.status !== 'pending') return
    openConfirmDialog(schedule)
  }

  async function handleCancelSchedule(s: ScheduleWithRelations) {
    try {
      await cancelSchedule(s.id)
      const dateLabel = format(new Date(s.scheduled_date + 'T12:00:00'), "dd 'de' MMMM", { locale: es })
      toast.warning(`Servicio cancelado para ${dateLabel}`)
    } catch {
      toast.error('Error al cancelar servicio')
    }
  }

  const selectedLabel = selectedDate
    ? format(new Date(selectedDate + 'T12:00:00'), "EEEE dd 'de' MMMM", { locale: es })
    : null

  const grouped = COLUMNS.reduce<Record<string, ScheduleWithRelations[]>>((acc, col) => {
    acc[col.key] = filteredSchedules.filter((s) => s.status === col.key)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Confirmacion de Pedidos</h1>
          <p className="text-sm text-muted-foreground mt-1">Aprobacion y seguimiento de ordenes</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="icon" onClick={() => setWeekOffset(weekOffset - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium">
          {format(weekStart, 'dd MMM', { locale: es })} - {format(weekEnd, 'dd MMM yyyy', { locale: es })}
        </span>
        <Button variant="outline" size="icon" onClick={() => setWeekOffset(weekOffset + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {weekOffset !== 0 && (
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
            Hoy
          </Button>
        )}
        <div className="ml-auto">
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las sucursales</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* ===== PEDIDOS PARA MANANA section ===== */}
          {tomorrowPending.length > 0 && (
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-primary animate-pulse" />
                  Pedidos para {format(nextBizDay, "EEEE dd 'de' MMMM", { locale: es })}
                  <Badge variant="secondary" className="ml-2">
                    {tomorrowPending.length} pendiente{tomorrowPending.length !== 1 ? 's' : ''}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tomorrowPending.map((s) => (
                    <Card key={s.id} className="shadow-sm border-primary/20">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <p className="text-sm font-semibold truncate">
                            {s.truck?.plate ?? 'Sin camion'}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {s.driver?.name ?? 'Sin conductor'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {s.scheduled_time ? s.scheduled_time.slice(0, 5) : '---'}
                          {s.operation_type ? ` | ${operationTypeMap[s.operation_type] ?? s.operation_type}` : ''}
                        </p>
                        {s.destination_type && (
                          <p className="text-xs text-muted-foreground truncate">
                            {destinationTypeMap[s.destination_type] ?? s.destination_type}: {getDestinationLabel(s)}
                          </p>
                        )}
                        {/* Confirmation status badge */}
                        {confirmationStatuses[s.id] && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              confirmationStatuses[s.id].status === 'pending_approval'
                                ? 'bg-amber-50 text-amber-700 border-amber-300'
                                : confirmationStatuses[s.id].status === 'approved'
                                  ? 'bg-green-50 text-green-700 border-green-300'
                                  : 'bg-red-50 text-red-700 border-red-300'
                            }`}
                          >
                            {confirmationStatuses[s.id].status === 'pending_approval'
                              ? 'Pendiente aprobacion'
                              : confirmationStatuses[s.id].status === 'approved'
                                ? 'Aprobado'
                                : 'Rechazado'}
                          </Badge>
                        )}
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            className="flex-1 gap-1 h-7 text-xs"
                            onClick={() => openConfirmDialog(s)}
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Confirmar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1 gap-1 h-7 text-xs"
                            onClick={() => handleCancelSchedule(s)}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Cancelar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Weekly calendar */}
          <div className="grid gap-3 lg:grid-cols-7">
            {days.map((day) => {
              const isToday = day.dateStr === format(new Date(), 'yyyy-MM-dd')
              const isSelected = day.dateStr === selectedDate
              const isTomorrow = day.dateStr === nextBizDayStr
              const total = day.schedules.length
              return (
                <Card
                  key={day.dateStr}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isSelected
                      ? 'ring-2 ring-primary border-primary'
                      : isToday
                        ? 'border-primary'
                        : isTomorrow
                          ? 'border-primary/40'
                          : ''
                  }`}
                  onClick={() => handleCardClick(day.dateStr)}
                >
                  <CardHeader className="pb-2 px-3 pt-3">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span className={isToday ? 'text-primary font-bold' : 'capitalize'}>{day.label}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    {total === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">-</p>
                    ) : (
                      <div className="space-y-1 text-xs">
                        <p className="text-muted-foreground font-medium">{total} agenda{total !== 1 ? 's' : ''}</p>
                        {day.pending > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-gray-400 shrink-0" />
                            <span className="text-muted-foreground">{day.pending} pend.</span>
                          </div>
                        )}
                        {day.confirmed > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                            <span className="text-muted-foreground">{day.confirmed} conf.</span>
                          </div>
                        )}
                        {day.cancelled > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
                            <span className="text-muted-foreground">{day.cancelled} canc.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Schedule columns */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>
                  {selectedLabel
                    ? `Pedidos del ${selectedLabel}`
                    : 'Todos los pedidos de la semana'}
                </span>
                {selectedDate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-muted-foreground"
                    onClick={() => setSelectedDate(undefined)}
                  >
                    Ver todos
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 overflow-x-auto pb-2" style={{ minHeight: '280px' }}>
                {COLUMNS.map((col) => {
                  const colSchedules = grouped[col.key] ?? []
                  return (
                    <div key={col.key} className="flex-1 min-w-[240px] max-w-sm flex flex-col gap-2">
                      <div className="flex items-center gap-2 px-1">
                        <Badge variant={col.variant}>{col.label}</Badge>
                        <span className="text-xs text-muted-foreground">{colSchedules.length}</span>
                      </div>
                      <ScrollArea className="flex-1 max-h-[400px]">
                        <div className="space-y-2 pr-1">
                          {colSchedules.length === 0 && (
                            <p className="py-4 text-center text-xs text-muted-foreground">Sin agendamientos</p>
                          )}
                          {colSchedules.map((s) => (
                            <Card
                              key={s.id}
                              className={`shadow-sm ${
                                col.key === 'pending'
                                  ? 'cursor-pointer hover:ring-1 hover:ring-primary'
                                  : ''
                              }`}
                              onDoubleClick={() =>
                                col.key === 'pending'
                                  ? handleScheduleDoubleClick(s)
                                  : undefined
                              }
                            >
                              <CardContent className="p-3 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Truck className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <p className="text-sm font-medium truncate">
                                    {s.truck?.plate ?? 'Sin camion'}
                                  </p>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {s.driver?.name ?? 'Sin conductor'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(s.scheduled_date + 'T00:00:00'), 'dd MMM', { locale: es })}
                                  {s.scheduled_time ? ` ${s.scheduled_time.slice(0, 5)}` : ''}
                                  {s.operation_type ? ` | ${operationTypeMap[s.operation_type] ?? s.operation_type}` : ''}
                                </p>
                                {s.destination_type && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {destinationTypeMap[s.destination_type] ?? s.destination_type}: {getDestinationLabel(s)}
                                  </p>
                                )}
                                {/* Confirmation status badge */}
                                {col.key === 'pending' && confirmationStatuses[s.id] && (
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] mt-1 ${
                                      confirmationStatuses[s.id].status === 'pending_approval'
                                        ? 'bg-amber-50 text-amber-700 border-amber-300'
                                        : confirmationStatuses[s.id].status === 'approved'
                                          ? 'bg-green-50 text-green-700 border-green-300'
                                          : 'bg-red-50 text-red-700 border-red-300'
                                    }`}
                                  >
                                    {confirmationStatuses[s.id].status === 'pending_approval'
                                      ? 'Pendiente aprobacion'
                                      : confirmationStatuses[s.id].status === 'approved'
                                        ? 'Aprobado'
                                        : 'Rechazado'}
                                  </Badge>
                                )}
                                {/* Confirmar / Cancelar buttons for pending */}
                                {col.key === 'pending' && (
                                  <div className="flex gap-1.5 pt-1.5">
                                    <Button
                                      size="sm"
                                      className="flex-1 gap-1 h-7 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        openConfirmDialog(s)
                                      }}
                                    >
                                      <CheckCircle className="h-3 w-3" />
                                      Confirmar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="flex-1 gap-1 h-7 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleCancelSchedule(s)
                                      }}
                                    >
                                      <XCircle className="h-3 w-3" />
                                      Cancelar
                                    </Button>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Order confirmation dialog */}
      <OrderConfirmationDialog
        open={confirmDialogOpen}
        onClose={() => {
          setConfirmDialogOpen(false)
          setSelectedSchedule(null)
        }}
        schedule={selectedSchedule}
      />
    </div>
  )
}
