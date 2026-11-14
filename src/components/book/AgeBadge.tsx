// Selo de faixa etária do livro (orientação editorial do Bookmoo). No hover mostra as outras faixas e os temas;
// se o livro está acima da idade da pessoa, o selo avisa (o livro continua visível).
import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { ageFrom, type AgeInfo } from '@/lib/catalog'
import { cn } from '@/lib/utils'

export function useUserAge(): number | null {
  const { session } = useAuth()
  return ageFrom(session?.user?.user_metadata?.birth_date as string | undefined)
}

const WARN = { backgroundColor: 'color-mix(in srgb, #E8A93B 22%, var(--theme-card-bg))', color: 'var(--theme-text)' }

export function AgeBadge({ ageMin, info, pt, compact = false, className }: { ageMin?: number; info?: AgeInfo; pt: boolean; compact?: boolean; className?: string }) {
  const userAge = useUserAge()
  const [open, setOpen] = useState(false)
  if (ageMin == null) return null
  const above = userAge !== null && userAge < ageMin
  const label = ageMin <= 0 ? (pt ? 'Livre' : 'All ages') : `${ageMin}+`
  if (compact) {
    // Nos cards só aparece quando o livro está acima da idade da pessoa.
    if (!above) return null
    return (
      <span className={cn('inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[10.5px] font-semibold backdrop-blur-md', className)} style={WARN}
        title={pt ? `Indicado a partir de ${ageMin} anos: acima da sua idade` : `Suggested for ${ageMin}+: above your age`}>
        <AlertTriangle className="w-3 h-3" />{label}
      </span>
    )
  }
  return (
    <span className={cn('relative inline-flex', className)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" onClick={() => setOpen(v => !v)} onBlur={() => setOpen(false)} aria-expanded={open}
        aria-label={pt ? `Faixa etária: ${label}` : `Age rating: ${label}`}
        className="inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-full text-[12px] font-medium border"
        style={above ? { ...WARN, borderColor: '#E8A93B' } : { borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}>
        {above && <AlertTriangle className="w-3.5 h-3.5" />}{label}{above && <span>· {pt ? 'acima da sua idade' : 'above your age'}</span>}
      </button>
      {open && (
        <span role="tooltip" className="absolute left-0 top-full z-30 mt-2 w-72 rounded-xl border p-3 text-left text-[12.5px] leading-snug shadow-lg"
          style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}>
          <span className="block font-semibold">{pt ? 'Faixa etária' : 'Age rating'}</span>
          <span className="mt-1.5 flex justify-between gap-3"><span style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Indicação Bookmoo' : 'Bookmoo suggestion'}</span><span className="font-medium">{label}</span></span>
          {info?.escala_br && <span className="mt-1 flex justify-between gap-3"><span style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Escala brasileira (equivalente)' : 'Brazilian scale (equivalent)'}</span><span className="font-medium">{info.escala_br === 'L' ? (pt ? 'Livre' : 'All ages') : `${info.escala_br} ${pt ? 'anos' : 'years'}`}</span></span>}
          {userAge !== null && <span className="mt-1 flex justify-between gap-3"><span style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Sua idade' : 'Your age'}</span><span className="font-medium">{userAge} · {above ? (pt ? 'acima da indicação' : 'below the suggestion') : (pt ? 'adequado' : 'suitable')}</span></span>}
          {!!info?.temas?.length && <span className="mt-2 block" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Temas: ' : 'Themes: '}{info.temas.join(', ')}</span>}
          <span className="mt-2 block text-[11.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Orientação editorial pelo conteúdo e temas da obra; não é classificação oficial.' : 'Editorial guidance based on the work’s content and themes; not an official rating.'}</span>
        </span>
      )}
    </span>
  )
}
