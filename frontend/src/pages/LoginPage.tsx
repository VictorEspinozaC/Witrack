import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Truck, ArrowLeft, Mail } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const { session, signIn, loading, passwordRecovery, clearPasswordRecovery } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Password recovery state
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoverySent, setRecoverySent] = useState(false)
  const [recoverySubmitting, setRecoverySubmitting] = useState(false)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)

  // Password reset state (when user arrives from email link)
  const [resetMode, setResetMode] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSuccess, setResetSuccess] = useState(false)

  // Detect PASSWORD_RECOVERY event from Supabase Auth context
  useEffect(() => {
    if (passwordRecovery) {
      setResetMode(true)
    }
  }, [passwordRecovery])

  if (loading) return null
  if (session && !resetMode) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await signIn(email, password)
    if (error) setError(error)
    setSubmitting(false)
  }

  async function handleRecovery(e: FormEvent) {
    e.preventDefault()
    setRecoveryError(null)
    setRecoverySubmitting(true)

    const redirectUrl = `${window.location.origin}/login`
    const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
      redirectTo: redirectUrl,
    })

    if (error) {
      setRecoveryError(error.message)
    } else {
      setRecoverySent(true)
    }
    setRecoverySubmitting(false)
  }

  async function handlePasswordReset(e: FormEvent) {
    e.preventDefault()
    setResetError(null)

    if (newPassword.length < 6) {
      setResetError('La contrasena debe tener al menos 6 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setResetError('Las contrasenas no coinciden')
      return
    }

    setResetSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setResetError(error.message)
    } else {
      setResetSuccess(true)
      clearPasswordRecovery()
      // Clear URL hash
      window.history.replaceState(null, '', window.location.pathname)
      setTimeout(() => {
        setResetMode(false)
        setResetSuccess(false)
      }, 3000)
    }
    setResetSubmitting(false)
  }

  function enterRecoveryMode() {
    setRecoveryMode(true)
    setRecoveryEmail(email)
    setRecoverySent(false)
    setRecoveryError(null)
  }

  function exitRecoveryMode() {
    setRecoveryMode(false)
    setRecoverySent(false)
    setRecoveryError(null)
  }

  // --- Password Reset Form (from email link) ---
  if (resetMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#293D62] via-[#448FAD] to-[#50ADC6] p-4">
        <Card className="w-full max-w-sm bg-white/20 backdrop-blur-lg border-white/30 text-white">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
              <Truck className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-xl">Nueva Contrasena</CardTitle>
            <p className="text-sm text-white/70">Ingresa tu nueva contrasena</p>
          </CardHeader>
          <CardContent>
            {resetSuccess ? (
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                  <Mail className="h-6 w-6 text-green-300" />
                </div>
                <p className="text-sm text-green-300 font-medium">Contrasena actualizada correctamente</p>
                <p className="text-xs text-white/60">Redirigiendo al inicio...</p>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/90">Nueva contrasena</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Minimo 6 caracteres"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/90">Confirmar contrasena</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Repite la contrasena"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  />
                </div>
                {resetError && <p className="text-sm text-red-300">{resetError}</p>}
                <Button type="submit" className="w-full" disabled={resetSubmitting}>
                  {resetSubmitting ? 'Actualizando...' : 'Actualizar Contrasena'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // --- Recovery Form ---
  if (recoveryMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#293D62] via-[#448FAD] to-[#50ADC6] p-4">
        <Card className="w-full max-w-sm bg-white/20 backdrop-blur-lg border-white/30 text-white">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
              <Truck className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-xl">Recuperar Cuenta</CardTitle>
            <p className="text-sm text-white/70">
              {recoverySent
                ? 'Revisa tu correo electronico'
                : 'Ingresa tu correo para restablecer la contrasena'}
            </p>
          </CardHeader>
          <CardContent>
            {recoverySent ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                  <Mail className="h-6 w-6 text-green-300" />
                </div>
                <p className="text-sm text-white/80">
                  Hemos enviado un enlace de recuperacion a <strong>{recoveryEmail}</strong>.
                  Revisa tu bandeja de entrada y sigue las instrucciones.
                </p>
                <Button
                  variant="outline"
                  className="w-full border-white/30 text-white hover:bg-white/10"
                  onClick={exitRecoveryMode}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver al inicio de sesion
                </Button>
              </div>
            ) : (
              <form onSubmit={handleRecovery} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recovery-email" className="text-white/90">Correo electronico</Label>
                  <Input
                    id="recovery-email"
                    type="email"
                    placeholder="usuario@empresa.cl"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  />
                </div>
                {recoveryError && <p className="text-sm text-red-300">{recoveryError}</p>}
                <Button type="submit" className="w-full" disabled={recoverySubmitting}>
                  {recoverySubmitting ? 'Enviando...' : 'Enviar enlace de recuperacion'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-white/70 hover:text-white hover:bg-white/10"
                  onClick={exitRecoveryMode}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // --- Login Form ---
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#293D62] via-[#448FAD] to-[#50ADC6] p-4">
      <Card className="w-full max-w-sm bg-white/20 backdrop-blur-lg border-white/30 text-white">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Truck className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">Gestion de Camiones</CardTitle>
          <p className="text-sm text-white/70">Inicia sesion para continuar</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/90">Correo electronico</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@empresa.cl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-white/90">Contrasena</Label>
                <button
                  type="button"
                  onClick={enterRecoveryMode}
                  className="text-xs text-white/60 hover:text-white underline underline-offset-2 transition-colors"
                >
                  Olvidaste tu contrasena?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
            </div>
            {error && (
              <p className="text-sm text-red-300">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
