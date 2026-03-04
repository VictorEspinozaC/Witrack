import { useState, useMemo } from 'react'
import { format, startOfWeek, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScheduleForm } from '@/components/agendamiento/ScheduleForm'
import { ScheduleList } from '@/components/agendamiento/ScheduleList'
import { useSchedules } from '@/hooks/useSchedules'
import { usePermissions } from '@/hooks/usePermissions'
import { ReadOnlyBanner } from '@/components/shared/ReadOnlyBanner'

export default function AgendamientoPage() {
  const { canWrite } = usePermissions()
  const readOnly = !canWrite('agendamiento')
  const [weekOffset, setWeekOffset] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | undefined>()
  const [statusFilter, setStatusFilter] = useState('all')

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 })
    return addDays(base, weekOffset * 7)
  }, [weekOffset])

  const weekEnd = addDays(weekStart, 6)

  const dateRange = useMemo(() => ({
    from: format(weekStart, 'yyyy-MM-dd'),
    to: format(weekEnd, 'yyyy-MM-dd'),
  }), [weekStart, weekEnd])

  // Fetch ALL schedules (no statusFilter in query — filter locally)
  const { schedules, loading, createSchedule, cancelSchedule, restoreSchedule, refetch } = useSchedules({
    dateRange,
  })

  // Day cards always use ALL schedules — counts always correct
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

  // Kanban uses local filters (status + date)
  const kanbanSchedules = useMemo(() => {
    let filtered = schedules
    if (statusFilter !== 'all') filtered = filtered.filter((s) => s.status === statusFilter)
    if (selectedDate) filtered = filtered.filter((s) => s.scheduled_date === selectedDate)
    return filtered
  }, [schedules, statusFilter, selectedDate])

  function handleCardClick(dateStr: string) {
    setSelectedDate((prev) => (prev === dateStr ? undefined : dateStr))
  }

  const selectedLabel = selectedDate
    ? format(new Date(selectedDate + 'T12:00:00'), "EEEE dd 'de' MMMM", { locale: es })
    : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agendamiento</h1>
          <p className="text-sm text-muted-foreground mt-1">Planificacion semanal de servicios</p>
        </div>
        {!readOnly && (
          <Button onClick={() => { setSelectedDate(undefined); setShowForm(true) }} className="gap-2">
            <Plus className="h-4 w-4" /> Nueva Agenda
          </Button>
        )}
      </div>
      {readOnly && <ReadOnlyBanner />}

      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="icon" onClick={() => setWeekOffset(weekOffset - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium">
          {format(weekStart, "dd MMM", { locale: es })} - {format(weekEnd, "dd MMM yyyy", { locale: es })}
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="confirmed">Confirmado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-7">
          {days.map((day) => {
            const isToday = day.dateStr === format(new Date(), 'yyyy-MM-dd')
            const isSelected = day.dateStr === selectedDate
            const total = day.schedules.length
            return (
              <Card
                key={day.dateStr}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isSelected
                    ? 'ring-2 ring-primary border-primary'
                    : isToday
                      ? 'border-primary'
                      : ''
                }`}
                onClick={() => handleCardClick(day.dateStr)}
              >
                <CardHeader className="pb-2 px-3 pt-3">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span className={isToday ? 'text-primary font-bold' : 'capitalize'}>{day.label}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => { e.stopPropagation(); setSelectedDate(day.dateStr); setShowForm(true) }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
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
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>
              {selectedLabel
                ? `Agendamientos del ${selectedLabel}`
                : 'Todos los agendamientos'}
            </span>
            {selectedDate && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
                onClick={() => setSelectedDate(undefined)}
              >
                <X className="h-3 w-3" /> Ver todos
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduleList
            schedules={kanbanSchedules}
            onCancel={cancelSchedule}
            onRestore={restoreSchedule}
            onRefresh={refetch}
          />
        </CardContent>
      </Card>

      <ScheduleForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onCreate={createSchedule}
        defaultDate={selectedDate}
      />
    </div>
  )
}
