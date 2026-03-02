import { useState } from 'react'
import { Building2, Truck, Users, PackageSearch, UserCheck, ShieldCheck, ShieldHalf } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { WindowDialog } from '@/components/shared/WindowDialog'
import { BranchManagement } from '@/components/admin/BranchManagement'
import { SupplierManagement } from '@/components/admin/SupplierManagement'
import { ClientManagement } from '@/components/admin/ClientManagement'
import { TruckManagement } from '@/components/admin/TruckManagement'
import { DriverManagement } from '@/components/admin/DriverManagement'
import { UserManagement } from '@/components/admin/UserManagement'
import { RoleManagement } from '@/components/admin/RoleManagement'

type MaestroKey = 'branches' | 'suppliers' | 'clients' | 'trucks' | 'drivers' | 'users' | 'roles' | null

const maestros = [
  {
    key: 'branches' as const,
    label: 'Maestro de Sucursales',
    description: 'Gestionar sucursales, direcciones y contactos',
    icon: Building2,
    color: 'text-teal-600 bg-teal-100',
  },
  {
    key: 'suppliers' as const,
    label: 'Maestro de Proveedores',
    description: 'Gestionar proveedores: comercializacion, compra local, importacion, servicios, activo fijo, maquila y transporte',
    icon: PackageSearch,
    color: 'text-blue-600 bg-blue-100',
  },
  {
    key: 'clients' as const,
    label: 'Maestro de Clientes',
    description: 'Gestionar clientes y sus datos de contacto',
    icon: Users,
    color: 'text-green-600 bg-green-100',
  },
  {
    key: 'trucks' as const,
    label: 'Maestro de Camiones',
    description: 'Gestionar camiones, patentes y tipos de vehiculo',
    icon: Truck,
    color: 'text-orange-600 bg-orange-100',
  },
  {
    key: 'drivers' as const,
    label: 'Maestro de Conductores',
    description: 'Gestionar conductores, licencias y datos personales',
    icon: UserCheck,
    color: 'text-purple-600 bg-purple-100',
  },
  {
    key: 'users' as const,
    label: 'Maestro de Usuarios',
    description: 'Gestionar usuarios, roles y permisos del sistema',
    icon: ShieldCheck,
    color: 'text-rose-600 bg-rose-100',
  },
  {
    key: 'roles' as const,
    label: 'Maestro de Roles',
    description: 'Gestionar roles del sistema y sus permisos por modulo',
    icon: ShieldHalf,
    color: 'text-indigo-600 bg-indigo-100',
  },
]

const windowTitles: Record<string, string> = {
  branches: 'Maestro de Sucursales',
  suppliers: 'Maestro de Proveedores',
  clients: 'Maestro de Clientes',
  trucks: 'Maestro de Camiones',
  drivers: 'Maestro de Conductores',
  users: 'Maestro de Usuarios',
  roles: 'Maestro de Roles',
}

export default function AdminPage() {
  const [activeWindow, setActiveWindow] = useState<MaestroKey>(null)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configuracion</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {maestros.map((m) => (
          <Card
            key={m.key}
            className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 active:scale-[0.98]"
            onClick={() => setActiveWindow(m.key)}
          >
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <div className={`flex h-16 w-16 items-center justify-center rounded-xl ${m.color}`}>
                <m.icon className="h-8 w-8" />
              </div>
              <h3 className="font-semibold text-sm">{m.label}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{m.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Floating windows */}
      <WindowDialog
        open={activeWindow === 'branches'}
        onClose={() => setActiveWindow(null)}
        title={windowTitles.branches}
      >
        <BranchManagement />
      </WindowDialog>

      <WindowDialog
        open={activeWindow === 'suppliers'}
        onClose={() => setActiveWindow(null)}
        title={windowTitles.suppliers}
      >
        <SupplierManagement />
      </WindowDialog>

      <WindowDialog
        open={activeWindow === 'clients'}
        onClose={() => setActiveWindow(null)}
        title={windowTitles.clients}
      >
        <ClientManagement />
      </WindowDialog>

      <WindowDialog
        open={activeWindow === 'trucks'}
        onClose={() => setActiveWindow(null)}
        title={windowTitles.trucks}
      >
        <TruckManagement />
      </WindowDialog>

      <WindowDialog
        open={activeWindow === 'drivers'}
        onClose={() => setActiveWindow(null)}
        title={windowTitles.drivers}
      >
        <DriverManagement />
      </WindowDialog>

      <WindowDialog
        open={activeWindow === 'users'}
        onClose={() => setActiveWindow(null)}
        title={windowTitles.users}
      >
        <UserManagement />
      </WindowDialog>

      <WindowDialog
        open={activeWindow === 'roles'}
        onClose={() => setActiveWindow(null)}
        title={windowTitles.roles}
      >
        <RoleManagement />
      </WindowDialog>
    </div>
  )
}
