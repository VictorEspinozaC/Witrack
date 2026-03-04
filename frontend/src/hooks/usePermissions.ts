import { useAuth } from '@/context/AuthContext'
import type { RolePermissions, PermissionModule } from '@/lib/permissions'
import { DEFAULT_PERMISSIONS, ROUTE_TO_MODULE } from '@/lib/permissions'

interface UsePermissionsReturn {
  permissions: RolePermissions
  loading: boolean
  isAdmin: boolean
  canRead: (mod: PermissionModule) => boolean
  canWrite: (mod: PermissionModule) => boolean
  canAccessRoute: (path: string) => boolean
}

export function usePermissions(): UsePermissionsReturn {
  const { user, permissions, permissionsLoading } = useAuth()
  const perms = permissions ?? { ...DEFAULT_PERMISSIONS }

  // Safety net: role 'admin' OR admin permission always gets full access
  const isAdmin = user?.role === 'admin' || perms.admin === true

  function canRead(mod: PermissionModule): boolean {
    if (isAdmin) return true
    return perms[mod]?.read === true
  }

  function canWrite(mod: PermissionModule): boolean {
    if (isAdmin) return true
    return perms[mod]?.write === true
  }

  function canAccessRoute(path: string): boolean {
    if (isAdmin) return true
    if (path === '/admin') return perms.admin === true
    const mod = ROUTE_TO_MODULE[path]
    if (!mod) return true // unknown routes are accessible
    return canRead(mod)
  }

  return { permissions: perms, loading: permissionsLoading, isAdmin, canRead, canWrite, canAccessRoute }
}
