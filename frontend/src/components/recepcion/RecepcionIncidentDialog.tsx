import { useState } from 'react'
import { toast } from 'sonner'
import { FileText, AlertTriangle } from 'lucide-react'
import { WindowDialog } from '@/components/shared/WindowDialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { INCIDENT_TYPES } from '@/lib/constants'
import type { Tables, Json } from '@/lib/types'

interface RecepcionIncidentDialogProps {
  open: boolean
  onClose: () => void
  shipment: (Tables<'shipments'> & { truck: Tables<'trucks'> | null; driver: Tables<'drivers'> | null }) | null
  onCreated?: () => void
}

interface DispatchDocument {
  name?: string
  url?: string
  type?: string
  [key: string]: unknown
}

function isImageUrl(url: string | undefined): boolean {
  if (!url) return false
  const lower = url.toLowerCase()
  return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp') || lower.endsWith('.gif')
}

export function RecepcionIncidentDialog({ open, onClose, shipment, onCreated }: RecepcionIncidentDialogProps) {
  const { user } = useAuth()
  const [incidentType, setIncidentType] = useState('')
  const [description, setDescription] = useState('')
  const [selectedDocs, setSelectedDocs] = useState<Set<number>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  // Parse dispatch_documents safely
  const documents: DispatchDocument[] = (() => {
    if (!shipment?.dispatch_documents) return []
    const docs = shipment.dispatch_documents
    if (Array.isArray(docs)) return docs as DispatchDocument[]
    return []
  })()

  function handleToggleDoc(index: number) {
    setSelectedDocs((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  function handleClose() {
    setIncidentType('')
    setDescription('')
    setSelectedDocs(new Set())
    onClose()
  }

  async function handleSubmit() {
    if (!shipment || !incidentType || !description.trim()) return

    setSubmitting(true)
    try {
      const affectedDocs = Array.from(selectedDocs).map((i) => documents[i])

      const { error } = await supabase.from('incidents').insert({
        shipment_id: shipment.id,
        type: incidentType,
        description: description.trim(),
        reported_by: user?.id ?? null,
        affected_documents: (affectedDocs.length > 0 ? affectedDocs : null) as Json,
      })

      if (error) throw error

      toast.success('Incidencia reportada correctamente')
      setIncidentType('')
      setDescription('')
      setSelectedDocs(new Set())
      onCreated?.()
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Error al reportar incidencia')
    } finally {
      setSubmitting(false)
    }
  }

  const title = shipment
    ? `Reportar Incidencia - ${shipment.truck?.plate ?? 'Sin patente'}`
    : 'Reportar Incidencia'

  const canSubmit = !!incidentType && description.trim().length > 0 && !submitting

  return (
    <WindowDialog
      open={open}
      onClose={handleClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            className="gap-1"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            <AlertTriangle className="h-4 w-4" />
            {submitting ? 'Reportando...' : 'Reportar Incidencia'}
          </Button>
        </>
      }
    >
      {shipment ? (
        <div className="space-y-5">
          {/* Shipment info header */}
          <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <div>
              <span className="text-muted-foreground">Patente:</span>{' '}
              <span className="font-semibold">{shipment.truck?.plate ?? '---'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Conductor:</span>{' '}
              <span className="font-semibold">{shipment.driver?.name ?? '---'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">N Sello:</span>{' '}
              <span className="font-semibold">{shipment.seal_number ?? '---'}</span>
            </div>
          </div>

          {/* Dispatch documents */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Documentos de despacho afectados</Label>
            {documents.length > 0 ? (
              <div className="space-y-2 rounded-lg border p-3">
                {documents.map((doc, index) => (
                  <label
                    key={index}
                    className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedDocs.has(index)}
                      onCheckedChange={() => handleToggleDoc(index)}
                    />
                    {isImageUrl(doc.url) ? (
                      <img
                        src={doc.url}
                        alt={doc.name ?? `Documento ${index + 1}`}
                        className="h-10 w-10 rounded border object-cover shrink-0"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded border bg-muted shrink-0">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <span className="text-sm">
                      {doc.name ?? `Documento ${index + 1}`}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                No hay documentos de despacho adjuntos
              </div>
            )}
          </div>

          {/* Incident type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tipo de incidencia</Label>
            <Select value={incidentType} onValueChange={setIncidentType}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione tipo de incidencia" />
              </SelectTrigger>
              <SelectContent>
                {INCIDENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Descripcion / Comentarios</Label>
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Describa la incidencia en detalle..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
      ) : null}
    </WindowDialog>
  )
}
