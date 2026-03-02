import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Truck, Clock, AlertTriangle, CheckCircle, PackageCheck, Bell, ClipboardList, Shield, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { STATUS_LABELS, STATUS_DOT_COLORS, SHIPMENT_STATES, INCIDENT_TYPES, type ShipmentStatus } from '@/lib/constants'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'

// ---------- Types for new sections ----------

interface Notification {
  id: string
  text: string
  type: 'incident' | 'rejection' | 'info'
  time: string
  link: string
}

interface PendingTask {
  id: string
  text: string
  link: string
}

interface PendingApproval {
  id: string
  branchName: string
  truckPlate: string
  scheduledDate: string
  fileName: string
  uploadedAt: string
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [incidentCount, setIncidentCount] = useState(0)

  // New state
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([])

  // ---------- Existing useEffect: shipment counts + incident count ----------
  useEffect(() => {
    async function load() {
      const branchId = user?.branch_id
      let query = supabase.from('shipments').select('status')
      if (branchId) query = query.eq('branch_id', branchId)

      const { data } = await query
      const grouped: Record<string, number> = {}
      data?.forEach((s) => {
        grouped[s.status] = (grouped[s.status] || 0) + 1
      })
      setCounts(grouped)

      const incQuery = supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('status', 'abierta')
      const { count } = await incQuery
      setIncidentCount(count ?? 0)
    }
    load()
  }, [user?.branch_id])

  // ---------- New useEffect: notifications ----------
  useEffect(() => {
    async function loadNotifications() {
      const items: Notification[] = []

      // 1. Last 5 open incidents
      const { data: incidents } = await supabase
        .from('incidents')
        .select('id, type, created_at, shipment:shipments(truck_id, truck:trucks(plate))')
        .eq('status', 'abierta')
        .order('created_at', { ascending: false })
        .limit(5)

      if (incidents) {
        for (const inc of incidents) {
          const shipment = inc.shipment as unknown as { truck_id: string; truck: { plate: string } | null } | null
          const plate = shipment?.truck?.plate ?? 'Sin patente'
          const typeLabel = INCIDENT_TYPES.find(t => t.value === inc.type)?.label ?? inc.type
          items.push({
            id: `inc-${inc.id}`,
            text: `Incidencia: ${typeLabel} - Camion ${plate}`,
            type: 'incident',
            time: inc.created_at ?? '',
            link: '/incidencias',
          })
        }
      }

      // 2. Last 5 rejected order_confirmations
      let rejQuery = supabase
        .from('order_confirmations')
        .select('id, rejection_reason, created_at, schedule:schedules(truck:trucks(plate), branch:branches(name), branch_id)')
        .eq('status', 'rejected')
        .order('created_at', { ascending: false })
        .limit(5)

      const { data: rejected } = await rejQuery

      if (rejected) {
        for (const rej of rejected) {
          const schedule = rej.schedule as unknown as {
            truck: { plate: string } | null
            branch: { name: string } | null
            branch_id: string
          } | null

          // For sucursal users, filter by their branch
          if (user?.role === 'sucursal' && user?.branch_id && schedule?.branch_id !== user.branch_id) {
            continue
          }

          const plate = schedule?.truck?.plate ?? 'Sin patente'
          const branchName = schedule?.branch?.name ?? ''
          const reason = rej.rejection_reason ?? 'Sin razon'
          items.push({
            id: `rej-${rej.id}`,
            text: `Pedido rechazado${branchName ? ` (${branchName})` : ''}: ${plate} - ${reason}`,
            type: 'rejection',
            time: rej.created_at ?? '',
            link: '/confirmacion-pedidos',
          })
        }
      }

      // Sort by time descending, take first 10
      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      setNotifications(items.slice(0, 10))
    }

    loadNotifications()
  }, [user?.branch_id, user?.role])

  // ---------- New useEffect: pending tasks ----------
  useEffect(() => {
    async function loadPendingTasks() {
      const tasks: PendingTask[] = []
      const role = user?.role

      if (role === 'sucursal' && user?.branch_id) {
        // Schedules with status='pending' for user's branch that need confirmation
        const { data: schedules } = await supabase
          .from('schedules')
          .select(`
            id, scheduled_date,
            truck:trucks(plate),
            order_confirmations(id, status)
          `)
          .eq('branch_id', user.branch_id)
          .eq('status', 'pending')
          .order('scheduled_date', { ascending: true })
          .limit(10)

        if (schedules) {
          for (const sch of schedules) {
            const confirmations = (sch.order_confirmations ?? []) as unknown as Array<{ id: string; status: string }>
            // Need confirmation if no confirmations or last one was rejected
            const hasValid = confirmations.some(c => c.status === 'pending_approval' || c.status === 'approved')
            if (!hasValid) {
              const truck = sch.truck as unknown as { plate: string } | null
              const plate = truck?.plate ?? 'Sin patente'
              const dateStr = format(new Date(sch.scheduled_date + 'T12:00:00'), 'dd/MM/yyyy')
              tasks.push({
                id: `sch-${sch.id}`,
                text: `Confirmar pedido para ${dateStr} - ${plate}`,
                link: '/confirmacion-pedidos',
              })
            }
          }
        }
      } else if (role === 'supervisor' || role === 'admin') {
        // Order confirmations pending approval
        const { data: pending } = await supabase
          .from('order_confirmations')
          .select('id, schedule:schedules(truck:trucks(plate), branch:branches(name))')
          .eq('status', 'pending_approval')
          .order('uploaded_at', { ascending: false })
          .limit(10)

        if (pending) {
          for (const item of pending) {
            const schedule = item.schedule as unknown as {
              truck: { plate: string } | null
              branch: { name: string } | null
            } | null
            const plate = schedule?.truck?.plate ?? 'Sin patente'
            const branchName = schedule?.branch?.name ?? 'Sucursal'
            tasks.push({
              id: `appr-${item.id}`,
              text: `Aprobar pedido de ${branchName} - ${plate}`,
              link: '/confirmacion-pedidos',
            })
          }
        }
      } else if (role === 'planta') {
        // Show active shipment counts as task items
        const statusTasks: Array<{ status: ShipmentStatus; label: string }> = [
          { status: 'en_carga', label: 'camiones en carga' },
          { status: 'espera_salida', label: 'esperando salida' },
          { status: 'en_puerta', label: 'camiones en puerta' },
          { status: 'en_patio', label: 'camiones en patio' },
          { status: 'carga_terminada', label: 'con carga terminada' },
          { status: 'emision_guia', label: 'en emision de guia' },
        ]
        for (const st of statusTasks) {
          const c = counts[st.status] ?? 0
          if (c > 0) {
            tasks.push({
              id: `task-${st.status}`,
              text: `${c} ${st.label}`,
              link: '/patio',
            })
          }
        }
      }

      setPendingTasks(tasks)
    }

    loadPendingTasks()
  }, [user?.branch_id, user?.role, counts])

