import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ClipboardList, Shield, AlertTriangle, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { STATUS_LABELS, STATUS_DOT_COLORS, SHIPMENT_STATES, type ShipmentStatus } from '@/lib/constants'
import type { DateRangeKey } from '@/lib/kpi-config'
import { useDashboardData } from '@/hooks/useDashboardData'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter'
import { ShipmentsPerDayChart } from '@/components/dashboard/ShipmentsPerDayChart'
import { StageTimesChart } from '@/components/dashboard/StageTimesChart'
import { IncidentsByTypeChart } from '@/components/dashboard/IncidentsByTypeChart'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [dateRange, setDateRange] = useState<DateRangeKey>('today')

  const {
    kpis,
    statusCounts,
    shipmentsPerDay,
    stageTimes,
    incidentsByType,
    notifications,
    pendingTasks,
    pendingApprovals,
    loading,
  } = useDashboardData(dateRange)

  function relativeTime(dateStr: string) {
    if (!dateStr) return ''
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es })
    } catch {
      return ''
    }
  }

  return (
    <div className="space-y-6">
      {/* Header + Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Resumen de operaciones en tiempo real</p>
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex h-20 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* 8 KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} />
        ))}
      </div>

      {/* 3 Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ShipmentsPerDayChart data={shipmentsPerDay} />
        <StageTimesChart data={stageTimes} />
        <IncidentsByTypeChart data={incidentsByType} />
      </div>

      {/* Status Summary */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Resumen por Estado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {SHIPMENT_STATES.map((status) => (
              <div key={status} className="flex items-center gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/30">
                <div className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT_COLORS[status as ShipmentStatus]}`} />
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground">{STATUS_LABELS[status as ShipmentStatus]}</p>
                  <p className="text-xl font-bold">{statusCounts[status] ?? 0}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notifications + Tasks */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                <Bell className="h-4 w-4 text-amber-600" />
              </div>
              Notificaciones Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sin notificaciones recientes</p>
            ) : (
              <div className="space-y-1.5">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="flex items-start gap-3 rounded-lg p-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(notif.link)}
                  >
                    {notif.type === 'incident' ? (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 shrink-0 mt-0.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                      </div>
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-50 shrink-0 mt-0.5">
                        <XCircle className="h-3.5 w-3.5 text-orange-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">{notif.text}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{relativeTime(notif.time)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                <ClipboardList className="h-4 w-4 text-blue-600" />
              </div>
              Tareas Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sin tareas pendientes</p>
            ) : (
              <div className="space-y-1.5">
                {pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(task.link)}
                  >
                    <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    <p className="text-sm leading-snug">{task.text}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals (supervisor/admin only) */}
      {(user?.role === 'supervisor' || user?.role === 'admin') && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50">
                <Shield className="h-4 w-4 text-violet-600" />
              </div>
              Aprobaciones Pendientes
            </CardTitle>
            {pendingApprovals.length > 0 && (
              <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate('/confirmacion-pedidos')}>
                Ir a revision
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {pendingApprovals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sin aprobaciones pendientes</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2.5 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Sucursal</th>
                      <th className="pb-2.5 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Patente</th>
                      <th className="pb-2.5 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha Agendada</th>
                      <th className="pb-2.5 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Archivo</th>
                      <th className="pb-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Subido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingApprovals.map((appr) => (
                      <tr
                        key={appr.id}
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => navigate('/confirmacion-pedidos')}
                      >
                        <td className="py-3 pr-4 font-medium">{appr.branchName}</td>
                        <td className="py-3 pr-4 font-mono text-xs">{appr.truckPlate}</td>
                        <td className="py-3 pr-4">
                          {appr.scheduledDate
                            ? format(new Date(appr.scheduledDate + 'T12:00:00'), 'dd/MM/yyyy')
                            : '-'}
                        </td>
                        <td className="py-3 pr-4 max-w-[200px] truncate text-muted-foreground">{appr.fileName}</td>
                        <td className="py-3 text-muted-foreground text-xs">{relativeTime(appr.uploadedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
