import { Award } from 'lucide-react'
import { fmtBand, type Section } from '@/lib/proficiencyApi'

const muted = { color: 'var(--theme-text-secondary)' }
const title = (s: Section) => s[0].toUpperCase() + s.slice(1)

export function ReportPreview() {
  const bars: [Section, number][] = [['reading', 4.5], ['listening', 4], ['writing', 3.5], ['speaking', 4]]
  return (
    <div className="relative mx-auto w-full max-w-[420px]" aria-label="Exemplo de relatório">
      <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-3xl border" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }} aria-hidden />
      <div className="relative rounded-3xl border p-6" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg)' }}>
        <div className="flex items-center justify-between text-[11.5px] uppercase tracking-[0.08em]" style={muted}><span>Relatório de resultado</span><span>Exemplo</span></div>
        <div className="mt-5 flex items-center gap-5">
          <ScoreDial value={4} size={112} />
          <div>
            <p className="text-[12.5px]" style={muted}>Faixa geral</p>
            <p className="font-display text-[40px] leading-none tabular-nums">4,0</p>
            <span className="mt-2 inline-flex items-center gap-1.5 h-7 px-2 rounded-md border text-[12.5px] font-semibold" style={{ borderColor: 'var(--theme-text)' }}><Award className="w-3.5 h-3.5" />B2</span>
          </div>
        </div>
        <ul className="mt-6 space-y-3">
          {bars.map(([s, b]) => (
            <li key={s}>
              <div className="flex justify-between text-[13px]"><span>{title(s)}</span><span className="tabular-nums font-medium">{fmtBand(b)}</span></div>
              <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}><div className="h-full rounded-full" style={{ width: `${((b - 1) / 5) * 100}%`, backgroundColor: 'var(--theme-text)' }} /></div>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-[12.5px] leading-relaxed rounded-xl p-3" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>“Você organiza bem as ideias no e-mail. Para subir, varie os conectores e desenvolva mais os exemplos.”</p>
      </div>
    </div>
  )
}

/** Mostrador semicircular da faixa (1 a 6). */
export function ScoreDial({ value, size = 140 }: { value: number | null; size?: number }) {
  const r = 44, c = Math.PI * r
  const frac = value == null ? 0 : (value - 1) / 5
  return (
    <svg viewBox="0 0 100 60" width={size} height={size * 0.6} aria-hidden>
      <path d="M6 54 A44 44 0 0 1 94 54" fill="none" stroke="var(--theme-bg-secondary)" strokeWidth="9" strokeLinecap="round" />
      <path d="M6 54 A44 44 0 0 1 94 54" fill="none" stroke="var(--theme-text)" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
    </svg>
  )
}

