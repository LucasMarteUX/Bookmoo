// Conversar: Cenas prontas, Minhas cenas, conversa livre com tutor, sessão por voz e feedback com nota.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Captions, CaptionsOff, Crown, Languages, LifeBuoy, Lock, Plus, Sparkles, Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/store/useLanguage'
import { useEntitlements } from '@/store/useEntitlements'
import { conversation, type Feedback } from '@/lib/billingApi'
import { openPaywall } from '@/components/billing/Paywall'
import { useVoiceConversation } from '@/hooks/useVoiceConversation'
import { VoiceOrb, PlayStopButton } from '@/components/voice/VoiceOrb'
import { Confetti } from '@/components/billing/Confetti'
import { toast } from '@/components/ui/toast'
import { CATEGORY_LABEL, DEMO_SCENE_KEY, SCENES, type Scene, type SceneCategory } from '../../supabase/functions/_shared/scenes'

type CustomScene = { id: string; title: string; setting: string; persona: Scene['persona']; goals: string[]; level: string; created_at: string }
type Active = { kind: 'scene' | 'tutor'; scene?: Scene; customId?: string; minutes: number }

const ORDER: SceneCategory[] = ['cafe', 'restaurant', 'airport', 'market', 'work', 'relationships', 'hotel', 'transport', 'health', 'shopping', 'housing', 'smalltalk', 'kids']

