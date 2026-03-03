import { LogOut, User, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface HeaderProps {
  collapsed: boolean
  onToggleSidebar: () => void
}

export function Header({ collapsed, onToggleSidebar }: HeaderProps) {
  const { user, signOut } = useAuth()

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? 'U'

  return (
    <header className="flex h-14 items-center justify-between border-b border-border/60 bg-background px-4">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={onToggleSidebar}
        title={collapsed ? 'Expandir menu' : 'Colapsar menu'}
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted outline-none">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </div>
            <div className="hidden sm:flex flex-col items-start">
              <span className="text-sm font-medium leading-none">{user?.full_name ?? user?.email}</span>
              <span className="text-[11px] text-muted-foreground leading-none mt-1">{user?.role?.toUpperCase()}</span>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-2 sm:hidden">
            <p className="text-sm font-medium">{user?.full_name ?? user?.email}</p>
            <Badge variant="secondary" className="mt-1 text-[10px]">{user?.role?.toUpperCase()}</Badge>
          </div>
          <DropdownMenuSeparator className="sm:hidden" />
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5 mr-2" />
            Mi perfil
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="gap-2 text-destructive focus:text-destructive">
            <LogOut className="h-3.5 w-3.5" />
            Cerrar sesion
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
