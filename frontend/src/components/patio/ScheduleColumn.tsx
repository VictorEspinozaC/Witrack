import { CalendarCheck, Truck, Clock, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { STATUS_DOT_COLORS } from '@/lib/constants'
import type { ScheduleWithRelations } from '@/hooks/useSchedules'

interface ScheduleColumnProps {
  schedules: ScheduleWithRelations[]
}

export function ScheduleColumn({ schedules }: ScheduleColumnProps) {
  return (
    <div className="flex flex-1 min-w-[180px] flex-col rounded-lg border bg-card">
      <div className="flex items-center gap-1.5 border-b px-2 py-2">
        <div className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT_COLORS.agendado}`} />
        <span className="text-xs font-semibold truncate">Agendado</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {schedules.length}
        </Badge>
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {schedules.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Sin agendamientos</p>
          ) : (
            schedules.map((sch) => (
              <ScheduleCard key={sch.id} schedule={sch} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function ScheduleCard({ schedule }: { schedule: ScheduleWithRelations }) {
  const destName =
    schedule.destination_branch?.name ??
    schedule.transport_supplier?.name ??
    schedule.supplier?.name ??
    schedule.maquila_supplier?.name ??
    schedule.client?.name ??
    null

  const truckPlate = schedule.truck?.plate ?? null
  const driverName = schedule.driver?.name ?? null
  const opLabel = schedule.operation_type === 'despacho' ? 'Despacho' : 'Recepcion'

  return (
    <Card className="border-dashed border-slate-300 bg-slate-50/50">
      <CardContent className="p-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {truckPlate ? (
              <>
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="font-bold text-sm">{truckPlate}</span>
              </>
            ) : (
              <>
                <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm text-muted-foreground">Sin camion</span>
              </>
            )}
          </div>
          {schedule.scheduled_time && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {schedule.scheduled_time}
            </div>
          )}
        </div>

        <div className="space-y-0.5 text-xs text-muted-foreground">
          {driverName && <p>{driverName}</p>}
          {schedule.transport_supplier?.name && schedule.destination_type === 'sucursal' && (
            <p>{schedule.transport_supplier.name}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {opLabel}
          </span>
          {destName && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="truncate max-w-[100px]">{destName}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
