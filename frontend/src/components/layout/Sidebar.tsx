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
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/agendamiento', icon: CalendarDays, label: 'Agendamiento' },
  { to: '/patio', icon: Warehouse, label: 'Control de Patio' },
  { to: '/despacho', icon: Truck, label: 'En Ruta' },
  { to: '/recepcion', icon: PackageCheck, label: 'En Recepcion' },
  { to: '/incidencias', icon: AlertTriangle, label: 'Incidencias' },
]

const secondaryItems = [
  { to: '/confirmacion-pedidos', icon: ClipboardCheck, label: 'Confirmacion Pedidos' },
]

const adminItems = [
  { to: '/admin', icon: Settings, label: 'Configuracion' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

function NavItem({ item, collapsed }: { item: typeof navItems[number]; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center rounded-lg text-sm font-medium transition-colors',
          collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
          isActive
            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        )
      }
    >
      <item.icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  )
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user } = useAuth()

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className={cn('flex h-16 items-center border-b border-sidebar-border', collapsed ? 'justify-center px-2' : 'gap-3 px-6')}>
        <Truck className="h-7 w-7 text-sidebar-primary shrink-0" />
        {!collapsed && <span className="text-lg font-bold whitespace-nowrap">GestionCamiones</span>}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => (
          <NavItem key={item.to} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Bottom area: secondary + admin + toggle */}
      <div className="space-y-1 p-2">
        {/* Separator */}
        <div className="my-1 border-t border-sidebar-border" />

        {/* Confirmacion Pedidos */}
        {secondaryItems.map((item) => (
          <NavItem key={item.to} item={item} collapsed={collapsed} />
        ))}

        {/* Admin items */}
        {user?.role === 'admin' && (
          <>
            <div className="my-1 border-t border-sidebar-border" />
            {adminItems.map((item) => (
              <NavItem key={item.to} item={item} collapsed={collapsed} />
            ))}
          </>
        )}

        {/* Toggle button */}
        <div className="mt-1 border-t border-sidebar-border pt-2">
          <button
            onClick={onToggle}
            className="flex w-full items-center justify-center rounded-lg p-2.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            title={collapsed ? 'Expandir menu' : 'Colapsar menu'}
          >
            {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </aside>
  )
}
