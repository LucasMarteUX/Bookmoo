// Tutor de leitura: botão flutuante no canto inferior direito do leitor. Conversa por voz sobre o livro
// (história até onde a pessoa leu, palavras da página, personagens). Plus e Pro; nos outros planos, convite.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Captions, CaptionsOff, Lock, Minus, Rabbit, Turtle, EyeOff, BookmarkPlus, SlidersHorizontal, X } from 'lucide-react'
import type { Book } from '@/store/useBookStore'
import { useLanguage } from '@/store/useLanguage'
import { useEntitlements } from '@/store/useEntitlements'
import { useVocabularyStore } from '@/store/useVocabularyStore'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { upsertVocabulary } from '@/lib/supabaseSync'
import { hasPortugueseVoice, useVoiceConversation } from '@/hooks/useVoiceConversation'
import { useStudyLevel } from '@/hooks/useStudyLevel'
import { conversation } from '@/lib/billingApi'
import { openPaywall } from '@/components/billing/Paywall'
import { toast } from '@/components/ui/toast'
import { AvatarBubble, TutorAvatar, PlayStopButton, type Mood } from '@/components/voice/TutorAvatar'
import { greetingFor } from '@/lib/greetings'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { runTutorAction, type TutorAction } from '@/lib/tutorActions'
import { TUTOR_LANG_OPTIONS, useTutorLang } from '@/lib/tutorLang'

const HIDDEN_KEY = 'bookmoo-tutor-hidden'
const CAPTIONS_KEY = 'bookmoo-tutor-captions'

export function isTutorHidden() {
  try { return localStorage.getItem(HIDDEN_KEY) === '1' } catch { return false }
}
export function setTutorHidden(hidden: boolean) {
  try { localStorage.setItem(HIDDEN_KEY, hidden ? '1' : '0') } catch { /* armazenamento bloqueado */ }
  window.dispatchEvent(new Event('bookmoo-tutor-visibility'))
}

