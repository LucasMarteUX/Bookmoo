import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

const ADMIN_EMAILS = ['lucasmarteux@gmail.com', 'lidiane.cristina40@gmail.com']

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  /** True when Supabase env is configured; when true, login is required. */
  hasSupabase: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
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
    }
    return { error }
  }

  const signUp = async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Supabase não configurado') }
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (!error && data?.session) {
      setSession(data.session)
      setUser(data.session.user)
    }
    return { error }
  }

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
  }

  const isAdmin = !!user && ADMIN_EMAILS.includes(user.email ?? '')
  const hasSupabase = !!supabase

  const value: AuthContextValue = {
    user,
    session,
    loading,
    isAdmin,
    hasSupabase,
    signIn,
    signUp,
    signOut
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
