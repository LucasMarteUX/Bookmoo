// Selo CEFR conquistado na prova de proficiência (A1 … C2). Aparece ao lado do nível do Bookmoo (Iniciante … Lenda),
// que é outra coisa: o nível do app vem do teste de nível; o selo, da prova completa.
import { Award } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { CefrId } from '@/lib/cefr'

export function CefrSeal({ cefr, pt, size = 'md', to, className }: { cefr: CefrId; pt: boolean; size?: 'sm' | 'md'; to?: string; className?: string }) {
  const body = (
    <span title={pt ? `Selo ${cefr} na prova de proficiência` : `${cefr} seal on the proficiency test`}
      className={cn('inline-flex items-center rounded-md font-semibold tabular-nums border', size === 'sm' ? 'h-6 px-1.5 gap-1 text-[11.5px]' : 'h-7 px-2 gap-1.5 text-[12.5px]', className)}
      style={{ borderColor: 'var(--theme-text)', color: 'var(--theme-text)' }}>
      <Award className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />{cefr}
    </span>
  )
  return to ? <Link to={to} className="inline-flex">{body}</Link> : body
}
