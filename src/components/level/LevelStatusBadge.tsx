// Selo do nível com o estado (docs/TESTE-DE-NIVEL.md, seção 4.1): pendente (contorno tracejado), verificado (preenchido,
// com marca) ou em revisão. Usado na barra lateral, no Você, no perfil e no teste.
import { BadgeCheck, Clock } from 'lucide-react'
import { CEFR, type CefrId } from '@/lib/cefr'
import { cn } from '@/lib/utils'

export type LevelState = 'pending' | 'verified' | 'review'

export function LevelStatusBadge({ level, state, pt, size = 'md', showName = false, className }: { level: CefrId; state: LevelState; pt: boolean; size?: 'sm' | 'md' | 'lg'; showName?: boolean; className?: string }) {
  const band = CEFR.find(b => b.id === level)
  const label = state === 'verified' ? (pt ? 'Verificado' : 'Verified') : state === 'review' ? (pt ? 'Em revisão' : 'Under review') : (pt ? 'Pendente' : 'Pending')
  const dims = size === 'lg' ? 'h-9 px-3.5 text-[15px] gap-2' : size === 'sm' ? 'h-6 px-2 text-[11.5px] gap-1' : 'h-7 px-2.5 text-[12.5px] gap-1.5'
  const verified = state === 'verified'
  return (
    <span title={`${pt ? band?.pt : band?.en} · ${label}`} className={cn('inline-flex items-center rounded-full font-semibold tabular-nums', dims, className)}
      style={verified
        ? { backgroundColor: 'var(--theme-text)', color: 'var(--theme-bg)' }
        : { border: `1.5px ${state === 'pending' ? 'dashed' : 'solid'} var(--theme-text-secondary)`, color: 'var(--theme-text)' }}>
      {verified ? <BadgeCheck className={size === 'lg' ? 'w-4.5 h-4.5' : 'w-3.5 h-3.5'} strokeWidth={2.2} /> : state === 'review' ? <Clock className="w-3.5 h-3.5" /> : null}
      <span>{pt ? band?.pt : band?.en}</span>
      {!verified && size !== 'sm' && <span className="font-medium opacity-70">· {label}</span>}
    </span>
  )
}
