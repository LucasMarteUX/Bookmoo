// Raio-X: avaliações datadas do inglês da pessoa. Cada avaliação mede, com os dados até aquele dia,
// Fala, Conversa, Vocabulário, Ditado e Constância (0–100), compara com a anterior e mostra a evolução.
// A IA só escreve o diagnóstico; as notas são calculadas dos dados. O nível é o oficial do app.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowDownRight, ArrowUpRight, Loader2, Lock, Minus, Play, Square } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/store/useLanguage'
import { useEntitlements } from '@/store/useEntitlements'
import { useStudyLevel } from '@/hooks/useStudyLevel'
import { coach, type Insight, type ReinforcementStory, type SkillKey } from '@/lib/billingApi'
import { openPaywall } from '@/components/billing/Paywall'
import { speak, stopSpeaking } from '@/lib/tts'
import { toast } from '@/components/ui/toast'

const SKILLS: { key: SkillKey; pt: string; en: string; where: string; hintPt: string; hintEn: string }[] = [
  { key: 'speaking', pt: 'Fala', en: 'Speaking', where: '/practice/speak', hintPt: 'Leia em voz alta em Praticar → Falar', hintEn: 'Read aloud in Practice → Speak' },
  { key: 'conversation', pt: 'Conversa', en: 'Conversation', where: '/conversar', hintPt: 'Converse por voz em Conversar', hintEn: 'Talk in Conversation' },
  { key: 'vocabulary', pt: 'Vocabulário', en: 'Vocabulary', where: '/vocabulary', hintPt: 'Salve e revise palavras', hintEn: 'Save and review words' },
  { key: 'dictation', pt: 'Ditado', en: 'Dictation', where: '/practice/write', hintPt: 'Faça um ditado em Praticar → Ditado', hintEn: 'Do a dictation' },
  { key: 'consistency', pt: 'Constância', en: 'Consistency', where: '/', hintPt: 'Estude um pouco todos os dias', hintEn: 'Study a little every day' },
]
const muted = { color: 'var(--theme-text-secondary)' }

function Delta({ now, before }: { now: number | null | undefined; before: number | null | undefined }) {
  if (now == null || before == null) return <span className="w-10" />
  const d = now - before
  const Icon = d > 0 ? ArrowUpRight : d < 0 ? ArrowDownRight : Minus
  return <span className="w-12 inline-flex items-center justify-end gap-0.5 text-[12.5px] tabular-nums" style={{ color: d > 0 ? '#059669' : d < 0 ? '#dc2626' : 'var(--theme-text-secondary)' }}><Icon className="w-3.5 h-3.5" />{d > 0 ? `+${d}` : d}</span>
}

function Trend({ points, pt }: { points: { at: string; v: number | null }[]; pt: boolean }) {
  const valid = points.filter(p => p.v != null) as { at: string; v: number }[]
  if (valid.length < 2) return <p className="text-[13px] py-8 text-center" style={muted}>{pt ? 'Gere pelo menos duas avaliações para ver a evolução.' : 'Generate at least two assessments to see your progress.'}</p>
  const W = 560, H = 160, P = 24
  const x = (i: number) => P + (i * (W - 2 * P)) / (valid.length - 1)
  const y = (v: number) => H - P - (v / 100) * (H - 2 * P)
  const d = valid.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.v)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40" role="img" aria-label={pt ? 'Evolução da nota' : 'Score trend'}>
      {[0, 50, 100].map(g => <g key={g}><line x1={P} x2={W - P} y1={y(g)} y2={y(g)} stroke="var(--theme-border)" strokeDasharray="3 4" /><text x={2} y={y(g) + 4} fontSize="10" fill="var(--theme-text-secondary)">{g}</text></g>)}
      <motion.path d={d} fill="none" stroke="var(--theme-text)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9 }} />
      {valid.map((p, i) => <g key={p.at}><circle cx={x(i)} cy={y(p.v)} r="3.5" fill="var(--theme-card-bg)" stroke="var(--theme-text)" strokeWidth="2" /><text x={x(i)} y={H - 4} fontSize="10" textAnchor="middle" fill="var(--theme-text-secondary)">{new Date(p.at).toLocaleDateString(pt ? 'pt-BR' : 'en-US', { day: 'numeric', month: 'short' })}</text></g>)}
    </svg>
  )
}

