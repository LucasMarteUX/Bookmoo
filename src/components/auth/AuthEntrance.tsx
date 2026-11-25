import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/contexts/AuthContext'
import { RabbitFlight } from '@/components/brand/RabbitFlight'
import './auth-entrance.css'

export const AUTH_ENTRANCE_KEY = 'upoonly-auth-entrance'
export function rememberAuthEntrance() {
  try { sessionStorage.setItem(AUTH_ENTRANCE_KEY, String(Date.now())) } catch { /* private storage */ }
}
export function clearAuthEntrance() {
  try { sessionStorage.removeItem(AUTH_ENTRANCE_KEY) } catch { /* private storage */ }
}

/** Persists across route changes, including the Google callback and onboarding redirects. */
export function AuthEntrance() {
  const { session, loading } = useAuth()
  const previous = useRef<string | null | undefined>(undefined)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (loading) return
    const id = session?.user.id ?? null
    let pending = false
    try { const at = Number(sessionStorage.getItem(AUTH_ENTRANCE_KEY)); pending = at > 0 && Date.now() - at < 30 * 60 * 1000 } catch { /* private storage */ }
    if (id && (pending || previous.current === null)) {
      clearAuthEntrance()
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) setVisible(true)
    }
    previous.current = id
  }, [loading, session?.user.id])
  useEffect(() => {
    if (!visible) return
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => setVisible(false), 4600)
    return () => { clearTimeout(timer); document.body.style.overflow = before }
  }, [visible])
  if (!visible) return null
  return createPortal(<div className="auth-entrance" role="status" aria-label="Bem-vindo ao Upoonly">
    <RabbitFlight />
  </div>, document.body)
}
