import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const EVENT = 'bookmoo-avatar-changed'

/** Avisa quem mostra a foto da pessoa (sidebar, menus) que ela mudou. */
export function announceAvatar(url: string | null) {
  window.dispatchEvent(new CustomEvent<string | null>(EVENT, { detail: url }))
}

/**
 * Foto da pessoa logada, na mesma ordem de prioridade da tela de perfil:
 * foto recém-trocada → perfil no banco → metadados da conta (inclui a do Google) → cópia salva só no aparelho.
 */
export function useMyAvatar(): string | undefined {
  const { user } = useAuth()
  const meta = user?.user_metadata as { avatar_url?: string; picture?: string } | undefined
  const [fresh, setFresh] = useState<string | null>(null)
  const [fromProfile, setFromProfile] = useState<string | null>(null)

  useEffect(() => {
    setFresh(null)
    setFromProfile(null)
    if (!user || !supabase) return
    let alive = true
    void supabase.from('profiles').select('avatar_url').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (alive) setFromProfile((data?.avatar_url as string | null) ?? null) })
    return () => { alive = false }
  }, [user?.id])

  useEffect(() => {
    const onChange = (e: Event) => setFresh((e as CustomEvent<string | null>).detail)
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [])

  if (!user) return undefined
  let local: string | null = null
  try { local = localStorage.getItem(`bookmoo-avatar-${user.id}`) } catch { /* armazenamento bloqueado */ }
  return fresh || fromProfile || meta?.avatar_url || meta?.picture || local || undefined
}
