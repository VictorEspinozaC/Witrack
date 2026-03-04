import { usePermissions } from '@/hooks/usePermissions'
import { ReadOnlyBanner } from '@/components/shared/ReadOnlyBanner'
import { TarifasManagement } from '@/components/tarifas/TarifasManagement'

export default function TarifasPage() {
  const { canWrite } = usePermissions()
  const readOnly = !canWrite('tarifas')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tarifas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestionar tarifas por sucursal y empresa de transporte
        </p>
      </div>
      {readOnly && <ReadOnlyBanner />}
      <TarifasManagement readOnly={readOnly} />
    </div>
  )
}
