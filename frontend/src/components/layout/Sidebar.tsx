import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  Warehouse,
  AlertTriangle,
  Truck,
  PackageCheck,
  Settings,
  ClipboardCheck,
  DollarSign,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import type { PermissionModule } from '@/lib/permissions'

const navItems: { to: string; icon: typeof LayoutDashboard; label: string; module: PermissionModule }[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', module: 'dashboard' },
  { to: '/agendamiento', icon: CalendarDays, label: 'Agendamiento', module: 'agendamiento' },
  { to: '/patio', icon: Warehouse, label: 'Control de Patio', module: 'patio' },
  { to: '/despacho', icon: Truck, label: 'En Ruta', module: 'en_ruta' },
  { to: '/recepcion', icon: PackageCheck, label: 'En Recepcion', module: 'en_recepcion' },
  { to: '/incidencias', icon: AlertTriangle, label: 'Incidencias', module: 'incidencias' },
]

const secondaryItems: { to: string; icon: typeof ClipboardCheck; label: string; module: PermissionModule }[] = [
  { to: '/confirmacion-pedidos', icon: ClipboardCheck, label: 'Confirmacion Pedidos', module: 'confirmacion_pedidos' },
  { to: '/tarifas', icon: DollarSign, label: 'Tarifas', module: 'tarifas' },
]

const adminItems = [
  { to: '/admin', icon: Settings, label: 'Configuracion' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

function SectionLabel({ collapsed, children }: { collapsed: boolean; children: string }) {
  if (collapsed) return <div className="my-2 mx-3 border-t border-sidebar-border" />
  return (
    <div className="px-3 pt-4 pb-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
        {children}
      </span>
    </div>
  )
}

function NavItem({ item, collapsed }: { item: typeof navItems[number]; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group flex items-center rounded-lg text-[13px] font-medium transition-all duration-200',
          collapsed ? 'justify-center p-2.5 mx-1' : 'gap-3 px-3 py-2.5 mx-2',
          isActive
            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
            : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        )
      }
    >
      <item.icon className={cn('h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-105')} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  )
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { isAdmin, canRead } = usePermissions()

  const visibleNavItems = navItems.filter(item => canRead(item.module))
  const visibleSecondaryItems = secondaryItems.filter(item => canRead(item.module))

  return (
    <aside
      className={cn(
        'flex h-full flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out shrink-0',
        collapsed ? 'w-[68px]' : 'w-[260px]'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex h-16 items-center shrink-0',
        collapsed ? 'justify-center px-2' : 'gap-3 px-5'
      )}>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary/20 shrink-0">
          <Truck className="h-5 w-5 text-sidebar-primary" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight whitespace-nowrap">GestionCamiones</span>
            <span className="text-[10px] text-sidebar-foreground/40 font-medium">Plataforma Logistica</span>
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-0.5 py-2 overflow-y-auto">
        {visibleNavItems.length > 0 && <SectionLabel collapsed={collapsed}>Principal</SectionLabel>}
        {visibleNavItems.map((item) => (
          <NavItem key={item.to} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Bottom area */}
      <div className="space-y-0.5 pb-2">
        {visibleSecondaryItems.length > 0 && <SectionLabel collapsed={collapsed}>Operaciones</SectionLabel>}
        {visibleSecondaryItems.map((item) => (
          <NavItem key={item.to} item={item} collapsed={collapsed} />
        ))}

        {isAdmin && (
          <>
            <SectionLabel collapsed={collapsed}>Sistema</SectionLabel>
            {adminItems.map((item) => (
              <NavItem key={item.to} item={item} collapsed={collapsed} />
            ))}
          </>
        )}

        {/* Toggle button */}
        <div className="mx-2 mt-2 border-t border-sidebar-border pt-2">
          <button
            onClick={onToggle}
            className={cn(
              'flex w-full items-center rounded-lg p-2.5 text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200',
              collapsed ? 'justify-center' : 'justify-center'
            )}
            title={collapsed ? 'Expandir menu' : 'Colapsar menu'}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </aside>
  )
}