  // ---------- New useEffect: pending approvals (supervisor/admin only) ----------
  useEffect(() => {
    async function loadPendingApprovals() {
      if (user?.role !== 'supervisor' && user?.role !== 'admin') {
        setPendingApprovals([])
        return
      }

      const { data } = await supabase
        .from('order_confirmations')
        .select('id, file_name, uploaded_at, schedule:schedules(scheduled_date, truck:trucks(plate), branch:branches(name))')
        .eq('status', 'pending_approval')
        .order('uploaded_at', { ascending: false })
        .limit(10)

      if (data) {
        const items: PendingApproval[] = data.map((row) => {
          const schedule = row.schedule as unknown as {
            scheduled_date: string
            truck: { plate: string } | null
            branch: { name: string } | null
          } | null
          return {
            id: row.id,
            branchName: schedule?.branch?.name ?? 'Sin sucursal',
            truckPlate: schedule?.truck?.plate ?? 'Sin patente',
            scheduledDate: schedule?.scheduled_date ?? '',
            fileName: row.file_name,
            uploadedAt: row.uploaded_at,
          }
        })
        setPendingApprovals(items)
      }
    }

    loadPendingApprovals()
  }, [user?.role])

  // ---------- Derived values ----------
  const activeCount = Object.entries(counts)
    .filter(([k]) => k !== 'en_ruta' && k !== 'en_recepcion')
    .reduce((sum, [, v]) => sum + v, 0)

  const dispatchedToday = counts['en_ruta'] ?? 0
  const enRecepcion = counts['en_recepcion'] ?? 0

  // ---------- Helpers ----------
  function relativeTime(dateStr: string) {
    if (!dateStr) return ''
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es })
    } catch {
      return ''
    }
  }

  // ---------- Render ----------
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Camiones Activos</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despachados Hoy</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dispatchedToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">En Recepcion</CardTitle>
            <PackageCheck className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{enRecepcion}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Incidencias Abiertas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{incidentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">En Espera</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{(counts['agendado'] ?? 0) + (counts['en_puerta'] ?? 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Status Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumen por Estado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {SHIPMENT_STATES.map((status) => (
              <div key={status} className="flex items-center gap-3 rounded-lg border p-3">
                <div className={`h-3 w-3 rounded-full ${STATUS_DOT_COLORS[status as ShipmentStatus]}`} />
                <div>
                  <p className="text-sm font-medium">{STATUS_LABELS[status as ShipmentStatus]}</p>
                  <p className="text-2xl font-bold">{counts[status] ?? 0}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ====== NEW SECTIONS ====== */}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Section 1: Notificaciones Recientes */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-500" />
              Notificaciones Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sin notificaciones recientes</p>
            ) : (
              <div className="space-y-2">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(notif.link)}
                  >
                    {notif.type === 'incident' ? (
                      <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">{notif.text}</p>
                      <p className="text-xs text-muted-foreground mt-1">{relativeTime(notif.time)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Tareas Pendientes */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-500" />
              Tareas Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sin tareas pendientes</p>
            ) : (
              <div className="space-y-2">
                {pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(task.link)}
                  >
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0" />
                    <p className="text-sm leading-snug">{task.text}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 3: Aprobaciones Pendientes (supervisor/admin only) */}
      {(user?.role === 'supervisor' || user?.role === 'admin') && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-violet-500" />
              Aprobaciones Pendientes
            </CardTitle>
            {pendingApprovals.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => navigate('/confirmacion-pedidos')}>
                Ir a revision
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {pendingApprovals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sin aprobaciones pendientes</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Sucursal</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Patente</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Fecha Agendada</th>
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Archivo</th>
                      <th className="pb-2 font-medium text-muted-foreground">Subido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingApprovals.map((appr) => (
                      <tr
                        key={appr.id}
                        className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate('/confirmacion-pedidos')}
                      >
                        <td className="py-2.5 pr-4">{appr.branchName}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs">{appr.truckPlate}</td>
                        <td className="py-2.5 pr-4">
                          {appr.scheduledDate
                            ? format(new Date(appr.scheduledDate + 'T12:00:00'), 'dd/MM/yyyy')
                            : '-'}
                        </td>
                        <td className="py-2.5 pr-4 max-w-[200px] truncate">{appr.fileName}</td>
                        <td className="py-2.5 text-muted-foreground">{relativeTime(appr.uploadedAt)}</td>
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
