import { useEffect, useState, useMemo } from 'react'
import { format, subDays, differenceInMinutes } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { INCIDENT_TYPES, type ShipmentStatus } from '@/lib/constants'
import {
  KPI_DEFINITIONS,
  computeKpiStatus,
  getDateRange,
  type DateRangeKey,
  type KpiValue,
} from '@/lib/kpi-config'

// ---------- Types ----------

export interface Notification {
  id: string
  text: string
  type: 'incident' | 'rejection' | 'info'
  time: string
  link: string
}

export interface PendingTask {
  id: string
  text: string
  link: string
}

export interface PendingApproval {
  id: string
  branchName: string
  truckPlate: string
  scheduledDate: string
  fileName: string
  uploadedAt: string
}

export interface ShipmentPerDay {
  date: string
  label: string
  count: number
}

export interface StageTime {
  stage: string
  label: string
  avgMinutes: number
}

export interface IncidentByType {
  type: string
  label: string
  count: number
}

export interface DashboardData {
  kpis: KpiValue[]
  statusCounts: Record<string, number>
  shipmentsPerDay: ShipmentPerDay[]
  stageTimes: StageTime[]
  incidentsByType: IncidentByType[]
  notifications: Notification[]
  pendingTasks: PendingTask[]
  pendingApprovals: PendingApproval[]
  loading: boolean
}

// ---------- Hook ----------

