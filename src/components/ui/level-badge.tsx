import { CEFR, type CefrId } from '@/lib/cefr'
import { cn } from '@/lib/utils'

/**
 * Selo de nível. Livros (`kind="book"`, padrão) mostram o código CEFR (A1 … C2); pessoas (`kind="person"`) mostram o
 * nível do Bookmoo (Iniciante … Lenda). `compact` é só o rótulo curto, sobre a capa ou ao lado do autor.
 */
export function LevelBadge({ id, pt, variant = 'full', kind = 'book', className }: { id: CefrId; pt: boolean; variant?: 'compact' | 'full'; kind?: 'book' | 'person'; className?: string }) {
  const band = CEFR.find(item => item.id === id)
  if (!band) return null
  const short = kind === 'book' ? band.id : (pt ? band.pt : band.en)
  if (variant === 'compact') {
    return (
      <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap', className)} style={{ backgroundColor: 'var(--theme-card-bg)', color: 'var(--theme-text)' }}>
        {short}
      </span>
    )
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium', className)} style={{ backgroundColor: 'var(--theme-pastel-3)', color: 'var(--theme-pastel-text)' }}>
      <span>{short}</span>
      {kind === 'book' && <span style={{ opacity: 0.75 }}>{pt ? band.book.pt : band.book.en}</span>}
    </span>
  )
}
