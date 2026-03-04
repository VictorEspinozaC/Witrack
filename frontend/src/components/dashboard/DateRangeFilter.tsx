import { Button } from '@/components/ui/button'
import type { DateRangeKey } from '@/lib/kpi-config'

const OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Esta Semana' },
  { key: 'month', label: 'Este Mes' },
]

interface DateRangeFilterProps {
  value: DateRangeKey
  onChange: (key: DateRangeKey) => void
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {OPTIONS.map((opt) => (
        <Button
          key={opt.key}
          variant={value === opt.key ? 'default' : 'ghost'}
          size="sm"
          className="text-xs px-3 h-7"
          onClick={() => onChange(opt.key)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  )
}
