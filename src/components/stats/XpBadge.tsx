// Pontuação no topo: sequência de dias (🔥) e pontos totais (⭐). Abre as estatísticas.
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useXpStore, xpSummary } from '@/store/useXpStore'

export function XpBadge({ pt }: { pt: boolean }) {
  const events = useXpStore(s => s.events)
  const navigate = useNavigate()
  const { total, streak, studiedToday } = useMemo(() => xpSummary(events), [events])
  const fmt = new Intl.NumberFormat(pt ? 'pt-BR' : 'en-US')
  const hint = pt
    ? `Sequência de ${streak} dia(s)${studiedToday ? '' : ' — estude hoje para não perder'} · ${fmt.format(total)} pontos`
    : `${streak}-day streak${studiedToday ? '' : ' — study today to keep it'} · ${fmt.format(total)} points`
  return (
    <button type="button" onClick={() => navigate('/stats')} title={hint} aria-label={hint}
      className="h-12 min-h-[44px] rounded-full border px-4 inline-flex items-center gap-3 text-sm font-bold tabular-nums transition-transform hover:-translate-y-0.5"
      style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-subtle)', color: 'var(--theme-text)' }}>
      <span className="inline-flex items-center gap-1" style={{ opacity: studiedToday || streak === 0 ? 1 : 0.6 }}>
        <span aria-hidden className={studiedToday ? '' : 'grayscale'}>🔥</span>{streak}
      </span>
      <span className="w-px h-5" style={{ backgroundColor: 'var(--theme-border-subtle)' }} />
      <span className="inline-flex items-center gap-1"><span aria-hidden>⭐</span>{fmt.format(total)}</span>
    </button>
  )
}
