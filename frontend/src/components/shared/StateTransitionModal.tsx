import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { Upload, FileText, X, Save, CheckCircle2 } from 'lucide-react'
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
import { StatusBadge } from './StatusBadge'
import {
  STATE_TRANSITIONS,
  STATUS_LABELS,
  TRANSITION_ACTIONS,
  type ShipmentStatus,
} from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import type { ShipmentWithRelations } from '@/hooks/useShipments'
import type { TablesUpdate } from '@/lib/types'

interface StateTransitionModalProps {
  shipment: ShipmentWithRelations | null
  ramps: string[]
  open: boolean
  onClose: () => void
  onConfirm: (id: string, newStatus: ShipmentStatus, extra?: TablesUpdate<'shipments'>) => Promise<void>
}

interface UploadedDoc {
  name: string
  url: string
  type: string
}

interface PendingFile {
  file: File
  previewUrl: string | null
  type: 'image' | 'pdf'
}

export function StateTransitionModal({
  shipment,
  ramps,
  open,
  onClose,
  onConfirm,
}: StateTransitionModalProps) {
  const [ramp, setRamp] = useState('')
  const [sealNumber, setSealNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [savedDocs, setSavedDocs] = useState<UploadedDoc[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentStatus = shipment ? (shipment.status as ShipmentStatus) : null
  const nextStatuses = currentStatus ? STATE_TRANSITIONS[currentStatus] : []
  const nextStatus = nextStatuses.length > 0 ? nextStatuses[0] : null
  const needsRamp = nextStatus === 'en_carga'
  const needsSeal = nextStatus === 'carga_terminada'
  const needsDocuments = nextStatus === 'espera_salida'

  // Load already-saved documents when modal opens
  useEffect(() => {
    if (open && shipment && needsDocuments) {
      const existing = shipment.dispatch_documents
      if (Array.isArray(existing) && existing.length > 0) {
        setSavedDocs(existing as unknown as UploadedDoc[])
      } else {
        setSavedDocs([])
      }
    }
  }, [open, shipment?.id])

  if (!shipment || !currentStatus || !nextStatus) return null

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files
    if (!selected) return

    const newFiles: PendingFile[] = Array.from(selected).map((file) => {
      const isImage = file.type.startsWith('image/')
      return {
        file,
        previewUrl: isImage ? URL.createObjectURL(file) : null,
        type: isImage ? 'image' as const : 'pdf' as const,
      }
    })

    setPendingFiles((prev) => [...prev, ...newFiles])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removePending(index: number) {
    setPendingFiles((prev) => {
      const removed = prev[index]
      if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  function removeSaved(index: number) {
    setSavedDocs((prev) => prev.filter((_, i) => i !== index))
  }

  function cleanup() {
    pendingFiles.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl) })
    setPendingFiles([])
    setSavedDocs([])
    setRamp('')
    setSealNumber('')
  }

  function handleClose() {
    cleanup()
    onClose()
  }

  /** Upload pending files and save to shipment (partial save) */
  async function handleSave() {
    if (!shipment || pendingFiles.length === 0) return
    setSaving(true)
    try {
      const newDocs: UploadedDoc[] = []

      for (const f of pendingFiles) {
        const path = `dispatch/${shipment.id}/${Date.now()}-${f.file.name}`
        const { error: uploadError } = await supabase.storage
          .from('shipment-photos')
          .upload(path, f.file)

        if (uploadError) {
          toast.error(`Error al subir ${f.file.name}`)
          continue
        }

        const { data } = supabase.storage.from('shipment-photos').getPublicUrl(path)
        newDocs.push({ name: f.file.name, url: data.publicUrl, type: f.type })
      }

      // Merge with already saved docs
      const allDocs = [...savedDocs, ...newDocs]

      const { error } = await supabase
        .from('shipments')
        .update({ dispatch_documents: allDocs as unknown as TablesUpdate<'shipments'>['dispatch_documents'] })
        .eq('id', shipment.id)

      if (error) {
        toast.error('Error al guardar documentos')
        return
      }

      // Move pending to saved
      setSavedDocs(allDocs)
      pendingFiles.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl) })
      setPendingFiles([])
      toast.success(`${newDocs.length} documento${newDocs.length !== 1 ? 's' : ''} guardado${newDocs.length !== 1 ? 's' : ''}`)
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  /** Confirm transition (also saves any unsaved pending files) */
  async function handleConfirm() {
    if (!shipment) return

    const totalDocs = savedDocs.length + pendingFiles.length
    if (needsDocuments && totalDocs === 0) {
      toast.warning('Debe adjuntar al menos un documento antes de confirmar')
      return
    }

    setSubmitting(true)
    try {
      const extra: TablesUpdate<'shipments'> = {}
      if (needsRamp && ramp) extra.ramp_assignment = ramp
      if (needsSeal && sealNumber) extra.seal_number = sealNumber

      if (needsDocuments) {
        // Upload any remaining pending files
        const newDocs: UploadedDoc[] = []
        for (const f of pendingFiles) {
          const path = `dispatch/${shipment.id}/${Date.now()}-${f.file.name}`
          const { error: uploadError } = await supabase.storage
            .from('shipment-photos')
            .upload(path, f.file)

          if (uploadError) {
            toast.error(`Error al subir ${f.file.name}`)
            continue
          }

          const { data } = supabase.storage.from('shipment-photos').getPublicUrl(path)
          newDocs.push({ name: f.file.name, url: data.publicUrl, type: f.type })
        }

        const allDocs = [...savedDocs, ...newDocs]
        extra.dispatch_documents = allDocs as unknown as TablesUpdate<'shipments'>['dispatch_documents']
      }

      await onConfirm(shipment.id, nextStatus, extra)
      toast.success(`${shipment.truck?.plate} - ${STATUS_LABELS[nextStatus]}`)
      cleanup()
      onClose()
    } catch {
      toast.error('Error al cambiar estado')
    } finally {
      setSubmitting(false)
    }
  }

  const totalDocs = savedDocs.length + pendingFiles.length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={needsDocuments ? 'sm:max-w-lg' : 'sm:max-w-md'}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{TRANSITION_ACTIONS[currentStatus]}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <span className="text-lg font-bold">{shipment.truck?.plate}</span>
            <span className="text-sm text-muted-foreground">{shipment.driver?.name}</span>
          </div>

          <div className="flex items-center justify-center gap-3">
            <StatusBadge status={currentStatus} />
            <span className="text-muted-foreground">→</span>
            <StatusBadge status={nextStatus} />
          </div>

          {needsRamp && (
            <div className="space-y-2">
              <Label>Asignar Rampa</Label>
              <Select value={ramp} onValueChange={setRamp}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar rampa" />
                </SelectTrigger>
                <SelectContent>
                  {ramps.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {needsSeal && (
            <div className="space-y-2">
              <Label>Numero de Sello</Label>
              <Input
                placeholder="Ej: SEAL-001"
                value={sealNumber}
                onChange={(e) => setSealNumber(e.target.value)}
              />
            </div>
          )}

          {needsDocuments && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Documentación de Despacho</Label>
              <p className="text-xs text-muted-foreground">
                Adjunte imágenes de la estiba del camión y el PDF de la guía de despacho.
              </p>

              {/* Already saved documents */}
              {savedDocs.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-green-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Guardados ({savedDocs.length})
                  </p>
                  {savedDocs.map((doc, i) => (
                    <div key={`saved-${i}`} className="flex items-center gap-2 rounded-md border p-2 bg-green-50/50">
                      {doc.type === 'image' ? (
                        <img src={doc.url} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-red-100 shrink-0">
                          <FileText className="h-5 w-5 text-red-600" />
                        </div>
                      )}
                      <p className="text-sm truncate flex-1 min-w-0">{doc.name}</p>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeSaved(i)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Pending (not yet uploaded) files */}
              {pendingFiles.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-amber-700">
                    Pendientes de guardar ({pendingFiles.length})
                  </p>
                  {pendingFiles.map((f, i) => (
                    <div key={`pending-${i}`} className="flex items-center gap-2 rounded-md border border-dashed p-2 bg-amber-50/50">
                      {f.type === 'image' && f.previewUrl ? (
                        <img src={f.previewUrl} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-red-100 shrink-0">
                          <FileText className="h-5 w-5 text-red-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{f.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(f.file.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removePending(i)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {totalDocs === 0 && (
                <p className="text-xs text-destructive text-center">
                  * Debe adjuntar al menos un archivo para confirmar
                </p>
              )}
            </div>
          )}
        </div>

        {/* File action buttons - always visible outside scroll area */}
        {needsDocuments && (
          <div className="space-y-2 border-t pt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.pdf"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Buscar archivos
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                disabled={pendingFiles.length === 0 || saving}
                onClick={handleSave}
              >
                <Save className="h-4 w-4" />
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={submitting || (needsDocuments && totalDocs === 0)}
            size="lg"
          >
            {submitting ? 'Procesando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
