import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { ArrivalForm } from '@/components/shared/ArrivalForm'
import type { TablesInsert } from '@/lib/types'

interface CreateShipmentDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (data: TablesInsert<'shipments'>) => Promise<unknown>
}

export function CreateShipmentDialog({ open, onClose, onCreate }: CreateShipmentDialogProps) {
  const { user } = useAuth()

  async function handleConfirm(driverId: string, truckId: string) {
    if (!user?.branch_id) return

    // Get truck plate for toast
    const { data: truckData } = await supabase.from('trucks').select('plate').eq('id', truckId).single()

    await onCreate({
      truck_id: truckId,
      driver_id: driverId,
      branch_id: user.branch_id,
      status: 'en_puerta',
      transport_company: null,
      cargo_type: null,
      arrival_time: new Date().toISOString(),
      gate_entry_time: new Date().toISOString(),
    })
    toast.success(`${truckData?.plate ?? 'Camion'} registrado en puerta`)
  }

  return (
    <ArrivalForm
      open={open}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Registrar Camion (Sin Agenda)"
    />
  )
}
