import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/types'
import type { ShipmentStatus } from '@/lib/constants'

export type ShipmentWithRelations = Tables<'shipments'> & {
  truck: Tables<'trucks'> | null
  driver: Tables<'drivers'> | null
  branch: Tables<'branches'> | null
  incidents: { id: string; status: string }[]
}

const SHIPMENT_SELECT = `
  *,
  truck:trucks(*),
  driver:drivers(*),
  branch:branches(*),
  incidents(id, status)
`

export function useShipments() {
  const { user } = useAuth()
  const [shipments, setShipments] = useState<ShipmentWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  const branchId = user?.branch_id

  const fetchShipments = useCallback(async () => {
    let query = supabase
      .from('shipments')
      .select(SHIPMENT_SELECT)
      .not('status', 'in', '("en_ruta","en_recepcion")')
      .order('created_at', { ascending: false })

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    const { data, error } = await query

    if (!error && data) {
      setShipments(data as unknown as ShipmentWithRelations[])
    }
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    fetchShipments()

    const channel = supabase
      .channel(`shipments:${branchId ?? 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shipments',
          ...(branchId ? { filter: `branch_id=eq.${branchId}` } : {}),
        },
        () => {
          fetchShipments()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [branchId, fetchShipments])

  async function createShipment(data: TablesInsert<'shipments'>) {
    const { data: newShipment, error } = await supabase
      .from('shipments')
      .insert(data)
      .select(SHIPMENT_SELECT)
      .single()

    if (error) throw error
    return newShipment
  }

  async function updateShipment(id: string, data: TablesUpdate<'shipments'>) {
    const { error } = await supabase
      .from('shipments')
      .update(data)
      .eq('id', id)

    if (error) throw error
  }

  async function transitionStatus(
    id: string,
    newStatus: ShipmentStatus,
    extraFields?: TablesUpdate<'shipments'>
  ) {
    const now = new Date().toISOString()
    const timestampMap: Partial<Record<ShipmentStatus, Partial<TablesUpdate<'shipments'>>>> = {
      en_puerta:       { arrival_time: now, gate_entry_time: now },
      en_patio:        { yard_entry_time: now },
      en_carga:        { load_start: now },
      carga_terminada: { load_end: now },
      emision_guia:    { emision_guia_time: now },
      espera_salida:   { espera_salida_time: now },
      en_ruta:         { dispatch_time: now },
      en_recepcion:    { recepcion_time: now },
    }

    const updateData: TablesUpdate<'shipments'> = {
      status: newStatus,
      ...timestampMap[newStatus],
      ...extraFields,
    }

    const { error } = await supabase
      .from('shipments')
      .update(updateData)
      .eq('id', id)

    if (error) throw error
  }

  return { shipments, loading, createShipment, updateShipment, transitionStatus, refetch: fetchShipments }
}
