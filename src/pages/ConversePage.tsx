// Conversar: uma tela só, limpa. Orbe no centro, mãos-livres (ouve, espera o silêncio, responde e volta a ouvir).
// A situação (conversa livre ou uma Cena) e os ajustes ficam em painéis discretos.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BarChart3, Captions, CaptionsOff, Check, ChevronDown, ChevronLeft, ChevronRight, Languages, Lightbulb, LifeBuoy, Lock, MessagesSquare, Mic, MicOff, Plus, RefreshCw, SlidersHorizontal, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/store/useLanguage'
import { useEntitlements } from '@/store/useEntitlements'
import { useStudyLevel } from '@/hooks/useStudyLevel'
import { conversation, type Feedback } from '@/lib/billingApi'
import { openPaywall } from '@/components/billing/Paywall'
import { useVoiceConversation } from '@/hooks/useVoiceConversation'
import { AvatarBubble, avatarKindFor, type Mood } from '@/components/voice/TutorAvatar'
import { CharacterAvatar } from '@/components/voice/CharacterAvatar'
import type { HeadBox } from '@/components/voice/LivLivAvatar'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useTutorPersona } from '@/hooks/useTutorPersona'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TutorPicker } from '@/components/voice/TutorPicker'
import { useAvatarSettings } from '@/store/useAvatarSettings'
import { CHARACTERS, characterById, effectiveCharacterId, YOUNG_CHARACTER } from '@/lib/livliv/characters'
import { useTutorLang } from '@/lib/tutorLang'
import { greetingFor } from '@/lib/greetings'
import { TutorInbox } from '@/components/reader/ReaderTutor'
import { useBookStore } from '@/store/useBookStore'
import { EFFORT_NAMES, useEffort, type Effort } from '@/lib/effort'
import { levelName, type CefrId } from '@/lib/cefr'
import { bookLines, makeWaitingPicker, personalLines } from '@/lib/waitingLines'
import { holdMs, lineText, MIC_SCARE, type ReactionLine } from '@/lib/tutorReactions'
import { pickTopics, type TalkTopic } from '@/lib/talkTopics'
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
  // Ao entrar: aparece o último tutor com quem a pessoa conversou (uma vez por visita, antes do palco montar, sem "ligação").
  // Antes isso era feito ao sair da tela de sessão, e qualquer remontagem desfazia a troca pelas setas (no celular voltava
  // sempre para o mesmo tutor).
  useState(() => {
    const { lastTalked, characterId } = useAvatarSettings.getState()
    // Vindo do banner da home com um tutor escolhido (?tutor=<id>): ele tem prioridade sobre o último da conversa.
    const asked = new URLSearchParams(window.location.search).get('tutor')
    if (asked && CHARACTERS.some(c => c.id === asked)) { if (asked !== characterId) useAvatarSettings.setState({ characterId: asked }) }
    else if (lastTalked && lastTalked !== characterId) useAvatarSettings.setState({ characterId: lastTalked })
    return null
  })
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
  // Conversas com os tutores (no corpo da página): abre direto vindo do chat flutuante (/conversar?conversas=1).
  const [history, setHistory] = useState(() => new URLSearchParams(window.location.search).has('conversas'))
  const [scores, setScores] = useState(false)
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

  // Itens bloqueados também podem ser vistos: a tela mostra o cadeado e o botão de assinar.
  const setCharacterOuter = useAvatarSettings(st => st.setCharacter)
  const pick = (c: Choice) => {
    // Assunto infantil: a Yuno (a mais jovem) é a sugestão; dá para trocar de tutor no botão do cabeçalho.
    if (c.kind === 'scene' && c.scene.category === 'kids' && !characterById(effectiveCharacterId(useAvatarSettings.getState().characterId))?.young) setCharacterOuter(YOUNG_CHARACTER)
    setChoice(c)
    setPicker(false)
  }
  const isLocked = (c: Choice) => (c.kind === 'tutor' ? !canFree : !c.customId && demoOnly && c.scene.key !== DEMO_SCENE_KEY)
  // Setas: tutor e todas as cenas, na ordem do catálogo.
  const persona = useTutorPersona()
  const ring = useMemo<Choice[]>(() => [{ kind: 'tutor' }, ...byCat.flatMap(([, list]) => list.map(sc => ({ kind: 'scene' as const, scene: sc })))], [byCat])
  const step = (dir: 1 | -1) => {
    const at = ring.findIndex(c => (c.kind === 'tutor' ? choice.kind === 'tutor' : choice.kind === 'scene' && c.scene.key === choice.scene.key))
    setChoice(ring[((at < 0 ? 0 : at) + dir + ring.length) % ring.length])
  }

  if (creating) return <CreateScene pt={pt} level={level.id} onDone={created => { setCreating(false); if (created) loadCustom() }} />
  // Histórico: as conversas com os tutores no corpo da página, como um app de mensagens (o modal com as notas segue no botão).
  if (history) return (
    <>
      <TutorInbox onClose={() => setHistory(false)} onCall={id => { setCharacterOuter(id); setChoice({ kind: 'tutor' }); setHistory(false) }} extra={<IconBtn label={pt ? 'Notas das conversas' : 'Conversation scores'} onClick={() => setScores(true)}><BarChart3 className="w-[18px] h-[18px]" /></IconBtn>} />
      <HistoryDialog open={scores} onOpenChange={setScores} pt={pt} />
    </>
  )
  if (feedback) return <FeedbackView feedback={feedback} pt={pt} goals={choice.kind === 'scene' ? choice.scene.goals : []} onExit={() => setFeedback(null)} />

  const title = choice.kind === 'tutor' ? (pt ? 'Conversa livre' : 'Free talk') : (pt ? choice.scene.title.pt : choice.scene.title.en)
  const subtitle = choice.kind === 'tutor'
    ? (pt ? `Com ${persona.female ? 'a' : 'o'} ${persona.name}, ${persona.female ? 'sua tutora' : 'seu tutor'}` : `With ${persona.name}, your tutor`)
    : `${persona.name} · ${choice.scene.persona.role}`

  return (
    <>
      <Session key={`${choice.kind}:${choice.kind === 'scene' ? choice.scene.key : ''}`} choice={choice} pt={pt} level={level.id} rate={rate} captions={captions} minutes={Math.min(minutes, maxMin)}
        title={title} subtitle={subtitle} onOpenPicker={() => setPicker(true)} onOpenSettings={() => setSettings(true)} onOpenHistory={() => setHistory(true)} onToggleCaptions={() => setCaptions(c => !c)}
        onFeedback={setFeedback}
        sceneSuggestions={visible.filter(s => choice.kind === 'scene' && s.key !== choice.scene.key)}
        locked={isLocked(choice)} onStep={step}
        onPickScene={sc => pick({ kind: 'scene', scene: sc })} />

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
                  <Row key={c.id} title={c.title} sub={levelName(c.level, pt)} active={choice.kind === 'scene' && choice.customId === c.id}
                    onClick={() => pick({ kind: 'scene', customId: c.id, scene: { key: `custom:${c.id}`, category: 'custom', title: { pt: c.title, en: c.title }, setting: c.setting, persona: c.persona, goals: c.goals, twists: [], opening: '', usefulPhrases: [], level: [c.level as Scene['level'][0], c.level as Scene['level'][0]] } })} />
                ))}
              </Group>
            )}
            {byCat.map(([cat, list]) => (
              <Group key={cat} title={pt ? CATEGORY_LABEL[cat].pt : CATEGORY_LABEL[cat].en}>
                {list.map(s => (
                  <Row key={s.key} title={pt ? s.title.pt : s.title.en} sub={`${s.level[0]}${s.level[1] !== s.level[0] ? `–${s.level[1]}` : ''}`}
                    active={choice.kind === 'scene' && choice.scene.key === s.key} locked={demoOnly && s.key !== DEMO_SCENE_KEY} onClick={() => pick({ kind: 'scene', scene: s })} />
                ))}
              </Group>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <HistoryDialog open={scores} onOpenChange={setScores} pt={pt} />

      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{pt ? 'Ajustes da conversa' : 'Conversation settings'}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <Seg label={pt ? 'Velocidade da voz' : 'Voice speed'} options={SPEEDS.map(s => ({ value: s.v, label: pt ? s.pt : s.en }))} value={rate} onChange={setRate} />
            <EffortPicker pt={pt} level={level.id} />
            <Seg label={pt ? 'Duração das Cenas' : 'Scene length'} options={[3, 5, 10].map(m => ({ value: m, label: `${m} min`, locked: m > maxMin }))} value={minutes}
              onChange={m => (m > maxMin ? openPaywall('scenes') : setMinutes(m))} />
            <label className="flex items-center justify-between text-[14px]">
              <span>{pt ? 'Mostrar legendas' : 'Show captions'}</span>
              <input type="checkbox" checked={captions} onChange={e => setCaptions(e.target.checked)} className="w-5 h-5 accent-[var(--theme-text)]" />
            </label>
            <p className="text-[12.5px]" style={muted}>{pt ? 'Ela escuta sozinha: fale normalmente e faça pausas à vontade; ela espera você terminar. Você pode interromper a voz falando por cima.' : 'It listens on its own: speak naturally and pause freely; it waits for you to finish. You can interrupt by speaking.'}</p>
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

function ArrowBtn({ dir, onClick, label }: { dir: 1 | -1; onClick: () => void; label: string }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={onClick} aria-label={label} title={label}
      className="w-11 h-11 rounded-full border grid place-items-center transition-colors hover:bg-[var(--ui-hover)] shrink-0 backdrop-blur-md shadow-sm"
      // Fundo próprio: a seta fica sobre o personagem e precisa aparecer em roupas claras ou escuras.
      style={{ borderColor: 'var(--theme-border)', backgroundColor: 'color-mix(in srgb, var(--theme-bg) 74%, transparent)' }}>
      {dir < 0 ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
    </motion.button>
  )
}

/** Esforço dentro do nível atual: três degraus com nomes próprios de cada nível (ver lib/effort). */
function EffortPicker({ pt, level }: { pt: boolean; level: CefrId }) {
  const [effort, setEffortValue] = useEffort()
  const names = EFFORT_NAMES[level] ?? EFFORT_NAMES.A1
  return (
    <div>
      <Seg label={pt ? `Esforço no nível ${levelName(level, true)}` : `Effort at ${levelName(level, false)}`} options={([1, 2, 3] as Effort[]).map(e => ({ value: e, label: pt ? names[e].pt : names[e].en }))} value={effort} onChange={v => setEffortValue(v as Effort)} />
      <p className="mt-1.5 text-[12px]" style={muted}>{pt ? names[effort].hint.pt : names[effort].hint.en} {pt ? 'Vale para todas as conversas.' : 'Applies to every conversation.'}</p>
    </div>
  )
}

function Seg<T extends number>({ label, options, value, onChange }: { label: string; options: { value: T; label: string; locked?: boolean }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="text-[13px] font-medium mb-1.5">{label}</p>
      <div className="grid gap-1 p-0.5 rounded-xl" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)`, backgroundColor: 'var(--theme-bg-secondary)' }}>
        {options.map(o => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={value === o.value}
            className="min-h-9 px-1.5 py-1 rounded-lg text-[13px] leading-tight text-center font-medium inline-flex items-center justify-center gap-1 transition-colors"
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
function Session({ choice, pt, level, rate, captions, minutes, title, subtitle, onOpenPicker, onOpenSettings, onOpenHistory, onToggleCaptions, onFeedback, sceneSuggestions, onPickScene, locked, onStep }: {
  choice: Choice; pt: boolean; level: string; rate: number; captions: boolean; minutes: number; title: string; subtitle: string
  sceneSuggestions: Scene[]; onPickScene: (s: Scene) => void
  locked: boolean; onStep: (dir: 1 | -1) => void
  onOpenPicker: () => void; onOpenSettings: () => void; onOpenHistory: () => void; onToggleCaptions: () => void; onFeedback: (f: Feedback | null | 'loading' | 'short') => void
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
  const [langMode] = useTutorLang()
  // Sugestões abaixo do texto: assuntos (conversa livre) ou outras situações (cenas). Somem ao começar.
  const [topics, setTopics] = useState<TalkTopic[]>(() => pickTopics(3))
  const [topic, setTopic] = useState<TalkTopic | null>(null)
  const [sceneSeed, setSceneSeed] = useState(0)
  const otherScenes = useMemo(() => {
    const pool = [...sceneSuggestions]
    const out: Scene[] = []
    let seed = sceneSeed * 7 + 3
    while (out.length < 3 && pool.length) { seed = (seed * 31 + 11) % 997; out.push(...pool.splice(seed % pool.length, 1)) }
    return out
  }, [sceneSuggestions, sceneSeed])
  // Reação do rosto e saudação: ao abrir, o personagem acena e fala num balão.
  // Entra neutra, de olhos abertos: as reações vêm depois, junto com as frases.
  const [mood, setMood] = useState<Mood>('neutral')
  const [wave, setWave] = useState(false)
  const [bubble, setBubble] = useState('')
  // Texto passageiro durante a conversa ao vivo (toque no personagem, susto sem microfone): some sozinho.
  const [flash, setFlash] = useState('')
  const reactTimer = useRef(0)
  const liveRef = useRef(false)
  // Cabeça do personagem no palco: o balão de fala fica logo acima dela.
  const [head, setHead] = useState<HeadBox | null>(null)
  // Balão no topo (fallback) só se a posição da cabeça faltar por um bom tempo (avatar vetorial); senão ele espera parado, sem passear.
  const [headLost, setHeadLost] = useState(false)
  // A fala (boas-vindas inclusive) só aparece com o personagem já na tela; na troca de personagem o balão some até o novo
  // aparecer, em vez de ficar no ar na posição do anterior.
  const [avatarReady, setAvatarReady] = useState(false)
  const onAvatarReady = (r: boolean) => { setAvatarReady(r); if (!r) setHead(null) }
  useEffect(() => {
    if (head || !avatarReady) { setHeadLost(false); return }
    const t = window.setTimeout(() => setHeadLost(true), 1500)
    return () => window.clearTimeout(t)
  }, [head, avatarReady])
  const [topicsOpen, setTopicsOpen] = useState(false)
  // Outro tutor sugerido pelo que está falando ("quer que eu chame a Bia?").
  const [suggest, setSuggest] = useState<string | null>(null)
  const isMobile = useIsMobile()
  const tutor = useTutorPersona()
  // Conversa livre com mais de um tutor: as setas trocam de tutor (o botão do cabeçalho também).
  const chosenCharacter = useAvatarSettings(st => st.characterId)
  const setCharacter = useAvatarSettings(st => st.setCharacter)
  const tutorMode = !scene && CHARACTERS.length > 1
  const stepTutor = (dir: 1 | -1) => {
    const i = Math.max(0, CHARACTERS.findIndex(c => c.id === effectiveCharacterId(chosenCharacter)))
    setCharacter(CHARACTERS[(i + dir + CHARACTERS.length) % CHARACTERS.length].id)
  }
  // Espera (conversa livre, ainda não começou e a pessoa não mexeu em nada): depois de 1 min chama outro tutor, e assim por
  // diante. Qualquer toque, tecla ou rolagem reinicia a contagem. Ao entrar de novo, volta o último com quem ela conversou.
  const setLastTalked = useAvatarSettings(st => st.setLastTalked)
  useEffect(() => {
    if (!tutorMode || phase !== 'ready') return
    let t = 0
    const arm = () => { window.clearTimeout(t); t = window.setTimeout(() => stepTutor(1), 60000) }
    const EV = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
    EV.forEach(e => window.addEventListener(e, arm, { passive: true }))
    arm()
    return () => { window.clearTimeout(t); EV.forEach(e => window.removeEventListener(e, arm)) }
  }, [tutorMode, phase, chosenCharacter]) // eslint-disable-line react-hooks/exhaustive-deps
  const greet = () => {
    // Entra de olhos abertos (o sorriso desses modelos fecha os olhos): só um aceno.
    setWave(true); setMood('neutral')
    setBubble(greetingFor({ pt, name: tutor.name, female: tutor.female, scene: !!scene, title }))
    window.setTimeout(() => setWave(false), 2300)
  }
  // Mostra uma frase junto com a reação que combina com ela (o rosto e o texto saem juntos) e volta ao neutro sozinha.
  const showLine = (line: ReactionLine) => {
    const text = lineText(line, pt)
    setMood(line.mood)
    if (liveRef.current) setFlash(text); else setBubble(text)
    window.clearTimeout(reactTimer.current)
    reactTimer.current = window.setTimeout(() => { setMood('neutral'); setFlash('') }, holdMs(text))
  }
  useEffect(() => () => window.clearTimeout(reactTimer.current), [])

  // Até a pessoa começar: um convite novo a cada poucos segundos, cada um com a reação que combina com a frase
  // (inglês e português misturados). Nada de gestos repetidos: a reação é só o rosto.
  // Banco grande sem repetir entre sessões, com as frases pessoais (memória deste tutor sobre a pessoa) primeiro.
  useEffect(() => {
    if (phase !== 'ready') return
    const picker = makeWaitingPicker(scene ? 'scene' : 'free', tutor.id)
    let alive = true
    // Uma da última conversa, uma do livro e o resto misturado: assim a espera fala da vida real da pessoa.
    if (!scene) void Promise.all([personalLines(tutor.id), bookLines(useBookStore.getState().books, tutor.id)]).then(([mem, book]) => {
      if (!alive) return
      const mix: ReactionLine[] = []
      for (let i = 0; i < Math.max(mem.length, book.length); i++) { if (book[i]) mix.push(book[i]); if (mem[i]) mix.push(mem[i]) }
      picker.setPersonal(mix)
    })
    const iv = window.setInterval(() => showLine(picker.next()), 10500)
    return () => { alive = false; window.clearInterval(iv) }
  }, [phase, choice, tutor.name]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cada personagem se apresenta com o próprio nome (também ao trocar pelas setas).
  useEffect(() => { const t = window.setTimeout(greet, 350); return () => window.clearTimeout(t) }, [choice, tutor.name]) // eslint-disable-line react-hooks/exhaustive-deps

  const voice = useVoiceConversation({
    continuous: true,
    bargeIn: true,
    gender: tutor.female ? 'female' : 'male',
    rate,
    fillers: scene?.fillers,
    keywords: scene?.usefulPhrases.flatMap(p => p.replace(/[…?.!,]/g, '').split(' ').filter(w => w.length > 4)),
    onTurn: async (text, filler) => {
      const r = await conversation.turn({ sessionId: sid.current!, text, filler, level, langMode: scene ? undefined : langMode, tutorName: tutor.name, characterId: tutor.id })
      return { reply: r.reply, segments: r.segments, extra: { goalsMet: r.goalsMet, wrapUp: r.wrapUp, mood: r.mood, suggestTutor: r.suggestTutor } }
    },
    onExtra: extra => {
      if (typeof extra.mood === 'string') setMood(extra.mood as Mood)
      // O tutor lembrou que a pessoa falou disso com outro: oferece chamá-lo (a troca acontece se ela aceitar).
      if (!scene && typeof extra.suggestTutor === 'string') {
        const other = CHARACTERS.find(c => c.name === extra.suggestTutor && c.id !== tutor.id)
        if (other) setSuggest(other.id)
      }
      if (Array.isArray(extra.goalsMet)) setGoalsMet(g => [...new Set([...g, ...(extra.goalsMet as number[])])])
      if (extra.wrapUp && scene) window.setTimeout(() => void finish(), 600)
    },
    onError: code => { if (code === 'session_over') void finish() },
    onIdle: () => toast(pt ? 'Pausado por silêncio. Toque no microfone para continuar.' : 'Paused after silence. Tap the mic to continue.'),
  })

  const begin = async () => {
    if (locked) { openPaywall(scene ? 'scenes' : 'free_talk'); return }
    setPhase('starting')
    try {
      const r = await conversation.start(scene
        ? { kind: 'scene', ...(choice.kind === 'scene' && choice.customId ? { sceneId: choice.customId } : { sceneKey: scene.key }), minutes, level, characterId: tutor.id }
        : { kind: 'tutor', level, opening: topic?.opening, characterId: tutor.id })
      sid.current = r.sessionId
      setPlanned(r.plannedSeconds ?? 0)
      setStartedAt(Date.now())
      setGoals(r.scene?.goals ?? [])
      if (r.scene) voice.preload([...(r.scene.fillers ?? []), 'Good question…', 'Oh, I see…', 'Alright…'])
      setPhase('live')
      setLastTalked(tutor.id)
      setBubble('')
      setWave(true); window.setTimeout(() => setWave(false), 2000)
      // A abertura do servidor apresenta a tutora pelo nome padrão: com um personagem, ele fala o próprio nome.
      const opening = r.opening ?? topic?.opening ?? "Hi! I'm Bia. What would you like to talk about today?"
      await voice.start(scene
        ? opening.replace(new RegExp(`\\b${scene.persona.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), tutor.name)
        : opening.replace(/\b(Bea|Bia)\b/g, tutor.name))
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

  // Aceitou chamar outro tutor: encerra esta conversa (cada um guarda a sua) e troca, com a "ligação".
  async function callTutor(id: string) {
    setSuggest(null)
    if (sid.current && !ended.current) {
      ended.current = true
      voice.stop()
      await conversation.end(sid.current).catch(() => {})
      sid.current = null; ended.current = false; voice.setBubbles([])
      setPhase('ready')
    }
    setCharacter(id)
  }

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
  liveRef.current = live
  const listening = voice.state !== 'idle' && voice.state !== 'error'
  const lastAi = [...voice.bubbles].reverse().find(b => b.role === 'ai')
  const lastUser = [...voice.bubbles].reverse().find(b => b.role === 'user')
  // Legenda do tutor no balão acima da cabeça (no lugar das reações rápidas enquanto há fala dele).
  const aiCaption = captions && live && lastAi ? `${lastAi.text}${lastAi.pending ? '…' : ''}` : ''
  const headText = live ? (aiCaption || flash) : bubble
  const status = voice.state === 'listening' ? (pt ? 'Ouvindo' : 'Listening') : voice.state === 'thinking' ? (pt ? 'Pensando' : 'Thinking')
    : voice.state === 'speaking' ? tutor.name : voice.error === 'mic_denied' ? (pt ? 'Libere o microfone no navegador' : 'Allow the microphone')
    : live ? (pt ? 'Pausado' : 'Paused') : ''
  const mm = Math.floor(remaining / 60), ss = Math.floor(remaining % 60)
  // Microfone bloqueado ou ausente (a primeira vez que pede): ela se assusta e avisa no balão, junto com o aviso de baixo.
  useEffect(() => { if (voice.error === 'mic_denied' || voice.error === 'mic_failed' || voice.error === 'no_speech_engine') showLine(MIC_SCARE) }, [voice.error]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative max-w-xl mx-auto flex flex-col" style={{
      // Altura exata da área útil: o palco desce até a barra de baixo (celular) ou até a borda da janela (desktop).
      minHeight: isMobile ? 'calc(100dvh - var(--safe-t) - var(--navbar-h) - 0.75rem - var(--safe-b) - var(--tabbar-h) - 1.5rem)' : 'calc(100dvh - 5rem)',
    }}>
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
          {!live && !scene && (
            <Popover open={topicsOpen} onOpenChange={setTopicsOpen}>
              <PopoverTrigger asChild>
                <button type="button" aria-label={pt ? 'Assunto da conversa' : 'Conversation topic'} title={topic ? (pt ? `Assunto: ${topic.pt}` : `Topic: ${topic.en}`) : (pt ? 'Assunto da conversa' : 'Conversation topic')}
                  className="relative w-10 h-10 rounded-full grid place-items-center transition-colors hover:bg-[var(--ui-hover)]" style={{ color: 'var(--theme-text)' }}>
                  <Lightbulb className="w-[18px] h-[18px]" />
                  {topic && <span aria-hidden className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--theme-primary)', boxShadow: '0 0 0 2px var(--theme-bg)' }} />}
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" sideOffset={6} collisionPadding={12} className="w-64 p-1.5">
                <p className="px-3 pt-1.5 pb-1 text-[12px] font-medium" style={muted}>{pt ? 'Assunto da conversa' : 'Conversation topic'}</p>
                {[null, ...topics].map(t => {
                  const on = (topic?.id ?? null) === (t?.id ?? null)
                  return (
                    <button key={t?.id ?? 'free'} type="button" onClick={() => { setTopic(t); setTopicsOpen(false) }}
                      className="w-full h-10 px-3 rounded-lg text-left text-[14px] flex items-center justify-between transition-colors hover:bg-[var(--ui-hover)]">
                      {t ? (pt ? t.pt : t.en) : (pt ? 'Livre, o que eu quiser' : 'Anything I like')}{on && <Check className="w-4 h-4" />}
                    </button>
                  )
                })}
                <button type="button" onClick={() => setTopics(cur => { const keep = topic && cur.some(x => x.id === topic.id) ? [topic] : []; return [...keep, ...pickTopics(3 - keep.length, cur.map(x => x.id))] })}
                  className="mt-1 w-full h-9 px-3 rounded-lg text-[13px] inline-flex items-center gap-1.5 border-t transition-colors hover:bg-[var(--ui-hover)]" style={{ ...muted, borderColor: 'var(--theme-border)' }}>
                  <RefreshCw className="w-3.5 h-3.5" />{pt ? 'Outras sugestões' : 'Other ideas'}
                </button>
              </PopoverContent>
            </Popover>
          )}
          {!live && <IconBtn label={pt ? 'Conversas com os tutores' : 'Chats with the tutors'} onClick={onOpenHistory}><MessagesSquare className="w-[18px] h-[18px]" /></IconBtn>}
          <IconBtn label={pt ? 'Ajustes' : 'Settings'} onClick={onOpenSettings}><SlidersHorizontal className="w-[18px] h-[18px]" /></IconBtn>
          {!live && <TutorPicker pt={pt} />}
        </div>
      </header>

      {goals.length > 0 && live && (
        <div className="mt-3 flex items-center gap-2 text-[12.5px]" style={muted}>
          <span>{pt ? 'Metas' : 'Goals'}</span>
          <span className="flex gap-1">{goals.map((g, i) => <span key={i} title={g} className="w-6 h-1 rounded-full transition-colors" style={{ backgroundColor: goalsMet.includes(i) ? 'var(--theme-text)' : 'var(--theme-border)' }} />)}</span>
          <span className="truncate">{goals.find((_, i) => !goalsMet.includes(i)) ?? (pt ? 'Todas cumpridas' : 'All done')}</span>
        </div>
      )}

      {/* Palco: o personagem grande vai até a borda de baixo; o botão e os controles ficam por cima dele. */}
      <div className="relative flex-1 min-h-[420px] -mx-4 md:-mx-10 -mb-6 md:-mb-12">
        <CharacterAvatar stage voice onReady={onAvatarReady} onHead={next => setHead(prev => (
          // O balão fica parado: só muda com outro personagem ou outro tamanho de tela, não com o balanço do corpo.
          next && prev && Math.abs(prev.x - next.x) < 48 && Math.abs(prev.top - next.top) < 48 && Math.abs(prev.width - next.width) < 24 ? prev : next
        ))} kind={scene ? avatarKindFor(scene.persona, scene.category) : 'woman'} state={live ? voice.state : 'idle'} speakingText={voice.speakingText} rate={rate} size={190}
          mood={mood} wave={wave} onPoke={showLine} />
        {live && !scene && suggest && (() => {
          const c = CHARACTERS.find(x => x.id === suggest)
          if (!c) return null
          return (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-24 z-20 flex items-center gap-1 rounded-full border pl-4 pr-1.5 py-1.5 shadow-sm"
              style={{ backgroundColor: 'var(--theme-bg)', borderColor: 'var(--theme-border)' }}>
              <span className="text-[13.5px]">{pt ? `Chamar ${c.voice.gender === 'female' ? 'a' : 'o'} ${c.name}?` : `Call ${c.name}?`}</span>
              <button type="button" onClick={() => void callTutor(c.id)} className="h-8 px-3 rounded-full text-[13px] font-medium" style={{ backgroundColor: 'var(--theme-text)', color: 'var(--theme-bg)' }}>{pt ? 'Chamar' : 'Call'}</button>
              <button type="button" aria-label={pt ? 'Dispensar' : 'Dismiss'} onClick={() => setSuggest(null)} className="w-8 h-8 rounded-full grid place-items-center hover:bg-[var(--ui-hover)]"><X className="w-4 h-4" /></button>
            </div>
          )
        })()}
        {headText && avatarReady && (head || headLost) && (
          head && head.top > 110
            ? <div className="absolute z-10 pointer-events-none w-[min(var(--bw),calc(100%-2rem))]"
                style={{ '--bw': aiCaption ? '420px' : '300px', left: `clamp(calc(min(var(--bw), 100% - 2rem) / 2 + 1rem), ${head.x}px, calc(100% - min(var(--bw), 100% - 2rem) / 2 - 1rem))`, top: Math.max(96, head.top - 36) /* folga acima do cabelo (o Yuri, de cabelo espetado, ficava com o balão encostado) */, transform: 'translate(-50%, -100%)' } as React.CSSProperties}>
                <AvatarBubble text={headText} side="top" />
              </div>
            : <div className="absolute top-2 inset-x-0 z-10 flex justify-center pointer-events-none px-6"><div className="w-full max-w-[420px] flex justify-center"><AvatarBubble text={headText} side="top" /></div></div>
        )}
        {!live && (
          <>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10"><ArrowBtn dir={-1} onClick={() => (tutorMode ? stepTutor(-1) : onStep(-1))} label={tutorMode ? (pt ? 'Tutor anterior' : 'Previous tutor') : (pt ? 'Anterior' : 'Previous')} /></div>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10"><ArrowBtn dir={1} onClick={() => (tutorMode ? stepTutor(1) : onStep(1))} label={tutorMode ? (pt ? 'Próximo tutor' : 'Next tutor') : (pt ? 'Próximo' : 'Next')} /></div>
          </>
        )}
        {locked && !live && (
          <span className="absolute right-6 bottom-6 z-10 w-10 h-10 rounded-full grid place-items-center border-2" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)', borderColor: 'var(--theme-bg)' }} aria-label={pt ? 'Bloqueado no seu plano' : 'Locked on your plan'}>
            <Lock className="w-4 h-4" />
          </span>
        )}
        <div className={`absolute inset-x-0 z-10 flex flex-col items-center gap-2 px-4 pointer-events-none ${live ? 'bottom-[8.75rem] md:bottom-[10.5rem]' : 'bottom-[9.5rem] md:bottom-[11rem]'}`}>
          {assist && live && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="pointer-events-auto w-full max-w-lg rounded-2xl border p-3 text-[13.5px] text-left backdrop-blur-md" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'color-mix(in srgb, var(--theme-bg) 88%, transparent)' }}>
              {assist.translation && <p>{assist.translation}</p>}
              {assist.suggestions?.map(s => <p key={s.en} className="mt-1"><b>{s.en}</b> <span style={muted}>· {s.pt}</span></p>)}
              <button type="button" onClick={() => setAssist(null)} className="mt-2 text-[12.5px] underline" style={muted}>{pt ? 'Fechar' : 'Close'}</button>
            </motion.div>
          )}
          {/* A fala do tutor vai no balão acima da cabeça; aqui embaixo fica só o que o aluno disse. */}
          {captions && live && (voice.interim || lastUser?.text) && (
            <p className="max-w-lg rounded-2xl px-4 py-2 text-center text-[13.5px] leading-snug backdrop-blur-md" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-bg) 84%, transparent)', border: '1px solid var(--theme-border)', color: 'var(--theme-text-secondary)' }}>{voice.interim || lastUser?.text}</p>
          )}
          <AnimatePresence mode="wait">
            {status && (
              <motion.p key={status} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} aria-live="polite"
                className="h-7 px-3 rounded-full grid place-items-center text-[12.5px] font-medium tracking-wide backdrop-blur-md"
                style={{ backgroundColor: 'color-mix(in srgb, var(--theme-bg) 78%, transparent)', color: 'var(--theme-text-secondary)' }}>{status}</motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>


      <footer className="absolute inset-x-0 bottom-0 z-20 pb-4 pt-2">
        {!live ? (
          locked ? (
            <div className="text-center">
              <p className="text-[13.5px] inline-flex items-center gap-1.5" style={muted}><Lock className="w-3.5 h-3.5" />{scene ? (pt ? 'Esta cena faz parte dos planos pagos' : 'This scene is part of the paid plans') : (pt ? 'A conversa livre faz parte do plano Plus' : 'Free talk is part of the Plus plan')}</p>
              <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => openPaywall(scene ? 'scenes' : 'free_talk')}
                className="mt-3 w-full h-12 rounded-lg text-[15px] font-medium active:scale-[0.97] transition-transform inline-flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
                {pt ? 'Assinar para liberar' : 'Subscribe to unlock'}
              </motion.button>
            </div>
          ) : (
          <>
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={begin} disabled={phase === 'starting'}
            className="w-full h-12 rounded-lg text-[15px] font-medium active:scale-[0.97] transition-transform inline-flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            <Mic className="w-5 h-5" />{phase === 'starting' ? (pt ? 'Preparando…' : 'Getting ready…') : (pt ? 'Começar a conversar' : 'Start talking')}
          </motion.button>
          </>
          )
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
      className={`${ring ? 'w-12 h-12 border shadow-sm' : 'w-10 h-10'} rounded-full grid place-items-center transition-colors hover:bg-[var(--ui-hover)]`}
      // Com borda (controles da conversa, por cima do personagem): fundo sólido para o ícone não sumir na roupa.
      style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text)', backgroundColor: ring ? 'var(--theme-card-bg)' : undefined }}>
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Resultado da Cena
// ---------------------------------------------------------------------------
function FeedbackView({ feedback, pt, goals, onExit }: { feedback: Feedback | 'loading' | 'short'; pt: boolean; goals: string[]; onExit: () => void }) {
  if (feedback === 'loading') return <div className="max-w-xl mx-auto py-28 text-center"><CharacterAvatar kind="woman" state="thinking" size={120} /><p className="mt-2 text-[15px]" style={muted}>{pt ? 'Avaliando sua conversa' : 'Scoring your conversation'}</p></div>
  if (feedback === 'short') return (
    <div className="max-w-md mx-auto py-24 text-center">
      <h1 className="font-display text-[26px]">{pt ? 'Conversa curta demais para avaliar' : 'Too short to score'}</h1>
      <p className="mt-2 text-[14.5px]" style={muted}>{pt ? 'Fale pelo menos duas vezes para receber nota e correções.' : 'Speak at least twice to get a score and corrections.'}</p>
      <button type="button" onClick={onExit} className="mt-6 h-11 px-5 rounded-lg font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Voltar' : 'Back'}</button>
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
      <button type="button" onClick={onExit} className="h-12 w-full rounded-lg text-[15px] font-medium active:scale-[0.97] transition-transform" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Conversar de novo' : 'Talk again'}</button>
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
        <label className="block text-[13px] font-medium">{pt ? 'Nível' : 'Level'}<select value={form.level} onChange={set('level')} className={field} style={{ borderColor: 'var(--theme-border)' }}>{['A1', 'A2', 'B1', 'B2', 'C1'].map(l => <option key={l} value={l}>{levelName(l, pt)}</option>)}</select></label>
        <label className="block text-[13px] font-medium">{pt ? 'Título (opcional)' : 'Title (optional)'}<input value={form.title} onChange={set('title')} className={field} style={{ borderColor: 'var(--theme-border)' }} /></label>
      </div>
      {msg && <p role="alert" className="text-[14px]" style={{ color: '#b42318' }}>{msg}</p>}
      <button type="button" disabled={busy} onClick={save} className="h-12 w-full rounded-lg text-[15px] font-medium active:scale-[0.97] transition-transform disabled:opacity-60" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
        {busy ? (pt ? 'Montando a cena…' : 'Building the scene…') : (pt ? 'Criar cena' : 'Create scene')}
      </button>
    </div>
  )
}


// ---------------------------------------------------------------------------
// Histórico: toda conversa fica salva com data, duração, nota e feedback
// ---------------------------------------------------------------------------
type HistoryRow = {
  id: string; kind: 'scene' | 'tutor' | 'reader'; title: string | null; started_at: string; used_seconds: number; planned_seconds: number; score: number | null
  conversation_feedback: { score: number; cefr: string | null; summary: string | null; tips: string[]; corrections: { said: string; better: string; why: string }[]; criteria: Record<string, number> } | { score: number }[] | null
}

function HistoryDialog({ open, onOpenChange, pt }: { open: boolean; onOpenChange: (o: boolean) => void; pt: boolean }) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  useEffect(() => {
    if (!open || !supabase) return
    void supabase.from('conversation_sessions')
      .select('id, kind, title, started_at, used_seconds, planned_seconds, score, conversation_feedback(score, cefr, summary, tips, corrections, criteria)')
      .order('started_at', { ascending: false }).limit(60)
      .then(({ data }) => setRows((data ?? []) as unknown as HistoryRow[]))
  }, [open])
  const kindLabel = (k: HistoryRow['kind']) => k === 'scene' ? (pt ? 'Cena' : 'Scene') : k === 'tutor' ? (pt ? 'Conversa livre' : 'Free talk') : (pt ? 'Tutor de leitura' : 'Reading tutor')
  const fb = (r: HistoryRow) => Array.isArray(r.conversation_feedback) ? (r.conversation_feedback[0] as HistoryRow['conversation_feedback'] & object) : r.conversation_feedback
  const mins = (r: HistoryRow) => { const s = r.used_seconds || 0; return s >= 60 ? `${Math.round(s / 60)} min` : s ? `${s}s` : '—' }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>{pt ? 'Histórico de conversas' : 'Conversation history'}</DialogTitle><DialogDescription>{pt ? 'Data, duração e nota de cada conversa.' : 'Date, length and score of every conversation.'}</DialogDescription></DialogHeader>
        {rows === null ? <div className="h-32 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} /> : rows.length === 0 ? <p className="text-[14px]" style={muted}>{pt ? 'Suas conversas aparecem aqui.' : 'Your conversations show up here.'}</p> : (
          <ul className="divide-y rounded-2xl border" style={{ borderColor: 'var(--theme-border)' }}>
            {rows.map(r => {
              const f = fb(r) as { score?: number; cefr?: string | null; summary?: string | null; tips?: string[]; corrections?: { said: string; better: string }[] } | null
              const score = f?.score ?? r.score
              return (
                <li key={r.id} style={{ borderColor: 'var(--theme-border)' }}>
                  <button type="button" onClick={() => setSel(sel === r.id ? null : r.id)} className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[var(--ui-hover)]">
                    <span className="min-w-0"><span className="block text-[14.5px] font-medium truncate">{r.title || kindLabel(r.kind)}</span>
                      <span className="block text-[12.5px]" style={muted}>{kindLabel(r.kind)} · {new Date(r.started_at).toLocaleDateString(pt ? 'pt-BR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })} · {mins(r)}</span></span>
                    <span className="text-[18px] font-semibold tabular-nums">{score ?? '–'}</span>
                  </button>
                  {sel === r.id && f && (
                    <div className="px-4 pb-4 space-y-2 text-[13.5px]">
                      {f.cefr && <p style={muted}>{pt ? 'Nível nesta conversa' : 'Level'}: {f.cefr}</p>}
                      {f.summary && <p>{f.summary}</p>}
                      {f.tips?.length ? <ul className="list-disc pl-5">{f.tips.map(t => <li key={t}>{t}</li>)}</ul> : null}
                      {f.corrections?.slice(0, 3).map((c, i) => <p key={i}><s style={muted}>{c.said}</s> → <b>{c.better}</b></p>)}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
