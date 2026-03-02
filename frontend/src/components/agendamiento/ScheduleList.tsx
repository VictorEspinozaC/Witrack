import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Truck, X, ArrowRight, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { ArrivalForm } from '@/components/shared/ArrivalForm'
import type { ScheduleWithRelations } from '@/hooks/useSchedules'

interface ScheduleListProps {
  schedules: ScheduleWithRelations[]
  onCancel: (id: string) => Promise<void>
  onRestore?: (id: string) => Promise<void>
  onRefresh: () => void
}

const operationTypeMap: Record<string, string> = {
  despacho: 'Despacho',
  recepcion: 'Recepcion',
}

const destinationTypeMap: Record<string, string> = {
  sucursal: 'Sucursal',
  proveedor: 'Proveedor',
  maquila: 'Maquila',
  cliente: 'Cliente',
}

function getDestinationLabel(s: ScheduleWithRelations): string {
  switch (s.destination_type) {
    case 'sucursal':
      return s.destination_branch?.name ?? 'Sucursal no asignada'
    case 'proveedor':
      return s.supplier?.name ?? 'Proveedor no asignado'
    case 'maquila':
      return s.maquila_supplier?.name ?? 'Maquila no asignada'
    case 'cliente':
      return s.client?.name ?? 'Cliente no asignado'
    default:
      return '---'
  }
}

const COLUMNS: { key: string; label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }[] = [
  { key: 'pending',   label: 'Pendiente',  variant: 'outline' },
  { key: 'confirmed', label: 'Confirmado', variant: 'default' },
  { key: 'cancelled', label: 'Cancelado',  variant: 'destructive' },
]

export function ScheduleList({ schedules, onCancel, onRestore, onRefresh }: ScheduleListProps) {
  const { user } = useAuth()
  const [arrivalSchedule, setArrivalSchedule] = useState<ScheduleWithRelations | null>(null)

  async function handleArrivalConfirm(driverId: string, truckId: string) {
    if (!arrivalSchedule || !user?.branch_id) return

    // Update schedule with driver + truck
    await supabase
      .from('schedules')
      .update({ truck_id: truckId, driver_id: driverId })
      .eq('id', arrivalSchedule.id)

    // Get updated truck info for toast
    const { data: truckData } = await supabase.from('trucks').select('plate').eq('id', truckId).single()

    // Create shipment en_puerta
    const { error } = await supabase.from('shipments').insert({
      truck_id: truckId,
      driver_id: driverId,
      branch_id: user.branch_id,
      status: 'en_puerta',
      schedule_id: arrivalSchedule.id,
      transport_company: arrivalSchedule.transport_supplier?.name ?? arrivalSchedule.transport_company ?? null,
      cargo_type: arrivalSchedule.cargo_type,
      arrival_time: new Date().toISOString(),
      gate_entry_time: new Date().toISOString(),
    })

    if (error) {
      toast.error('Error al registrar llegada')
      throw error
    }

    // Update schedule status
    await supabase.from('schedules').update({ status: 'confirmed' }).eq('id', arrivalSchedule.id)
    toast.success(`${truckData?.plate ?? 'Camion'} registrado en puerta`)
    setArrivalSchedule(null)
    onRefresh()
  }

  const canCancel = user?.role === 'admin'

  const grouped = COLUMNS.reduce<Record<string, ScheduleWithRelations[]>>((acc, col) => {
    acc[col.key] = schedules.filter((s) => s.status === col.key)
    return acc
  }, {})

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ minHeight: '280px' }}>
        {COLUMNS.map((col) => {
          const colSchedules = grouped[col.key] ?? []
          return (
            <div key={col.key} className="flex-1 min-w-[240px] max-w-sm flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <Badge variant={col.variant}>{col.label}</Badge>
                <span className="text-xs text-muted-foreground">{colSchedules.length}</span>
              </div>
              <ScrollArea className="flex-1 max-h-[400px]">
                <div className="space-y-2 pr-1">
                  {colSchedules.length === 0 && (
                    <p className="py-4 text-center text-xs text-muted-foreground">Sin agendamientos</p>
                  )}
                  {colSchedules.map((s) => (
                    <Card key={s.id} className="shadow-sm">
                      <CardContent className="p-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <Truck className="h-3 w-3 text-muted-foreground shrink-0" />
                          <p className="text-sm font-medium truncate">
                            {s.truck?.plate ?? 'Sin camion'}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {s.driver?.name ?? 'Sin conductor'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(s.scheduled_date + 'T00:00:00'), 'dd MMM', { locale: es })}
                          {s.scheduled_time ? ` ${s.scheduled_time.slice(0, 5)}` : ''}
                          {s.operation_type ? ` | ${operationTypeMap[s.operation_type] ?? s.operation_type}` : ''}
                        </p>
                        {s.destination_type && (
                          <p className="text-xs text-muted-foreground truncate">
                            {destinationTypeMap[s.destination_type] ?? s.destination_type}: {getDestinationLabel(s)}
                            {s.destination_type === 'sucursal' && s.transport_supplier
                              ? ` (${s.transport_supplier.name})`
                              : ''}
                          </p>
                        )}

                        {s.status === 'pending' && (
                          <div className="flex gap-1 pt-1">
                            <Button
                              size="sm"
                              variant="default"
                              className="gap-1 h-7 text-xs flex-1"
                              onClick={() => setArrivalSchedule(s)}
                            >
                              <ArrowRight className="h-3 w-3" /> Llego
                            </Button>
                            {canCancel && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => onCancel(s.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}

                        {s.status === 'cancelled' && onRestore && (
                          <div className="flex gap-1 pt-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 h-7 text-xs flex-1"
                              onClick={() => onRestore(s.id)}
                            >
                              <RotateCcw className="h-3 w-3" /> Restaurar
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )
        })}
      </div>

      <ArrivalForm
        open={!!arrivalSchedule}
        onClose={() => setArrivalSchedule(null)}
        onConfirm={handleArrivalConfirm}
        schedule={arrivalSchedule}
        title="Registrar Llegada"
      />
    </>
  )
}
