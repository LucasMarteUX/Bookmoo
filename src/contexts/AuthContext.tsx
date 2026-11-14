import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { resetAiStatus } from '@/lib/aiKeys'

const ADMIN_EMAILS = ['lucasmarteux@gmail.com']

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  /** True when Supabase env is configured; when true, login is required. */
  hasSupabase: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, meta?: Record<string, string>) => Promise<{ error: Error | null; needsConfirmation?: boolean }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Dados de estudo ficam no aparelho (localStorage). Ao trocar de conta eles precisam sair, senão uma conta nova
// herda pontos, vocabulário e sequência de quem usou o aparelho antes. Preferências (tema, idioma) permanecem.
const OWNER_KEY = 'bookmoo-owner'
const ACCOUNT_DATA_KEYS = ['lexis-books', 'lexis-study', 'lexis-vocabulary', 'bookmoo-xp', 'bookmoo-practice', 'bookmoo-pins']
const clearAccountData = () => { for (const k of ACCOUNT_DATA_KEYS) { try { localStorage.removeItem(k) } catch { /* ignore */ } } }

/** Devolve true se os dados locais eram de outra conta e foram apagados (a página precisa recarregar). */
function claimDevice(user: { id: string; created_at?: string } | null | undefined): boolean {
  try {
    if (!user) return false
    const owner = localStorage.getItem(OWNER_KEY)
    if (owner === user.id) return false
    // Sem dono registrado: dados antigos só são mantidos se a conta já existia (uso anterior à regra); conta recém-criada começa limpa.
    const fresh = !!user.created_at && Date.now() - new Date(user.created_at).getTime() < 24 * 3600 * 1000
    const hadData = ACCOUNT_DATA_KEYS.some(k => localStorage.getItem(k))
    const mustClear = hadData && (!!owner || fresh)
    localStorage.setItem(OWNER_KEY, user.id)
    if (mustClear) { clearAccountData(); return true }
  } catch { /* sem armazenamento */ }
  return false
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    let accountId: string | undefined
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (claimDevice(session?.user)) { window.location.reload(); return }
      if (accountId !== session?.user.id) {
        accountId = session?.user.id
        resetAiStatus()
      }
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Supabase não configurado') }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error && data?.session) {
      setSession(data.session)
      setUser(data.session.user)
      setLoading(false)
    }
    return { error: error ? new Error(error.message) : null }
  }

  const signUp = async (email: string, password: string, meta?: Record<string, string>) => {
    if (!supabase) return { error: new Error('Supabase não configurado') }
    const { data, error } = await supabase.auth.signUp({ email, password, options: { ...(meta ? { data: meta } : {}), emailRedirectTo: window.location.origin } })
    if (!error && data?.session) {
      setSession(data.session)
      setUser(data.session.user)
      setLoading(false)
    }
    return { error: error ? new Error(error.message) : null, needsConfirmation: !error && !data?.session }
  }

  // Google: o Supabase redireciona para o Google e volta para o app já com a sessão.
  const signInWithGoogle = async () => {
    if (!supabase) return { error: new Error('Supabase não configurado') }
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    return { error: error ? new Error(error.message) : null }
  }

  const signOut = async () => {
    resetAiStatus()
    if (supabase) await supabase.auth.signOut()
    clearAccountData()
    try { localStorage.removeItem(OWNER_KEY) } catch { /* ignore */ }
    setSession(null)
    setUser(null)
    window.location.assign('/login') // recarrega para a memória não guardar dados da conta anterior
  }

  const isAdmin = !!user && ADMIN_EMAILS.includes((user.email ?? '').toLowerCase())
  const hasSupabase = !!supabase

  const value: AuthContextValue = {
    user,
    session,
    loading,
    isAdmin,
    hasSupabase,
    signIn,
    signUp,
    signInWithGoogle,
    signOut
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
