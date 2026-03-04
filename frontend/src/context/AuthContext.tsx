import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/types'
import type { RolePermissions } from '@/lib/permissions'
import { DEFAULT_PERMISSIONS, parsePermissions } from '@/lib/permissions'

type UserProfile = Tables<'users'>

interface AuthContextType {
  session: Session | null
  user: UserProfile | null
  loading: boolean
  passwordRecovery: boolean
  permissions: RolePermissions
  permissionsLoading: boolean
  clearPasswordRecovery: () => void
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [permissions, setPermissions] = useState<RolePermissions>({ ...DEFAULT_PERMISSIONS })
  const [permissionsLoading, setPermissionsLoading] = useState(true)

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    setUser(data)

    // Load permissions from roles table
    if (data?.role) {
      const { data: roleData } = await supabase
        .from('roles')
        .select('permissions')
        .eq('name', data.role)
        .eq('is_active', true)
        .single()
      setPermissions(roleData ? parsePermissions(roleData.permissions) : { ...DEFAULT_PERMISSIONS })
    } else {
      setPermissions({ ...DEFAULT_PERMISSIONS })
    }
    setPermissionsLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        fetchProfile(session.user.id)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true)
      }
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setPermissions({ ...DEFAULT_PERMISSIONS })
    setPermissionsLoading(true)
  }

  function clearPasswordRecovery() {
    setPasswordRecovery(false)
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, passwordRecovery, permissions, permissionsLoading, clearPasswordRecovery, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