export function ReaderTutor({ book }: { book: Book }) {
  const pt = useLanguage().locale === 'pt-BR'
  const ent = useEntitlements(s => s.data)
  const level = useStudyLevel()
  const { user } = useAuth()
  const [hidden, setHidden] = useState(isTutorHidden)
  const [open, setOpen] = useState(false)
  const [captions, setCaptions] = useState(() => { try { return localStorage.getItem(CAPTIONS_KEY) !== '0' } catch { return true } })
  const [slow, setSlow] = useState(false)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const [langMode, setLangMode] = useTutorLang()
  const [ptVoice, setPtVoice] = useState<boolean | null>(null)
  useEffect(() => { const sync = () => setPtVoice(hasPortugueseVoice()); sync(); window.speechSynthesis?.addEventListener?.('voiceschanged', sync); return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', sync) }, [])
  const [mood, setMood] = useState<Mood>('happy')
  const [wave, setWave] = useState(false)
  const [hello, setHello] = useState('')
  const [examples, setExamples] = useState<{ title: string; items: { en: string; pt?: string }[] } | null>(null)
  const session = useRef<string | null>(null)
  const allowed = !!ent && (ent.is_admin || ent.limits.tutor)
  const creditsLeft = ent ? ent.credits.available : 0

  useEffect(() => {
    const sync = () => setHidden(isTutorHidden())
    window.addEventListener('bookmoo-tutor-visibility', sync)
    return () => window.removeEventListener('bookmoo-tutor-visibility', sync)
  }, [])
  useEffect(() => { try { localStorage.setItem(CAPTIONS_KEY, captions ? '1' : '0') } catch { /* ignore */ } }, [captions])

  const voice = useVoiceConversation({
    continuous: true,
    rate: slow ? 0.8 : 0.95,
    bargeIn: true,
    gender: 'female',
    fillers: ['Hmm, let me look at the page…', 'Ooh, good one…', 'Well…', 'Let me think…'],
    onIdle: () => setPaused(true),
    onTurn: async (text, filler) => {
      if (!session.current) session.current = (await conversation.start({ kind: 'reader', bookId: book.id, level: level.id })).sessionId
      const r = await conversation.turn({ sessionId: session.current, text, filler, page: book.currentPage, level: level.id, langMode })
      return { reply: r.reply, segments: r.segments, extra: { highlight: r.highlight, offerSave: r.offerSave, actions: r.actions ?? [], mood: r.mood } }
    },
    onExtra: extra => {
      if (typeof extra.mood === 'string') setMood(extra.mood as Mood)
      if (extra.highlight && extra.offerSave) setHighlight(String(extra.highlight))
      // A tutora mostra na tela o que está explicando: destaca, volta páginas, abre a lição ou o desafio.
      for (const a of (extra.actions as TutorAction[] | undefined) ?? []) {
        if (a.type === 'show_examples') setExamples({ title: a.title, items: a.items })
        else runTutorAction(a)
      }
    },
    onError: code => {
      if (code === 'session_over' || code === 'book_not_found') session.current = null
      if (!['no_minutes', 'plan_required'].includes(code)) toast(pt ? 'O tutor não conseguiu responder agora' : 'The tutor could not answer right now', { tone: 'error' })
    },
  })

  // Encerra a sessão ao sair do livro.
  useEffect(() => () => {
    voice.stop()
    if (session.current) void conversation.end(session.current).catch(() => {})
  }, [book.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // O tutorial do livro abre e fecha o painel para apresentar a tutora.
  useEffect(() => {
    const show = () => { if (allowed) setOpen(true) }
    const hide = () => setOpen(false)
    window.addEventListener('bookmoo:tutor-open', show)
    window.addEventListener('bookmoo:tutor-close', hide)
    return () => { window.removeEventListener('bookmoo:tutor-open', show); window.removeEventListener('bookmoo:tutor-close', hide) }
  }, [allowed])

  // Ao abrir o painel: acena e cumprimenta num balão.
  useEffect(() => {
    if (!open) return
    setMood('happy'); setWave(true)
    setHello(greetingFor({ pt, name: 'Bea', book: book.title }))
    const t1 = window.setTimeout(() => setWave(false), 2300)
    const t2 = window.setTimeout(() => setHello(''), 6000)
    return () => { window.clearTimeout(t1); window.clearTimeout(t2) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (hidden) return null
  const running = voice.state !== 'idle' && voice.state !== 'error'
  const toggle = () => {
    setPaused(false)
    setHello('')
    if (running) voice.stop()
    else void voice.listen()
  }
  const saveWord = async (word: string) => {
    const v = useVocabularyStore.getState().addVocabulary({ bookId: book.id, text: word, type: word.includes(' ') ? 'phrase' : 'word', status: 'review', explanation: '', examples: [] })
    if (supabase && user) await upsertVocabulary(supabase, user.id, v).catch(() => {})
    setHighlight(null)
    toast(pt ? `“${word}” salvo no vocabulário` : `“${word}” saved to vocabulary`)
  }
  const lastBubbles = voice.bubbles.slice(-3)
  const statusText = voice.state === 'listening' ? (pt ? 'Ouvindo…' : 'Listening…') : voice.state === 'thinking' ? (pt ? 'Pensando…' : 'Thinking…')
    : voice.state === 'speaking' ? (pt ? 'Respondendo…' : 'Answering…') : paused ? (pt ? 'Pausado. Toque no play para continuar' : 'Paused. Tap play to continue')
    : voice.error === 'mic_denied' ? (pt ? 'Libere o microfone no navegador' : 'Allow the microphone in your browser')
    : (pt ? 'Toque no play e pergunte sobre o livro' : 'Tap play and ask about the book')

  return (
    <div className="fixed z-[45] right-4 md:right-8 flex flex-col items-end pointer-events-none"
      style={{ bottom: 'calc(var(--safe-b, 0px) + var(--tutor-bottom, 1.5rem) + 4.5rem)' }}>
      <AnimatePresence>
        {open && (
          <motion.div key="panel" initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }} style={{ transformOrigin: 'bottom right', borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}
            className="pointer-events-auto mb-3 w-[min(92vw,360px)] rounded-3xl border shadow-2xl overflow-hidden"
            data-tour="tutor-panel" role="dialog" aria-label={pt ? 'Tutor de leitura' : 'Reading tutor'}>
            <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-tight">Bea</p>
                <p className="text-[12px] leading-tight" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Tutora de leitura' : 'Reading tutor'}</p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" aria-label={pt ? 'Ajustes da tutora' : 'Tutor settings'} title={pt ? 'Ajustes da tutora' : 'Tutor settings'}
                      className="w-9 h-9 rounded-full grid place-items-center transition-colors hover:bg-[var(--ui-hover)]" style={{ color: 'var(--theme-text-secondary)' }}><SlidersHorizontal className="w-4 h-4" /></button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2 z-[160]" align="end" side="top" sideOffset={8}>
                    <p className="px-2 pt-1 pb-1 text-[12px] font-medium" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Como a tutora responde' : 'How the tutor answers'}</p>
                    {TUTOR_LANG_OPTIONS.map(o => (
                      <button key={o.id} type="button" onClick={() => setLangMode(o.id)} className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--ui-hover)]" style={{ backgroundColor: langMode === o.id ? 'var(--theme-bg-secondary)' : undefined }}>
                        <span className="block text-[13.5px] font-medium">{pt ? o.pt : o.en}</span>
                        <span className="block text-[12px] leading-snug" style={{ color: 'var(--theme-text-secondary)' }}>{o.hint[pt ? 0 : 1]}</span>
                      </button>
                    ))}
                    {langMode !== 'en' && ptVoice === false && (
                      <p className="mx-2 mt-1.5 mb-1 text-[12px] leading-snug rounded-lg px-2.5 py-2" style={{ backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-secondary)' }}>
                        {pt ? 'Este aparelho não tem voz em português instalada. A tutora fala o inglês em voz alta e mostra o português nas legendas.' : 'This device has no Portuguese voice installed. The tutor speaks the English aloud and shows the Portuguese in the captions.'}
                      </p>
                    )}
                    <div className="my-1.5 h-px mx-2" style={{ backgroundColor: 'var(--theme-border)' }} />
                    <MenuRow icon={captions ? <Captions className="w-4 h-4" /> : <CaptionsOff className="w-4 h-4" />} label={captions ? (pt ? 'Esconder legendas' : 'Hide captions') : (pt ? 'Mostrar legendas' : 'Show captions')} onClick={() => setCaptions(c => !c)} />
                    <MenuRow icon={slow ? <Turtle className="w-4 h-4" /> : <Rabbit className="w-4 h-4" />} label={slow ? (pt ? 'Voz em velocidade normal' : 'Normal speed voice') : (pt ? 'Voz mais lenta' : 'Slower voice')} onClick={() => setSlow(v => !v)} />
                    <MenuRow icon={<EyeOff className="w-4 h-4" />} label={pt ? 'Ocultar a tutora' : 'Hide the tutor'} onClick={() => { voice.stop(); setOpen(false); setTutorHidden(true); toast(pt ? 'Tutora oculta. Reative em Configurações.' : 'Tutor hidden. Turn it back on in Settings.') }} />
                    <p className="px-2.5 pt-2 pb-1 text-[11.5px]" style={{ color: !ent?.is_admin && creditsLeft < 5 ? '#dc2626' : 'var(--theme-text-secondary)' }}>{pt ? '1 crédito por minuto de conversa' : '1 credit per conversation minute'}</p>
                  </PopoverContent>
                </Popover>
                <IconBtn label={pt ? 'Minimizar' : 'Minimize'} onClick={() => setOpen(false)}><Minus className="w-4 h-4" /></IconBtn>
              </div>
            </div>

            <div className="px-4 pt-2 min-h-[120px] max-h-[34dvh] overflow-y-auto flex flex-col justify-end gap-2">
              <AnimatePresence initial={false}>
                {captions && lastBubbles.map(b => (
                  <motion.div key={b.id} layout initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -10 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                    className={`max-w-[88%] rounded-2xl px-3 py-2 text-[13.5px] leading-snug ${b.role === 'user' ? 'self-end' : 'self-start'}`}
                    style={b.role === 'user' ? { backgroundColor: 'var(--theme-bg-secondary)' } : { backgroundColor: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card-bg))' }}>
                    {b.text}{b.pending ? <span className="opacity-60"> …</span> : null}
                  </motion.div>
                ))}
                {captions && voice.interim && (
                  <motion.div key="interim" initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} className="self-end max-w-[88%] rounded-2xl px-3 py-2 text-[13.5px] italic" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>{voice.interim}</motion.div>
                )}
              </AnimatePresence>
              {examples && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="self-stretch rounded-2xl border p-3" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12.5px] font-semibold">{examples.title || (pt ? 'Exemplos' : 'Examples')}</p>
                    <button type="button" onClick={() => setExamples(null)} aria-label={pt ? 'Fechar exemplos' : 'Close examples'} className="w-6 h-6 grid place-items-center rounded-full hover:bg-[var(--ui-hover)]"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <ul className="mt-1.5 space-y-1.5">{examples.items.map((e, i) => (
                    <li key={i}><p className="font-serif italic text-[14.5px] leading-snug">{e.en}</p>{e.pt && <p className="text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{e.pt}</p>}</li>
                  ))}</ul>
                </motion.div>
              )}
              {highlight && (
                <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} type="button" onClick={() => saveWord(highlight)}
                  className="self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12.5px] font-medium border" style={{ borderColor: 'var(--theme-border)' }}>
                  <BookmarkPlus className="w-3.5 h-3.5" />{pt ? `Salvar “${highlight}”` : `Save “${highlight}”`}
                </motion.button>
              )}
            </div>

            <div className="flex items-center gap-4 px-4 pt-3 pb-4">
              <TutorAvatar kind="woman" state={voice.state} speakingText={voice.speakingText} size={84} mood={mood} wave={wave}
                onPoke={() => setHello(pt ? ['Oi! Pode perguntar.', 'Estou aqui!', 'Haha, cócegas!'][Math.floor(Math.random() * 3)] : ['Hi! Ask away.', 'I am here!', 'Haha, that tickles!'][Math.floor(Math.random() * 3)])} />
              <div className="flex-1 min-w-0">
                {hello && !running
                  ? <AvatarBubble text={hello} side="right" tone="accent" />
                  : <p className="text-[13px] leading-snug" style={{ color: 'var(--theme-text-secondary)' }} aria-live="polite">{statusText}</p>}
              </div>
              <PlayStopButton active={running} onClick={toggle} size={52} label={running ? (pt ? 'Parar' : 'Stop') : (pt ? 'Começar a conversar' : 'Start talking')} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button data-tour="tutor-fab" type="button" onClick={() => (allowed ? setOpen(o => !o) : openPaywall('tutor'))}
        whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.06 }}
        className="pointer-events-auto relative w-14 h-14 rounded-2xl shadow-xl grid place-items-center overflow-hidden border" style={{ borderColor: 'var(--theme-border)' }}
        aria-label={allowed ? (pt ? 'Abrir tutor de leitura' : 'Open reading tutor') : (pt ? 'Tutor de leitura (Plus)' : 'Reading tutor (Plus)')}
        title={allowed ? (pt ? 'Converse com a tutora sobre o livro' : 'Talk with the tutor about the book') : (pt ? 'Tutor de leitura, disponível no Plus' : 'Reading tutor, Plus plan')}>
        <span className="absolute inset-0 grid place-items-center" style={{ backgroundColor: 'var(--theme-card-bg)' }}>
          <TutorAvatar kind="woman" state="idle" size={44} followPointer={false} mood="happy" />
        </span>
        {running && <motion.span aria-hidden className="absolute inset-0 rounded-2xl border-2" style={{ borderColor: 'var(--theme-text)' }} animate={{ opacity: [0.2, 0.6, 0.2] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />}
        {!allowed && <span className="absolute right-0.5 bottom-0.5 w-5 h-5 rounded-full grid place-items-center" style={{ backgroundColor: '#111', color: '#FCD34D' }}><Lock className="w-3 h-3" /></span>}
      </motion.button>
    </div>
  )
}

function MenuRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-[13.5px] hover:bg-[var(--ui-hover)]">
      <span style={{ color: 'var(--theme-text-secondary)' }}>{icon}</span>{label}
    </button>
  )
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className="w-9 h-9 rounded-full grid place-items-center transition-colors hover:bg-[var(--ui-hover)]" style={{ color: 'var(--theme-text-secondary)' }}>
      {children}
    </button>
  )
}
