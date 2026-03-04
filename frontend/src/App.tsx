import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { PermissionGuard } from '@/components/layout/PermissionGuard'
import { Toaster } from '@/components/ui/sonner'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import PatioPage from '@/pages/PatioPage'
import AgendamientoPage from '@/pages/AgendamientoPage'
import IncidenciasPage from '@/pages/IncidenciasPage'
import DespachoPage from '@/pages/DespachoPage'
import RecepcionPage from '@/pages/RecepcionPage'
import AdminPage from '@/pages/AdminPage'
import ConfirmacionPedidosPage from '@/pages/ConfirmacionPedidosPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="patio" element={<PermissionGuard><PatioPage /></PermissionGuard>} />
            <Route path="agendamiento" element={<PermissionGuard><AgendamientoPage /></PermissionGuard>} />
            <Route path="incidencias" element={<PermissionGuard><IncidenciasPage /></PermissionGuard>} />
            <Route path="despacho" element={<PermissionGuard><DespachoPage /></PermissionGuard>} />
            <Route path="recepcion" element={<PermissionGuard><RecepcionPage /></PermissionGuard>} />
            <Route path="confirmacion-pedidos" element={<PermissionGuard><ConfirmacionPedidosPage /></PermissionGuard>} />
            <Route path="admin" element={<PermissionGuard><AdminPage /></PermissionGuard>} />
          </Route>
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  )
}
