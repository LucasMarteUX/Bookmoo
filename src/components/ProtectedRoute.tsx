import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useEntitlements } from '@/store/useEntitlements'

/** Rotas do primeiro acesso: liberadas mesmo com o onboarding pendente. */
const ONBOARDING_PATHS = ['/completar-cadastro', '/conhecendo-voce', '/planos', '/presente', '/checkout/retorno', '/terms', '/privacy', '/faq']

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { hasSupabase, session, loading } = useAuth()
  const location = useLocation()
  const { data: ent, unavailable, blocked, load, clear } = useEntitlements()
  const { signOut } = useAuth()

  useEffect(() => {
    if (session?.user?.id) void load()
    else clear()
  }, [session?.user?.id, load, clear])

  // Saldo e plano atualizados ao voltar para a aba (ex.: depois de pagar em outra aba).
  useEffect(() => {
    if (!session?.user?.id) return
    const onFocus = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onFocus)
    return () => document.removeEventListener('visibilitychange', onFocus)
  }, [session?.user?.id, load])

  if (blocked) {
    return (
      <div className="min-h-dvh grid place-items-center px-6 text-center" style={{ backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
        <div className="max-w-sm">
          <h1 className="font-display text-[28px]">Conta indisponível</h1>
          <p className="mt-2 text-[15px]" style={{ color: 'var(--theme-text-secondary)' }}>Sua conta foi suspensa. Se acha que foi um engano, fale com o suporte.</p>
          <button type="button" onClick={() => void signOut()} className="mt-6 h-11 px-6 rounded-xl text-[14.5px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>Sair</button>
        </div>
      </div>
    )
  }

  if (loading || (hasSupabase && session && !ent && !unavailable)) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ backgroundColor: 'var(--theme-bg)' }}>
        <p style={{ color: 'var(--theme-text-secondary)' }}>Carregando...</p>
      </div>
    )
  }

  if (hasSupabase && !session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Primeiro acesso: completar cadastro (Google) → planos → presente. Não dá para pular pela URL.
  if (ent && !ONBOARDING_PATHS.some(p => location.pathname.startsWith(p))) {
    if (ent.onboarding_step === 'complete_profile') return <Navigate to="/completar-cadastro" replace />
    if (ent.onboarding_step === 'survey') return <Navigate to="/conhecendo-voce" replace />
    if (ent.onboarding_step === 'plans') return <Navigate to="/planos?welcome=1" replace />
  }

  return <>{children}</>
}