export function useDashboardData(dateRange: DateRangeKey): DashboardData {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)

  // Raw data
  const [shipments, setShipments] = useState<any[]>([])
  const [allShipments, setAllShipments] = useState<any[]>([])
  const [incidents, setIncidents] = useState<any[]>([])
  const [openIncidentCount, setOpenIncidentCount] = useState(0)
  const [orderConfirmations, setOrderConfirmations] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([])

  // ---------- Main data fetch ----------
  useEffect(() => {
    async function loadAll() {
      setLoading(true)
      const { from, to } = getDateRange(dateRange)
      const branchId = user?.branch_id

      // All queries in parallel
      const [
        shipmentsRes,
        allShipmentsRes,
        incidentsRes,
        openIncidentsRes,
        confirmationsRes,
        schedulesRes,
      ] = await Promise.all([
        // 1. Shipments in date range
        (() => {
          let q = supabase
            .from('shipments')
            .select('id, status, created_at, arrival_time, yard_entry_time, load_start, load_end, emision_guia_time, espera_salida_time, dispatch_time, recepcion_time')
            .gte('created_at', from)
            .lte('created_at', to)
          if (branchId) q = q.eq('branch_id', branchId)
          return q
        })(),

        // 2. ALL shipments (for status counts - preserving original behavior)
        (() => {
          let q = supabase.from('shipments').select('status')
          if (branchId) q = q.eq('branch_id', branchId)
          return q
        })(),

        // 3. Incidents in date range
        (() => {
          return supabase
            .from('incidents')
            .select('id, type, status, created_at')
            .gte('created_at', from)
            .lte('created_at', to)
        })(),

        // 4. Open incidents count
        supabase
          .from('incidents')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'abierta'),

        // 5. Order confirmations in date range
        (() => {
          return supabase
            .from('order_confirmations')
            .select('id, status, created_at')
            .gte('created_at', from)
            .lte('created_at', to)
        })(),

        // 6. Schedules in date range
        (() => {
          let q = supabase
            .from('schedules')
            .select('id, status, scheduled_date')
            .gte('scheduled_date', from.split('T')[0])
            .lte('scheduled_date', to.split('T')[0])
          if (branchId) q = q.eq('branch_id', branchId)
          return q
        })(),
      ])

      setShipments(shipmentsRes.data ?? [])
      setAllShipments(allShipmentsRes.data ?? [])
      setIncidents(incidentsRes.data ?? [])
      setOpenIncidentCount(openIncidentsRes.count ?? 0)
      setOrderConfirmations(confirmationsRes.data ?? [])
      setSchedules(schedulesRes.data ?? [])
      setLoading(false)
    }

    loadAll()
  }, [dateRange, user?.branch_id])

  // ---------- Notifications, Tasks, Approvals (independent of date range) ----------
  useEffect(() => {
    async function loadNotifications() {
      const items: Notification[] = []

      const { data: incidentData } = await supabase
        .from('incidents')
        .select('id, type, created_at, shipment:shipments(truck_id, truck:trucks(plate))')
        .eq('status', 'abierta')
        .order('created_at', { ascending: false })
        .limit(5)

      if (incidentData) {
        for (const inc of incidentData) {
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

      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      setNotifications(items.slice(0, 10))
    }

    async function loadPendingTasks() {
      const tasks: PendingTask[] = []
      const role = user?.role
      const statusCounts: Record<string, number> = {}
      allShipments.forEach((s: any) => {
        statusCounts[s.status] = (statusCounts[s.status] || 0) + 1
      })

      if (role === 'sucursal' && user?.branch_id) {
        const { data: schData } = await supabase
          .from('schedules')
          .select('id, scheduled_date, truck:trucks(plate), order_confirmations(id, status)')
          .eq('branch_id', user.branch_id)
          .eq('status', 'pending')
          .order('scheduled_date', { ascending: true })
          .limit(10)

        if (schData) {
          for (const sch of schData) {
            const confirmations = (sch.order_confirmations ?? []) as unknown as Array<{ id: string; status: string }>
            const hasValid = confirmations.some(c => c.status === 'pending_approval' || c.status === 'approved')
            if (!hasValid) {
              const truck = sch.truck as unknown as { plate: string } | null
              const plate = truck?.plate ?? 'Sin patente'
              const dateStr = format(new Date(sch.scheduled_date + 'T12:00:00'), 'dd/MM/yyyy')
              tasks.push({ id: `sch-${sch.id}`, text: `Confirmar pedido para ${dateStr} - ${plate}`, link: '/confirmacion-pedidos' })
            }
          }
        }
      } else if (role === 'supervisor' || role === 'admin') {
        const { data: pending } = await supabase
          .from('order_confirmations')
          .select('id, schedule:schedules(truck:trucks(plate), branch:branches(name))')
          .eq('status', 'pending_approval')
          .order('uploaded_at', { ascending: false })
          .limit(10)

        if (pending) {
          for (const item of pending) {
            const schedule = item.schedule as unknown as { truck: { plate: string } | null; branch: { name: string } | null } | null
            const plate = schedule?.truck?.plate ?? 'Sin patente'
            const branchName = schedule?.branch?.name ?? 'Sucursal'
            tasks.push({ id: `appr-${item.id}`, text: `Aprobar pedido de ${branchName} - ${plate}`, link: '/confirmacion-pedidos' })
          }
        }
      } else if (role === 'planta') {
        const statusTasks: Array<{ status: ShipmentStatus; label: string }> = [
          { status: 'en_carga', label: 'camiones en carga' },
          { status: 'espera_salida', label: 'esperando salida' },
          { status: 'en_puerta', label: 'camiones en puerta' },
          { status: 'en_patio', label: 'camiones en patio' },
          { status: 'carga_terminada', label: 'con carga terminada' },
          { status: 'emision_guia', label: 'en emision de guia' },
        ]
        for (const st of statusTasks) {
          const c = statusCounts[st.status] ?? 0
          if (c > 0) {
            tasks.push({ id: `task-${st.status}`, text: `${c} ${st.label}`, link: '/patio' })
          }
        }
      }

      setPendingTasks(tasks)
    }

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
        setPendingApprovals(data.map((row) => {
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
        }))
      }
    }

    loadNotifications()
    loadPendingTasks()
    loadPendingApprovals()
  }, [user?.branch_id, user?.role, allShipments])

  // ---------- Computed: Status Counts ----------
  const statusCounts = useMemo(() => {
    const grouped: Record<string, number> = {}
    allShipments.forEach((s: any) => {
      grouped[s.status] = (grouped[s.status] || 0) + 1
    })
    return grouped
  }, [allShipments])

  // ---------- Computed: KPIs ----------
  const kpis = useMemo<KpiValue[]>(() => {
    const totalShipments = shipments.length
    const completedShipments = shipments.filter((s: any) => s.recepcion_time).length

    // Average plant time (dispatch_time - arrival_time)
    const plantTimes = shipments
      .filter((s: any) => s.dispatch_time && s.arrival_time)
      .map((s: any) => differenceInMinutes(new Date(s.dispatch_time), new Date(s.arrival_time)))
    const avgPlantTime = plantTimes.length > 0 ? Math.round(plantTimes.reduce((a, b) => a + b, 0) / plantTimes.length) : 0

    // Average load time (load_end - load_start)
    const loadTimes = shipments
      .filter((s: any) => s.load_end && s.load_start)
      .map((s: any) => differenceInMinutes(new Date(s.load_end), new Date(s.load_start)))
    const avgLoadTime = loadTimes.length > 0 ? Math.round(loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length) : 0

    // Dispatch rate
    const dispatched = shipments.filter((s: any) =>
      s.status === 'en_ruta' || s.status === 'en_recepcion' || s.dispatch_time
    ).length
    const dispatchRate = totalShipments > 0 ? Math.round((dispatched / totalShipments) * 100) : 0

    // Order rejection rate
    const totalConf = orderConfirmations.length
    const rejectedConf = orderConfirmations.filter((c: any) => c.status === 'rejected').length
    const rejectionRate = totalConf > 0 ? Math.round((rejectedConf / totalConf) * 100) : 0

    // Schedule compliance
    const confirmedSchedules = schedules.filter((s: any) => s.status === 'confirmed' || s.status === 'completed').length
    const totalSchedules = schedules.length
    const compliance = totalSchedules > 0 ? Math.round((confirmedSchedules / totalSchedules) * 100) : 0

    const rawValues: Record<string, number> = {
      shipments_period: totalShipments,
      shipments_completed: completedShipments,
      avg_plant_time: avgPlantTime,
      avg_load_time: avgLoadTime,
      dispatch_rate: dispatchRate,
      open_incidents: openIncidentCount,
      order_rejection_rate: rejectionRate,
      schedule_compliance: compliance,
    }

    return KPI_DEFINITIONS.map((def) => {
      const value = rawValues[def.key] ?? 0
      const target = def.targets[dateRange]
      const status = computeKpiStatus(value, target, def.direction)
      return {
        key: def.key,
        label: def.label,
        icon: def.icon,
        unit: def.unit,
        value,
        target,
        status,
        direction: def.direction,
      }
    })
  }, [shipments, openIncidentCount, orderConfirmations, schedules, dateRange])

  // ---------- Computed: Shipments per day (last 7 days) ----------
  const shipmentsPerDay = useMemo<ShipmentPerDay[]>(() => {
    const days: ShipmentPerDay[] = []
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i)
      const dateStr = format(d, 'yyyy-MM-dd')
      const label = format(d, 'EEE dd', { locale: es })
      const count = shipments.filter((s: any) => {
        const sDate = (s.created_at ?? '').substring(0, 10)
        return sDate === dateStr
      }).length
      days.push({ date: dateStr, label, count })
    }
    return days
  }, [shipments])

  // ---------- Computed: Stage times ----------
  const stageTimes = useMemo<StageTime[]>(() => {
    const stages: Array<{ key: string; label: string; startField: string; endField: string }> = [
      { key: 'gate_to_yard', label: 'Puerta → Patio', startField: 'arrival_time', endField: 'yard_entry_time' },
      { key: 'yard_to_load', label: 'Patio → Carga', startField: 'yard_entry_time', endField: 'load_start' },
      { key: 'loading', label: 'Carga', startField: 'load_start', endField: 'load_end' },
      { key: 'guide', label: 'Emision Guia', startField: 'load_end', endField: 'emision_guia_time' },
      { key: 'wait_exit', label: 'Espera Salida', startField: 'emision_guia_time', endField: 'espera_salida_time' },
      { key: 'dispatch', label: 'Despacho', startField: 'espera_salida_time', endField: 'dispatch_time' },
    ]

    return stages.map(({ key, label, startField, endField }) => {
      const times = shipments
        .filter((s: any) => s[startField] && s[endField])
        .map((s: any) => differenceInMinutes(new Date(s[endField]), new Date(s[startField])))
        .filter(t => t >= 0 && t < 1440) // discard negatives and > 24h outliers

      const avg = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0
      return { stage: key, label, avgMinutes: avg }
    })
  }, [shipments])

  // ---------- Computed: Incidents by type ----------
  const incidentsByType = useMemo<IncidentByType[]>(() => {
    const typeCounts: Record<string, number> = {}
    incidents.forEach((inc: any) => {
      typeCounts[inc.type] = (typeCounts[inc.type] || 0) + 1
    })

    return Object.entries(typeCounts).map(([type, count]) => ({
      type,
      label: INCIDENT_TYPES.find(t => t.value === type)?.label ?? type,
      count,
    }))
  }, [incidents])

  return {
    kpis,
    statusCounts,
    shipmentsPerDay,
    stageTimes,
    incidentsByType,
    notifications,
    pendingTasks,
    pendingApprovals,
    loading,
  }
}
