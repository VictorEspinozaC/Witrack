import { useState, useEffect, useRef } from 'react'
import { Download, Upload, CheckCircle, AlertCircle, FileSpreadsheet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Tables } from '@/lib/types'

// ---------- Types ----------

interface ParsedRow {
  rowIndex: number
  fecha: string          // display: dd/mm/yyyy
  hora: string           // display: HH:MM
  operationType: string  // display: Despacho/Recepcion
  codigo: string         // branch code
  sucursalName: string   // display
  rut: string            // transport rut
  transporteName: string // display
  // Resolved IDs
  branchId: string | null
  transportSupplierId: string | null
  // Validation
  errors: string[]
  valid: boolean
  // Parsed values
  parsedDate: string     // yyyy-MM-dd
  parsedTime: string     // HH:MM
}

interface BulkScheduleUploadProps {
  open: boolean
  onClose: () => void
  onComplete: () => void
}

// ---------- Helpers ----------

/** Parse Excel serial date number or dd/mm/yyyy string → yyyy-MM-dd */
function parseExcelDate(raw: unknown): string {
  const val = raw ?? ''
  const num = Number(val)

  // Excel serial date (number > 40000 = ~2009+)
  if (!isNaN(num) && num > 40000 && num < 70000) {
    // Excel epoch: 1899-12-30, with the Lotus 1-2-3 leap year bug
    const utcDays = num - 25569 // days since 1970-01-01
    const date = new Date(utcDays * 86400000)
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
  }

  // Try dd/mm/yyyy or dd-mm-yyyy
  const str = String(val).trim()
  const parts = str.split(/[\/\-]/)
  if (parts.length === 3) {
    const [d, m, y] = parts
    const day = parseInt(d, 10)
    const month = parseInt(m, 10)
    const year = parseInt(y, 10)
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2024 && year <= 2099) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  return ''
}

