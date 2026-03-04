import {
  Truck, CheckCircle, Clock, Timer, TrendingUp,
  AlertTriangle, XCircle, CalendarCheck,
} from 'lucide-react'

// ---------- Types ----------

export type KpiStatus = 'good' | 'warning' | 'bad'
export type KpiDirection = 'higher_better' | 'lower_better'
export type DateRangeKey = 'today' | 'week' | 'month'

export interface KpiDefinition {
  key: string
  label: string
  icon: typeof Truck
  unit: string            // '', '%', 'min'
  direction: KpiDirection
  targets: Record<DateRangeKey, number>
}

export interface KpiValue {
  key: string
  label: string
  icon: typeof Truck
  unit: string
  value: number
  target: number
  status: KpiStatus
  direction: KpiDirection
}

// ---------- KPI Definitions ----------

export const KPI_DEFINITIONS: KpiDefinition[] = [
  {
    key: 'shipments_period',
    label: 'Embarques del Periodo',
    icon: Truck,
    unit: '',
    direction: 'higher_better',
    targets: { today: 10, week: 50, month: 200 },
  },
  {
    key: 'shipments_completed',
    label: 'Embarques Completados',
    icon: CheckCircle,
    unit: '',
    direction: 'higher_better',
    targets: { today: 8, week: 40, month: 160 },
  },
  {
    key: 'avg_plant_time',
    label: 'Tiempo Prom. en Planta',
    icon: Clock,
    unit: 'min',
    direction: 'lower_better',
    targets: { today: 180, week: 180, month: 180 },
  },
  {
    key: 'avg_load_time',
    label: 'Tiempo Prom. de Carga',
    icon: Timer,
    unit: 'min',
    direction: 'lower_better',
    targets: { today: 60, week: 60, month: 60 },
  },
  {
    key: 'dispatch_rate',
    label: 'Tasa de Despacho',
    icon: TrendingUp,
    unit: '%',
    direction: 'higher_better',
    targets: { today: 80, week: 80, month: 80 },
  },
  {
    key: 'open_incidents',
    label: 'Incidencias Abiertas',
    icon: AlertTriangle,
    unit: '',
    direction: 'lower_better',
    targets: { today: 0, week: 3, month: 5 },
  },
  {
    key: 'order_rejection_rate',
    label: 'Tasa de Rechazo',
    icon: XCircle,
    unit: '%',
    direction: 'lower_better',
    targets: { today: 10, week: 10, month: 10 },
  },
  {
    key: 'schedule_compliance',
    label: 'Cumplimiento Agenda',
    icon: CalendarCheck,
    unit: '%',
    direction: 'higher_better',
    targets: { today: 90, week: 90, month: 90 },
  },
]

// ---------- Status computation ----------

export function computeKpiStatus(
  value: number,
  target: number,
  direction: KpiDirection,
): KpiStatus {
  if (direction === 'higher_better') {
    if (target === 0) return value >= 0 ? 'good' : 'bad'
    const ratio = value / target
    if (ratio >= 1) return 'good'
    if (ratio >= 0.7) return 'warning'
    return 'bad'
  } else {
    // lower_better
    if (target === 0) return value === 0 ? 'good' : value <= 2 ? 'warning' : 'bad'
    const ratio = value / target
    if (ratio <= 1) return 'good'
    if (ratio <= 1.3) return 'warning'
    return 'bad'
  }
}

// ---------- Date range helpers ----------

export function getDateRange(key: DateRangeKey): { from: string; to: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (key) {
    case 'today':
      return {
        from: today.toISOString(),
        to: new Date(today.getTime() + 86400000 - 1).toISOString(),
      }
    case 'week': {
      const dayOfWeek = today.getDay()
      const monday = new Date(today)
      monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7))
      return {
        from: monday.toISOString(),
        to: new Date(today.getTime() + 86400000 - 1).toISOString(),
      }
    }
    case 'month': {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      return {
        from: firstDay.toISOString(),
        to: new Date(today.getTime() + 86400000 - 1).toISOString(),
      }
    }
  }
}
