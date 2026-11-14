// Conversar: uma tela só, limpa. Orbe no centro, mãos-livres (ouve, espera o silêncio, responde e volta a ouvir).
// A situação (conversa livre ou uma Cena) e os ajustes ficam em painéis discretos.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Captions, CaptionsOff, Check, ChevronDown, Languages, LifeBuoy, Lock, Mic, MicOff, Plus, SlidersHorizontal, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/store/useLanguage'
import { useEntitlements } from '@/store/useEntitlements'
import { useStudyLevel } from '@/hooks/useStudyLevel'
import { conversation, type Feedback } from '@/lib/billingApi'
import { openPaywall } from '@/components/billing/Paywall'
import { useVoiceConversation } from '@/hooks/useVoiceConversation'
import { VoiceOrb } from '@/components/voice/VoiceOrb'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { CATEGORY_LABEL, DEMO_SCENE_KEY, SCENES, type Scene, type SceneCategory } from '../../supabase/functions/_shared/scenes'

type CustomScene = { id: string; title: string; setting: string; persona: Scene['persona']; goals: string[]; level: string }
type Choice = { kind: 'tutor' } | { kind: 'scene'; scene: Scene; customId?: string }

const ORDER: SceneCategory[] = ['cafe', 'restaurant', 'airport', 'market', 'work', 'relationships', 'hotel', 'transport', 'health', 'shopping', 'housing', 'smalltalk', 'kids']
const SPEEDS = [{ v: 0.8, pt: 'Lenta', en: 'Slow' }, { v: 0.95, pt: 'Natural', en: 'Natural' }, { v: 1.1, pt: 'Rápida', en: 'Fast' }]
const muted = { color: 'var(--theme-text-secondary)' }

function readPref<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback } catch { return fallback }
}
function writePref(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* ignore */ } }

