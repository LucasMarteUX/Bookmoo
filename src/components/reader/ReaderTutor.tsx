// Tutor de leitura: botão flutuante no canto inferior direito do leitor. Conversa por voz sobre o livro
// (história até onde a pessoa leu, palavras da página, personagens). Plus e Pro; nos outros planos, convite.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AudioLines, Captions, CaptionsOff, Lock, Minus, Rabbit, Turtle, EyeOff, BookmarkPlus } from 'lucide-react'
import type { Book } from '@/store/useBookStore'
import { useLanguage } from '@/store/useLanguage'
import { useEntitlements } from '@/store/useEntitlements'
import { useVocabularyStore } from '@/store/useVocabularyStore'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { upsertVocabulary } from '@/lib/supabaseSync'
import { useVoiceConversation } from '@/hooks/useVoiceConversation'
import { useStudyLevel } from '@/hooks/useStudyLevel'
import { conversation } from '@/lib/billingApi'
import { openPaywall } from '@/components/billing/Paywall'
import { toast } from '@/components/ui/toast'
import { VoiceOrb, PlayStopButton } from '@/components/voice/VoiceOrb'

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
    fillers: ['Hmm, let me look at the page…', 'Ooh, good one…', 'Well…', 'Let me think…'],
    onIdle: () => setPaused(true),
    onTurn: async (text, filler) => {
      if (!session.current) session.current = (await conversation.start({ kind: 'reader', bookId: book.id, level: level.id })).sessionId
      const r = await conversation.turn({ sessionId: session.current, text, filler, page: book.currentPage, level: level.id })
      return { reply: r.reply, extra: { highlight: r.highlight, offerSave: r.offerSave } }
    },
    onExtra: extra => { if (extra.highlight && extra.offerSave) setHighlight(String(extra.highlight)) },
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

  if (hidden) return null
  const running = voice.state !== 'idle' && voice.state !== 'error'
  const toggle = () => {
    setPaused(false)
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
          <motion.div key="panel" layout initial={{ opacity: 0, scale: 0.6, y: 30, originX: 1, originY: 1 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.6, y: 30 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="pointer-events-auto mb-3 w-[min(92vw,360px)] rounded-[28px] border shadow-2xl overflow-hidden backdrop-blur-xl"
            style={{ borderColor: 'var(--theme-border)', backgroundColor: 'color-mix(in srgb, var(--theme-card-bg) 92%, transparent)' }}
            role="dialog" aria-label={pt ? 'Tutor de leitura' : 'Reading tutor'}>
            <div className="flex items-center justify-between px-4 pt-3">
              <div>
                <p className="text-[14px] font-semibold">Bea · {pt ? 'tutora de leitura' : 'reading tutor'}</p>
                <p className="text-[11.5px]" style={{ color: !ent?.is_admin && creditsLeft < 5 ? '#dc2626' : 'var(--theme-text-secondary)' }}>{pt ? '1 crédito por minuto de conversa' : '1 credit per conversation minute'}</p>
              </div>
              <div className="flex items-center gap-0.5">
                <IconBtn label={captions ? (pt ? 'Esconder legendas' : 'Hide captions') : (pt ? 'Mostrar legendas' : 'Show captions')} onClick={() => setCaptions(c => !c)}>{captions ? <Captions className="w-4 h-4" /> : <CaptionsOff className="w-4 h-4" />}</IconBtn>
                <IconBtn label={slow ? (pt ? 'Voz normal' : 'Normal voice') : (pt ? 'Voz mais lenta' : 'Slower voice')} onClick={() => setSlow(v => !v)}>{slow ? <Turtle className="w-4 h-4" /> : <Rabbit className="w-4 h-4" />}</IconBtn>
                <IconBtn label={pt ? 'Ocultar tutor' : 'Hide tutor'} onClick={() => { voice.stop(); setOpen(false); setTutorHidden(true); toast(pt ? 'Tutor oculto. Reative em Configurações → Leitura.' : 'Tutor hidden. Turn it back on in Settings.') }}><EyeOff className="w-4 h-4" /></IconBtn>
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
              {highlight && (
                <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} type="button" onClick={() => saveWord(highlight)}
                  className="self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12.5px] font-medium border" style={{ borderColor: 'var(--theme-border)' }}>
                  <BookmarkPlus className="w-3.5 h-3.5" />{pt ? `Salvar “${highlight}”` : `Save “${highlight}”`}
                </motion.button>
              )}
            </div>

            <div className="flex flex-col items-center pb-4">
              <VoiceOrb state={voice.state} level={voice.level} size={84} />
              <p className="-mt-2 text-[12.5px] text-center px-4" style={{ color: 'var(--theme-text-secondary)' }} aria-live="polite">{statusText}</p>
              <div className="mt-3"><PlayStopButton active={running} onClick={toggle} label={running ? (pt ? 'Parar' : 'Stop') : (pt ? 'Começar a conversar' : 'Start talking')} /></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button type="button" layout onClick={() => (allowed ? setOpen(o => !o) : openPaywall('tutor'))}
        whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.06 }}
        className="pointer-events-auto relative w-14 h-14 rounded-full shadow-xl grid place-items-center overflow-hidden"
        aria-label={allowed ? (pt ? 'Abrir tutor de leitura' : 'Open reading tutor') : (pt ? 'Tutor de leitura (Plus)' : 'Reading tutor (Plus)')}
        title={allowed ? (pt ? 'Converse com a tutora sobre o livro' : 'Talk with the tutor about the book') : (pt ? 'Tutor de leitura — disponível no Plus' : 'Reading tutor — Plus plan')}>
        <motion.span className="absolute inset-[-30%]" style={{ background: 'conic-gradient(from 0deg, #8b5cf6, #ec4899, #f59e0b, #3b82f6, #8b5cf6)' }}
          animate={{ rotate: 360 }} transition={{ duration: running ? 3 : 12, repeat: Infinity, ease: 'linear' }} />
        <motion.span className="absolute inset-[3px] rounded-full grid place-items-center text-[22px]" style={{ backgroundColor: 'var(--theme-card-bg)' }}
          animate={running ? { scale: 1 + voice.level * 0.08 } : { scale: [1, 1.04, 1] }} transition={running ? { type: 'spring', stiffness: 300, damping: 15 } : { duration: 4, repeat: Infinity }}>
          <AudioLines className="w-5 h-5" strokeWidth={1.8} />
        </motion.span>
        {!allowed && <span className="absolute right-0.5 bottom-0.5 w-5 h-5 rounded-full grid place-items-center" style={{ backgroundColor: '#111', color: '#FCD34D' }}><Lock className="w-3 h-3" /></span>}
      </motion.button>
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
