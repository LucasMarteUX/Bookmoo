// Selo de faixa etária do livro (orientação editorial do Bookmoo). No hover mostra as outras faixas e os temas;
// se o livro está acima da idade da pessoa, o selo avisa (o livro continua visível).
import { useState } from 'react'
import type { AgeInfo } from '@/lib/catalog'
import { cn } from '@/lib/utils'

export function AgeBadge({ ageMin, info, pt, className }: { ageMin?: number; info?: AgeInfo; pt: boolean; compact?: boolean; className?: string }) {
  const [open, setOpen] = useState(false)
  if (ageMin == null) return null
  const label = ageMin <= 0 ? (pt ? 'Livre' : 'All ages') : `${ageMin}+`
  return (
    <span className={cn('relative inline-flex', className)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" onClick={() => setOpen(v => !v)} onBlur={() => setOpen(false)} aria-expanded={open}
        aria-label={pt ? `Faixa etária: ${label}` : `Age rating: ${label}`}
        className="inline-flex items-center h-[26px] px-2.5 rounded-full text-[12px] font-medium border"
        style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}>
        {label}
      </button>
      {open && (
        <span role="tooltip" className="absolute left-0 top-full z-30 mt-2 w-72 rounded-xl border p-3 text-left text-[12.5px] leading-snug shadow-lg"
          style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}>
          <span className="block font-semibold">{pt ? 'Faixa etária' : 'Age rating'}</span>
          <span className="mt-1.5 flex justify-between gap-3"><span style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Indicação Bookmoo' : 'Bookmoo suggestion'}</span><span className="font-medium">{label}</span></span>
          {info?.escala_br && <span className="mt-1 flex justify-between gap-3"><span style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Escala brasileira (equivalente)' : 'Brazilian scale (equivalent)'}</span><span className="font-medium">{info.escala_br === 'L' ? (pt ? 'Livre' : 'All ages') : `${info.escala_br} ${pt ? 'anos' : 'years'}`}</span></span>}
          {!!info?.temas?.length && <span className="mt-2 block" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Temas: ' : 'Themes: '}{info.temas.join(', ')}</span>}
          <span className="mt-2 block text-[11.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Orientação editorial pelo conteúdo e temas da obra; não é classificação oficial.' : 'Editorial guidance based on the work’s content and themes; not an official rating.'}</span>
        </span>
      )}
    </span>
  )
}
