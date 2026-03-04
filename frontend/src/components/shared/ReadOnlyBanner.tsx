import { Eye } from 'lucide-react'

export function ReadOnlyBanner() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <Eye className="h-4 w-4 shrink-0" />
      <span>Modo solo lectura. No tienes permisos de escritura en este modulo.</span>
    </div>
  )
}
