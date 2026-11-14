// Raio-X do inglês (análise de perfil com IA) e Histórias de reforço com quiz. Plus e Pro.
import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Brain, Crown, Loader2, Play, RefreshCw, Sparkles, Square } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/store/useLanguage'
import { useEntitlements } from '@/store/useEntitlements'
import { coach, type Insight, type ReinforcementStory } from '@/lib/billingApi'
import { openPaywall } from '@/components/billing/Paywall'
import { speak, stopSpeaking } from '@/lib/tts'
import { toast } from '@/components/ui/toast'

export function InsightsPage() {
  const pt = useLanguage().locale === 'pt-BR'
  const ent = useEntitlements(s => s.data)
  const allowed = !!ent && (ent.is_admin || ent.limits.insights !== 'none')
  const [insight, setInsight] = useState<Insight | null>(null)
  const [nextAt, setNextAt] = useState<string | null>(null)
  const [stories, setStories] = useState<ReinforcementStory[]>([])
  const [open, setOpen] = useState<ReinforcementStory | null>(null)
  const [busy, setBusy] = useState<'insight' | 'story' | null>(null)

  useEffect(() => {
    if (!supabase) return
    void supabase.from('profile_insights').select('id, created_at, report').order('created_at', { ascending: false }).limit(1).maybeSingle().then(({ data }) => setInsight(data as Insight | null))
    void supabase.from('reinforcement_stories').select('*').order('created_at', { ascending: false }).limit(30).then(({ data }) => setStories((data ?? []) as ReinforcementStory[]))
  }, [])

  const refresh = async () => {
    if (!allowed) { openPaywall('insights'); return }
    setBusy('insight')
    try { const r = await coach.insights(); setInsight(r.insight); setNextAt(r.next_at) } catch { /* convite já aberto ou erro */ } finally { setBusy(null) }
  }
  const newStory = async () => {
    if (!ent || !(ent.is_admin || ent.limits.stories !== 0)) { openPaywall('stories'); return }
    setBusy('story')
    try { const r = await coach.story(); setStories(s => [r.story, ...s]); setOpen(r.story) } catch (e) {
      if ((e as { code?: string }).code !== 'cap_reached') toast(pt ? 'Não foi possível criar a história agora' : 'Could not create the story now', { tone: 'error' })
    } finally { setBusy(null) }
  }
  const storiesLeft = ent?.limits.stories == null ? null : Math.max(0, (ent.limits.stories ?? 0) - Number(ent.usage?.stories ?? 0))
  const r = insight?.report

  if (open) return <StoryReader story={open} pt={pt} onClose={() => setOpen(null)} />

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header>
        <h1 className="font-display text-[32px] md:text-[42px] leading-tight flex items-center gap-2">{pt ? 'Raio-X do seu inglês' : 'Your English report'}{!allowed && <Crown className="w-6 h-6" style={{ color: '#d97706' }} />}</h1>
        <p className="mt-1 text-[14.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'A IA analisa suas palavras, práticas e conversas e mostra exatamente onde focar.' : 'AI analyses your words, practice and conversations and shows where to focus.'}</p>
      </header>

      <section className="rounded-3xl border p-5 sm:p-6" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
        {!r ? (
          <div className="text-center py-6">
            <Brain className="w-10 h-10 mx-auto" style={{ color: 'var(--theme-accent)' }} />
            <p className="mt-3 text-[15px]">{pt ? 'Gere seu primeiro Raio-X.' : 'Generate your first report.'}</p>
            <button type="button" onClick={refresh} disabled={busy !== null} className="mt-4 h-11 px-5 rounded-xl text-[14.5px] font-semibold inline-flex items-center gap-2" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
              {busy === 'insight' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{pt ? 'Analisar meu perfil' : 'Analyse my profile'}
            </button>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[18px] font-semibold leading-snug">{r.headline}</p>
              {r.level_estimate && <span className="shrink-0 h-8 px-3 rounded-full inline-flex items-center text-[13px] font-semibold" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>{r.level_estimate}</span>}
            </div>
            {r.strengths?.length ? <div><p className="text-[13px] font-semibold">{pt ? 'Pontos fortes' : 'Strengths'}</p><ul className="mt-1.5 space-y-1 text-[14px]">{r.strengths.map(s => <li key={s}>💪 {s}</li>)}</ul></div> : null}
            <div className="grid gap-3">
              {r.difficulties?.map((d, i) => (
                <div key={d.title} className="rounded-2xl p-4" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                  <p className="text-[14.5px] font-semibold">{i + 1}. {d.title}</p>
                  <p className="mt-1 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{d.evidence}</p>
                  <p className="mt-1.5 text-[13.5px]">👉 {d.tip}</p>
                </div>
              ))}
            </div>
            {r.focus_words?.length ? <div><p className="text-[13px] font-semibold">{pt ? 'Palavras que mais travam' : 'Trickiest words'}</p><div className="mt-2 flex flex-wrap gap-1.5">{r.focus_words.map(w => <span key={w} className="px-2.5 h-7 rounded-full inline-flex items-center text-[13px] border" style={{ borderColor: 'var(--theme-border)' }}>{w}</span>)}</div></div> : null}
            {r.recommendation && <p className="text-[14px]">🎯 <b>{pt ? 'Esta semana:' : 'This week:'}</b> {r.recommendation.practice} {r.recommendation.scene ? `· ${pt ? 'Cena sugerida' : 'Suggested scene'}: ${r.recommendation.scene}` : ''}</p>}
            <div className="flex items-center justify-between gap-3 text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
              <span>{pt ? 'Atualizado em' : 'Updated'} {new Date(insight!.created_at).toLocaleDateString(pt ? 'pt-BR' : 'en-US')}{nextAt ? ` · ${pt ? 'próximo em' : 'next on'} ${new Date(nextAt).toLocaleDateString(pt ? 'pt-BR' : 'en-US')}` : ''}</span>
              <button type="button" onClick={refresh} disabled={busy !== null} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border" style={{ borderColor: 'var(--theme-border)' }}>{busy === 'insight' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}{pt ? 'Atualizar' : 'Refresh'}</button>
            </div>
          </motion.div>
        )}
      </section>

      <section>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold">{pt ? 'Histórias de reforço' : 'Reinforcement stories'}</h2>
            <p className="text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Histórias curtas com as palavras e a gramática que você mais erra, com quiz no final.' : 'Short stories with your trickiest words and grammar, with a quiz.'}{storiesLeft != null && allowed ? ` ${pt ? `Restam ${storiesLeft} este mês.` : `${storiesLeft} left this month.`}` : ''}</p>
          </div>
          <button type="button" onClick={newStory} disabled={busy !== null} className="shrink-0 h-11 px-4 rounded-xl text-[14px] font-semibold inline-flex items-center gap-2 disabled:opacity-60" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            {busy === 'story' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{pt ? 'Nova história' : 'New story'}
          </button>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {stories.map(s => (
            <li key={s.id}>
              <button type="button" onClick={() => setOpen(s)} className="w-full text-left rounded-2xl border p-4 hover:shadow-md transition-shadow" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
                <p className="text-[15px] font-semibold">{s.title}</p>
                <p className="mt-1 text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{s.level} · {s.grammar_focus} · {(s.target_words ?? []).slice(0, 4).join(', ')}</p>
              </button>
            </li>
          ))}
        </ul>
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
      <button type="button" onClick={onClose} className="text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}>← {pt ? 'Raio-X' : 'Report'}</button>
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-[32px] leading-tight">{story.title}</h1>
        <button type="button" onClick={listen} className="shrink-0 w-11 h-11 rounded-full grid place-items-center" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }} aria-label={playing ? (pt ? 'Parar' : 'Stop') : (pt ? 'Ouvir' : 'Listen')}>{playing ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}</button>
      </div>
      <article className="space-y-4 text-[17px] leading-relaxed font-serif">
        {story.body.split(/\n\n+/).map((para, i) => (
          <p key={i}>{para.split(/(\s+)/).map((tok, j) => targets.has(tok.toLowerCase().replace(/[^a-z'-]/g, '')) ? <mark key={j} className="rounded px-0.5" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-accent) 25%, transparent)', color: 'inherit' }}>{tok}</mark> : tok)}</p>
        ))}
      </article>
      <section className="space-y-4">
        <h2 className="text-[16px] font-semibold">Quiz {Object.keys(answers).length === story.quiz.length ? `· ${score}/${story.quiz.length}` : ''}</h2>
        {story.quiz.map((q, i) => (
          <div key={i} className="rounded-2xl border p-4" style={{ borderColor: 'var(--theme-border)' }}>
            <p className="text-[14.5px] font-medium">{q.question}</p>
            <div className="mt-2 grid gap-1.5">
              {q.options.map((o, k) => {
                const picked = answers[i] === k
                const done = answers[i] !== undefined
                const right = k === q.answer
                return (
                  <button key={k} type="button" disabled={done} onClick={() => setAnswers(a => ({ ...a, [i]: k }))}
                    className="text-left rounded-xl border px-3 py-2 text-[14px]"
                    style={{ borderColor: done && right ? '#10b981' : picked ? '#ef4444' : 'var(--theme-border)', backgroundColor: done && right ? 'rgba(16,185,129,0.1)' : picked ? 'rgba(239,68,68,0.08)' : undefined }}>
                    {o}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
