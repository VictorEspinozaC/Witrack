import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Download,
  X,
  Save,
} from 'lucide-react'
import { format, differenceInMinutes } from 'date-fns'
import { es } from 'date-fns/locale'
import { WindowDialog } from '@/components/shared/WindowDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { useOrderConfirmation, type SavedDocRef } from '@/hooks/useOrderConfirmation'
import { ORDER_CONFIRMATION_STATUS } from '@/lib/constants'
import type { ScheduleWithRelations } from '@/hooks/useSchedules'

interface Props {
  open: boolean
  onClose: () => void
  schedule: ScheduleWithRelations | null
}

interface PendingFile {
  file: File
  previewUrl: string | null
  type: 'image' | 'pdf' | 'excel'
}

function getDeadlineStart(scheduledDate: string): Date {
  const date = new Date(scheduledDate + 'T08:30:00')
  date.setDate(date.getDate() - 1)
  return date
}

function formatElapsed(minutes: number): string {
  if (minutes < 0) return 'Aun no inicia'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m}m`
}

function getDestinationLabel(s: ScheduleWithRelations): string {
  switch (s.destination_type) {
    case 'sucursal':
      return s.destination_branch?.name ?? 'Sucursal'
    case 'proveedor':
      return s.supplier?.name ?? 'Proveedor'
    case 'maquila':
      return s.maquila_supplier?.name ?? 'Maquila'
    case 'cliente':
      return s.client?.name ?? 'Cliente'
    default:
      return '---'
  }
}

function getFileType(file: File): 'image' | 'pdf' | 'excel' {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type === 'application/pdf') return 'pdf'
  return 'excel'
}

function getFileIcon(type: string) {
  if (type === 'image') return null // will use img preview
  if (type === 'pdf') return <FileText className="h-5 w-5 text-red-600" />
  return <FileSpreadsheet className="h-5 w-5 text-green-700" />
}

export function OrderConfirmationDialog({ open, onClose, schedule }: Props) {
  const { user } = useAuth()
  const { confirmation, loading, uploading, saveFiles, approve, reject } =
    useOrderConfirmation(schedule?.id ?? null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [savedDocs, setSavedDocs] = useState<SavedDocRef[]>([])
  const [saving, setSaving] = useState(false)

  const isSucursal = user?.role === 'sucursal'
  const isSupervisor = user?.role === 'supervisor'
  const isAdmin = user?.role === 'admin'
  const canUpload = isSucursal
  const canReview = isSupervisor || isAdmin

  const deadlineStart = schedule ? getDeadlineStart(schedule.scheduled_date) : null

  // Load saved docs when confirmation changes or dialog opens
  useEffect(() => {
    if (open && confirmation) {
      const files = (confirmation as Record<string, unknown>).files
      if (Array.isArray(files) && files.length > 0) {
        setSavedDocs(files as unknown as SavedDocRef[])
      } else if (confirmation.file_url && confirmation.file_name) {
        // Backward compat: single file
        setSavedDocs([{
          name: confirmation.file_name,
          url: confirmation.file_url,
          type: 'excel',
        }])
      } else {
        setSavedDocs([])
      }
    } else if (open) {
      setSavedDocs([])
    }
  }, [open, confirmation?.id])

  // Clean up pending files when dialog closes
  useEffect(() => {
    if (!open) {
      pendingFiles.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl) })
      setPendingFiles([])
    }
  }, [open])

  // Update elapsed time every minute
  useEffect(() => {
    if (!deadlineStart) return
    function tick() {
      setElapsed(differenceInMinutes(new Date(), deadlineStart!))
    }
    tick()
    const interval = setInterval(tick, 60_000)
    return () => clearInterval(interval)
  }, [deadlineStart])

  // Reset reject form when confirmation changes
  useEffect(() => {
    setShowRejectForm(false)
    setRejectionReason('')
  }, [confirmation?.id])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files
    if (!selected) return

    const validTypes = [
      'image/jpeg', 'image/png', 'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ]

    const newFiles: PendingFile[] = []
    for (const file of Array.from(selected)) {
      if (!validTypes.includes(file.type)) {
        toast.error(`Tipo no soportado: ${file.name}`)
        continue
      }
      newFiles.push({
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        type: getFileType(file),
      })
    }

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

  async function handleSave() {
    if (pendingFiles.length === 0) return
    setSaving(true)
    try {
      const allDocs = await saveFiles(
        pendingFiles.map((f) => f.file),
        savedDocs
      )
      if (allDocs) {
        setSavedDocs(allDocs)
        pendingFiles.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl) })
        setPendingFiles([])
        toast.success(`${allDocs.length} archivo${allDocs.length !== 1 ? 's' : ''} guardado${allDocs.length !== 1 ? 's' : ''}`)
      }
    } catch {
      toast.error('Error al guardar archivos')
    } finally {
      setSaving(false)
    }
  }

  async function handleApprove() {
    try {
      await approve()
      toast.success('Pedido aprobado')
    } catch {
      toast.error('Error al aprobar')
    }
  }

  async function handleReject() {
    if (!rejectionReason.trim()) {
      toast.warning('Debe indicar un motivo de rechazo')
      return
    }
    try {
      await reject(rejectionReason.trim())
      toast.success('Pedido rechazado')
      setRejectionReason('')
      setShowRejectForm(false)
    } catch {
      toast.error('Error al rechazar')
    }
  }

  const statusKey = confirmation?.status as keyof typeof ORDER_CONFIRMATION_STATUS | undefined
  const statusInfo = statusKey ? ORDER_CONFIRMATION_STATUS[statusKey] : null

  const title = schedule
    ? `Confirmacion Pedido - ${schedule.truck?.plate ?? 'Sin camion'}`
    : 'Confirmacion Pedido'

  const totalDocs = savedDocs.length + pendingFiles.length
  const showUploadArea = canUpload && (!confirmation || confirmation.status === 'rejected')
  const showSavedFilesForSucursal = canUpload && confirmation?.status === 'pending_approval'

  return (
    <WindowDialog
      open={open}
      onClose={onClose}
      title={title}
      footer={<Button variant="outline" onClick={onClose}>Cerrar</Button>}
    >
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : schedule ? (
        <div className="space-y-5">
          {/* Schedule info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Fecha agendada:</span>{' '}
              <span className="font-medium">
                {format(new Date(schedule.scheduled_date + 'T12:00:00'), "EEEE dd 'de' MMMM", { locale: es })}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Hora:</span>{' '}
              <span className="font-medium">{schedule.scheduled_time?.slice(0, 5) ?? '---'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Camion:</span>{' '}
              <span className="font-medium">{schedule.truck?.plate ?? 'Sin asignar'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Conductor:</span>{' '}
              <span className="font-medium">{schedule.driver?.name ?? 'Sin asignar'}</span>
            </div>
            {schedule.destination_type && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Destino:</span>{' '}
                <span className="font-medium">{getDestinationLabel(schedule)}</span>
              </div>
            )}
          </div>

          {/* Time indicator */}
          {deadlineStart && (
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                elapsed < 0
                  ? 'bg-muted/50 border-muted-foreground/20'
                  : elapsed < 120
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : elapsed < 240
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                Desde 8:30 AM (
                {format(deadlineStart, "dd MMM", { locale: es })}) —{' '}
                <span className="font-semibold">{formatElapsed(elapsed)}</span> transcurrido
              </span>
            </div>
          )}

          {/* Current status */}
          {statusInfo && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Estado:</span>
              <Badge variant="outline" className={`${statusInfo.color} border font-medium`}>
                {statusInfo.label}
              </Badge>
            </div>
          )}

          {/* ===== SUCURSAL VIEW ===== */}
          {canUpload && (
            <div className="space-y-3">
              {/* No confirmation or rejected -> upload area with multi-file */}
              {showUploadArea && (
                <div className="space-y-3">
                  {/* Show rejection reason */}
                  {confirmation?.status === 'rejected' && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Pedido rechazado</p>
                        <p className="text-red-700 mt-0.5">
                          Motivo: {confirmation.rejection_reason ?? 'Sin motivo'}
                        </p>
                        {confirmation.reviewer && (
                          <p className="text-red-600 text-xs mt-1">
                            Por: {confirmation.reviewer.full_name ?? confirmation.reviewer.email}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Scrollable file area */}
                  <div className="max-h-[60vh] overflow-y-auto space-y-3">
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
                              <div className="flex h-10 w-10 items-center justify-center rounded bg-muted shrink-0">
                                {getFileIcon(doc.type)}
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
                              <div className="flex h-10 w-10 items-center justify-center rounded bg-muted shrink-0">
                                {getFileIcon(f.type)}
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
                      <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-6 text-center">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {confirmation?.status === 'rejected'
                              ? 'Subir nuevos archivos'
                              : 'Subir archivos de confirmacion'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Excel, PDF, imagenes (max 10 MB c/u)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action buttons - always visible below scroll area */}
                  <div className="space-y-2 border-t pt-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,.pdf,.xlsx,.xls"
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
                        disabled={pendingFiles.length === 0 || saving || uploading}
                        onClick={handleSave}
                      >
                        <Save className="h-4 w-4" />
                        {saving || uploading ? 'Guardando...' : 'Guardar'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Pending approval -> show saved files (read-only for sucursal) */}
              {showSavedFilesForSucursal && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <Clock className="h-5 w-5 shrink-0" />
                    <p className="font-medium">Esperando aprobacion del supervisor...</p>
                  </div>

                  {savedDocs.length > 0 && (
                    <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                      <p className="text-xs font-medium text-muted-foreground">
                        Archivos subidos ({savedDocs.length})
                      </p>
                      {savedDocs.map((doc, i) => (
                        <div key={`saved-${i}`} className="flex items-center gap-2 rounded-md border p-2 bg-muted/30">
                          {doc.type === 'image' ? (
                            <img src={doc.url} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-muted shrink-0">
                              {getFileIcon(doc.type)}
                            </div>
                          )}
                          <p className="text-sm truncate flex-1 min-w-0">{doc.name}</p>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Approved -> success */}
              {confirmation?.status === 'approved' && (
                <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-medium">Pedido aprobado</p>
                    <p className="text-green-700 text-xs mt-1">
                      {savedDocs.length > 0
                        ? `${savedDocs.length} archivo${savedDocs.length !== 1 ? 's' : ''}`
                        : `Archivo: ${confirmation.file_name}`}
                    </p>
                    {confirmation.reviewer && (
                      <p className="text-green-600 text-xs mt-0.5">
                        Aprobado por: {confirmation.reviewer.full_name ?? confirmation.reviewer.email}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== SUPERVISOR / ADMIN VIEW ===== */}
          {canReview && (
            <div className="space-y-3">
              {/* No confirmation yet */}
              {!confirmation && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No se ha subido ningun archivo aun.
                </p>
              )}

              {/* Pending approval -> review actions with file list */}
              {confirmation?.status === 'pending_approval' && (
                <div className="space-y-3">
                  {/* File list - scrollable */}
                  <div className="max-h-[40vh] overflow-y-auto space-y-1.5">
                    <p className="text-xs font-medium text-amber-700 flex items-center gap-1">
                      Archivos pendientes de revision ({savedDocs.length})
                    </p>
                    {savedDocs.map((doc, i) => (
                      <div key={`review-${i}`} className="flex items-center gap-2 rounded-md border border-amber-200 p-2 bg-amber-50/50">
                        {doc.type === 'image' ? (
                          <img src={doc.url} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-muted shrink-0">
                            {getFileIcon(doc.type)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{doc.name}</p>
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                        >
                          <Download className="h-3.5 w-3.5" /> Descargar
                        </a>
                      </div>
                    ))}

                    {/* Fallback: if no savedDocs but has legacy single file */}
                    {savedDocs.length === 0 && confirmation.file_name && (
                      <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        <FileSpreadsheet className="h-5 w-5 shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium">{confirmation.file_name}</p>
                        </div>
                        <a
                          href={confirmation.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Download className="h-3.5 w-3.5" /> Descargar
                        </a>
                      </div>
                    )}
                  </div>

                  <p className="text-amber-700 text-xs">
                    Subido por: {confirmation.uploader?.full_name ?? confirmation.uploader?.email ?? '---'}
                    {' — '}
                    {format(new Date(confirmation.uploaded_at), "dd MMM HH:mm", { locale: es })}
                  </p>

                  {!showRejectForm ? (
                    <div className="flex gap-2">
                      <Button className="flex-1 gap-1" onClick={handleApprove}>
                        <CheckCircle2 className="h-4 w-4" /> Aprobar
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1 gap-1"
                        onClick={() => setShowRejectForm(true)}
                      >
                        <XCircle className="h-4 w-4" /> Rechazar
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-sm font-medium text-red-800">Motivo del rechazo:</p>
                      <Input
                        placeholder="Indique el motivo..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="bg-white"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-1"
                          onClick={handleReject}
                        >
                          Confirmar Rechazo
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowRejectForm(false)
                            setRejectionReason('')
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Approved */}
              {confirmation?.status === 'approved' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium">Pedido aprobado</p>
                      {confirmation.reviewer && (
                        <p className="text-green-600 text-xs mt-0.5">
                          Aprobado por: {confirmation.reviewer.full_name ?? confirmation.reviewer.email}
                          {confirmation.reviewed_at &&
                            ` — ${format(new Date(confirmation.reviewed_at), "dd MMM HH:mm", { locale: es })}`}
                        </p>
                      )}
                    </div>
                  </div>
                  {savedDocs.length > 0 && (
                    <div className="max-h-[30vh] overflow-y-auto space-y-1.5">
                      {savedDocs.map((doc, i) => (
                        <div key={`approved-${i}`} className="flex items-center gap-2 rounded-md border p-2 bg-green-50/30">
                          {doc.type === 'image' ? (
                            <img src={doc.url} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-muted shrink-0">
                              {getFileIcon(doc.type)}
                            </div>
                          )}
                          <p className="text-sm truncate flex-1 min-w-0">{doc.name}</p>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                          >
                            <Download className="h-3.5 w-3.5" /> Descargar
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Rejected */}
              {confirmation?.status === 'rejected' && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Pedido rechazado</p>
                    <p className="text-red-700 text-xs mt-0.5">
                      Motivo: {confirmation.rejection_reason ?? 'Sin motivo'}
                    </p>
                    {confirmation.reviewer && (
                      <p className="text-red-600 text-xs mt-0.5">
                        Rechazado por: {confirmation.reviewer.full_name ?? confirmation.reviewer.email}
                        {confirmation.reviewed_at &&
                          ` — ${format(new Date(confirmation.reviewed_at), "dd MMM HH:mm", { locale: es })}`}
                      </p>
                    )}
                    <p className="text-red-600 text-xs mt-1">Esperando que el usuario suba un nuevo archivo...</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== READ ONLY for other roles ===== */}
          {!canUpload && !canReview && (
            <div className="text-sm text-muted-foreground text-center py-4">
              {confirmation ? (
                <p>
                  Estado: <span className="font-medium">{statusInfo?.label ?? confirmation.status}</span>
                  {' — '}{savedDocs.length > 0 ? `${savedDocs.length} archivos` : confirmation.file_name}
                </p>
              ) : (
                <p>No se ha subido ningun archivo aun.</p>
              )}
            </div>
          )}
        </div>
      ) : null}
    </WindowDialog>
  )
}
