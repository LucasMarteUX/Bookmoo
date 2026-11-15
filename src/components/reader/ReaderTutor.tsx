// Tutor de leitura: botão flutuante no canto inferior direito do leitor. Conversa por voz sobre o livro
// (história até onde a pessoa leu, palavras da página, personagens). Plus e Pro; nos outros planos, convite.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronLeft, Lock, Minus, EyeOff, BookmarkPlus, SlidersHorizontal, X } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
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
  const [view, setView] = useState<'chat' | 'settings'>('chat')
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
    const hide = () => { setOpen(false); setView('chat') }
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
    // A bolinha e o painel ocupam o mesmo lugar: ao abrir, o painel cresce a partir do canto da bolinha.
    <div className="fixed z-[45] right-4 md:right-8 w-14 h-14 pointer-events-none"
      style={{ bottom: 'calc(var(--safe-b, 0px) + var(--tutor-bottom, 1.5rem) + 4.5rem)' }}>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="panel" initial={{ opacity: 0, scale: 0.3, borderRadius: 999 }} animate={{ opacity: 1, scale: 1, borderRadius: 28 }} exit={{ opacity: 0, scale: 0.3, borderRadius: 999 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }} style={{ transformOrigin: 'bottom right', borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}
            className="pointer-events-auto absolute bottom-0 right-0 w-[min(calc(100vw-2rem),380px)] border shadow-2xl overflow-hidden"
            data-tour="tutor-panel" role="dialog" aria-label={pt ? 'Tutora de leitura' : 'Reading tutor'}>
            <div className="flex items-center gap-1 px-3 pt-3 pb-1">
              {view === 'settings' ? (
                <>
                  <IconBtn label={pt ? 'Voltar' : 'Back'} onClick={() => setView('chat')}><ChevronLeft className="w-[18px] h-[18px]" /></IconBtn>
                  <p className="flex-1 text-[15px] font-semibold">{pt ? 'Ajustes da tutora' : 'Tutor settings'}</p>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0 pl-1.5">
                    <p className="text-[15px] font-semibold leading-tight">Bea</p>
                    <p className="text-[12px] leading-tight flex items-center gap-1.5" style={{ color: 'var(--theme-text-secondary)' }}>
                      <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: running ? '#22c55e' : 'var(--theme-border)' }} />
                      {pt ? 'Tutora de leitura' : 'Reading tutor'}
                    </p>
                  </div>
                  <IconBtn label={pt ? 'Ajustes da tutora' : 'Tutor settings'} onClick={() => setView('settings')}><SlidersHorizontal className="w-4 h-4" /></IconBtn>
                </>
              )}
              <IconBtn label={pt ? 'Minimizar' : 'Minimize'} onClick={() => { setOpen(false); setView('chat') }}><Minus className="w-4 h-4" /></IconBtn>
            </div>

            {view === 'settings' ? (
              <div className="px-3 pb-3 pt-1 max-h-[60dvh] overflow-y-auto">
                <p className="px-1.5 pt-1 pb-2 text-[12px] font-medium" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Como a tutora responde' : 'How the tutor answers'}</p>
                <div role="radiogroup" aria-label={pt ? 'Idioma da tutora' : 'Tutor language'} className="space-y-1.5">
                  {TUTOR_LANG_OPTIONS.map(o => {
                    const on = langMode === o.id
                    return (
                      <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => setLangMode(o.id)}
                        className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl border transition-colors"
                        style={{ borderColor: on ? 'var(--theme-text)' : 'var(--theme-border)', backgroundColor: on ? 'var(--theme-bg-secondary)' : 'transparent' }}>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-medium">{pt ? o.pt : o.en}</span>
                          <span className="block text-[12px] leading-snug" style={{ color: 'var(--theme-text-secondary)' }}>{o.hint[pt ? 0 : 1]}</span>
                        </span>
                        <span aria-hidden className="w-5 h-5 shrink-0 rounded-full grid place-items-center border" style={{ borderColor: on ? 'var(--theme-text)' : 'var(--theme-text-secondary)', backgroundColor: on ? 'var(--theme-text)' : 'transparent', color: 'var(--theme-bg)' }}>
                          {on && <Check className="w-3 h-3" strokeWidth={3} />}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {langMode !== 'en' && ptVoice === false && (
                  <p className="mt-2 text-[12px] leading-snug rounded-xl px-3 py-2.5" style={{ backgroundColor: 'var(--pastel-amber-bg)', color: 'var(--pastel-amber-fg)' }}>
                    {pt ? 'Este aparelho não tem voz em português instalada. A tutora fala o inglês em voz alta e mostra o português nas legendas.' : 'This device has no Portuguese voice installed. The tutor speaks the English aloud and shows the Portuguese in the captions.'}
                  </p>
                )}
                <div className="mt-3 rounded-xl border divide-y" style={{ borderColor: 'var(--theme-border)' }}>
                  <ToggleRow label={pt ? 'Legendas' : 'Captions'} hint={pt ? 'Mostra o que ela fala em texto.' : 'Shows what she says as text.'} checked={captions} onChange={setCaptions} />
                  <ToggleRow label={pt ? 'Voz mais lenta' : 'Slower voice'} hint={pt ? 'Bom para acompanhar com calma.' : 'Good for following along.'} checked={slow} onChange={setSlow} />
                </div>
                <button type="button" onClick={() => { voice.stop(); setOpen(false); setView('chat'); setTutorHidden(true); toast(pt ? 'Tutora oculta. Reative em Ajustes.' : 'Tutor hidden. Turn it back on in Settings.') }}
                  className="mt-3 w-full h-10 rounded-xl text-[13.5px] font-medium inline-flex items-center justify-center gap-2 hover:bg-[var(--ui-hover)]" style={{ color: 'var(--theme-text-secondary)' }}>
                  <EyeOff className="w-4 h-4" />{pt ? 'Ocultar a tutora' : 'Hide the tutor'}
                </button>
              </div>
            ) : (
              <>
                <div className="px-4 pt-2 min-h-[110px] max-h-[34dvh] overflow-y-auto flex flex-col justify-end gap-2">
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
              </>
            )}
          </motion.div>
        )}

        {!open && (
          <motion.button key="fab" data-tour="tutor-fab" type="button" onClick={() => (allowed ? setOpen(true) : openPaywall('tutor'))}
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.06 }}
            className="pointer-events-auto absolute bottom-0 right-0 w-14 h-14 rounded-full shadow-xl grid place-items-center overflow-hidden border-2" style={{ borderColor: 'var(--theme-card-bg)', backgroundColor: 'var(--theme-card-bg)', boxShadow: '0 8px 24px rgba(0,0,0,0.22), 0 0 0 1px var(--theme-border)' }}
            aria-label={allowed ? (pt ? 'Abrir a tutora de leitura' : 'Open the reading tutor') : (pt ? 'Tutora de leitura (Plus)' : 'Reading tutor (Plus)')}
            title={allowed ? (pt ? 'Converse com a tutora sobre o livro' : 'Talk with the tutor about the book') : (pt ? 'Tutora de leitura, disponível no Plus' : 'Reading tutor, Plus plan')}>
            <span className="absolute inset-0 rounded-full overflow-hidden grid place-items-center">
              <TutorAvatar kind="woman" state="idle" size={52} followPointer={false} mood="happy" />
            </span>
            {running && <motion.span aria-hidden className="absolute inset-0 rounded-full border-2" style={{ borderColor: 'var(--theme-text)' }} animate={{ opacity: [0.2, 0.7, 0.2] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />}
            {!allowed && <span className="absolute right-0 bottom-0 w-5 h-5 rounded-full grid place-items-center" style={{ backgroundColor: '#111', color: '#FCD34D' }}><Lock className="w-3 h-3" /></span>}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5 cursor-pointer" style={{ borderColor: 'var(--theme-border)' }}
      onClick={e => { if (!(e.target as HTMLElement).closest('button')) onChange(!checked) }}>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium">{label}</span>
        <span className="block text-[12px] leading-snug" style={{ color: 'var(--theme-text-secondary)' }}>{hint}</span>
      </span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
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
