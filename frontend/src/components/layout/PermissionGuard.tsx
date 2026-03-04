import { Navigate, useLocation } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'

interface PermissionGuardProps {
  children: React.ReactNode
}

export function PermissionGuard({ children }: PermissionGuardProps) {
  const { canAccessRoute, loading } = usePermissions()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!canAccessRoute(location.pathname)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
