import { Truck, AlertTriangle, MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TimeElapsed } from './TimeElapsed'
import { TRANSITION_ACTIONS, type ShipmentStatus } from '@/lib/constants'
import type { ShipmentWithRelations } from '@/hooks/useShipments'

interface TruckCardProps {
  shipment: ShipmentWithRelations
  onTransition: (shipment: ShipmentWithRelations) => void
  onClick: (shipment: ShipmentWithRelations) => void
}

export function TruckCard({ shipment, onTransition, onClick }: TruckCardProps) {
  const status = shipment.status as ShipmentStatus
  const action = TRANSITION_ACTIONS[status]
  const hasOpenIncident = shipment.incidents?.some((i) => i.status === 'abierta')

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => onClick(shipment)}
    >
      <CardContent className="p-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <span className="font-bold text-sm">{shipment.truck?.plate ?? '---'}</span>
          </div>
          {hasOpenIncident && (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          )}
        </div>

        <div className="space-y-1 text-sm text-muted-foreground">
          <p>{shipment.driver?.name ?? 'Sin conductor'}</p>
          {shipment.transport_company && (
            <p className="text-xs">{shipment.transport_company}</p>
          )}
          {shipment.ramp_assignment && (
            <div className="flex items-center gap-1 text-xs">
              <MapPin className="h-3 w-3" />
              {shipment.ramp_assignment}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <TimeElapsed since={shipment.created_at} />
          {shipment.cargo_type && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {shipment.cargo_type}
            </span>
          )}
        </div>

        {action && (
          <Button
            size="sm"
            className="w-full mt-1"
            onClick={(e) => {
              e.stopPropagation()
              onTransition(shipment)
            }}
          >
            {action}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