export function ConversePage() {
  const pt = useLanguage().locale === 'pt-BR'
  const ent = useEntitlements(s => s.data)
  const level = useStudyLevel()
  const canFree = !!ent && (ent.is_admin || ent.limits.free_talk)
  const demoOnly = !!ent && !ent.is_admin && ent.limits.scenes === 'demo'
  const maxMin = ent?.is_admin ? 10 : ent?.limits.max_scene_minutes ?? 3
  const age = ent?.birth_date ? Math.floor((Date.now() - new Date(`${ent.birth_date}T12:00:00`).getTime()) / (365.25 * 86400_000)) : null

  const [choice, setChoice] = useState<Choice>(() => canFree ? { kind: 'tutor' } : { kind: 'scene', scene: SCENES.find(s => s.key === DEMO_SCENE_KEY)! })
  const [picker, setPicker] = useState(false)
  const [settings, setSettings] = useState(false)
  const [creating, setCreating] = useState(false)
  const [rate, setRate] = useState<number>(() => readPref('bookmoo-voice-rate', 0.95))
  const [captions, setCaptions] = useState<boolean>(() => readPref('bookmoo-voice-captions', true))
  const [minutes, setMinutes] = useState(() => Math.min(readPref('bookmoo-scene-minutes', 5), maxMin))
  const [custom, setCustom] = useState<CustomScene[]>([])
  const [feedback, setFeedback] = useState<Feedback | null | 'loading' | 'short'>(null)

  useEffect(() => { writePref('bookmoo-voice-rate', rate) }, [rate])
  useEffect(() => { writePref('bookmoo-voice-captions', captions) }, [captions])
  useEffect(() => { writePref('bookmoo-scene-minutes', minutes) }, [minutes])
  useEffect(() => { if (canFree && choice.kind === 'scene' && choice.scene.key === DEMO_SCENE_KEY) setChoice({ kind: 'tutor' }) }, [canFree]) // eslint-disable-line react-hooks/exhaustive-deps
  const loadCustom = () => {
    if (!supabase) return
    void supabase.from('scenes').select('id, title, setting, persona, goals, level').order('created_at', { ascending: false }).then(({ data }) => setCustom((data ?? []) as CustomScene[]))
  }
  useEffect(loadCustom, [])

  const visible = SCENES.filter(s => !s.ageMin || age === null || age >= s.ageMin)
  const byCat = useMemo(() => ORDER.map(c => [c, visible.filter(s => s.category === c)] as const).filter(([, l]) => l.length), [visible.length])

  const pick = (c: Choice) => {
    if (c.kind === 'tutor' && !canFree) { openPaywall('free_talk'); return }
    if (c.kind === 'scene' && demoOnly && c.scene.key !== DEMO_SCENE_KEY) { openPaywall('scenes'); return }
    setChoice(c)
    setPicker(false)
  }

  if (creating) return <CreateScene pt={pt} level={level.id} onDone={created => { setCreating(false); if (created) loadCustom() }} />
  if (feedback) return <FeedbackView feedback={feedback} pt={pt} goals={choice.kind === 'scene' ? choice.scene.goals : []} onExit={() => setFeedback(null)} />

  const title = choice.kind === 'tutor' ? (pt ? 'Conversa livre' : 'Free talk') : (pt ? choice.scene.title.pt : choice.scene.title.en)
  const subtitle = choice.kind === 'tutor' ? (pt ? 'Com a Bea, sua tutora' : 'With Bea, your tutor') : `${choice.scene.persona.name} · ${choice.scene.persona.role}`

  return (
    <>
      <Session key={`${choice.kind}:${choice.kind === 'scene' ? choice.scene.key : ''}`} choice={choice} pt={pt} level={level.id} rate={rate} captions={captions} minutes={Math.min(minutes, maxMin)}
        title={title} subtitle={subtitle} onOpenPicker={() => setPicker(true)} onOpenSettings={() => setSettings(true)} onToggleCaptions={() => setCaptions(c => !c)}
        onFeedback={setFeedback} />

      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent className="sm:max-w-lg max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{pt ? 'Com quem você quer conversar?' : 'Who do you want to talk to?'}</DialogTitle>
            <DialogDescription>{pt ? 'Escolha uma conversa livre ou uma situação do dia a dia.' : 'Pick a free talk or an everyday situation.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-1">
              <Row active={choice.kind === 'tutor'} locked={!canFree} title={pt ? 'Conversa livre' : 'Free talk'} sub={pt ? 'Tutora que conhece suas dificuldades' : 'A tutor who knows your weak spots'} onClick={() => pick({ kind: 'tutor' })} />
              <Row title={pt ? 'Criar minha cena' : 'Create my scene'} sub={pt ? 'Você inventa o lugar, o personagem e o objetivo' : 'You invent place, character and goal'} locked={!(ent?.is_admin || ent?.limits.scenes_create)} icon={<Plus className="w-4 h-4" />}
                onClick={() => { if (ent?.is_admin || ent?.limits.scenes_create) { setPicker(false); setCreating(true) } else openPaywall('scenes_create') }} />
            </div>
            {custom.length > 0 && (
              <Group title={pt ? CATEGORY_LABEL.custom.pt : CATEGORY_LABEL.custom.en}>
                {custom.map(c => (
                  <Row key={c.id} title={c.title} sub={`${c.persona?.name ?? ''} · ${c.level}`} active={choice.kind === 'scene' && choice.customId === c.id}
                    onClick={() => pick({ kind: 'scene', customId: c.id, scene: { key: `custom:${c.id}`, category: 'custom', title: { pt: c.title, en: c.title }, setting: c.setting, persona: c.persona, goals: c.goals, twists: [], opening: '', usefulPhrases: [], level: [c.level as Scene['level'][0], c.level as Scene['level'][0]] } })} />
                ))}
              </Group>
            )}
            {byCat.map(([cat, list]) => (
              <Group key={cat} title={pt ? CATEGORY_LABEL[cat].pt : CATEGORY_LABEL[cat].en}>
                {list.map(s => (
                  <Row key={s.key} title={pt ? s.title.pt : s.title.en} sub={`${s.persona.name} · ${s.level[0]}${s.level[1] !== s.level[0] ? `–${s.level[1]}` : ''}`}
                    active={choice.kind === 'scene' && choice.scene.key === s.key} locked={demoOnly && s.key !== DEMO_SCENE_KEY} onClick={() => pick({ kind: 'scene', scene: s })} />
                ))}
              </Group>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{pt ? 'Ajustes da conversa' : 'Conversation settings'}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <Seg label={pt ? 'Velocidade da voz' : 'Voice speed'} options={SPEEDS.map(s => ({ value: s.v, label: pt ? s.pt : s.en }))} value={rate} onChange={setRate} />
            <Seg label={pt ? 'Duração das Cenas' : 'Scene length'} options={[3, 5, 10].map(m => ({ value: m, label: `${m} min`, locked: m > maxMin }))} value={minutes}
              onChange={m => (m > maxMin ? openPaywall('scenes') : setMinutes(m))} />
            <label className="flex items-center justify-between text-[14px]">
              <span>{pt ? 'Mostrar legendas' : 'Show captions'}</span>
              <input type="checkbox" checked={captions} onChange={e => setCaptions(e.target.checked)} className="w-5 h-5 accent-[var(--theme-text)]" />
            </label>
            <p className="text-[12.5px]" style={muted}>{pt ? 'A conversa usa 1 crédito por minuto. Ela escuta sozinha: fale normalmente e faça pausas à vontade; ela espera você terminar. Você pode interromper a voz falando por cima.' : 'Uses 1 credit per minute. It listens on its own: speak naturally and pause freely; it waits for you to finish. You can interrupt by speaking.'}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><p className="px-1 text-[12px] font-medium uppercase tracking-wide" style={muted}>{title}</p><div className="mt-1 space-y-0.5">{children}</div></section>
}

function Row({ title, sub, active, locked, icon, onClick }: { title: string; sub: string; active?: boolean; locked?: boolean; icon?: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--ui-hover)]"
      style={{ backgroundColor: active ? 'var(--theme-nav-active)' : undefined }}>
      {icon && <span className="w-8 h-8 rounded-lg grid place-items-center border" style={{ borderColor: 'var(--theme-border)' }}>{icon}</span>}
      <span className="flex-1 min-w-0">
        <span className="block text-[14.5px] font-medium truncate">{title}</span>
        <span className="block text-[12.5px] truncate" style={muted}>{sub}</span>
      </span>
      {locked ? <Lock className="w-4 h-4 shrink-0" style={muted} /> : active ? <Check className="w-4 h-4 shrink-0" /> : null}
    </button>
  )
}

function Seg<T extends number>({ label, options, value, onChange }: { label: string; options: { value: T; label: string; locked?: boolean }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="text-[13px] font-medium mb-1.5">{label}</p>
      <div className="grid gap-1 p-0.5 rounded-xl" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)`, backgroundColor: 'var(--theme-bg-secondary)' }}>
        {options.map(o => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={value === o.value}
            className="h-9 rounded-lg text-[13px] font-medium inline-flex items-center justify-center gap-1 transition-colors"
            style={{ backgroundColor: value === o.value ? 'var(--theme-card-bg)' : 'transparent', color: value === o.value ? 'var(--theme-text)' : 'var(--theme-text-secondary)', boxShadow: value === o.value ? '0 1px 2px rgba(0,0,0,0.12)' : undefined }}>
            {o.label}{o.locked && <Lock className="w-3 h-3" />}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sessão
// ---------------------------------------------------------------------------
function Session({ choice, pt, level, rate, captions, minutes, title, subtitle, onOpenPicker, onOpenSettings, onToggleCaptions, onFeedback }: {
  choice: Choice; pt: boolean; level: string; rate: number; captions: boolean; minutes: number; title: string; subtitle: string
  onOpenPicker: () => void; onOpenSettings: () => void; onToggleCaptions: () => void; onFeedback: (f: Feedback | null | 'loading' | 'short') => void
}) {
  const [phase, setPhase] = useState<'ready' | 'starting' | 'live'>('ready')
  const [planned, setPlanned] = useState(0)
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [goals, setGoals] = useState<string[]>([])
  const [goalsMet, setGoalsMet] = useState<number[]>([])
  const [assist, setAssist] = useState<{ suggestions?: { en: string; pt: string }[]; translation?: string } | null>(null)
  const sid = useRef<string | null>(null)
  const ended = useRef(false)
  const scene = choice.kind === 'scene' ? choice.scene : null

  const voice = useVoiceConversation({
    continuous: true,
    bargeIn: true,
    rate,
    fillers: scene?.fillers,
    keywords: scene?.usefulPhrases.flatMap(p => p.replace(/[…?.!,]/g, '').split(' ').filter(w => w.length > 4)),
    onTurn: async (text, filler) => {
      const r = await conversation.turn({ sessionId: sid.current!, text, filler, level })
      return { reply: r.reply, extra: { goalsMet: r.goalsMet, wrapUp: r.wrapUp } }
    },
    onExtra: extra => {
      if (Array.isArray(extra.goalsMet)) setGoalsMet(g => [...new Set([...g, ...(extra.goalsMet as number[])])])
      if (extra.wrapUp && scene) window.setTimeout(() => void finish(), 600)
    },
    onError: code => { if (code === 'session_over') void finish() },
    onIdle: () => toast(pt ? 'Pausado por silêncio. Toque no microfone para continuar.' : 'Paused after silence. Tap the mic to continue.'),
  })

  const begin = async () => {
    setPhase('starting')
    try {
      const r = await conversation.start(scene
        ? { kind: 'scene', ...(choice.kind === 'scene' && choice.customId ? { sceneId: choice.customId } : { sceneKey: scene.key }), minutes, level }
        : { kind: 'tutor', level })
      sid.current = r.sessionId
      setPlanned(r.plannedSeconds ?? 0)
      setStartedAt(Date.now())
      setGoals(r.scene?.goals ?? [])
      if (r.scene) voice.preload([...(r.scene.fillers ?? []), 'Good question…', 'Oh, I see…', 'Alright…'])
      setPhase('live')
      await voice.start(r.opening ?? (pt ? "Hi! I'm Bea. What would you like to talk about today?" : "Hi! I'm Bea. What would you like to talk about today?"))
    } catch {
      setPhase('ready')
    }
  }

  useEffect(() => {
    if (!planned) return
    const iv = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(iv)
  }, [planned])
  const remaining = planned ? Math.max(0, planned - (now - startedAt) / 1000) : 0
  useEffect(() => { if (planned && startedAt && remaining <= 0 && !ended.current && voice.state !== 'speaking') void finish() }, [remaining, voice.state]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (sid.current && !ended.current) void conversation.end(sid.current).catch(() => {}) }, [])

  async function finish() {
    if (ended.current || !sid.current) return
    ended.current = true
    voice.stop()
    if (!scene) { await conversation.end(sid.current).catch(() => {}); setPhase('ready'); sid.current = null; ended.current = false; voice.setBubbles([]); return }
    onFeedback('loading')
    try { const r = await conversation.end(sid.current, voice.getMetrics()); onFeedback(r.feedback ?? 'short') } catch { onFeedback('short') }
  }

  const ask = async (mode: 'hint' | 'translate') => {
    if (!sid.current) return
    try { setAssist(await conversation.assist(sid.current, mode)) } catch { /* silencioso */ }
  }

  const live = phase === 'live'
  const listening = voice.state !== 'idle' && voice.state !== 'error'
  const lastAi = [...voice.bubbles].reverse().find(b => b.role === 'ai')
  const lastUser = [...voice.bubbles].reverse().find(b => b.role === 'user')
  const status = voice.state === 'listening' ? (pt ? 'Ouvindo' : 'Listening') : voice.state === 'thinking' ? (pt ? 'Pensando' : 'Thinking')
    : voice.state === 'speaking' ? (scene?.persona.name ?? 'Bea') : voice.error === 'mic_denied' ? (pt ? 'Libere o microfone no navegador' : 'Allow the microphone')
    : live ? (pt ? 'Pausado' : 'Paused') : ''
  const mm = Math.floor(remaining / 60), ss = Math.floor(remaining % 60)

  return (
    <div className="max-w-xl mx-auto flex flex-col min-h-[calc(100dvh-9rem)] md:min-h-[calc(100dvh-6rem)]">
      <header className="flex items-center justify-between gap-2">
        <button type="button" onClick={live ? undefined : onOpenPicker} disabled={live}
          className="min-w-0 flex items-center gap-1.5 rounded-xl px-2 py-1.5 -ml-2 text-left transition-colors enabled:hover:bg-[var(--ui-hover)]">
          <span className="min-w-0">
            <span className="block text-[17px] font-semibold truncate">{title}</span>
            <span className="block text-[12.5px] truncate" style={muted}>{subtitle}</span>
          </span>
          {!live && <ChevronDown className="w-4 h-4 shrink-0" style={muted} />}
        </button>
        <div className="flex items-center gap-1">
          {planned > 0 && live && <span className="text-[13px] tabular-nums px-2" style={{ color: remaining < 30 ? '#dc2626' : 'var(--theme-text-secondary)' }}>{mm}:{String(ss).padStart(2, '0')}</span>}
          <IconBtn label={pt ? 'Ajustes' : 'Settings'} onClick={onOpenSettings}><SlidersHorizontal className="w-[18px] h-[18px]" /></IconBtn>
        </div>
      </header>

      {goals.length > 0 && live && (
        <div className="mt-3 flex items-center gap-2 text-[12.5px]" style={muted}>
          <span>{pt ? 'Metas' : 'Goals'}</span>
          <span className="flex gap-1">{goals.map((g, i) => <span key={i} title={g} className="w-6 h-1 rounded-full transition-colors" style={{ backgroundColor: goalsMet.includes(i) ? 'var(--theme-text)' : 'var(--theme-border)' }} />)}</span>
          <span className="truncate">{goals.find((_, i) => !goalsMet.includes(i)) ?? (pt ? 'Todas cumpridas' : 'All done')}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center py-6">
        <VoiceOrb state={live ? voice.state : 'idle'} level={voice.level} size={150} />
        <AnimatePresence mode="wait">
          <motion.p key={status} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 h-5 text-[13px] tracking-wide" style={muted} aria-live="polite">{status}</motion.p>
        </AnimatePresence>
        {!live && (
          <p className="mt-4 max-w-sm text-center text-[14.5px] leading-relaxed" style={muted}>
            {scene ? scene.setting : (pt ? 'Converse sobre o que quiser. Ela conhece seu nível e puxa as palavras e a gramática que você mais precisa.' : 'Talk about anything. She knows your level and works on what you need most.')}
          </p>
        )}
        {captions && live && (
          <div className="mt-6 w-full space-y-3 text-center min-h-[96px]">
            <AnimatePresence mode="popLayout">
              {lastAi && <motion.p key={`ai-${lastAi.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[18px] leading-snug font-display">{lastAi.text}{lastAi.pending ? '…' : ''}</motion.p>}
            </AnimatePresence>
            <p className="text-[14px] leading-snug" style={muted}>{voice.interim || lastUser?.text || ''}</p>
          </div>
        )}
        {assist && live && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 w-full rounded-2xl border p-3 text-[13.5px] text-left" style={{ borderColor: 'var(--theme-border)' }}>
            {assist.translation && <p>{assist.translation}</p>}
            {assist.suggestions?.map(s => <p key={s.en} className="mt-1"><b>{s.en}</b> <span style={muted}>· {s.pt}</span></p>)}
            <button type="button" onClick={() => setAssist(null)} className="mt-2 text-[12.5px] underline" style={muted}>{pt ? 'Fechar' : 'Close'}</button>
          </motion.div>
        )}
      </div>

      <footer className="pb-4">
        {!live ? (
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={begin} disabled={phase === 'starting'}
            className="w-full h-14 rounded-full text-[16px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            <Mic className="w-5 h-5" />{phase === 'starting' ? (pt ? 'Preparando…' : 'Getting ready…') : (pt ? 'Começar a conversar' : 'Start talking')}
          </motion.button>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <IconBtn label={pt ? 'Ajuda: o que posso dizer?' : 'Help: what can I say?'} onClick={() => ask('hint')} ring><LifeBuoy className="w-5 h-5" /></IconBtn>
            <IconBtn label={pt ? 'Traduzir a última fala' : 'Translate last line'} onClick={() => ask('translate')} ring><Languages className="w-5 h-5" /></IconBtn>
            <motion.button type="button" whileTap={{ scale: 0.92 }} onClick={() => (listening ? voice.stop() : void voice.listen())}
              aria-label={listening ? (pt ? 'Pausar microfone' : 'Pause microphone') : (pt ? 'Continuar' : 'Resume')}
              className="w-16 h-16 rounded-full grid place-items-center border" style={{ borderColor: 'var(--theme-border)', backgroundColor: listening ? 'var(--theme-card-bg)' : 'var(--theme-bg-secondary)' }}>
              {listening ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" style={muted} />}
            </motion.button>
            <IconBtn label={captions ? (pt ? 'Esconder legendas' : 'Hide captions') : (pt ? 'Mostrar legendas' : 'Show captions')} onClick={onToggleCaptions} ring>{captions ? <Captions className="w-5 h-5" /> : <CaptionsOff className="w-5 h-5" />}</IconBtn>
            <motion.button type="button" whileTap={{ scale: 0.92 }} onClick={() => void finish()} aria-label={pt ? 'Encerrar' : 'End'}
              className="w-12 h-12 rounded-full grid place-items-center" style={{ backgroundColor: '#dc2626', color: '#fff' }}>
              <X className="w-5 h-5" />
            </motion.button>
          </div>
        )}
      </footer>
    </div>
  )
}

function IconBtn({ label, onClick, children, ring }: { label: string; onClick: () => void; children: React.ReactNode; ring?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className={`${ring ? 'w-12 h-12 border' : 'w-10 h-10'} rounded-full grid place-items-center transition-colors hover:bg-[var(--ui-hover)]`}
      style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}>
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Resultado da Cena
// ---------------------------------------------------------------------------
function FeedbackView({ feedback, pt, goals, onExit }: { feedback: Feedback | 'loading' | 'short'; pt: boolean; goals: string[]; onExit: () => void }) {
  if (feedback === 'loading') return <div className="max-w-xl mx-auto py-28 text-center"><VoiceOrb state="thinking" level={0} size={90} /><p className="mt-2 text-[15px]" style={muted}>{pt ? 'Avaliando sua conversa' : 'Scoring your conversation'}</p></div>
  if (feedback === 'short') return (
    <div className="max-w-md mx-auto py-24 text-center">
      <h1 className="font-display text-[26px]">{pt ? 'Conversa curta demais para avaliar' : 'Too short to score'}</h1>
      <p className="mt-2 text-[14.5px]" style={muted}>{pt ? 'Fale pelo menos duas vezes para receber nota e correções.' : 'Speak at least twice to get a score and corrections.'}</p>
      <button type="button" onClick={onExit} className="mt-6 h-11 px-6 rounded-full font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Voltar' : 'Back'}</button>
    </div>
  )
  const labels: Record<string, [string, string]> = { communication: ['Comunicação', 'Communication'], grammar: ['Gramática', 'Grammar'], vocabulary: ['Vocabulário', 'Vocabulary'], fluency: ['Fluência', 'Fluency'], pronunciation: ['Pronúncia', 'Pronunciation'] }
  const r = 54, c = 2 * Math.PI * r
  return (
    <div className="max-w-xl mx-auto space-y-8 pb-10">
      <div className="text-center pt-4">
        <div className="relative mx-auto w-36 h-36">
          <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
            <circle cx="64" cy="64" r={r} fill="none" stroke="var(--theme-border)" strokeWidth="6" />
            <motion.circle cx="64" cy="64" r={r} fill="none" stroke="var(--theme-text)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c}
              initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - feedback.score / 100) }} transition={{ duration: 1.1, ease: 'easeOut' }} />
          </svg>
          <span className="absolute inset-0 grid place-items-center text-[38px] font-semibold tabular-nums">{feedback.score}</span>
        </div>
        <p className="mt-3 text-[13px]" style={muted}>{pt ? 'Nível nesta conversa' : 'Level in this conversation'} · {feedback.cefr}</p>
        <p className="mt-3 text-[15.5px] leading-relaxed">{feedback.summary}</p>
      </div>
      <div className="space-y-2.5">
        {Object.entries(labels).map(([k, [lp, le]]) => {
          const v = Number(feedback.criteria?.[k] ?? 0)
          return (
            <div key={k} className="grid grid-cols-[110px_1fr_40px] items-center gap-3 text-[13.5px]">
              <span>{pt ? lp : le}</span>
              <span className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}><motion.span className="block h-full rounded-full" style={{ backgroundColor: 'var(--theme-text)' }} initial={{ width: 0 }} animate={{ width: `${(v / 20) * 100}%` }} transition={{ duration: 0.8 }} /></span>
              <span className="text-right tabular-nums" style={muted}>{v}/20</span>
            </div>
          )
        })}
      </div>
      {goals.length > 0 && (
        <section><h2 className="text-[14px] font-semibold">{pt ? 'Metas' : 'Goals'}</h2>
          <ul className="mt-2 space-y-1.5 text-[14px]">{goals.map((g, i) => <li key={i} className="flex items-center gap-2">{feedback.goals_met?.includes(i) ? <Check className="w-4 h-4" /> : <span className="w-4 h-4 rounded-full border" style={{ borderColor: 'var(--theme-border)' }} />}{g}</li>)}</ul></section>
      )}
      {feedback.tips?.length > 0 && (
        <section><h2 className="text-[14px] font-semibold">{pt ? 'Dicas' : 'Tips'}</h2>
          <ul className="mt-2 space-y-1.5 text-[14px] list-disc pl-5">{feedback.tips.map(t => <li key={t}>{t}</li>)}</ul></section>
      )}
      {(feedback.corrections.length > 0 || feedback.locked_corrections > 0) && (
        <section>
          <h2 className="text-[14px] font-semibold">{pt ? 'Você disse → Mais natural' : 'You said → More natural'}</h2>
          <ul className="mt-2 divide-y rounded-2xl border" style={{ borderColor: 'var(--theme-border)' }}>
            {feedback.corrections.map((c, i) => (
              <li key={i} className="p-3 text-[14px]" style={{ borderColor: 'var(--theme-border)' }}>
                <p style={muted}><s>{c.said}</s></p>
                <p className="font-medium">{c.better}</p>
                {c.why && <p className="mt-0.5 text-[12.5px]" style={muted}>{c.why}</p>}
              </li>
            ))}
          </ul>
          {feedback.locked_corrections > 0 && (
            <button type="button" onClick={() => openPaywall('scenes')} className="mt-2 w-full h-11 rounded-xl border text-[13.5px] inline-flex items-center justify-center gap-2" style={{ borderColor: 'var(--theme-border)' }}>
              <Lock className="w-4 h-4" />{pt ? `+${feedback.locked_corrections} correções no plano Plus` : `+${feedback.locked_corrections} corrections on Plus`}
            </button>
          )}
        </section>
      )}
      {feedback.new_words?.length > 0 && (
        <section><h2 className="text-[14px] font-semibold">{pt ? 'Palavras úteis' : 'Useful words'}</h2>
          <ul className="mt-2 flex flex-wrap gap-2">{feedback.new_words.map(w => <li key={w.word} className="text-[13px] px-3 py-1.5 rounded-full border" style={{ borderColor: 'var(--theme-border)' }}><b>{w.word}</b> · {w.meaning}</li>)}</ul></section>
      )}
      <button type="button" onClick={onExit} className="h-12 w-full rounded-full text-[15px] font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Conversar de novo' : 'Talk again'}</button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Criar cena
