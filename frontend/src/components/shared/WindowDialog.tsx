import { useState, type ReactNode } from 'react'
import { Minus, Square, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WindowDialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

export function WindowDialog({ open, onClose, title, children, footer }: WindowDialogProps) {
  const [minimized, setMinimized] = useState(false)
  const [maximized, setMaximized] = useState(false)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" />

      {/* Window */}
      <div
        className={cn(
          'relative z-50 flex flex-col rounded-lg border bg-background shadow-2xl transition-all',
          maximized
            ? 'h-full w-full rounded-none'
            : 'h-[85vh] w-[90vw] max-w-4xl',
          minimized && 'h-12 overflow-hidden'
        )}
      >
        {/* Title bar */}
        <div className="flex h-10 shrink-0 items-center justify-between border-b bg-muted/60 px-3 rounded-t-lg">
          <span className="text-sm font-semibold select-none">{title}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMinimized(!minimized)}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted-foreground/20 transition-colors"
              title="Minimizar"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => { setMaximized(!maximized); setMinimized(false) }}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted-foreground/20 transition-colors"
              title={maximized ? 'Restaurar' : 'Maximizar'}
            >
              <Square className="h-3 w-3" />
            </button>
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-destructive hover:text-destructive-foreground transition-colors"
              title="Cerrar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {!minimized && (
          <>
            <div className="flex-1 overflow-auto p-4">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="shrink-0 border-t bg-muted/30 px-4 py-3 flex items-center justify-end gap-2">
                {footer}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
