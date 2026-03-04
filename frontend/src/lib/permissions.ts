// ---- Permission types matching roles.permissions JSONB ----
export type ModulePermission = { read: boolean; write: boolean }

export type RolePermissions = {
  dashboard: ModulePermission
  agendamiento: ModulePermission
  patio: ModulePermission
  en_ruta: ModulePermission
  en_recepcion: ModulePermission
  incidencias: ModulePermission
  confirmacion_pedidos: ModulePermission
  admin: boolean
}

export type PermissionModule = keyof Omit<RolePermissions, 'admin'>

// ---- Default empty permissions ----
export const DEFAULT_PERMISSIONS: RolePermissions = {
  dashboard: { read: false, write: false },
  agendamiento: { read: false, write: false },
  patio: { read: false, write: false },
  en_ruta: { read: false, write: false },
  en_recepcion: { read: false, write: false },
  incidencias: { read: false, write: false },
  confirmacion_pedidos: { read: false, write: false },
  admin: false,
}

// ---- Module metadata: labels + route path (single source of truth) ----
export const MODULE_CONFIG: Record<PermissionModule, { label: string; route: string }> = {
  dashboard: { label: 'Dashboard', route: '/' },
  agendamiento: { label: 'Agendamiento', route: '/agendamiento' },
  patio: { label: 'Control de Patio', route: '/patio' },
  en_ruta: { label: 'En Ruta / Despacho', route: '/despacho' },
  en_recepcion: { label: 'En Recepcion', route: '/recepcion' },
  incidencias: { label: 'Incidencias', route: '/incidencias' },
  confirmacion_pedidos: { label: 'Confirmacion Pedidos', route: '/confirmacion-pedidos' },
}

// ---- Reverse lookup: route path → permission module key ----
export const ROUTE_TO_MODULE: Record<string, PermissionModule> = Object.entries(MODULE_CONFIG)
  .reduce((acc, [key, { route }]) => {
    acc[route] = key as PermissionModule
    return acc
  }, {} as Record<string, PermissionModule>)

// ---- Parser: safely extract RolePermissions from raw JSONB ----
function parseMod(p: Record<string, unknown>, key: string): ModulePermission {
  const m = p[key] as Record<string, boolean> | undefined
  return { read: !!m?.read, write: !!m?.write }
}

export function parsePermissions(raw: unknown): RolePermissions {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PERMISSIONS }
  const p = raw as Record<string, unknown>
  return {
    dashboard: parseMod(p, 'dashboard'),
    agendamiento: parseMod(p, 'agendamiento'),
    patio: parseMod(p, 'patio'),
    en_ruta: parseMod(p, 'en_ruta'),
    en_recepcion: parseMod(p, 'en_recepcion'),
    incidencias: parseMod(p, 'incidencias'),
    confirmacion_pedidos: parseMod(p, 'confirmacion_pedidos'),
    admin: !!p.admin,
  }
}