/** Parse Excel time fraction (0.2916... = 07:00) or HH:MM string → HH:MM */
function parseExcelTime(raw: unknown): string {
  const val = raw ?? ''
  const num = Number(val)

  // Excel time as decimal fraction of day (0.0 - 0.9999)
  if (!isNaN(num) && num >= 0 && num < 1) {
    const totalMinutes = Math.round(num * 1440)
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  // Already a string like "07:00" or "7:00"
  const str = String(val).trim()
  const match = str.match(/^(\d{1,2}):(\d{2})$/)
  if (match) {
    const h = parseInt(match[1], 10)
    const m = parseInt(match[2], 10)
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
  }

  return ''
}

/** Format yyyy-MM-dd → dd/mm/yyyy for display */
function displayDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ---------- Component ----------

export function BulkScheduleUpload({ open, onClose, onComplete }: BulkScheduleUploadProps) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [branches, setBranches] = useState<Tables<'branches'>[]>([])
  const [transportSuppliers, setTransportSuppliers] = useState<Tables<'suppliers'>[]>([])
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [inserting, setInserting] = useState(false)
  const [insertResult, setInsertResult] = useState<{ success: number; errors: number } | null>(null)

  // Load reference data when dialog opens
  useEffect(() => {
    if (!open) return
    setStep(1)
    setParsedRows([])
    setInsertResult(null)

    supabase
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setBranches(data ?? []))

    supabase
      .from('suppliers')
      .select('*')
      .eq('is_active', true)
      .contains('types', ['transporte'])
      .order('name')
      .then(({ data }) => setTransportSuppliers(data ?? []))
  }, [open])

  // ---------- Step 1: Generate & Download Template ----------

  function downloadTemplate() {
    // Hoja 1: Agendamiento
    const wsData = [
      ['Fecha (dd/mm/yyyy)', 'Hora (HH:MM)', 'Tipo de Operación', 'Codigo', 'Sucursal', 'RUT', 'Proveedor'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [
      { wch: 20 },  // Fecha
      { wch: 14 },  // Hora
      { wch: 18 },  // Tipo de Operación
      { wch: 10 },  // Codigo
      { wch: 22 },  // Sucursal
      { wch: 16 },  // RUT
      { wch: 40 },  // Proveedor
    ]

    // Hoja 2: Sucursales (Codigo + Nombre)
    const branchRows = [
      ['Codigo', 'Nombre'],
      ...branches.map((b) => [b.code, b.name]),
    ]
    const wsBranches = XLSX.utils.aoa_to_sheet(branchRows)
    wsBranches['!cols'] = [{ wch: 12 }, { wch: 30 }]

    // Hoja 3: Transportes (RUT + Nombre)
    const transportRows = [
      ['RUT', 'Nombre'],
      ...transportSuppliers.map((s) => [s.rut ?? '', s.name]),
    ]
    const wsTransport = XLSX.utils.aoa_to_sheet(transportRows)
    wsTransport['!cols'] = [{ wch: 16 }, { wch: 45 }]

    // Crear workbook
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Agendamiento')
    XLSX.utils.book_append_sheet(wb, wsBranches, 'Sucursales')
    XLSX.utils.book_append_sheet(wb, wsTransport, 'Transportes')

    XLSX.writeFile(wb, 'plantilla_agendamiento.xlsx')
    toast.success('Plantilla descargada')
  }

  // ---------- Step 2: Parse uploaded file ----------

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })

        const sheetName = wb.SheetNames[0]
        if (!sheetName) {
          toast.error('El archivo no contiene hojas')
          return
        }

        const ws = wb.Sheets[sheetName]
        // Read raw values (not formatted) to handle Excel dates/times as numbers
        const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true })

        if (rawRows.length < 2) {
          toast.error('El archivo no contiene datos (solo encabezado)')
          return
        }

        // Build lookup maps by CODE and RUT
        const branchByCode = new Map(branches.map((b) => [b.code.toUpperCase(), b]))
        const transportByRut = new Map(
          transportSuppliers
            .filter((s) => s.rut)
            .map((s) => [s.rut!.trim(), s])
        )

        const rows: ParsedRow[] = []

        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i]
          // Skip completely empty rows
          if (row.every((c) => String(c ?? '').trim() === '')) continue

          const fechaRaw = row[0]
          const horaRaw = row[1]
          const opTypeRaw = String(row[2] ?? '').trim()
          const codigoRaw = String(row[3] ?? '').trim()
          const sucursalNameRaw = String(row[4] ?? '').trim()
          const rutRaw = String(row[5] ?? '').trim()
          const transporteNameRaw = String(row[6] ?? '').trim()

          const errors: string[] = []

          // Parse & validate fecha
          const parsedDate = parseExcelDate(fechaRaw)
          if (!parsedDate) {
            errors.push('Fecha invalida')
          }

          // Parse & validate hora
          const parsedTime = parseExcelTime(horaRaw)
          if (!parsedTime) {
            errors.push('Hora invalida')
          }

          // Validate tipo operacion
          const opLower = opTypeRaw.toLowerCase()
          if (!opLower || (opLower !== 'despacho' && opLower !== 'recepcion' && opLower !== 'recepción')) {
            errors.push('Tipo operacion invalido')
          }

          // Resolve sucursal by code
          const branch = codigoRaw ? branchByCode.get(codigoRaw.toUpperCase()) : null
          if (!codigoRaw) {
            errors.push('Codigo sucursal requerido')
          } else if (!branch) {
            errors.push(`Codigo "${codigoRaw}" no encontrado`)
          }

          // Resolve transporte by RUT
          const transport = rutRaw ? transportByRut.get(rutRaw) : null
          if (!rutRaw) {
            errors.push('RUT transporte requerido')
          } else if (!transport) {
            errors.push(`RUT "${rutRaw}" no encontrado`)
          }

          rows.push({
            rowIndex: i + 1,
            fecha: parsedDate ? displayDate(parsedDate) : String(fechaRaw ?? ''),
            hora: parsedTime || String(horaRaw ?? ''),
            operationType: opTypeRaw || '—',
            codigo: codigoRaw,
            sucursalName: branch?.name ?? sucursalNameRaw,
            rut: rutRaw,
            transporteName: transport?.name ?? transporteNameRaw,
            branchId: branch?.id ?? null,
            transportSupplierId: transport?.id ?? null,
            errors,
            valid: errors.length === 0,
            parsedDate,
            parsedTime,
          })
        }

        if (rows.length === 0) {
          toast.error('No se encontraron filas con datos')
          return
        }

        setParsedRows(rows)
        setStep(2)
      } catch {
        toast.error('Error al leer el archivo Excel')
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  // ---------- Step 3: Insert ----------

  async function handleInsert() {
    if (!user?.branch_id) return

    const validRows = parsedRows.filter((r) => r.valid)
    if (validRows.length === 0) return

    setInserting(true)

    const records = validRows.map((r) => {
      const opType = r.operationType.toLowerCase().replace('ó', 'o')
      return {
        branch_id: user.branch_id!,
        scheduled_date: r.parsedDate,
        scheduled_time: r.parsedTime,
        operation_type: opType === 'recepcion' ? 'recepcion' : 'despacho',
        destination_type: 'sucursal',
        destination_branch_id: r.branchId,
        transport_supplier_id: r.transportSupplierId,
        status: 'pending',
      }
    })

    const { error } = await supabase.from('schedules').insert(records)

    if (error) {
      toast.error(`Error al insertar: ${error.message}`)
      setInserting(false)
      return
    }

    setInsertResult({ success: validRows.length, errors: parsedRows.length - validRows.length })
    setStep(3)
    setInserting(false)
    onComplete()
    toast.success(`${validRows.length} agenda${validRows.length > 1 ? 's' : ''} creada${validRows.length > 1 ? 's' : ''}`)
  }

  const validCount = parsedRows.filter((r) => r.valid).length
  const invalidCount = parsedRows.length - validCount

  function handleClose() {
    setParsedRows([])
    setStep(1)
    setInsertResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-3xl max-h-[85vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Carga Masiva de Agendamiento
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {s}
              </div>
              <span className={step >= s ? 'font-medium' : 'text-muted-foreground'}>
                {s === 1 ? 'Plantilla' : s === 2 ? 'Vista Previa' : 'Resultado'}
              </span>
              {s < 3 && <div className="h-px w-6 bg-border" />}
            </div>
          ))}
        </div>

        {/* ---------- Step 1: Download Template ---------- */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Descarga la plantilla Excel, completa las filas con los despachos a agendar y luego sube el archivo.
              </p>
              <p className="text-xs text-muted-foreground">
                La plantilla incluye hojas de referencia con los codigos de sucursales y RUT de transportes.
              </p>
              <Button onClick={downloadTemplate} className="gap-2" variant="outline">
                <Download className="h-4 w-4" /> Descargar Plantilla
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Subir archivo completado</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* ---------- Step 2: Preview ---------- */}
        {step === 2 && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <CheckCircle className="h-4 w-4" /> {validCount} valida{validCount !== 1 ? 's' : ''}
              </span>
              {invalidCount > 0 && (
                <span className="flex items-center gap-1 text-destructive font-medium">
                  <AlertCircle className="h-4 w-4" /> {invalidCount} con errores
                </span>
              )}
              <span className="text-muted-foreground">de {parsedRows.length} filas</span>
            </div>

            <div className="border rounded-lg overflow-auto max-h-[40vh]">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">#</th>
                    <th className="text-left p-2 font-medium">Fecha</th>
                    <th className="text-left p-2 font-medium">Hora</th>
                    <th className="text-left p-2 font-medium">Operacion</th>
                    <th className="text-left p-2 font-medium">Codigo</th>
                    <th className="text-left p-2 font-medium">Sucursal</th>
                    <th className="text-left p-2 font-medium">RUT</th>
                    <th className="text-left p-2 font-medium">Transporte</th>
                    <th className="text-left p-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row) => (
                    <tr
                      key={row.rowIndex}
                      className={row.valid ? 'hover:bg-muted/30' : 'bg-destructive/5'}
                    >
                      <td className="p-2 text-muted-foreground">{row.rowIndex}</td>
                      <td className="p-2">{row.fecha}</td>
                      <td className="p-2">{row.hora}</td>
                      <td className="p-2">{row.operationType}</td>
                      <td className="p-2 font-mono">{row.codigo || '—'}</td>
                      <td className="p-2">
                        {row.branchId
                          ? row.sucursalName
                          : <span className="text-destructive">{row.sucursalName || row.codigo || '—'}</span>
                        }
                      </td>
                      <td className="p-2 font-mono text-[11px]">{row.rut || '—'}</td>
                      <td className="p-2">
                        {row.transportSupplierId
                          ? row.transporteName
                          : <span className="text-destructive">{row.transporteName || row.rut || '—'}</span>
                        }
                      </td>
                      <td className="p-2">
                        {row.valid ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <CheckCircle className="h-3 w-3" /> OK
                          </span>
                        ) : (
                          <span className="text-destructive text-[11px]">{row.errors.join(', ')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <DialogFooter className="flex-row gap-2 sm:justify-between">
              <Button variant="outline" size="sm" onClick={() => { setStep(1); setParsedRows([]) }}>
                Volver
              </Button>
              <Button
                size="sm"
                onClick={handleInsert}
                disabled={validCount === 0 || inserting}
                className="gap-1"
              >
                {inserting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Insertando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" /> Crear {validCount} Agenda{validCount !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ---------- Step 3: Result ---------- */}
        {step === 3 && insertResult && (
          <div className="space-y-4 py-4 text-center">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold">Carga completada</p>
              <p className="text-sm text-muted-foreground mt-1">
                Se crearon <span className="font-bold text-foreground">{insertResult.success}</span> agenda{insertResult.success !== 1 ? 's' : ''} exitosamente.
              </p>
              {insertResult.errors > 0 && (
                <p className="text-xs text-destructive mt-1">
                  {insertResult.errors} fila{insertResult.errors !== 1 ? 's' : ''} con errores fueron omitida{insertResult.errors !== 1 ? 's' : ''}.
                </p>
              )}
            </div>
            <Button onClick={handleClose}>Cerrar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
