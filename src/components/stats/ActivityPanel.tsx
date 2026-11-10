// Painel de atividade estilo GitHub: um quadradinho por dia (último ano), sequência de dias,
// horários em que o aluno mais estuda e de onde vieram os pontos.
import { Fragment, useEffect, useMemo, useRef } from 'react'
import { CalendarDays, Flame, Star, Trophy } from 'lucide-react'
import { kindOf, useXpStore, xpSummary, type XpKind } from '@/store/useXpStore'

// Intensidade em tons de tinta (preto/branco conforme o tema).
const LEVELS = ['var(--heat-0)', 'color-mix(in srgb, var(--theme-text) 22%, transparent)', 'color-mix(in srgb, var(--theme-text) 42%, transparent)', 'color-mix(in srgb, var(--theme-text) 66%, transparent)', 'var(--theme-text)']
const level = (n: number) => n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4
const card = { backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }

export function ActivityPanel({ pt }: { pt: boolean }) {
  const events = useXpStore(s => s.events)
  const summary = useMemo(() => xpSummary(events), [events])
  const fmt = new Intl.NumberFormat(pt ? 'pt-BR' : 'en-US')
  const locale = pt ? 'pt-BR' : 'en-US'

  // 53 semanas terminando nesta semana; colunas = semanas (domingo no topo), como no GitHub.
  const weeks = useMemo(() => {
    const today = new Date(); today.setHours(12, 0, 0, 0)
    const start = new Date(today); start.setDate(start.getDate() - today.getDay() - 52 * 7)
    const cols: { date: Date; key: string; count: number; points: number; future: boolean }[][] = []
    for (let w = 0; w < 53; w++) {
      const col = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(start); date.setDate(start.getDate() + w * 7 + d)
        const key = summary.dayKey(date.getTime())
        const v = summary.byDay.get(key)
        col.push({ date, key, count: v?.count ?? 0, points: v?.points ?? 0, future: date > today })
      }
      cols.push(col)
    }
    return cols
  }, [summary])
  const activeDays = summary.byDay.size
  const yearCount = weeks.flat().reduce((a, d) => a + d.count, 0)
  const months = weeks.map((col, i) => {
    const first = col[0].date
    const prev = weeks[i - 1]?.[0].date
    return !prev || prev.getMonth() !== first.getMonth() ? first.toLocaleDateString(locale, { month: 'short' }).replace('.', '') : ''
  })

  const byKind = useMemo(() => {
    const out: Record<XpKind, number> = { speak: 0, write: 0, learned: 0, read: 0, recovered: 0, community: 0 }
    for (const e of events) { const k = kindOf(e.key); if (k in out) out[k] += e.amount }
    return out
  }, [events])
  const kindLabels: Record<XpKind, string> = pt
    ? { speak: 'Falar', write: 'Ditado', learned: 'Palavras aprendidas', read: 'Páginas lidas', recovered: 'Bônus (palavras recuperadas)', community: 'Exemplos em imagem' }
    : { speak: 'Speak', write: 'Dictation', learned: 'Words learned', read: 'Pages read', recovered: 'Bonus (recovered words)', community: 'Image examples' }
  const maxHour = Math.max(1, ...summary.byHour)

  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => { scroller.current?.scrollTo({ left: scroller.current.scrollWidth }) }, [])

  return (
    <section className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          [<Flame key="i" className="w-3.5 h-3.5" />, pt ? 'Sequência atual' : 'Current streak', `${summary.streak} ${pt ? (summary.streak === 1 ? 'dia' : 'dias') : (summary.streak === 1 ? 'day' : 'days')}`,
            summary.studiedToday ? (pt ? 'Você já estudou hoje' : 'You studied today') : (pt ? 'Estude hoje para manter' : 'Study today to keep it')],
          [<Trophy key="i" className="w-3.5 h-3.5" />, pt ? 'Recorde' : 'Best streak', `${summary.best} ${pt ? (summary.best === 1 ? 'dia' : 'dias') : (summary.best === 1 ? 'day' : 'days')}`, pt ? 'maior sequência' : 'longest run'],
          [<Star key="i" className="w-3.5 h-3.5" />, pt ? 'Pontos' : 'Points', fmt.format(summary.total), pt ? 'Falar, ditado, leitura e vocabulário' : 'Speak, dictation, reading, vocabulary'],
          [<CalendarDays key="i" className="w-3.5 h-3.5" />, pt ? 'Dias de estudo' : 'Study days', fmt.format(activeDays), pt ? `${fmt.format(yearCount)} atividades no último ano` : `${fmt.format(yearCount)} activities last year`],
        ].map(([icon, label, value, sub]) => (
          <div key={String(label)} className="rounded-2xl border px-5 py-4" style={card}>
            <div className="flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{icon}{label}</div>
            <div className="mt-1.5 text-[26px] font-semibold tabular-nums leading-tight" style={{ color: 'var(--theme-text)' }}>{value}</div>
            <div className="text-[12px] mt-0.5" style={{ color: 'var(--theme-text-secondary)' }}>{sub}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border p-4" style={{ ...card, ['--heat-0' as string]: 'color-mix(in srgb, var(--theme-text) 8%, transparent)' }}>
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--theme-text)' }}>
          {pt ? `${fmt.format(yearCount)} atividades no último ano` : `${fmt.format(yearCount)} activities in the last year`}
        </p>
        <div ref={scroller} className="overflow-x-auto pb-1">
          <div className="inline-grid gap-[3px]" style={{ gridTemplateColumns: `28px repeat(53, 11px)`, gridTemplateRows: '14px repeat(7, 11px)' }}>
            <span />
            {months.map((m, i) => <span key={i} className="text-[11.5px] leading-none whitespace-nowrap" style={{ color: 'var(--theme-text-secondary)' }}>{m}</span>)}
            {Array.from({ length: 7 }, (_, d) => (
              <Fragment key={d}>
                <span key={`l${d}`} className="text-[11.5px] leading-[11px] pr-1 text-right" style={{ color: 'var(--theme-text-secondary)', gridColumn: 1, gridRow: d + 2 }}>
                  {d % 2 === 1 ? new Date(2024, 0, 7 + d).toLocaleDateString(locale, { weekday: 'short' }).replace('.', '') : ''}
                </span>
                {weeks.map((col, w) => {
                  const cell = col[d]
                  return <span key={`${w}-${d}`} className="rounded-[2px]"
                    style={{ gridColumn: w + 2, gridRow: d + 2, backgroundColor: cell.future ? 'transparent' : LEVELS[level(cell.count)] }}
                    title={cell.future ? undefined : `${cell.date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}: ${cell.count} ${pt ? 'atividade(s)' : 'activit(ies)'} · ${cell.points} ${pt ? 'pontos' : 'points'}`} />
                })}
              </Fragment>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-1 mt-2 text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? 'Menos' : 'Less'}
          {LEVELS.map(c => <span key={c} className="w-[11px] h-[11px] rounded-[2px]" style={{ backgroundColor: c }} />)}
          {pt ? 'Mais' : 'More'}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border p-4" style={card}>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--theme-text)' }}>{pt ? 'Horários em que você estuda' : 'When you study'}</p>
          <div className="flex items-end gap-[3px] h-24">
            {summary.byHour.map((n, h) => (
              <div key={h} className="flex-1 rounded-t-sm" title={`${h}h: ${n}`}
                style={{ height: `${Math.max(n ? 6 : 2, (n / maxHour) * 100)}%`, backgroundColor: n ? 'color-mix(in srgb, var(--theme-text) 55%, transparent)' : 'var(--theme-border-subtle)' }} />
            ))}
          </div>
          <div className="flex justify-between text-[11.5px] mt-1" style={{ color: 'var(--theme-text-secondary)' }}>
            <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
          </div>
        </div>
        <div className="rounded-2xl border p-4" style={card}>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--theme-text)' }}>{pt ? 'De onde vêm seus pontos' : 'Where your points come from'}</p>
          <div className="space-y-2">
            {(Object.keys(byKind) as XpKind[]).map(k => (
              <div key={k} className="flex items-center gap-2 text-sm">
                <span className="w-48 shrink-0 truncate" style={{ color: 'var(--theme-text-secondary)' }}>{kindLabels[k]}</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-border-subtle)' }}>
                  <div className="h-full rounded-full" style={{ width: `${summary.total ? (byKind[k] / summary.total) * 100 : 0}%`, backgroundColor: 'color-mix(in srgb, var(--theme-text) 55%, transparent)' }} />
                </div>
                <span className="w-12 text-right tabular-nums font-semibold" style={{ color: 'var(--theme-text)' }}>{fmt.format(byKind[k])}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
