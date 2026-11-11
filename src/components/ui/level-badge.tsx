import { CEFR, type CefrId } from '@/lib/cefr'
import { cn } from '@/lib/utils'

/** Selo CEFR. `compact` é só a sigla, sobre a capa; `full` traz o nome da faixa. */
export function LevelBadge({ id, pt, variant = 'full', className }: { id: CefrId; pt: boolean; variant?: 'compact' | 'full'; className?: string }) {
  if (variant === 'compact') {
    return (
      <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-medium', className)} style={{ backgroundColor: 'var(--theme-card-bg)', color: 'var(--theme-text)' }}>
        {id}
      </span>
    )
  }
  const band = CEFR.find(item => item.id === id)
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium', className)} style={{ backgroundColor: 'var(--theme-pastel-3)', color: 'var(--theme-pastel-text)' }}>
      <span>{id}</span>
      <span style={{ opacity: 0.75 }}>{pt ? band?.pt : band?.en}</span>
    </span>
  )
}
