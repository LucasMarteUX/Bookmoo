// Emblema de nível conquistado no teste de nível: medalha com a posição (1 a 6), o nome do nível e a marca de verificado.
import { BadgeCheck } from 'lucide-react'
import { levelName, levelRank, type CefrId } from '@/lib/cefr'

export function Emblem({ level, size = 44, pt = true }: { level: CefrId; size?: number; pt?: boolean }) {
  const name = levelName(level, pt)
  const big = size >= 80
  return (
    <span className="relative inline-grid place-items-center rounded-full font-semibold" title={name}
      style={{ width: size, height: size, backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text)', boxShadow: 'inset 0 0 0 2px var(--theme-text)' }}>
      <span className="text-center leading-none">
        <span className="block font-display tabular-nums" style={{ fontSize: size * (big ? 0.36 : 0.42) }}>{levelRank(level)}</span>
        {big && <span className="block mt-1 font-sans font-semibold uppercase tracking-[0.06em]" style={{ fontSize: Math.max(9, size * 0.1) }}>{name}</span>}
      </span>
      <BadgeCheck className="absolute -right-1 -bottom-1 rounded-full" style={{ width: size * 0.36, height: size * 0.36, backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }} />
    </span>
  )
}
