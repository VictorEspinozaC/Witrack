import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TruckCard } from '@/components/shared/TruckCard'
import { STATUS_LABELS, STATUS_DOT_COLORS, type ShipmentStatus } from '@/lib/constants'
import type { ShipmentWithRelations } from '@/hooks/useShipments'

interface KanbanColumnProps {
  status: ShipmentStatus
  shipments: ShipmentWithRelations[]
  onTransition: (shipment: ShipmentWithRelations) => void
  onCardClick: (shipment: ShipmentWithRelations) => void
}

export function KanbanColumn({ status, shipments, onTransition, onCardClick }: KanbanColumnProps) {
  return (
    <div className="flex flex-1 min-w-[180px] flex-col rounded-lg border bg-card">
      <div className="flex items-center gap-1.5 border-b px-2 py-2">
        <div className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT_COLORS[status]}`} />
        <span className="text-xs font-semibold truncate">{STATUS_LABELS[status]}</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {shipments.length}
        </Badge>
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {shipments.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Sin camiones</p>
          ) : (
            shipments.map((s) => (
              <TruckCard
                key={s.id}
                shipment={s}
                onTransition={onTransition}
                onClick={onCardClick}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
