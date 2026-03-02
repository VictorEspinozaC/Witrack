import { LogOut, User, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface HeaderProps {
  collapsed: boolean
  onToggleSidebar: () => void
}

export function Header({ collapsed, onToggleSidebar }: HeaderProps) {
  const { user, signOut } = useAuth()

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card/70 backdrop-blur-md px-6">
      <Button variant="ghost" size="icon" onClick={onToggleSidebar} title={collapsed ? 'Expandir menú' : 'Colapsar menú'}>
        {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2">
            <User className="h-4 w-4" />
            <span className="text-sm">{user?.full_name ?? user?.email}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="text-muted-foreground text-xs" disabled>
            {user?.role?.toUpperCase()}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={signOut} className="gap-2 text-destructive">
            <LogOut className="h-4 w-4" />
            Cerrar sesion
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
