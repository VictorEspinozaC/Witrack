import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Tables, TablesInsert } from '@/lib/types'

export type ScheduleWithRelations = Tables<'schedules'> & {
  truck: Tables<'trucks'> | null
  driver: Tables<'drivers'> | null
  destination_branch: Tables<'branches'> | null
  transport_supplier: Tables<'suppliers'> | null
  supplier: Tables<'suppliers'> | null
  maquila_supplier: Tables<'suppliers'> | null
  client: Tables<'clients'> | null
}

const SCHEDULE_SELECT = `
  *,
  truck:trucks(*),
  driver:drivers(*),
  destination_branch:branches!schedules_destination_branch_id_fkey(*),
  transport_supplier:suppliers!schedules_transport_supplier_id_fkey(*),
  supplier:suppliers!schedules_supplier_id_fkey(*),
  maquila_supplier:suppliers!schedules_maquila_supplier_id_fkey(*),
  client:clients!schedules_client_id_fkey(*)
`

interface UseSchedulesOptions {
  dateRange?: { from: string; to: string }
  /** Override branch_id filter. Pass null to see all branches. */
  branchId?: string | null
}

export function useSchedules(options?: UseSchedulesOptions | { from: string; to: string }) {
  const { user } = useAuth()
  const [schedules, setSchedules] = useState<ScheduleWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  // Support both old API (dateRange object) and new API (options object)
  const dateRange = options && 'from' in options ? options as { from: string; to: string } : (options as UseSchedulesOptions)?.dateRange

  // branchId: use override if provided, otherwise default to user's branch
  const branchIdOverride = options && !('from' in options) ? (options as UseSchedulesOptions).branchId : undefined
  const branchId = branchIdOverride !== undefined ? branchIdOverride : user?.branch_id

  const fetchSchedules = useCallback(async () => {
    let query = supabase
      .from('schedules')
      .select(SCHEDULE_SELECT)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true })

    if (branchId) query = query.eq('branch_id', branchId)
    if (dateRange?.from) query = query.gte('scheduled_date', dateRange.from)
    if (dateRange?.to) query = query.lte('scheduled_date', dateRange.to)

    const { data, error } = await query
    if (!error && data) {
      setSchedules(data as unknown as ScheduleWithRelations[])
    }
    setLoading(false)
  }, [branchId, dateRange?.from, dateRange?.to])

  useEffect(() => {
    fetchSchedules()

    const channel = supabase
      .channel(`schedules:${branchId ?? 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedules',
          ...(branchId ? { filter: `branch_id=eq.${branchId}` } : {}),
        },
        () => fetchSchedules()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [branchId, fetchSchedules])

  async function createSchedule(data: TablesInsert<'schedules'>) {
    const { error } = await supabase.from('schedules').insert(data)
    if (error) throw error
  }

  async function cancelSchedule(id: string) {
    const { error } = await supabase.from('schedules').update({ status: 'cancelled' }).eq('id', id)
    if (error) throw error
  }

  async function confirmSchedule(id: string) {
    const { error } = await supabase.from('schedules').update({ status: 'confirmed' }).eq('id', id)
    if (error) throw error
  }

  async function restoreSchedule(id: string) {
    const { error } = await supabase.from('schedules').update({ status: 'pending' }).eq('id', id)
    if (error) throw error
  }

  return { schedules, loading, createSchedule, cancelSchedule, confirmSchedule, restoreSchedule, refetch: fetchSchedules }
}