// ---------------------------------------------------------------------------
function CreateScene({ pt, level, onDone }: { pt: boolean; level: string; onDone: (created: boolean) => void }) {
  const [form, setForm] = useState({ setting: '', personaName: '', personaRole: '', personaTraits: '', goal: '', level: ['A1', 'A2', 'B1', 'B2', 'C1'].includes(level) ? level : 'A2', title: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }))
  const field = 'mt-1 w-full rounded-xl border px-3 py-2.5 text-[15px] bg-transparent outline-none'
  const save = async () => {
    if (form.setting.trim().length < 3 || form.goal.trim().length < 3) { setMsg(pt ? 'Conte onde é a cena e qual é o seu objetivo.' : 'Tell us where it happens and your goal.'); return }
    setBusy(true); setMsg('')
    try {
      const r = await conversation.createScene(form)
      if (r.rejected) { setMsg(r.reason ?? (pt ? 'Esta cena não pode ser criada.' : 'This scene cannot be created.')); setBusy(false); return }
      toast(pt ? 'Cena criada' : 'Scene created')
      onDone(true)
    } catch { setMsg(pt ? 'Não foi possível criar agora.' : 'Could not create now.'); setBusy(false) }
  }
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <button type="button" onClick={() => onDone(false)} className="inline-flex items-center gap-1.5 h-10 text-[13.5px]" style={muted}><X className="w-4 h-4" />{pt ? 'Cancelar' : 'Cancel'}</button>
      <h1 className="font-display text-[30px] leading-tight">{pt ? 'Criar minha cena' : 'Create my scene'}</h1>
      <label className="block text-[13px] font-medium">{pt ? 'Onde acontece?' : 'Where does it happen?'}
        <textarea rows={2} value={form.setting} onChange={set('setting')} placeholder={pt ? 'Num pub na Irlanda numa sexta à noite' : 'In a pub in Ireland on a Friday night'} className={field} style={{ borderColor: 'var(--theme-border)' }} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-[13px] font-medium">{pt ? 'Nome do personagem' : 'Character name'}<input value={form.personaName} onChange={set('personaName')} placeholder="Seán" className={field} style={{ borderColor: 'var(--theme-border)' }} /></label>
        <label className="block text-[13px] font-medium">{pt ? 'Quem é' : 'Who they are'}<input value={form.personaRole} onChange={set('personaRole')} placeholder="bartender" className={field} style={{ borderColor: 'var(--theme-border)' }} /></label>
      </div>
      <label className="block text-[13px] font-medium">{pt ? 'Jeito do personagem' : 'Personality'}<input value={form.personaTraits} onChange={set('personaTraits')} placeholder={pt ? 'divertido, fala rápido, usa gírias locais' : 'funny, talks fast, local slang'} className={field} style={{ borderColor: 'var(--theme-border)' }} /></label>
      <label className="block text-[13px] font-medium">{pt ? 'Seu objetivo' : 'Your goal'}<input value={form.goal} onChange={set('goal')} placeholder={pt ? 'Pedir uma bebida e saber se vai ter música ao vivo' : 'Order a drink and ask about live music'} className={field} style={{ borderColor: 'var(--theme-border)' }} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-[13px] font-medium">{pt ? 'Nível' : 'Level'}<select value={form.level} onChange={set('level')} className={field} style={{ borderColor: 'var(--theme-border)' }}>{['A1', 'A2', 'B1', 'B2', 'C1'].map(l => <option key={l}>{l}</option>)}</select></label>
        <label className="block text-[13px] font-medium">{pt ? 'Título (opcional)' : 'Title (optional)'}<input value={form.title} onChange={set('title')} className={field} style={{ borderColor: 'var(--theme-border)' }} /></label>
      </div>
      {msg && <p role="alert" className="text-[14px]" style={{ color: '#b42318' }}>{msg}</p>}
      <button type="button" disabled={busy} onClick={save} className="h-12 w-full rounded-full text-[15px] font-semibold disabled:opacity-60" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
        {busy ? (pt ? 'Montando a cena…' : 'Building the scene…') : (pt ? 'Criar cena' : 'Create scene')}
      </button>
    </div>
  )
}
