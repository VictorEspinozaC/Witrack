import { Badge } from '@/components/ui/badge'
import { STATUS_LABELS, STATUS_COLORS, type ShipmentStatus } from '@/lib/constants'

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  const colors = STATUS_COLORS[status]
  return (
    <Badge
      variant="outline"
      className={`${colors.bg} ${colors.text} ${colors.border} border font-medium`}
    >
      {STATUS_LABELS[status]}
    </Badge>
  )
}