export function ConversePage() {
  const pt = useLanguage().locale === 'pt-BR'
  const ent = useEntitlements(s => s.data)
  const [active, setActive] = useState<Active | null>(null)
  const [creating, setCreating] = useState(false)
  const [custom, setCustom] = useState<CustomScene[]>([])
  const [history, setHistory] = useState<{ id: string; title: string; score: number | null; started_at: string }[]>([])
  const [minutes, setMinutes] = useState(3)
  const age = ent?.birth_date ? Math.floor((Date.now() - new Date(`${ent.birth_date}T12:00:00`).getTime()) / (365.25 * 86400_000)) : null

  const reloadLists = () => {
    if (!supabase) return
    void supabase.from('scenes').select('id, title, setting, persona, goals, level, created_at').order('created_at', { ascending: false }).then(({ data }) => setCustom((data ?? []) as CustomScene[]))
    void supabase.from('conversation_sessions').select('id, title, score, started_at').eq('kind', 'scene').order('started_at', { ascending: false }).limit(8).then(({ data }) => setHistory(data ?? []))
  }
  useEffect(reloadLists, [])

  const demoOnly = !!ent && !ent.is_admin && ent.limits.scenes === 'demo'
  const maxMin = ent?.is_admin ? 10 : ent?.limits.max_scene_minutes ?? 3
  const visible = SCENES.filter(s => !s.ageMin || age === null || age >= s.ageMin)
  const byCat = useMemo(() => ORDER.map(c => [c, visible.filter(s => s.category === c)] as const).filter(([, list]) => list.length), [visible.length])

  const startScene = (scene: Scene) => {
    if (demoOnly && scene.key !== DEMO_SCENE_KEY) { openPaywall('scenes'); return }
    setActive({ kind: 'scene', scene, minutes: Math.min(minutes, maxMin) })
  }

  if (active) return <Session active={active} pt={pt} onExit={() => { setActive(null); reloadLists() }} />
  if (creating) return <CreateScene pt={pt} onDone={(s) => { setCreating(false); if (s) reloadLists() }} />

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] md:text-[44px] leading-[1.02]">{pt ? 'Conversar' : 'Conversation'}</h1>
          <p className="mt-1 text-[14.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
            {pt ? 'Fale em situações reais. O personagem responde por voz e, no fim, você recebe nota e correções.' : 'Speak in real situations. The character answers by voice and you get a score and corrections at the end.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Duração' : 'Length'}</span>
          {[3, 5, 10].map(m => (
            <button key={m} type="button" onClick={() => (m > maxMin ? openPaywall('scenes') : setMinutes(m))}
              className="h-9 px-3 rounded-full text-[13px] font-medium border inline-flex items-center gap-1"
              style={{ borderColor: minutes === m ? 'var(--theme-accent)' : 'var(--theme-border)', backgroundColor: minutes === m ? 'color-mix(in srgb, var(--theme-accent) 12%, transparent)' : undefined }}>
              {m} min{m > maxMin && <Lock className="w-3 h-3" />}
            </button>
          ))}
        </div>
      </header>

      {demoOnly && (
        <div className="rounded-2xl p-4 flex flex-wrap items-center gap-3 justify-between" style={{ background: 'linear-gradient(120deg, color-mix(in srgb, var(--theme-accent) 18%, transparent), transparent)', border: '1px solid var(--theme-border)' }}>
          <p className="text-[14px]">{pt ? '🎁 Experimente grátis a cena “Pedir café”. As outras 30+ cenas são dos planos pagos.' : '🎁 Try the “Ordering coffee” scene for free. 30+ more scenes come with paid plans.'}</p>
          <button type="button" onClick={() => openPaywall('scenes')} className="h-9 px-4 rounded-full text-[13px] font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Liberar todas' : 'Unlock all'}</button>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <motion.button type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
          onClick={() => (ent && (ent.is_admin || ent.limits.free_talk) ? setActive({ kind: 'tutor', minutes: 0 }) : openPaywall('free_talk'))}
          className="text-left rounded-3xl p-5 border relative overflow-hidden" style={{ borderColor: 'var(--theme-border)', background: 'linear-gradient(135deg, color-mix(in srgb, #8b5cf6 16%, transparent), transparent)' }}>
          <p className="text-[28px]" aria-hidden>💬</p>
          <p className="mt-2 text-[16px] font-semibold flex items-center gap-1.5">{pt ? 'Conversa livre com tutor' : 'Free talk with a tutor'}{!(ent?.is_admin || ent?.limits.free_talk) && <Crown className="w-4 h-4" style={{ color: '#d97706' }} />}</p>
          <p className="mt-1 text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Um tutor que conhece suas dificuldades e puxa exatamente o que você precisa treinar.' : 'A tutor who knows your weak spots and works on them.'}</p>
        </motion.button>
        <motion.button type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
          onClick={() => (ent && (ent.is_admin || ent.limits.scenes_create) ? setCreating(true) : openPaywall('scenes_create'))}
          className="text-left rounded-3xl p-5 border" style={{ borderColor: 'var(--theme-border)', background: 'linear-gradient(135deg, color-mix(in srgb, #f59e0b 16%, transparent), transparent)' }}>
          <p className="text-[28px]" aria-hidden>🎭</p>
          <p className="mt-2 text-[16px] font-semibold flex items-center gap-1.5">{pt ? 'Criar minha cena' : 'Create my scene'}{!(ent?.is_admin || ent?.limits.scenes_create) && <Crown className="w-4 h-4" style={{ color: '#d97706' }} />}</p>
          <p className="mt-1 text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Invente o lugar, o personagem e o seu objetivo. Ex.: “num pub na Irlanda”.' : 'Invent the place, character and goal. E.g. “in a pub in Ireland”.'}</p>
        </motion.button>
      </section>

      {custom.length > 0 && (
        <SceneRow title={`${CATEGORY_LABEL.custom.emoji} ${pt ? CATEGORY_LABEL.custom.pt : CATEGORY_LABEL.custom.en}`}>
          {custom.map(c => (
            <SceneCard key={c.id} emoji={c.persona?.emoji ?? '🙂'} title={c.title} sub={`${c.persona?.name ?? ''} · ${c.level}`} pt={pt}
              onClick={() => setActive({ kind: 'scene', customId: c.id, minutes: Math.min(minutes, maxMin), scene: { key: `custom:${c.id}`, category: 'custom', title: { pt: c.title, en: c.title }, setting: c.setting, persona: c.persona, goals: c.goals, twists: [], opening: '', usefulPhrases: [], level: [c.level as Scene['level'][0], c.level as Scene['level'][0]] } })} />
          ))}
        </SceneRow>
      )}

      {byCat.map(([cat, list]) => (
        <SceneRow key={cat} title={`${CATEGORY_LABEL[cat].emoji} ${pt ? CATEGORY_LABEL[cat].pt : CATEGORY_LABEL[cat].en}`}>
          {list.map(s => (
            <SceneCard key={s.key} emoji={s.persona.emoji} title={pt ? s.title.pt : s.title.en} sub={`${s.persona.name} · ${s.level[0]}${s.level[1] !== s.level[0] ? `–${s.level[1]}` : ''}`}
              locked={demoOnly && s.key !== DEMO_SCENE_KEY} featured={s.key === DEMO_SCENE_KEY && demoOnly} pt={pt} onClick={() => startScene(s)} />
          ))}
        </SceneRow>
      ))}

      {history.length > 0 && (
        <section>
          <h2 className="text-[16px] font-semibold">{pt ? 'Suas últimas conversas' : 'Your recent conversations'}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {history.map(h => (
              <li key={h.id} className="rounded-2xl border px-4 py-3 flex items-center justify-between text-[13.5px]" style={{ borderColor: 'var(--theme-border)' }}>
                <span className="truncate">{h.title} · {new Date(h.started_at).toLocaleDateString(pt ? 'pt-BR' : 'en-US')}</span>
                {h.score != null && <span className="font-semibold tabular-nums">{h.score}/100</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function SceneRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[16px] font-semibold">{title}</h2>
      <div className="mt-3 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
    </section>
  )
}

function SceneCard({ emoji, title, sub, locked, featured, onClick, pt }: { emoji: string; title: string; sub: string; locked?: boolean; featured?: boolean; onClick: () => void; pt: boolean }) {
  return (
    <motion.button type="button" onClick={onClick} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}
      className="relative text-left rounded-2xl border p-4 flex flex-col gap-1 min-h-[118px]"
      style={{ borderColor: featured ? 'var(--theme-accent)' : 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)', opacity: locked ? 0.75 : 1 }}>
      <span className="text-[30px]" aria-hidden>{emoji}</span>
      <span className="text-[14.5px] font-semibold leading-snug">{title}</span>
      <span className="text-[12px]" style={{ color: 'var(--theme-text-secondary)' }}>{sub}</span>
      {locked && <span className="absolute right-3 top-3 inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 h-5 rounded-full" style={{ backgroundColor: '#111', color: '#FCD34D' }}><Crown className="w-3 h-3" />Premium</span>}
      {featured && <span className="absolute right-3 top-3 text-[10.5px] font-semibold px-1.5 h-5 rounded-full inline-flex items-center" style={{ backgroundColor: 'var(--theme-accent)', color: '#fff' }}>{pt ? 'Grátis' : 'Free'}</span>}
    </motion.button>
  )
}

// ---------------------------------------------------------------------------
// Sessão
// ---------------------------------------------------------------------------
function Session({ active, pt, onExit }: { active: Active; pt: boolean; onExit: () => void }) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ goals: string[]; usefulPhrases: string[]; persona?: { name: string; emoji: string } } | null>(null)
  const [goalsMet, setGoalsMet] = useState<number[]>([])
  const [planned, setPlanned] = useState(0)
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [captions, setCaptions] = useState(true)
  const [assist, setAssist] = useState<{ suggestions?: { en: string; pt: string }[]; translation?: string } | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null | 'loading' | 'short'>(null)
  const [starting, setStarting] = useState(true)
  const ended = useRef(false)
  const sid = useRef<string | null>(null)

  const voice = useVoiceConversation({
    continuous: true,
    fillers: active.scene?.fillers,
    keywords: active.scene?.usefulPhrases.flatMap(p => p.replace(/[…?.!,]/g, '').split(' ').filter(w => w.length > 4)),
    onTurn: async (text, filler) => {
      const r = await conversation.turn({ sessionId: sid.current!, text, filler })
      return { reply: r.reply, extra: { goalsMet: r.goalsMet, wrapUp: r.wrapUp } }
    },
    onExtra: extra => {
      if (Array.isArray(extra.goalsMet)) setGoalsMet(g => [...new Set([...g, ...(extra.goalsMet as number[])])])
      if (extra.wrapUp && active.kind === 'scene') window.setTimeout(() => void finish(), 400)
    },
    onError: code => { if (code === 'session_over') void finish() },
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const r = await conversation.start(active.kind === 'tutor'
          ? { kind: 'tutor' }
          : { kind: 'scene', ...(active.customId ? { sceneId: active.customId } : { sceneKey: active.scene!.key }), minutes: active.minutes })
        if (cancelled) return
        sid.current = r.sessionId
        setSessionId(r.sessionId)
        setPlanned(r.plannedSeconds ?? 0)
        setStartedAt(Date.now())
        if (r.scene) {
          setMeta({ goals: r.scene.goals, usefulPhrases: r.scene.usefulPhrases, persona: r.scene.persona })
          voice.preload([...(r.scene.fillers ?? []), 'Good question…', 'Oh, I see…', 'Alright…'])
        }
        setStarting(false)
        if (r.opening) await voice.aiSays(r.opening, true)
        else void voice.aiSays(pt ? "Hi! I'm Bea, your tutor. What would you like to talk about today?" : "Hi! I'm Bea, your tutor. What would you like to talk about today?", true)
      } catch {
        if (!cancelled) onExit()
      }
    })()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!planned) return
    const iv = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(iv)
  }, [planned])

  const remaining = planned ? Math.max(0, planned - (now - startedAt) / 1000) : 0
  useEffect(() => { if (planned && startedAt && remaining <= 0 && !ended.current && voice.state !== 'speaking') void finish() }, [remaining, voice.state]) // eslint-disable-line react-hooks/exhaustive-deps

  async function finish() {
    if (ended.current || !sid.current) return
    ended.current = true
    voice.stop()
    if (active.kind !== 'scene') { await conversation.end(sid.current).catch(() => {}); onExit(); return }
    setFeedback('loading')
    try {
      const r = await conversation.end(sid.current, voice.getMetrics())
      setFeedback(r.feedback ?? 'short')
    } catch { setFeedback('short') }
  }

  const ask = async (mode: 'hint' | 'translate') => {
    if (!sessionId) return
    try { setAssist(await conversation.assist(sessionId, mode)) } catch { toast(pt ? 'Não foi possível ajudar agora' : 'Could not help right now', { tone: 'error' }) }
  }

  if (feedback) return <FeedbackView feedback={feedback} pt={pt} goals={meta?.goals ?? []} onExit={onExit} />

  const running = voice.state !== 'idle' && voice.state !== 'error'
  const title = active.kind === 'tutor' ? (pt ? 'Conversa livre' : 'Free talk') : (pt ? active.scene!.title.pt : active.scene!.title.en)
  const mm = Math.floor(remaining / 60), ss = Math.floor(remaining % 60)
  return (
    <div className="max-w-2xl mx-auto flex flex-col min-h-[calc(100dvh-10rem)]">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => void finish()} className="inline-flex items-center gap-1.5 h-10 px-2 -ml-2 text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}><ArrowLeft className="w-4 h-4" />{pt ? 'Encerrar' : 'End'}</button>
        <p className="text-[14px] font-semibold truncate px-2">{title}</p>
        <div className="flex items-center gap-1">
          {planned > 0 && (
            <span className="relative w-11 h-11 grid place-items-center text-[11.5px] font-semibold tabular-nums">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="none" stroke="var(--theme-border)" strokeWidth="3" /><circle cx="22" cy="22" r="19" fill="none" stroke={remaining < 30 ? '#dc2626' : 'var(--theme-accent)'} strokeWidth="3" strokeDasharray={2 * Math.PI * 19} strokeDashoffset={2 * Math.PI * 19 * (1 - remaining / planned)} strokeLinecap="round" /></svg>
              {mm}:{String(ss).padStart(2, '0')}
            </span>
          )}
          <button type="button" onClick={() => setCaptions(c => !c)} className="w-10 h-10 grid place-items-center rounded-full" aria-label={pt ? 'Legendas' : 'Captions'}>{captions ? <Captions className="w-4 h-4" /> : <CaptionsOff className="w-4 h-4" />}</button>
        </div>
      </div>

      {meta?.goals?.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {meta.goals.map((g, i) => (
            <motion.li key={i} layout className="text-[12px] px-2.5 h-7 rounded-full inline-flex items-center gap-1 border"
              animate={{ backgroundColor: goalsMet.includes(i) ? 'rgba(16,185,129,0.15)' : 'rgba(0,0,0,0)' }}
              style={{ borderColor: goalsMet.includes(i) ? '#10b981' : 'var(--theme-border)' }}>
              {goalsMet.includes(i) ? '✅' : '⬜'} {g}
            </motion.li>
          ))}
        </ul>
      ) : null}

      <div className="flex-1 mt-4 flex flex-col justify-end gap-2 overflow-y-auto">
        <AnimatePresence initial={false}>
          {captions && voice.bubbles.slice(-6).map(b => (
            <motion.div key={b.id} layout initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0 }}
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug ${b.role === 'user' ? 'self-end' : 'self-start'}`}
              style={b.role === 'user' ? { backgroundColor: 'var(--theme-bg-secondary)' } : { backgroundColor: 'color-mix(in srgb, var(--theme-accent) 13%, var(--theme-card-bg))' }}>
              {b.text}{b.pending ? <span className="opacity-60"> …</span> : null}
            </motion.div>
          ))}
          {captions && voice.interim && <motion.div key="interim" initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} className="self-end max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] italic" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>{voice.interim}</motion.div>}
        </AnimatePresence>
      </div>

      {assist && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-2xl border p-3 text-[13.5px]" style={{ borderColor: 'var(--theme-border)' }}>
          {assist.translation && <p>🇧🇷 {assist.translation}</p>}
          {assist.suggestions?.map(s => <p key={s.en} className="mt-1"><b>“{s.en}”</b> <span style={{ color: 'var(--theme-text-secondary)' }}>— {s.pt}</span></p>)}
          <button type="button" onClick={() => setAssist(null)} className="mt-2 text-[12.5px] underline" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Fechar' : 'Close'}</button>
        </motion.div>
      )}

      <div className="mt-4 flex flex-col items-center pb-4">
        {starting ? <p className="text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Preparando a cena…' : 'Setting the scene…'}</p> : (
          <>
            <VoiceOrb state={voice.state} level={voice.level} size={110} emoji={meta?.persona?.emoji ?? (active.kind === 'tutor' ? '👩‍🏫' : undefined)} />
            <p className="-mt-2 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }} aria-live="polite">
              {voice.state === 'listening' ? (pt ? 'Ouvindo… fale à vontade' : 'Listening… go ahead') : voice.state === 'thinking' ? (pt ? 'Pensando…' : 'Thinking…') : voice.state === 'speaking' ? `${meta?.persona?.name ?? 'Bea'}…` : voice.error === 'mic_denied' ? (pt ? 'Libere o microfone no navegador' : 'Allow the microphone') : (pt ? 'Toque no play para falar' : 'Tap play to talk')}
            </p>
            <div className="mt-3 flex items-center gap-4">
              <button type="button" onClick={() => ask('translate')} className="w-11 h-11 rounded-full grid place-items-center border" style={{ borderColor: 'var(--theme-border)' }} aria-label={pt ? 'Traduzir a última fala' : 'Translate last line'} title={pt ? 'Traduzir a última fala' : 'Translate last line'}><Languages className="w-4 h-4" /></button>
              <PlayStopButton active={running} onClick={() => (running ? voice.stop() : void voice.listen())} label={running ? (pt ? 'Parar' : 'Stop') : (pt ? 'Falar' : 'Talk')} size={64} />
              <button type="button" onClick={() => ask('hint')} className="w-11 h-11 rounded-full grid place-items-center border" style={{ borderColor: 'var(--theme-border)' }} aria-label={pt ? 'Ajuda: o que posso dizer?' : 'Help: what can I say?'} title={pt ? 'Ajuda: o que posso dizer?' : 'Help: what can I say?'}><LifeBuoy className="w-4 h-4" /></button>
            </div>
            {active.kind === 'scene' && <button type="button" onClick={() => void finish()} className="mt-4 text-[13px] underline underline-offset-4" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Terminar e ver minha nota' : 'Finish and see my score'}</button>}
          </>
        )}
      </div>
    </div>
  )
}

function FeedbackView({ feedback, pt, goals, onExit }: { feedback: Feedback | 'loading' | 'short'; pt: boolean; goals: string[]; onExit: () => void }) {
  if (feedback === 'loading') return <div className="max-w-xl mx-auto py-24 text-center"><Sparkles className="w-8 h-8 mx-auto animate-pulse" /><p className="mt-3 text-[15px]">{pt ? 'Avaliando sua conversa…' : 'Scoring your conversation…'}</p></div>
  if (feedback === 'short') return (
    <div className="max-w-xl mx-auto py-20 text-center">
      <p className="text-[40px]">🗣️</p>
      <h1 className="mt-3 font-display text-[26px]">{pt ? 'Conversa curta demais para avaliar' : 'Too short to score'}</h1>
      <p className="mt-2 text-[14.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Fale pelo menos duas vezes para receber nota e correções.' : 'Speak at least twice to get a score and corrections.'}</p>
      <button type="button" onClick={onExit} className="mt-6 h-11 px-5 rounded-xl font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Voltar às cenas' : 'Back to scenes'}</button>
    </div>
  )
  const labels: Record<string, [string, string]> = { communication: ['Comunicação', 'Communication'], grammar: ['Gramática', 'Grammar'], vocabulary: ['Vocabulário', 'Vocabulary'], fluency: ['Fluência', 'Fluency'], pronunciation: ['Pronúncia', 'Pronunciation'] }
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      {feedback.score >= 70 && <Confetti />}
      <div className="text-center">
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }}
          className="mx-auto w-32 h-32 rounded-full grid place-items-center shadow-xl" style={{ background: 'conic-gradient(var(--theme-accent) ' + feedback.score * 3.6 + 'deg, var(--theme-bg-secondary) 0deg)' }}>
          <div className="w-[104px] h-[104px] rounded-full grid place-items-center" style={{ backgroundColor: 'var(--theme-card-bg)' }}>
            <span className="text-[34px] font-semibold tabular-nums">{feedback.score}</span>
          </div>
        </motion.div>
        <p className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold"><Trophy className="w-4 h-4" />{pt ? 'Nível estimado nesta conversa' : 'Estimated level'}: {feedback.cefr}</p>
        <p className="mt-3 text-[15px] max-w-lg mx-auto">{feedback.summary}</p>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {Object.entries(labels).map(([k, [lp, le]]) => (
          <div key={k} className="rounded-2xl border p-2.5 text-center" style={{ borderColor: 'var(--theme-border)' }}>
            <p className="text-[18px] font-semibold tabular-nums">{feedback.criteria?.[k] ?? 0}<span className="text-[11px] opacity-60">/20</span></p>
            <p className="text-[10.5px] leading-tight" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? lp : le}</p>
          </div>
        ))}
      </div>
      {goals.length > 0 && (
        <section><h2 className="text-[15px] font-semibold">{pt ? 'Objetivos' : 'Goals'}</h2>
          <ul className="mt-2 space-y-1 text-[14px]">{goals.map((g, i) => <li key={i}>{feedback.goals_met?.includes(i) ? '✅' : '⬜'} {g}</li>)}</ul></section>
      )}
      {feedback.tips?.length > 0 && (
        <section><h2 className="text-[15px] font-semibold">{pt ? 'Dicas' : 'Tips'}</h2>
          <ul className="mt-2 space-y-1.5 text-[14px]">{feedback.tips.map(t => <li key={t}>💡 {t}</li>)}</ul></section>
      )}
      <section>
        <h2 className="text-[15px] font-semibold">{pt ? 'Você disse → Mais natural' : 'You said → More natural'}</h2>
        <ul className="mt-2 space-y-2">
          {feedback.corrections.map((c, i) => (
            <li key={i} className="rounded-2xl border p-3 text-[14px]" style={{ borderColor: 'var(--theme-border)' }}>
              <p style={{ color: 'var(--theme-text-secondary)' }}><s>{c.said}</s></p>
              <p className="font-medium">→ {c.better}</p>
              {c.why && <p className="mt-1 text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{c.why}</p>}
            </li>
          ))}
        </ul>
        {feedback.locked_corrections > 0 && (
          <button type="button" onClick={() => openPaywall('scenes')} className="mt-2 w-full rounded-2xl border p-3 text-[13.5px] inline-flex items-center justify-center gap-2" style={{ borderColor: 'var(--theme-border)', filter: 'none' }}>
            <Lock className="w-4 h-4" />{pt ? `+${feedback.locked_corrections} correções frase a frase no plano Plus` : `+${feedback.locked_corrections} more corrections on Plus`}
          </button>
        )}
      </section>
      {feedback.new_words?.length > 0 && (
        <section><h2 className="text-[15px] font-semibold">{pt ? 'Palavras úteis' : 'Useful words'}</h2>
          <ul className="mt-2 flex flex-wrap gap-2">{feedback.new_words.map(w => <li key={w.word} className="text-[13px] px-3 py-1.5 rounded-full border" style={{ borderColor: 'var(--theme-border)' }}><b>{w.word}</b> · {w.meaning}</li>)}</ul></section>
      )}
      <button type="button" onClick={onExit} className="h-12 w-full rounded-2xl text-[15px] font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Praticar outra cena' : 'Practise another scene'}</button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Criar cena
// ---------------------------------------------------------------------------
function CreateScene({ pt, onDone }: { pt: boolean; onDone: (created: boolean) => void }) {
  const [form, setForm] = useState({ setting: '', personaName: '', personaRole: '', personaTraits: '', goal: '', level: 'B1', title: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }))
  const field = 'w-full rounded-xl border px-3 py-2.5 text-[15px] bg-transparent outline-none'
  const save = async () => {
    if (form.setting.trim().length < 3 || form.goal.trim().length < 3) { setMsg(pt ? 'Conte onde é a cena e qual é o seu objetivo.' : 'Tell us where it happens and your goal.'); return }
    setBusy(true); setMsg('')
    try {
      const r = await conversation.createScene(form)
      if (r.rejected) { setMsg(r.reason ?? (pt ? 'Esta cena não pode ser criada.' : 'This scene cannot be created.')); setBusy(false); return }
      toast(pt ? 'Cena criada! 🎭' : 'Scene created! 🎭')
      onDone(true)
    } catch { setMsg(pt ? 'Não foi possível criar agora.' : 'Could not create now.'); setBusy(false) }
  }
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <button type="button" onClick={() => onDone(false)} className="inline-flex items-center gap-1.5 h-10 text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}><ArrowLeft className="w-4 h-4" />{pt ? 'Voltar' : 'Back'}</button>
      <h1 className="font-display text-[30px] leading-tight">{pt ? 'Criar minha cena' : 'Create my scene'}</h1>
      <label className="block"><span className="text-[13px] font-medium">{pt ? 'Onde acontece?' : 'Where does it happen?'}</span>
        <textarea rows={2} value={form.setting} onChange={set('setting')} placeholder={pt ? 'Ex.: Num pub na Irlanda numa sexta à noite' : 'E.g. In a pub in Ireland on a Friday night'} className={field} style={{ borderColor: 'var(--theme-border)' }} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="text-[13px] font-medium">{pt ? 'Nome do personagem' : 'Character name'}</span><input value={form.personaName} onChange={set('personaName')} placeholder="Seán" className={field} style={{ borderColor: 'var(--theme-border)' }} /></label>
        <label className="block"><span className="text-[13px] font-medium">{pt ? 'Quem é' : 'Who they are'}</span><input value={form.personaRole} onChange={set('personaRole')} placeholder={pt ? 'bartender' : 'bartender'} className={field} style={{ borderColor: 'var(--theme-border)' }} /></label>
      </div>
      <label className="block"><span className="text-[13px] font-medium">{pt ? 'Jeito do personagem' : 'Personality'}</span><input value={form.personaTraits} onChange={set('personaTraits')} placeholder={pt ? 'divertido, fala rápido, usa gírias locais' : 'funny, talks fast, uses local slang'} className={field} style={{ borderColor: 'var(--theme-border)' }} /></label>
      <label className="block"><span className="text-[13px] font-medium">{pt ? 'Seu objetivo' : 'Your goal'}</span><input value={form.goal} onChange={set('goal')} placeholder={pt ? 'Pedir uma bebida e saber se vai ter música ao vivo' : 'Order a drink and ask about live music'} className={field} style={{ borderColor: 'var(--theme-border)' }} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="text-[13px] font-medium">{pt ? 'Nível' : 'Level'}</span>
          <select value={form.level} onChange={set('level')} className={field} style={{ borderColor: 'var(--theme-border)' }}>{['A1', 'A2', 'B1', 'B2', 'C1'].map(l => <option key={l}>{l}</option>)}</select></label>
        <label className="block"><span className="text-[13px] font-medium">{pt ? 'Título (opcional)' : 'Title (optional)'}</span><input value={form.title} onChange={set('title')} className={field} style={{ borderColor: 'var(--theme-border)' }} /></label>
      </div>
      {msg && <p role="alert" className="text-[14px]" style={{ color: '#b42318' }}>{msg}</p>}
      <button type="button" disabled={busy} onClick={save} className="h-12 w-full rounded-2xl text-[15px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
        <Plus className="w-4 h-4" />{busy ? (pt ? 'Montando a cena…' : 'Building the scene…') : (pt ? 'Criar cena' : 'Create scene')}
      </button>
    </div>
  )
}