export function InsightsPage() {
  const pt = useLanguage().locale === 'pt-BR'
  const ent = useEntitlements(s => s.data)
  const level = useStudyLevel()
  const allowed = !!ent && (ent.is_admin || ent.limits.insights !== 'none')
  const [list, setList] = useState<Insight[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [trendKey, setTrendKey] = useState<'overall' | SkillKey>('overall')
  const [nextAt, setNextAt] = useState<string | null>(null)
  const [stories, setStories] = useState<ReinforcementStory[]>([])
  const [open, setOpen] = useState<ReinforcementStory | null>(null)
  const [busy, setBusy] = useState<'insight' | 'story' | null>(null)

  useEffect(() => {
    if (!supabase) return
    void supabase.from('profile_insights').select('id, created_at, summary, report').order('created_at', { ascending: true }).limit(60).then(({ data }) => setList((data ?? []) as Insight[]))
    void supabase.from('reinforcement_stories').select('*').order('created_at', { ascending: false }).limit(30).then(({ data }) => setStories((data ?? []) as ReinforcementStory[]))
  }, [])

  const generate = async () => {
    if (!allowed) { openPaywall('insights'); return }
    setBusy('insight')
    try {
      const r = await coach.insights(level.id)
      setNextAt(r.next_at)
      if (r.reused) toast(pt ? `Sua próxima avaliação libera em ${new Date(r.next_at).toLocaleDateString('pt-BR')}.` : `Next assessment available on ${new Date(r.next_at).toLocaleDateString('en-US')}.`)
      else { setList(l => [...l, r.insight]); setSelected(r.insight.id) }
    } catch { /* convite aberto ou erro */ } finally { setBusy(null) }
  }
  const newStory = async () => {
    if (!ent || !(ent.is_admin || ent.limits.stories !== 0)) { openPaywall('stories'); return }
    setBusy('story')
    try { const r = await coach.story(level.id); setStories(s => [r.story, ...s]); setOpen(r.story) } catch (e) {
      if ((e as { code?: string }).code !== 'cap_reached') toast(pt ? 'Não foi possível criar a história agora' : 'Could not create the story now', { tone: 'error' })
    } finally { setBusy(null) }
  }

  const withScores = list.filter(i => i.summary?.skills)
  const current = withScores.find(i => i.id === selected) ?? withScores[withScores.length - 1]
  const idx = current ? withScores.indexOf(current) : -1
  const previous = idx > 0 ? withScores[idx - 1] : null
  const cur = current?.summary?.skills
  const prev = previous?.summary?.skills
  const r = current?.report
  const trend = useMemo(() => withScores.map(i => ({ at: i.created_at, v: trendKey === 'overall' ? i.summary!.skills!.overall : i.summary!.skills!.scores[trendKey] })), [withScores.length, trendKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const storiesLeft = ent?.limits.stories == null ? null : Math.max(0, (ent.limits.stories ?? 0) - Number(ent.usage?.stories ?? 0))
  const date = (iso: string) => new Date(iso).toLocaleDateString(pt ? 'pt-BR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })

  if (open) return <StoryReader story={open} pt={pt} onClose={() => setOpen(null)} />

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[32px] md:text-[42px] leading-tight">Raio-X</h1>
          <p className="mt-1 text-[14.5px]" style={muted}>{pt ? 'Como está o seu inglês, o que melhorou e onde focar.' : 'Where your English is, what improved and where to focus.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-9 px-3 rounded-full inline-flex items-center text-[13px] border" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Seu nível' : 'Your level'} · <b className="ml-1">{level.id}</b></span>
          <button type="button" onClick={generate} disabled={busy !== null} className="h-9 px-4 rounded-full text-[13.5px] font-semibold inline-flex items-center gap-2 disabled:opacity-60" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            {busy === 'insight' ? <Loader2 className="w-4 h-4 animate-spin" /> : !allowed ? <Lock className="w-4 h-4" /> : null}
            {withScores.length ? (pt ? 'Nova avaliação' : 'New assessment') : (pt ? 'Gerar avaliação' : 'Generate assessment')}
          </button>
        </div>
      </header>

      {!cur ? (
        <section className="rounded-3xl border p-6 sm:p-8" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
          <h2 className="text-[18px] font-semibold">{pt ? 'Sua primeira avaliação' : 'Your first assessment'}</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed" style={muted}>{pt ? 'Analisamos tudo o que você fez até hoje e damos uma nota de 0 a 100 para cada habilidade. Gere outras avaliações com o tempo para ver a sua evolução.' : 'We analyse everything you have done so far and score each skill from 0 to 100. Generate more over time to see your progress.'}</p>
          <ul className="mt-5 grid gap-2 sm:grid-cols-5 text-[13px]">{SKILLS.map(s => <li key={s.key} className="rounded-xl border px-3 py-2.5 text-center" style={{ borderColor: 'var(--theme-border)' }}>{pt ? s.pt : s.en}</li>)}</ul>
        </section>
      ) : (
        <>
          <section className="rounded-3xl border p-5 sm:p-7" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[12.5px] uppercase tracking-wide" style={muted}>{pt ? 'Avaliação de' : 'Assessment of'} {date(current!.created_at)}</p>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-[56px] font-semibold leading-none tabular-nums">{cur.overall ?? '–'}</span>
                  <span className="text-[14px]" style={muted}>/ 100</span>
                  <Delta now={cur.overall} before={prev?.overall} />
                </div>
                {previous && <p className="mt-1 text-[12.5px]" style={muted}>{pt ? 'comparado com' : 'compared with'} {date(previous.created_at)}</p>}
              </div>
              {withScores.length > 1 && (
                <select value={current!.id} onChange={e => setSelected(e.target.value)} className="h-9 rounded-lg border px-2 text-[13px] bg-transparent" style={{ borderColor: 'var(--theme-border)' }} aria-label={pt ? 'Ver avaliação' : 'View assessment'}>
                  {[...withScores].reverse().map(i => <option key={i.id} value={i.id}>{date(i.created_at)} · {i.summary?.skills?.overall ?? '–'}</option>)}
                </select>
              )}
            </div>
            <div className="mt-6 space-y-3">
              {SKILLS.map(s => {
                const v = cur.scores[s.key]
                return (
                  <div key={s.key} className="grid grid-cols-[96px_1fr_36px_48px] items-center gap-3 text-[14px]">
                    <span>{pt ? s.pt : s.en}</span>
                    {v == null ? (
                      <Link to={s.where} className="text-[12.5px] underline underline-offset-2 truncate" style={muted}>{pt ? `Sem dados · ${s.hintPt}` : `No data · ${s.hintEn}`}</Link>
                    ) : (
                      <span className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                        <motion.span className="block h-full rounded-full" style={{ backgroundColor: 'var(--theme-text)' }} initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 0.7 }} />
                      </span>
                    )}
                    <span className="text-right tabular-nums font-medium">{v ?? ''}</span>
                    <Delta now={v} before={prev?.scores[s.key]} />
                  </div>
                )
              })}
            </div>
            <p className="mt-5 text-[12px]" style={muted}>
              {pt ? `Últimos ${cur.window_days} dias: ${cur.metrics.speak_sessions ?? 0} leituras em voz alta, ${cur.metrics.conversations ?? 0} conversas, ${cur.metrics.dictation_sessions ?? 0} ditados, ${cur.metrics.study_days ?? 0} dias de estudo (${cur.metrics.study_minutes ?? 0} min). Vocabulário: ${cur.metrics.words_total ?? 0} palavras, ${cur.metrics.words_learned ?? 0} aprendidas.`
                : `Last ${cur.window_days} days: ${cur.metrics.speak_sessions ?? 0} read-alouds, ${cur.metrics.conversations ?? 0} conversations, ${cur.metrics.dictation_sessions ?? 0} dictations, ${cur.metrics.study_days ?? 0} study days.`}
            </p>
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[16px] font-semibold">{pt ? 'Evolução' : 'Progress'}</h2>
              <div className="flex flex-wrap gap-1">
                {[{ key: 'overall' as const, pt: 'Geral', en: 'Overall' }, ...SKILLS].map(s => (
                  <button key={s.key} type="button" onClick={() => setTrendKey(s.key)} className="h-8 px-3 rounded-full text-[12.5px] border"
                    style={{ borderColor: trendKey === s.key ? 'var(--theme-text)' : 'var(--theme-border)', fontWeight: trendKey === s.key ? 600 : 400 }}>{pt ? s.pt : s.en}</button>
                ))}
              </div>
            </div>
            <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: 'var(--theme-border)' }}><Trend points={trend} pt={pt} /></div>
          </section>

          {r && (
            <section className="space-y-5">
              <h2 className="text-[16px] font-semibold">{pt ? 'Diagnóstico' : 'Diagnosis'}</h2>
              <p className="text-[16px] leading-relaxed">{r.headline}</p>
              {r.progress && <p className="text-[14.5px] leading-relaxed" style={muted}>{r.progress}</p>}
              {r.strengths?.length ? <div><p className="text-[13px] font-semibold">{pt ? 'Pontos fortes' : 'Strengths'}</p><ul className="mt-1.5 list-disc pl-5 space-y-1 text-[14px]">{r.strengths.map(s => <li key={s}>{s}</li>)}</ul></div> : null}
              <div>
                <p className="text-[13px] font-semibold">{pt ? 'Onde você mais precisa melhorar' : 'Where to improve most'}</p>
                <ol className="mt-2 grid gap-2">
                  {r.difficulties?.map((d, i) => (
                    <li key={d.title} className="rounded-2xl border p-4" style={{ borderColor: 'var(--theme-border)' }}>
                      <p className="text-[14.5px] font-semibold">{i + 1}. {d.title}</p>
                      <p className="mt-1 text-[13px]" style={muted}>{d.evidence}</p>
                      <p className="mt-1.5 text-[13.5px]">{d.tip}</p>
                    </li>
                  ))}
                </ol>
              </div>
              {r.study_plan?.length ? <div><p className="text-[13px] font-semibold">{pt ? 'Plano para os próximos 7 dias' : 'Plan for the next 7 days'}</p><ul className="mt-1.5 list-disc pl-5 space-y-1 text-[14px]">{r.study_plan.map(s => <li key={s}>{s}</li>)}</ul></div> : null}
              {r.focus_words?.length ? <div><p className="text-[13px] font-semibold">{pt ? 'Palavras para treinar' : 'Words to practise'}</p><div className="mt-2 flex flex-wrap gap-1.5">{r.focus_words.map(w => <span key={w} className="px-2.5 h-7 rounded-full inline-flex items-center text-[13px] border" style={{ borderColor: 'var(--theme-border)' }}>{w}</span>)}</div></div> : null}
            </section>
          )}
          {nextAt && <p className="text-[12.5px]" style={muted}>{pt ? 'Próxima avaliação disponível em' : 'Next assessment available on'} {date(nextAt)}.</p>}
        </>
      )}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold">{pt ? 'Histórias de reforço' : 'Reinforcement stories'}</h2>
            <p className="text-[13.5px]" style={muted}>{pt ? 'Histórias curtas no seu nível, com as palavras e a gramática que você mais erra.' : 'Short stories at your level with your trickiest words and grammar.'}{storiesLeft != null && ent?.limits.stories ? ` ${pt ? `Restam ${storiesLeft} este mês.` : `${storiesLeft} left this month.`}` : ''}</p>
          </div>
          <button type="button" onClick={newStory} disabled={busy !== null} className="h-9 px-4 rounded-full text-[13.5px] font-semibold inline-flex items-center gap-2 border disabled:opacity-60" style={{ borderColor: 'var(--theme-border)' }}>
            {busy === 'story' ? <Loader2 className="w-4 h-4 animate-spin" /> : !(ent?.is_admin || ent?.limits.stories !== 0) ? <Lock className="w-4 h-4" /> : null}{pt ? 'Nova história' : 'New story'}
          </button>
        </div>
        {stories.length > 0 && (
          <ul className="mt-4 divide-y rounded-2xl border" style={{ borderColor: 'var(--theme-border)' }}>
            {stories.map(s => (
              <li key={s.id} style={{ borderColor: 'var(--theme-border)' }}>
                <button type="button" onClick={() => setOpen(s)} className="w-full text-left px-4 py-3 hover:bg-[var(--ui-hover)]">
                  <p className="text-[14.5px] font-medium">{s.title}</p>
                  <p className="text-[12.5px]" style={muted}>{s.level} · {s.grammar_focus} · {(s.target_words ?? []).slice(0, 4).join(', ')}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function StoryReader({ story, pt, onClose }: { story: ReinforcementStory; pt: boolean; onClose: () => void }) {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [playing, setPlaying] = useState(false)
  const targets = new Set((story.target_words ?? []).map(w => w.toLowerCase()))
  const listen = async () => {
    if (playing) { stopSpeaking(); setPlaying(false); return }
    setPlaying(true)
    for (const para of story.body.split(/\n\n+/)) { const h = await speak(para, { context: 'reader' }); await h.done }
    setPlaying(false)
  }
  useEffect(() => () => stopSpeaking(), [])
  const score = story.quiz.filter((q, i) => answers[i] === q.answer).length
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <button type="button" onClick={onClose} className="text-[13.5px]" style={muted}>← Raio-X</button>
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-[32px] leading-tight">{story.title}</h1>
        <button type="button" onClick={listen} className="shrink-0 w-11 h-11 rounded-full grid place-items-center border" style={{ borderColor: 'var(--theme-border)' }} aria-label={playing ? (pt ? 'Parar' : 'Stop') : (pt ? 'Ouvir' : 'Listen')}>{playing ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}</button>
      </div>
      <article className="space-y-4 text-[17px] leading-relaxed font-serif">
        {story.body.split(/\n\n+/).map((para, i) => (
          <p key={i}>{para.split(/(\s+)/).map((tok, j) => targets.has(tok.toLowerCase().replace(/[^a-z'-]/g, '')) ? <mark key={j} className="rounded px-0.5" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-accent) 22%, transparent)', color: 'inherit' }}>{tok}</mark> : tok)}</p>
        ))}
      </article>
      <section className="space-y-4">
        <h2 className="text-[16px] font-semibold">Quiz {Object.keys(answers).length === story.quiz.length ? `· ${score}/${story.quiz.length}` : ''}</h2>
        {story.quiz.map((q, i) => (
          <div key={i} className="rounded-2xl border p-4" style={{ borderColor: 'var(--theme-border)' }}>
            <p className="text-[14.5px] font-medium">{q.question}</p>
            <div className="mt-2 grid gap-1.5">
              {q.options.map((o, k) => {
                const picked = answers[i] === k, done = answers[i] !== undefined, right = k === q.answer
                return (
                  <button key={k} type="button" disabled={done} onClick={() => setAnswers(a => ({ ...a, [i]: k }))} className="text-left rounded-xl border px-3 py-2 text-[14px]"
                    style={{ borderColor: done && right ? '#059669' : picked ? '#dc2626' : 'var(--theme-border)' }}>{o}</button>
                )
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
