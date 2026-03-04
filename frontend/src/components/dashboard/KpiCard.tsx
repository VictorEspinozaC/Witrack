import { Card, CardContent } from '@/components/ui/card'
import type { KpiValue } from '@/lib/kpi-config'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<string, { dot: string; icon: string; bg: string; bar: string }> = {
  good:    { dot: 'bg-emerald-500', icon: 'text-emerald-600', bg: 'bg-emerald-50', bar: 'bg-emerald-500' },
  warning: { dot: 'bg-amber-500',   icon: 'text-amber-600',   bg: 'bg-amber-50',   bar: 'bg-amber-500' },
  bad:     { dot: 'bg-red-500',     icon: 'text-red-600',     bg: 'bg-red-50',     bar: 'bg-red-500' },
}

function formatValue(value: number, unit: string): string {
  if (unit === '%') return `${value}%`
  if (unit === 'min') return `${value} min`
  return value.toLocaleString('es-CL')
}

function formatTarget(target: number, unit: string): string {
  if (unit === '%') return `${target}%`
  if (unit === 'min') return `${target} min`
  return target.toLocaleString('es-CL')
}

function getProgress(value: number, target: number, direction: string): number {
  if (target === 0) {
    if (direction === 'lower_better') return value === 0 ? 100 : Math.max(0, 100 - value * 25)
    return value > 0 ? 100 : 0
  }
  if (direction === 'higher_better') {
    return Math.min(100, Math.round((value / target) * 100))
  }
  // lower_better: 100% when at or below target
  if (value <= target) return 100
  return Math.max(0, Math.round((target / value) * 100))
}

export function KpiCard({ kpi }: { kpi: KpiValue }) {
  const colors = STATUS_COLORS[kpi.status]
  const progress = getProgress(kpi.value, kpi.target, kpi.direction)

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <div className={cn('h-2 w-2 rounded-full shrink-0', colors.dot)} />
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate">
                {kpi.label}
              </p>
            </div>
            <p className="text-2xl font-bold tracking-tight">{formatValue(kpi.value, kpi.unit)}</p>
          </div>
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl shrink-0', colors.bg)}>
            <kpi.icon className={cn('h-4.5 w-4.5', colors.icon)} />
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 space-y-1">
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className={cn('h-1.5 rounded-full transition-all duration-500', colors.bar)}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Meta: {formatTarget(kpi.target, kpi.unit)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
