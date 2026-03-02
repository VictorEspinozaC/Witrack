import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { INCIDENT_TYPES } from '@/lib/constants'

interface IncidentFormProps {
  open: boolean
  onClose: () => void
  shipmentId?: string
  onCreated?: () => void
}

export function IncidentForm({ open, onClose, shipmentId, onCreated }: IncidentFormProps) {
  const { user } = useAuth()
  const [type, setType] = useState('')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!type || !description || !shipmentId) return

    setSubmitting(true)
    try {
      let photoUrl: string | null = null

      if (photo) {
        const ext = photo.name.split('.').pop()
        const path = `incidents/${shipmentId}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('shipment-photos')
          .upload(path, photo)
        if (!uploadError) {
          const { data } = supabase.storage.from('shipment-photos').getPublicUrl(path)
          photoUrl = data.publicUrl
        }
      }

      const { error } = await supabase.from('incidents').insert({
        shipment_id: shipmentId,
        type,
        description,
        photo_url: photoUrl,
        reported_by: user?.id ?? null,
      })

      if (error) throw error

      toast.success('Incidencia reportada')
      setType('')
      setDescription('')
      setPhoto(null)
      onCreated?.()
      onClose()
    } catch {
      toast.error('Error al reportar incidencia')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reportar Incidencia</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Incidencia *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                {INCIDENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descripcion *</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describa el problema..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Foto (opcional)</Label>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={submitting || !type || !description}>
              {submitting ? 'Enviando...' : 'Reportar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
