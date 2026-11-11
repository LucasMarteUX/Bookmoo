import { useEffect, useState } from 'react'
import { Check, Clock, UserPlus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/toast'
import { errorText, follow, unfollow } from '@/lib/social'
import { cn } from '@/lib/utils'

export type FollowState = 'none' | 'pending' | 'following'

/** Seguir. Perfil fechado vira "pedido enviado" até a pessoa aprovar. Atualiza na hora e volta atrás se falhar. */
export function FollowButton({ userId, following, pending = false, pt, onChange, size = 'md', className }: {
  userId: string
  following: boolean
  pending?: boolean
  pt: boolean
  onChange?: (state: FollowState, previous: FollowState) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  const { user } = useAuth()
  const initial: FollowState = following ? 'following' : pending ? 'pending' : 'none'
  const [state, setState] = useState<FollowState>(initial)
  const [busy, setBusy] = useState(false)
  const [hover, setHover] = useState(false)
  useEffect(() => setState(initial), [initial])
  if (!user || user.id === userId) return null

  const toggle = async () => {
    const previous = state
    setBusy(true)
    try {
      if (state === 'none') {
        setState('following')
        const result = await follow(user.id, userId)
        const next: FollowState = result === 'pending' ? 'pending' : 'following'
        setState(next); onChange?.(next, previous)
      } else {
        setState('none')
        await unfollow(user.id, userId)
        onChange?.('none', previous)
      }
    } catch (err) {
      setState(previous)
      toast(errorText(err, pt), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const label = state === 'following'
    ? (hover ? (pt ? 'Deixar de seguir' : 'Unfollow') : (pt ? 'Seguindo' : 'Following'))
    : state === 'pending'
      ? (hover ? (pt ? 'Cancelar pedido' : 'Cancel request') : (pt ? 'Pedido enviado' : 'Requested'))
      : (pt ? 'Seguir' : 'Follow')
  const on = state !== 'none'
  return (
    <button type="button" onClick={() => { void toggle() }} disabled={busy} aria-pressed={on}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className={cn('inline-flex items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap transition-colors duration-200 disabled:opacity-70',
        size === 'sm' ? 'h-8 px-3 text-[12.5px]' : 'h-9 px-4 text-[13.5px]', on && 'border', className)}
      style={on
        ? { borderColor: 'var(--theme-border)', color: hover ? 'var(--color-destructive)' : 'var(--theme-text)', backgroundColor: 'var(--theme-card-bg)' }
        : { backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
      {state === 'following' ? <Check className="w-3.5 h-3.5" /> : state === 'pending' ? <Clock className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
      {label}
    </button>
  )
}
