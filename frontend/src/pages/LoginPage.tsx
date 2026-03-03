import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Truck, ArrowLeft, Mail, MessageSquare, CheckCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PhoneInput } from '@/components/ui/PhoneInput'

const DARK_INPUT = 'bg-white/8 border-white/15 text-white placeholder:text-white/35 focus:border-white/30'

export default function LoginPage() {
  const { session, signIn, loading, passwordRecovery, clearPasswordRecovery } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Recovery mode: 'select' | 'email' | 'whatsapp'
  const [recoveryMode, setRecoveryMode] = useState<false | 'select' | 'email' | 'whatsapp'>(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoverySubmitting, setRecoverySubmitting] = useState(false)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)

  // Email OTP state
  const [emailStep, setEmailStep] = useState<'form' | 'otp' | 'newPassword' | 'success'>('form')
  const [emailOtp, setEmailOtp] = useState('')

  // Password reset state (from email link)
  const [resetMode, setResetMode] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSuccess, setResetSuccess] = useState(false)

  // WhatsApp OTP state
  const [waStep, setWaStep] = useState<'sending' | 'needsPhone' | 'otp' | 'newPassword' | 'success'>('sending')
  const [waPhone, setWaPhone] = useState('')
  const [waPhoneMasked, setWaPhoneMasked] = useState('')
  const [waOtp, setWaOtp] = useState('')
  const [waError, setWaError] = useState<string | null>(null)
  const [waSubmitting, setWaSubmitting] = useState(false)

  // Detect PASSWORD_RECOVERY event from Supabase Auth context
  useEffect(() => {
    if (passwordRecovery) {
      setResetMode(true)
    }
  }, [passwordRecovery])

  if (loading) return null
  if (session && !resetMode) return <Navigate to="/" replace />

  // --- Handlers ---

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await signIn(email, password)
    if (error) setError(error)
    setSubmitting(false)
  }

  async function handleEmailOtpSend(e: FormEvent) {
    e.preventDefault()
    if (!recoveryEmail) {
      setRecoveryError('Ingresa tu correo electronico')
      return
    }
    setRecoveryError(null)
    setRecoverySubmitting(true)

    try {
      const { data, error } = await supabase.functions.invoke('email-otp', {
        body: { email: recoveryEmail },
      })

      if (error) throw new Error(error.message)

      if (data.error) {
        setRecoveryError(data.error)
      } else {
        setEmailStep('otp')
      }
    } catch (err) {
      setRecoveryError(err instanceof Error ? err.message : 'Error al enviar codigo')
    }
    setRecoverySubmitting(false)
  }

  async function handleEmailVerifyOtp(e: FormEvent) {
    e.preventDefault()
    if (emailOtp.length !== 6) {
      setRecoveryError('Ingresa el codigo de 6 digitos')
      return
    }
    setRecoveryError(null)
    setRecoverySubmitting(true)

    try {
      const { data, error } = await supabase.functions.invoke('reset-password-whatsapp', {
        body: { action: 'verify-otp', email: recoveryEmail, otp_code: emailOtp },
      })

      if (error) throw new Error(error.message)

      if (data.error) {
        setRecoveryError(data.error)
      } else if (data.verified) {
        setEmailStep('newPassword')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (err) {
      setRecoveryError(err instanceof Error ? err.message : 'Error al verificar codigo')
    }
    setRecoverySubmitting(false)
  }

  async function handleEmailPasswordReset(e: FormEvent) {
    e.preventDefault()
    setRecoveryError(null)

    if (newPassword.length < 6) {
      setRecoveryError('La contrasena debe tener al menos 6 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setRecoveryError('Las contrasenas no coinciden')
      return
    }

    setRecoverySubmitting(true)

    try {
      const { data, error } = await supabase.functions.invoke('reset-password-whatsapp', {
        body: { action: 'reset-password', email: recoveryEmail, otp_code: emailOtp, new_password: newPassword },
      })

      if (error) throw new Error(error.message)

      if (data.error) {
        setRecoveryError(data.error)
      } else {
        setEmailStep('success')
        setTimeout(() => {
          exitRecoveryMode()
        }, 3000)
      }
    } catch (err) {
      setRecoveryError(err instanceof Error ? err.message : 'Error al cambiar contrasena')
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
      window.history.replaceState(null, '', window.location.pathname)
      setTimeout(() => {
        setResetMode(false)
        setResetSuccess(false)
      }, 3000)
    }
    setResetSubmitting(false)
  }

  function enterRecoveryMode() {
    setRecoveryMode('select')
    setRecoveryEmail(email)
    setRecoveryError(null)
    // Reset email OTP state
    setEmailStep('form')
    setEmailOtp('')
    // Reset WhatsApp state
    setWaStep('sending')
    setWaPhone('')
    setWaPhoneMasked('')
    setWaOtp('')
    setWaError(null)
  }

  function exitRecoveryMode() {
    setRecoveryMode(false)
    setRecoveryError(null)
    setEmailStep('form')
    setEmailOtp('')
    setWaError(null)
  }

  // --- WhatsApp Handlers ---

  async function handleWhatsAppStart() {
    if (!recoveryEmail) {
      setWaError('Ingresa tu correo electronico primero')
      return
    }
    setWaError(null)
    setWaSubmitting(true)
    setRecoveryMode('whatsapp')
    setWaStep('sending')

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-otp', {
        body: { email: recoveryEmail },
      })

      if (error) throw new Error(error.message)

      if (data.error) {
        setWaError(data.error)
        setWaStep('sending')
      } else if (data.needs_phone) {
        setWaStep('needsPhone')
      } else if (data.phone_masked) {
        setWaPhoneMasked(data.phone_masked)
        setWaStep('otp')
      } else {
        // Generic success (user not found but we don't reveal that)
        setWaPhoneMasked('')
        setWaStep('otp')
      }
    } catch (err) {
      setWaError(err instanceof Error ? err.message : 'Error al enviar codigo')
      setWaStep('sending')
    }
    setWaSubmitting(false)
  }

  async function handleSendOtpWithPhone(e: FormEvent) {
    e.preventDefault()
    if (!waPhone) {
      setWaError('Ingresa tu numero de telefono')
      return
    }
    setWaError(null)
    setWaSubmitting(true)

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-otp', {
        body: { email: recoveryEmail, phone: waPhone },
      })

      if (error) throw new Error(error.message)

      if (data.error) {
        setWaError(data.error)
      } else if (data.phone_masked) {
        setWaPhoneMasked(data.phone_masked)
        setWaStep('otp')
      }
    } catch (err) {
      setWaError(err instanceof Error ? err.message : 'Error al enviar codigo')
    }
    setWaSubmitting(false)
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault()
    if (waOtp.length !== 6) {
      setWaError('Ingresa el codigo de 6 digitos')
      return
    }
    setWaError(null)
    setWaSubmitting(true)

    try {
      const phone = waPhone || waPhoneMasked
      const { data, error } = await supabase.functions.invoke('reset-password-whatsapp', {
        body: { action: 'verify-otp', phone, email: recoveryEmail, otp_code: waOtp },
      })

      if (error) throw new Error(error.message)

      if (data.error) {
        setWaError(data.error)
      } else if (data.verified) {
        setWaStep('newPassword')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (err) {
      setWaError(err instanceof Error ? err.message : 'Error al verificar codigo')
    }
    setWaSubmitting(false)
  }

  async function handleWhatsAppPasswordReset(e: FormEvent) {
    e.preventDefault()
    setWaError(null)

    if (newPassword.length < 6) {
      setWaError('La contrasena debe tener al menos 6 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setWaError('Las contrasenas no coinciden')
      return
    }

    setWaSubmitting(true)

    try {
      const phone = waPhone || waPhoneMasked
      const { data, error } = await supabase.functions.invoke('reset-password-whatsapp', {
        body: { action: 'reset-password', phone, email: recoveryEmail, otp_code: waOtp, new_password: newPassword },
      })

      if (error) throw new Error(error.message)

      if (data.error) {
        setWaError(data.error)
      } else {
        setWaStep('success')
        setTimeout(() => {
          exitRecoveryMode()
        }, 3000)
      }
    } catch (err) {
      setWaError(err instanceof Error ? err.message : 'Error al cambiar contrasena')
    }
    setWaSubmitting(false)
  }

  // ===========================
  // RENDER
  // ===========================

  const cardBase = 'w-full max-w-sm border-0 bg-white/8 backdrop-blur-xl text-white shadow-2xl'
  const pageBase = 'flex min-h-screen items-center justify-center bg-[#0f1923] p-4 relative overflow-hidden'

  const bgDecoration = (
    <>
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f1923] via-[#162a3e] to-[#0f1923]" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl -translate-y-1/3 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-primary/5 blur-3xl translate-y-1/3 -translate-x-1/4" />
    </>
  )

  // --- Password Reset Form (from email link) ---
  if (resetMode) {
    return (
      <div className={pageBase}>
        {bgDecoration}
        <Card className={cardBase + ' relative z-10'}>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20">
              <Truck className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-xl">Nueva Contrasena</CardTitle>
            <p className="text-sm text-white/50">Ingresa tu nueva contrasena</p>
          </CardHeader>
          <CardContent>
            {resetSuccess ? (
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                  <CheckCircle className="h-6 w-6 text-emerald-400" />
                </div>
                <p className="text-sm text-emerald-400 font-medium">Contrasena actualizada correctamente</p>
                <p className="text-xs text-white/40">Redirigiendo al inicio...</p>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/90">Nueva contrasena</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    required minLength={6} placeholder="Minimo 6 caracteres" className={DARK_INPUT} />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/90">Confirmar contrasena</Label>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    required placeholder="Repite la contrasena" className={DARK_INPUT} />
                </div>
                {resetError && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{resetError}</p>}
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

  // --- WhatsApp Recovery Flow ---
  if (recoveryMode === 'whatsapp') {
    return (
      <div className={pageBase}>
        {bgDecoration}
        <Card className={cardBase + ' relative z-10'}>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-600">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-xl">
              {waStep === 'needsPhone' && 'Ingresa tu Telefono'}
              {waStep === 'otp' && 'Ingresa el Codigo'}
              {waStep === 'newPassword' && 'Nueva Contrasena'}
              {waStep === 'success' && 'Listo!'}
              {waStep === 'sending' && 'Enviando...'}
            </CardTitle>
            <p className="text-sm text-white/50">
              {waStep === 'needsPhone' && 'No tienes un telefono registrado. Ingresa uno para recibir el codigo.'}
              {waStep === 'otp' && (waPhoneMasked
                ? `Enviamos un codigo de 6 digitos a ${waPhoneMasked}`
                : 'Si tu correo esta registrado, recibiras un codigo por WhatsApp.'
              )}
              {waStep === 'newPassword' && 'Codigo verificado. Ingresa tu nueva contrasena.'}
              {waStep === 'success' && 'Tu contrasena fue actualizada correctamente.'}
              {waStep === 'sending' && 'Buscando tu cuenta...'}
            </p>
          </CardHeader>
          <CardContent>

            {/* Step: Needs Phone */}
            {waStep === 'needsPhone' && (
              <form onSubmit={handleSendOtpWithPhone} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/90">Numero de telefono</Label>
                  <PhoneInput
                    value={waPhone}
                    onChange={setWaPhone}
                    inputClassName={DARK_INPUT}
                    selectClassName="bg-white/10 border-white/20 text-white"
                  />
                </div>
                {waError && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{waError}</p>}
                <Button type="submit" className="w-full" disabled={waSubmitting}>
                  {waSubmitting ? 'Enviando...' : 'Enviar Codigo por WhatsApp'}
                </Button>
                <Button type="button" variant="ghost" className="w-full text-white/50 hover:text-white hover:bg-white/5"
                  onClick={() => setRecoveryMode('select')}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Volver
                </Button>
              </form>
            )}

            {/* Step: Enter OTP */}
            {waStep === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/90">Codigo de verificacion</Label>
                  <Input
                    value={waOtp}
                    onChange={(e) => setWaOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    inputMode="numeric"
                    maxLength={6}
                    className={`${DARK_INPUT} text-center text-2xl tracking-[0.5em] font-mono`}
                    autoFocus
                  />
                </div>
                {waError && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{waError}</p>}
                <Button type="submit" className="w-full" disabled={waSubmitting || waOtp.length !== 6}>
                  {waSubmitting ? 'Verificando...' : 'Verificar Codigo'}
                </Button>
                <button type="button" onClick={handleWhatsAppStart}
                  className="w-full text-xs text-white/40 hover:text-white underline underline-offset-2 transition-colors">
                  Reenviar codigo
                </button>
                <Button type="button" variant="ghost" className="w-full text-white/50 hover:text-white hover:bg-white/5"
                  onClick={() => setRecoveryMode('select')}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Volver
                </Button>
              </form>
            )}

            {/* Step: New Password */}
            {waStep === 'newPassword' && (
              <form onSubmit={handleWhatsAppPasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/90">Nueva contrasena</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    required minLength={6} placeholder="Minimo 6 caracteres" className={DARK_INPUT} />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/90">Confirmar contrasena</Label>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    required placeholder="Repite la contrasena" className={DARK_INPUT} />
                </div>
                {waError && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{waError}</p>}
                <Button type="submit" className="w-full" disabled={waSubmitting}>
                  {waSubmitting ? 'Actualizando...' : 'Actualizar Contrasena'}
                </Button>
              </form>
            )}

            {/* Step: Success */}
            {waStep === 'success' && (
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                  <CheckCircle className="h-6 w-6 text-emerald-400" />
                </div>
                <p className="text-sm text-emerald-400 font-medium">Contrasena actualizada correctamente</p>
                <p className="text-xs text-white/40">Redirigiendo al inicio...</p>
              </div>
            )}

            {/* Step: Sending (loading) */}
            {waStep === 'sending' && (
              <div className="space-y-4">
                {waError ? (
                  <>
                    <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{waError}</p>
                    <Button className="w-full" onClick={handleWhatsAppStart} disabled={waSubmitting}>
                      Reintentar
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <div className="animate-spin mx-auto h-8 w-8 border-2 border-white/30 border-t-white rounded-full" />
                  </div>
                )}
                <Button type="button" variant="ghost" className="w-full text-white/50 hover:text-white hover:bg-white/5"
                  onClick={() => setRecoveryMode('select')}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Volver
                </Button>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    )
  }

  // --- Email Recovery Flow (OTP) ---
  if (recoveryMode === 'email') {
    return (
      <div className={pageBase}>
        {bgDecoration}
        <Card className={cardBase + ' relative z-10'}>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20">
              <Mail className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-xl">
              {emailStep === 'form' && 'Recuperar por Email'}
              {emailStep === 'otp' && 'Ingresa el Codigo'}
              {emailStep === 'newPassword' && 'Nueva Contrasena'}
              {emailStep === 'success' && 'Listo!'}
            </CardTitle>
            <p className="text-sm text-white/50">
              {emailStep === 'form' && 'Te enviaremos un codigo de verificacion a tu correo'}
              {emailStep === 'otp' && `Enviamos un codigo de 6 digitos a ${recoveryEmail}`}
              {emailStep === 'newPassword' && 'Codigo verificado. Ingresa tu nueva contrasena.'}
              {emailStep === 'success' && 'Tu contrasena fue actualizada correctamente.'}
            </p>
          </CardHeader>
          <CardContent>

            {/* Step: Email Form */}
            {emailStep === 'form' && (
              <form onSubmit={handleEmailOtpSend} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recovery-email" className="text-white/90">Correo electronico</Label>
                  <Input id="recovery-email" type="email" placeholder="usuario@empresa.cl"
                    value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)}
                    required className={DARK_INPUT} />
                </div>
                {recoveryError && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{recoveryError}</p>}
                <Button type="submit" className="w-full" disabled={recoverySubmitting}>
                  {recoverySubmitting ? 'Enviando...' : 'Enviar codigo de verificacion'}
                </Button>
                <Button type="button" variant="ghost" className="w-full text-white/50 hover:text-white hover:bg-white/5"
                  onClick={() => setRecoveryMode('select')}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Volver
                </Button>
              </form>
            )}

            {/* Step: Enter OTP */}
            {emailStep === 'otp' && (
              <form onSubmit={handleEmailVerifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/90">Codigo de verificacion</Label>
                  <Input
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    inputMode="numeric"
                    maxLength={6}
                    className={`${DARK_INPUT} text-center text-2xl tracking-[0.5em] font-mono`}
                    autoFocus
                  />
                </div>
                {recoveryError && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{recoveryError}</p>}
                <Button type="submit" className="w-full" disabled={recoverySubmitting || emailOtp.length !== 6}>
                  {recoverySubmitting ? 'Verificando...' : 'Verificar Codigo'}
                </Button>
                <button type="button" onClick={(e) => { setEmailOtp(''); setRecoveryError(null); handleEmailOtpSend(e as unknown as FormEvent) }}
                  className="w-full text-xs text-white/40 hover:text-white underline underline-offset-2 transition-colors">
                  Reenviar codigo
                </button>
                <Button type="button" variant="ghost" className="w-full text-white/50 hover:text-white hover:bg-white/5"
                  onClick={() => { setEmailStep('form'); setRecoveryError(null) }}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Volver
                </Button>
              </form>
            )}

            {/* Step: New Password */}
            {emailStep === 'newPassword' && (
              <form onSubmit={handleEmailPasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/90">Nueva contrasena</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    required minLength={6} placeholder="Minimo 6 caracteres" className={DARK_INPUT} />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/90">Confirmar contrasena</Label>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    required placeholder="Repite la contrasena" className={DARK_INPUT} />
                </div>
                {recoveryError && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{recoveryError}</p>}
                <Button type="submit" className="w-full" disabled={recoverySubmitting}>
                  {recoverySubmitting ? 'Actualizando...' : 'Actualizar Contrasena'}
                </Button>
              </form>
            )}

            {/* Step: Success */}
            {emailStep === 'success' && (
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                  <CheckCircle className="h-6 w-6 text-emerald-400" />
                </div>
                <p className="text-sm text-emerald-400 font-medium">Contrasena actualizada correctamente</p>
                <p className="text-xs text-white/40">Redirigiendo al inicio...</p>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    )
  }

  // --- Recovery Method Selection ---
  if (recoveryMode === 'select') {
    return (
      <div className={pageBase}>
        {bgDecoration}
        <Card className={cardBase + ' relative z-10'}>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20">
              <Truck className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-xl">Recuperar Cuenta</CardTitle>
            <p className="text-sm text-white/50">Ingresa tu correo y elige como recuperar tu contrasena</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recovery-email-select" className="text-white/90">Correo electronico</Label>
              <Input id="recovery-email-select" type="email" placeholder="usuario@empresa.cl"
                value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)}
                required className={DARK_INPUT} />
            </div>
            <div className="space-y-2">
              <Button className="w-full" onClick={() => { if (recoveryEmail) setRecoveryMode('email') }}
                disabled={!recoveryEmail}>
                <Mail className="h-4 w-4 mr-2" /> Recuperar por Email
              </Button>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleWhatsAppStart} disabled={!recoveryEmail || waSubmitting}>
                <MessageSquare className="h-4 w-4 mr-2" />
                {waSubmitting ? 'Enviando...' : 'Recuperar por WhatsApp'}
              </Button>
            </div>
            <Button type="button" variant="ghost" className="w-full text-white/50 hover:text-white hover:bg-white/5"
              onClick={exitRecoveryMode}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Volver
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // --- Login Form ---
  return (
    <div className={pageBase}>
      {bgDecoration}
      <Card className={cardBase + ' relative z-10'}>
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20">
            <Truck className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">Gestion de Camiones</CardTitle>
          <p className="text-sm text-white/50">Inicia sesion para continuar</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/90">Correo electronico</Label>
              <Input id="email" type="email" placeholder="usuario@empresa.cl"
                value={email} onChange={(e) => setEmail(e.target.value)} required className={DARK_INPUT} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-white/90">Contrasena</Label>
                <button type="button" onClick={enterRecoveryMode}
                  className="text-xs text-white/40 hover:text-white underline underline-offset-2 transition-colors">
                  Olvidaste tu contrasena?
                </button>
              </div>
              <Input id="password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} required className={DARK_INPUT} />
            </div>
            {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
