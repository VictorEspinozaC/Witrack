import { PatioKanban } from '@/components/patio/PatioKanban'
import { usePermissions } from '@/hooks/usePermissions'
import { ReadOnlyBanner } from '@/components/shared/ReadOnlyBanner'

export default function PatioPage() {
  const { canWrite } = usePermissions()
  const readOnly = !canWrite('patio')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Control de Patio</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestion y seguimiento de camiones en planta</p>
      </div>
      {readOnly && <ReadOnlyBanner />}
      <PatioKanban />
    </div>
  )
}
