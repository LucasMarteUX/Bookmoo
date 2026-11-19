// Chat com os tutores, como num app de mensagens: a bolinha no canto inferior direito, em todas as telas (montada no
// Layout). Abre a lista de conversas (Bia, Luck, Yuno, Yuri, com a última mensagem de cada um) e o chat de cada tutor:
// - texto: escreve e ele responde por escrito;
// - áudio: fala uma vez e ele responde falando;
// - chamada: "Chamando…" (o mesmo da tela de conversa) e o personagem aparece no chat, animado, falando com lip sync.
// O histórico de cada tutor fica guardado no aparelho (useTutorChats). Com um livro aberto a conversa é sobre o livro; fora
// dele, é livre. Cada tutor tem a própria sessão no servidor (a memória do tutor é a mesma da tela Conversar).
// Some em /conversar, durante o teste de nível e nas práticas de fala/escrita do livro (useTutorDock.focus); a prova roda
// fora do Layout. Plus e Pro; nos outros planos, convite.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUp, ChevronLeft, Lock, MessagesSquare, Mic, Minus, EyeOff, BookmarkPlus, Phone, PhoneOff, SlidersHorizontal, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Switch } from '@/components/ui/switch'
import { useLanguage } from '@/store/useLanguage'
import { useEntitlements } from '@/store/useEntitlements'
import { useVocabularyStore } from '@/store/useVocabularyStore'
import { useTutorDock } from '@/store/useTutorDock'
import { useTutorChats, TUTOR_CHAT_BOOK, type ChatMessage } from '@/store/useTutorChats'
import { useVocabularyStore as useVocab, type VocabStatus } from '@/store/useVocabularyStore'
import { WordTooltip, type WordTooltipState } from '@/components/reader/WordTooltip'
import { VocabularyModal } from '@/components/vocabulary/VocabularyModal'
import { speak } from '@/lib/tts'
import { useAvatarSettings } from '@/store/useAvatarSettings'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { upsertVocabulary } from '@/lib/supabaseSync'
import { useVoiceConversation } from '@/hooks/useVoiceConversation'
import { useStudyLevel } from '@/hooks/useStudyLevel'
import { useIsMobile } from '@/hooks/useIsMobile'
import { conversation } from '@/lib/billingApi'
import { openPaywall } from '@/components/billing/Paywall'
import { toast } from '@/components/ui/toast'
import { type Mood } from '@/components/voice/TutorAvatar'
import { CharacterAvatar } from '@/components/voice/CharacterAvatar'
import { greetingFor } from '@/lib/greetings'
import { CHARACTERS, characterAvatarUrl, characterById, characterFaceUrl } from '@/lib/livliv/characters'
import { runTutorAction, type TutorAction } from '@/lib/tutorActions'
import { useTutorLang } from '@/lib/tutorLang'

const HIDDEN_KEY = 'bookmoo-tutor-hidden'
/** Tempo do "Chamando…" antes de o personagem aparecer na chamada (o mesmo da tela de conversa). */
const CALL_MS = 3000

export function isTutorHidden() {
  try { return localStorage.getItem(HIDDEN_KEY) === '1' } catch { return false }
}
export function setTutorHidden(hidden: boolean) {
  try { localStorage.setItem(HIDDEN_KEY, hidden ? '1' : '0') } catch { /* armazenamento bloqueado */ }
  window.dispatchEvent(new Event('bookmoo-tutor-visibility'))
}

type Persona = { id: string; name: string; female: boolean }
function personaOf(id: string): Persona {
  const c = CHARACTERS.find(x => x.id === id) ?? CHARACTERS[0]
  return { id: c.id, name: c.name.replace(/\s*\(.*\)$/, ''), female: c.voice.gender === 'female' }
}

/** Montado uma vez no Layout. Decide sozinho onde aparece. */
export function TutorDock() {
  const book = useTutorDock(s => s.book)
  const focus = useTutorDock(s => s.focus)
  const { pathname } = useLocation()
  const [hidden, setHidden] = useState(isTutorHidden)
  useEffect(() => {
    const sync = () => setHidden(isTutorHidden())
    window.addEventListener('bookmoo-tutor-visibility', sync)
    return () => window.removeEventListener('bookmoo-tutor-visibility', sync)
  }, [])
  // Na tela de conversa com os tutores ele já está na frente; em foco (teste de nível, práticas do livro) sai.
  if (hidden || focus > 0 || pathname.startsWith('/conversar')) return null
  // Um painel por contexto: trocar de livro (ou sair dele) começa outra sessão.
  return <TutorPanel key={book?.id ?? 'livre'} />
}

function TutorPanel() {
  const pt = useLanguage().locale === 'pt-BR'
  const book = useTutorDock(s => s.book)
  const ent = useEntitlements(s => s.data)
  const isMobile = useIsMobile()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const active = useTutorChats(s => s.active)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'chat' | 'settings'>('chat')
  const [slow, setSlow] = useState(false)
  const allowed = !!ent && (ent.is_admin || ent.limits.tutor)
  // A bolinha e o chat mostram o último tutor com quem a pessoa falou; sem conversa ainda, a Bia.
  const tutorId = lastTutor(active)
  const tutor = personaOf(tutorId)
  const art = tutor.female ? 'a' : 'o'

  // O tutorial do livro abre e fecha o painel para apresentar o tutor.
  useEffect(() => {
    const show = () => { if (allowed) { setOpen(true); setView('chat') } }
    const hide = () => setOpen(false)
    window.addEventListener('bookmoo:tutor-open', show)
    window.addEventListener('bookmoo:tutor-close', hide)
    return () => { window.removeEventListener('bookmoo:tutor-open', show); window.removeEventListener('bookmoo:tutor-close', hide) }
  }, [allowed])

  const fabHint = allowed
    ? (pt ? (book ? `Converse com ${art} ${tutor.name} sobre o livro` : `Converse com ${art} ${tutor.name}`) : (book ? `Talk with ${tutor.name} about the book` : `Talk with ${tutor.name}`))
    : (pt ? 'Chat com os tutores, disponível no Plus' : 'Chat with the tutors, Plus plan')
  // No leitor a barra de ferramentas fica embaixo; nas outras telas do celular, a tab bar.
  const onBook = /^\/book\//.test(pathname)
  const bottom = onBook
    ? 'calc(var(--safe-b, 0px) + var(--tutor-bottom, 1.5rem) + 4.5rem)'
    : isMobile ? 'calc(var(--safe-b, 0px) + var(--tabbar-h, 4rem) + 1rem)' : '1.5rem'

  return (
    // A bolinha e o painel ocupam o mesmo canto: o painel abre a partir dele (escala + opacidade, cantos sempre iguais).
    <div data-chrome={open ? undefined : 'fade'} className="fixed z-[45] right-4 md:right-8 w-14 h-14 pointer-events-none" style={{ bottom }}>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="panel" initial={{ opacity: 0, scale: 0.92, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }} style={{ transformOrigin: 'bottom right', borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}
            className="pointer-events-auto absolute bottom-0 right-0 w-[min(calc(100vw-2rem),390px)] rounded-[28px] border shadow-2xl overflow-hidden flex flex-col"
            data-tour="tutor-panel" role="dialog" aria-label={pt ? 'Chat com os tutores' : 'Chat with the tutors'}>
            {view === 'settings' && (
              <>
                <div className="flex items-center gap-1 px-3 pt-3 pb-1">
                  <IconBtn label={pt ? 'Voltar' : 'Back'} onClick={() => setView('chat')}><ChevronLeft className="w-[18px] h-[18px]" /></IconBtn>
                  <p className="flex-1 text-[15px] font-semibold">{pt ? 'Ajustes do chat' : 'Chat settings'}</p>
                  <IconBtn label={pt ? 'Minimizar' : 'Minimize'} onClick={() => setOpen(false)}><Minus className="w-4 h-4" /></IconBtn>
                </div>
                <div className="px-3 pb-3 pt-1">
                  <div className="rounded-xl border divide-y" style={{ borderColor: 'var(--theme-border)' }}>
                    <ToggleRow label={pt ? 'Voz mais lenta' : 'Slower voice'} hint={pt ? 'Bom para acompanhar com calma.' : 'Good for following along.'} checked={slow} onChange={setSlow} />
                  </div>
                  <button type="button" onClick={() => { setOpen(false); setTutorHidden(true); toast(pt ? 'Chat oculto. Reative em Ajustes.' : 'Chat hidden. Turn it back on in Settings.') }}
                    className="mt-3 w-full h-10 rounded-xl text-[13.5px] font-medium inline-flex items-center justify-center gap-2 hover:bg-[var(--ui-hover)]" style={{ color: 'var(--theme-text-secondary)' }}>
                    <EyeOff className="w-4 h-4" />{pt ? 'Ocultar o chat dos tutores' : 'Hide the tutor chat'}
                  </button>
                </div>
              </>
            )}
            {view === 'chat' && (
              // Conversa com o último tutor; todas as conversas ficam no ícone de histórico (abre o chat geral na tela Conversar).
              <TutorChat key={tutorId} tutor={tutor} slow={slow} onHistory={() => { setOpen(false); navigate('/conversar?conversas=1') }} onSettings={() => setView('settings')} onMinimize={() => setOpen(false)} />
            )}
          </motion.div>
        )}

        {!open && (
          <motion.button key="fab" data-tour="tutor-fab" type="button" onClick={() => (allowed ? (setOpen(true), setView('chat')) : openPaywall('tutor'))}
            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.06 }}
            className="pointer-events-auto absolute bottom-0 right-0 w-14 h-14 rounded-full shadow-xl grid place-items-center" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.22), 0 0 0 2px var(--theme-card-bg), 0 0 0 3px var(--theme-border)' }}
            aria-label={fabHint} title={fabHint}>
            <Face id={tutorId} size={56} online={allowed} />
            {!allowed && <span className="absolute right-0 bottom-0 w-5 h-5 rounded-full grid place-items-center" style={{ backgroundColor: '#111', color: '#FCD34D' }}><Lock className="w-3 h-3" /></span>}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

function TutorChat({ tutor, slow, onList, onHistory, onSettings, onMinimize, onCall, page = false }: { tutor: Persona; slow: boolean; onList?: () => void; onHistory?: () => void; onSettings?: () => void; onMinimize?: () => void; onCall?: (id: string) => void; page?: boolean }) {
  const pt = useLanguage().locale === 'pt-BR'
  const book = useTutorDock(s => s.book)
  const level = useStudyLevel()
  const { user } = useAuth()
  const history = useTutorChats(s => s.chats[tutor.id]) ?? EMPTY
  const add = useTutorChats(s => s.add)
  const setActive = useTutorChats(s => s.setActive)
  const [call, setCall] = useState<'off' | 'calling' | 'live'>('off')
  const [via, setVia] = useState<'text' | 'voice'>('text')
  const [text, setText] = useState('')
  const [highlight, setHighlight] = useState<string | null>(null)
  const [langMode] = useTutorLang()
  const [mood, setMood] = useState<Mood>('happy')
  const [hello] = useState(() => greetingFor({ pt, name: tutor.name, female: tutor.female, book: book?.title }))
  const [examples, setExamples] = useState<{ title: string; items: { en: string; pt?: string }[] } | null>(null)
  const session = useRef<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const callRef = useRef(call)
  callRef.current = call
  const art = tutor.female ? 'a' : 'o'
  const role = pt ? (tutor.female ? 'Tutora' : 'Tutor') : 'Tutor'

  const voice = useVoiceConversation({
    // Na chamada volta a ouvir sozinho depois de responder; o áudio é uma fala só.
    continuous: call === 'live',
    rate: slow ? 0.8 : 0.95,
    bargeIn: true,
    gender: tutor.female ? 'female' : 'male',
    fillers: book ? ['Hmm, let me look at the page…', 'Ooh, good one…', 'Well…', 'Let me think…'] : ['Hmm…', 'Good question…', 'Well…', 'Let me think…'],
    onIdle: () => { if (callRef.current === 'live') setCall('off') },
    onTurn: async (said, filler) => {
      if (!session.current) {
        session.current = (await conversation.start(book
          ? { kind: 'reader', bookId: book.id, level: level.id, characterId: tutor.id }
          : { kind: 'tutor', level: level.id, characterId: tutor.id })).sessionId
      }
      const how = callRef.current === 'live' ? 'call' : via
      setActive(tutor.id)
      add(tutor.id, { role: 'user', text: said, at: Date.now(), via: how })
      const r = await conversation.turn({ sessionId: session.current, text: said, filler, page: book?.currentPage, level: level.id, langMode, tutorName: tutor.name, characterId: tutor.id })
      add(tutor.id, { role: 'ai', text: r.reply, at: Date.now(), via: how })
      return { reply: r.reply, segments: r.segments, extra: { highlight: r.highlight, offerSave: r.offerSave, actions: r.actions ?? [], mood: r.mood } }
    },
    onExtra: extra => {
      if (typeof extra.mood === 'string') setMood(extra.mood as Mood)
      if (book && extra.highlight && extra.offerSave) setHighlight(String(extra.highlight))
      // O tutor mostra na tela o que está explicando: destaca, volta páginas, abre a lição ou o desafio.
      for (const a of (extra.actions as TutorAction[] | undefined) ?? []) {
        if (a.type === 'show_examples') setExamples({ title: a.title, items: a.items })
        else runTutorAction(a)
      }
    },
    onError: code => {
      if (code === 'session_over' || code === 'book_not_found') session.current = null
      if (!['no_minutes', 'plan_required'].includes(code)) toast(pt ? `${tutor.female ? 'A' : 'O'} ${tutor.name} não conseguiu responder agora` : `${tutor.name} could not answer right now`, { tone: 'error' })
    },
  })

  // Sair da conversa (trocar de tutor, minimizar o contexto, sair do livro) encerra a sessão: o servidor guarda o que
  // aprendeu na memória do tutor, que a tela Conversar também usa.
  useEffect(() => () => {
    voice.stop()
    if (session.current) void conversation.end(session.current).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Chamada: "Chamando…" e depois o personagem; o microfone abre quando ele aparece.
  useEffect(() => {
    if (call !== 'calling') return
    const t = window.setTimeout(() => { setCall('live'); void voice.listen() }, CALL_MS)
    return () => window.clearTimeout(t)
  }, [call]) // eslint-disable-line react-hooks/exhaustive-deps

  // A conversa rola para a última mensagem.
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }) }, [history.length, voice.state, voice.interim, examples, highlight, call])

  const busy = voice.state !== 'idle' && voice.state !== 'error'
  // Na página de conversas, ligar abre a tela de conversa normal com este tutor (com todos os controles).
  const startCall = () => { voice.stop(); if (onCall) onCall(tutor.id); else setCall('calling') }
  const endCall = () => { setCall('off'); voice.stop() }
  const audioMessage = () => {
    if (busy) { voice.stop(); return }
    setVia('voice'); void voice.listen()
  }
  const send = () => {
    const msg = text.trim()
    if (!msg) return
    setText(''); setVia('text')
    void voice.ask(msg)
  }
  const saveWord = async (word: string) => {
    if (!book) return
    const v = useVocabularyStore.getState().addVocabulary({ bookId: book.id, text: word, type: word.includes(' ') ? 'phrase' : 'word', status: 'review', explanation: '', examples: [] })
    if (supabase && user) await upsertVocabulary(supabase, user.id, v).catch(() => {})
    setHighlight(null)
    toast(pt ? `“${word}” salvo no vocabulário` : `“${word}” saved to vocabulary`)
  }
  const status = voice.state === 'listening' ? (pt ? 'ouvindo…' : 'listening…') : voice.state === 'thinking' ? (pt ? 'digitando…' : 'typing…')
    : voice.state === 'speaking' ? (pt ? 'falando…' : 'speaking…') : null
  const lastAi = [...history].reverse().find(m => m.role === 'ai')

  // Palavras das mensagens: o mesmo cartão do leitor (status, explicação, nota, imagem, ouvir), salvando no vocabulário
  // de sempre. Fora de um livro, a origem é "Conversa com os tutores".
  const vocabBook = book?.id ?? TUTOR_CHAT_BOOK
  const [wordTip, setWordTip] = useState<WordTooltipState | null>(null)
  const [tipSpeaking, setTipSpeaking] = useState(false)
  const [card, setCard] = useState<{ text: string; id: string | null; tab: 'meaning' | 'notes' | 'images' } | null>(null)
  const vocabFor = (w: string) => {
    const key = w.trim().toLowerCase()
    const all = useVocab.getState().vocabularies.filter(v => v.text.trim().toLowerCase() === key)
    return all.find(v => v.bookId === vocabBook) ?? all.sort((a, b) => b.createdAt - a.createdAt)[0]
  }
  const openWord = (w: string, el: HTMLElement, idx: number) => {
    const r = el.getBoundingClientRect()
    setWordTip({ idx, text: w, x: (r.left + r.right) / 2, y: r.bottom, top: r.top - 2 })
  }
  const setWordStatus = (w: string, status: VocabStatus) => {
    const existing = vocabFor(w)
    const st = useVocab.getState()
    const saved = existing ? (st.updateVocabulary(existing.id, { status }), { ...existing, status })
      : st.addVocabulary({ bookId: vocabBook, text: w.trim(), type: w.trim().includes(' ') ? 'phrase' : 'word', status, explanation: '', examples: [] })
    if (supabase && user) void upsertVocabulary(supabase, user.id, saved).catch(() => {})
  }
  const openCard = (w: string, tab: 'meaning' | 'notes' | 'images') => { setWordTip(null); setCard({ text: w, id: vocabFor(w)?.id ?? null, tab }) }
  useEffect(() => {
    if (!wordTip) return
    const hide = (e: Event) => { if (!(e.target as HTMLElement | null)?.closest?.('.word-tooltip, [data-chat-word]')) setWordTip(null) }
    const onScroll = () => setWordTip(null)
    document.addEventListener('pointerdown', hide, true)
    scroller.current?.addEventListener('scroll', onScroll)
    const sc = scroller.current
    return () => { document.removeEventListener('pointerdown', hide, true); sc?.removeEventListener('scroll', onScroll) }
  }, [wordTip])

  return (
    <div className={page ? 'flex flex-col h-full min-h-0' : 'contents'}>
      <div className="flex items-center gap-2 px-2.5 pt-3 pb-2 border-b" style={{ borderColor: 'var(--theme-border)' }}>
        {onList && <IconBtn label={pt ? 'Conversas' : 'Chats'} onClick={onList}><ChevronLeft className="w-[18px] h-[18px]" /></IconBtn>}
        <Face id={tutor.id} size={40} />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold leading-tight truncate">{tutor.name}</p>
          <p className="text-[12px] leading-tight flex items-center gap-1.5" style={{ color: 'var(--theme-text-secondary)' }}>
            <span aria-hidden className="w-2 h-2 rounded-full" style={{ backgroundColor: '#22c55e' }} />
            {call === 'live' ? (pt ? 'em chamada' : 'on a call') : status ?? (pt ? `online · ${book ? `${role.toLowerCase()} de leitura` : role.toLowerCase()}` : `online · ${book ? 'reading tutor' : 'tutor'}`)}
          </p>
        </div>
        {call === 'off'
          ? <IconBtn label={pt ? `Ligar para ${art} ${tutor.name}` : `Call ${tutor.name}`} onClick={startCall}><Phone className="w-4 h-4" /></IconBtn>
          : <IconBtn label={pt ? 'Encerrar chamada' : 'End call'} onClick={endCall} tone="danger"><PhoneOff className="w-4 h-4" /></IconBtn>}
        {onHistory && <IconBtn label={pt ? 'Todas as conversas' : 'All chats'} onClick={onHistory}><MessagesSquare className="w-4 h-4" /></IconBtn>}
        {onSettings && <IconBtn label={pt ? 'Ajustes' : 'Settings'} onClick={onSettings}><SlidersHorizontal className="w-4 h-4" /></IconBtn>}
        {onMinimize && <IconBtn label={pt ? 'Minimizar' : 'Minimize'} onClick={onMinimize}><Minus className="w-4 h-4" /></IconBtn>}
      </div>

      {call !== 'off' ? (
        // Chamada: o palco ocupa a área do chat. "Chamando…" e depois o personagem, com as animações da tela de conversa.
        <div className={`relative overflow-hidden ${page ? 'flex-1 min-h-0' : 'h-[min(58dvh,460px)]'}`} style={{ backgroundColor: 'var(--theme-bg)' }}>
          {/* O personagem já carrega por trás do "Chamando…" e aparece assim que ele termina. */}
          <CharacterAvatar stage voice characterId={tutor.id} kind={tutor.female ? 'woman' : 'man'} state={voice.state} speakingText={voice.speakingText} size={190} mood={mood} />
          {call === 'calling' && <div className="absolute inset-0 z-10" style={{ backgroundColor: 'var(--theme-bg)' }}><Calling id={tutor.id} name={tutor.name} pt={pt} /></div>}
          {call === 'live' && (voice.interim || lastAi) && (
            <div className="absolute inset-x-3 bottom-3 z-10 flex flex-col gap-1.5 pointer-events-none">
              {lastAi && voice.state === 'speaking' && <p className="self-start max-w-[90%] rounded-2xl px-3 py-2 text-[13px] leading-snug shadow-sm" style={{ backgroundColor: 'var(--theme-card-bg)', color: 'var(--theme-text)' }}>{lastAi.text}</p>}
              {voice.interim && <p className="self-end max-w-[90%] rounded-2xl px-3 py-2 text-[13px] italic opacity-80" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>{voice.interim}</p>}
            </div>
          )}
        </div>
      ) : (
        <>
          <div ref={scroller} className={`px-3.5 py-3 overflow-y-auto flex flex-col gap-1.5 ${page ? 'flex-1 min-h-0' : 'h-[min(52dvh,400px)]'}`}>
            <div className="mt-auto" />
            {/* Cumprimento do tutor no começo da conversa. */}
            {!history.length && <Bubble mine={false}>{hello}</Bubble>}
            {history.map((m, i) => <Message key={i} m={m} pt={pt} onWord={openWord} />)}
            {voice.interim && <Bubble mine dim>{voice.interim}</Bubble>}
            {voice.state === 'thinking' && <Bubble mine={false} dim><Typing /></Bubble>}
            {examples && (
              <div className="self-stretch rounded-2xl border p-3 mt-1" style={{ borderColor: 'var(--theme-border)' }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12.5px] font-semibold">{examples.title || (pt ? 'Exemplos' : 'Examples')}</p>
                  <button type="button" onClick={() => setExamples(null)} aria-label={pt ? 'Fechar exemplos' : 'Close examples'} className="w-6 h-6 grid place-items-center rounded-full hover:bg-[var(--ui-hover)]"><X className="w-3.5 h-3.5" /></button>
                </div>
                <ul className="mt-1.5 space-y-1.5">{examples.items.map((e, i) => (
                  <li key={i}><p className="font-serif italic text-[14.5px] leading-snug">{e.en}</p>{e.pt && <p className="text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{e.pt}</p>}</li>
                ))}</ul>
              </div>
            )}
            {highlight && (
              <button type="button" onClick={() => saveWord(highlight)}
                className="self-start mt-1 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12.5px] font-medium border" style={{ borderColor: 'var(--theme-border)' }}>
                <BookmarkPlus className="w-3.5 h-3.5" />{pt ? `Salvar “${highlight}”` : `Save “${highlight}”`}
              </button>
            )}
          </div>

          {/* Escrever ou mandar áudio; a chamada fica no telefone do cabeçalho. */}
          <form className="flex items-end gap-2 px-3 pb-3 pt-2 border-t" style={{ borderColor: 'var(--theme-border)' }} onSubmit={e => { e.preventDefault(); send() }}>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={1}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder={pt ? `Mensagem para ${art} ${tutor.name}` : `Message ${tutor.name}`}
              className="flex-1 min-w-0 max-h-28 resize-none rounded-2xl border px-3.5 py-2.5 text-[14px] leading-snug bg-transparent outline-none focus:border-[var(--theme-text-secondary)]"
              style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }} />
            {text.trim()
              ? <button type="submit" aria-label={pt ? 'Enviar' : 'Send'} className="shrink-0 w-10 h-10 rounded-full grid place-items-center" style={{ backgroundColor: 'var(--theme-text)', color: 'var(--theme-bg)' }}><ArrowUp className="w-[18px] h-[18px]" /></button>
              : <button type="button" onClick={audioMessage} aria-label={voice.state === 'listening' ? (pt ? 'Parar' : 'Stop') : (pt ? 'Mandar áudio' : 'Send a voice note')}
                  className="relative shrink-0 w-10 h-10 rounded-full grid place-items-center transition-colors"
                  style={voice.state === 'listening' ? { backgroundColor: 'var(--theme-text)', color: 'var(--theme-bg)' } : { backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text)' }}>
                  <Mic className="w-[18px] h-[18px]" />
                  {voice.state === 'listening' && <motion.span aria-hidden className="absolute inset-0 rounded-full border-2" style={{ borderColor: 'var(--theme-text)' }} animate={{ scale: [1, 1.25], opacity: [0.6, 0] }} transition={{ duration: 1.2, repeat: Infinity }} />}
                </button>}
          </form>
        </>
      )}
      <WordTooltip state={wordTip} status={wordTip ? vocabFor(wordTip.text)?.status ?? null : null}
        onStatus={st => wordTip && setWordStatus(wordTip.text, st)}
        onExplain={() => wordTip && openCard(wordTip.text, 'meaning')}
        onNote={() => wordTip && openCard(wordTip.text, 'notes')}
        onImage={() => wordTip && openCard(wordTip.text, 'images')}
        speaking={tipSpeaking}
        onSpeak={() => { if (!wordTip) return; setTipSpeaking(true); void speak(wordTip.text, { language: 'en', context: 'word', rate: 0.9 }).then(h => h.done).finally(() => setTipSpeaking(false)) }}
        burst={null}
        labels={pt ? { learned: 'Aprendido', review: 'Revisão', important: 'Importante', explain: 'Explicação', note: 'Nota', image: 'Imagem', listen: 'Ouvir a palavra' }
          : { learned: 'Learned', review: 'Review', important: 'Important', explain: 'Explain', note: 'Note', image: 'Image', listen: 'Say this word' }} />
      <VocabularyModal isOpen={!!card} onClose={() => setCard(null)} initialText={card?.text ?? ''} bookId={vocabBook} vocabId={card?.id ?? null} initialTab={card?.tab} autoExplain={card?.tab === 'meaning' && !card?.id} />
    </div>
  )
}

/** Último tutor com quem a pessoa falou; sem conversa ainda, a Bia. */
function lastTutor(active: string | null) {
  return active && CHARACTERS.some(c => c.id === active) ? active : 'bookmoo-mulher'
}

const EMPTY: ChatMessage[] = []

/** Rosto do tutor: a foto em alta (não precisa animar) sobre o tom pastel da roupa dele, com o ponto de online quando pedido. */
function Face({ id, size, online }: { id: string; size: number; online?: boolean }) {
  return (
    <span className="relative shrink-0 block rounded-full" style={{ width: size, height: size }}>
      <img src={characterFaceUrl(id)} alt="" draggable={false} decoding="async"
        className="w-full h-full rounded-full object-cover select-none" style={{ backgroundColor: characterById(id)?.tint ?? 'var(--theme-bg-secondary)' }} />
      {online && <span aria-hidden className="absolute right-0 bottom-0 rounded-full border-2" style={{ width: Math.max(10, size * 0.24), height: Math.max(10, size * 0.24), backgroundColor: '#22c55e', borderColor: 'var(--theme-card-bg)' }} />}
    </span>
  )
}

/** "Chamando…": foto com ondas, como na tela de conversa. */
function Calling({ id, name, pt }: { id: string; name: string; pt: boolean }) {
  return (
    <div role="status" aria-live="polite" className="absolute inset-0 grid place-items-center">
      <div className="flex flex-col items-center gap-5">
        <div className="relative w-28 h-28 grid place-items-center">
          {[0, 0.7, 1.4].map(d => (
            <span key={d} aria-hidden className="absolute inset-0 rounded-full animate-ping" style={{ border: '1.5px solid color-mix(in srgb, var(--theme-text) 28%, transparent)', animationDuration: '2.1s', animationDelay: `${d}s` }} />
          ))}
          <img src={characterAvatarUrl(id)} alt="" className="relative w-24 h-24 rounded-full object-cover"
            style={{ boxShadow: '0 0 0 3px var(--theme-bg), 0 0 0 4px color-mix(in srgb, var(--theme-text) 18%, transparent)' }} />
        </div>
        <div className="text-center">
          <p className="text-[17px] font-medium leading-tight" style={{ color: 'var(--theme-text)' }}>{name}</p>
          <p className="mt-1 text-[13px] flex items-center justify-center gap-1" style={{ color: 'var(--theme-text-secondary)' }}>
            {pt ? 'Chamando' : 'Calling'}
            <span aria-hidden className="inline-flex gap-[3px] ml-0.5">
              {[0, 0.2, 0.4].map(d => <span key={d} className="w-1 h-1 rounded-full animate-bounce" style={{ backgroundColor: 'currentColor', animationDelay: `${d}s`, animationDuration: '1s' }} />)}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

function Message({ m, pt, onWord }: { m: ChatMessage; pt: boolean; onWord?: (w: string, el: HTMLElement, idx: number) => void }) {
  const mine = m.role === 'user'
  return (
    <Bubble mine={mine} meta={`${m.via === 'call' ? (pt ? 'chamada · ' : 'call · ') : m.via === 'voice' ? (pt ? 'áudio · ' : 'voice · ') : ''}${timeOf(m.at, pt)}`}>
      {onWord ? <Words text={m.text} onWord={onWord} seed={m.at} /> : m.text}
    </Bubble>
  )
}

/** Texto com as palavras em inglês clicáveis (abrem o cartão de palavra, como no leitor). */
function Words({ text, onWord, seed }: { text: string; onWord: (w: string, el: HTMLElement, idx: number) => void; seed: number }) {
  // Palavras que já estão no vocabulário aparecem marcadas com a cor do status, como no leitor (vocab-review etc.).
  const vocab = useVocab(s => s.vocabularies)
  const status = useMemo(() => {
    const m = new Map<string, VocabStatus>()
    for (const v of vocab) { const k = v.text.trim().toLowerCase(); if (!k.includes(' ') && !m.has(k)) m.set(k, v.status) }
    return m
  }, [vocab])
  return (
    <>
      {text.split(/([A-Za-z][A-Za-z'’-]*)/).map((part, i) => {
        if (!(i % 2)) return <span key={i}>{part}</span>
        const word = part.replace(/['’-]+$/, '')
        const st = status.get(word.toLowerCase())
        return (
          <span key={i} data-chat-word role="button" tabIndex={-1} onClick={e => onWord(word, e.currentTarget, seed * 1000 + i)}
            className={st ? `vocab-${st} cursor-pointer` : 'cursor-pointer rounded-[3px] decoration-dotted underline-offset-2 hover:underline hover:bg-[var(--ui-hover)]'}>{part}</span>
        )
      })}
    </>
  )
}

function Bubble({ mine, dim, meta, children }: { mine: boolean; dim?: boolean; meta?: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: dim ? 0.7 : 1, y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className={`max-w-[84%] rounded-2xl px-3 py-2 text-[13.5px] leading-snug ${mine ? 'self-end rounded-br-md' : 'self-start rounded-bl-md'}`}
      style={mine ? { backgroundColor: 'var(--pastel-blue-bg)', color: 'var(--theme-text)' } : { backgroundColor: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card-bg))' }}>
      {children}
      {meta && <span className="block mt-0.5 text-[10.5px] text-right tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{meta}</span>}
    </motion.div>
  )
}

function Typing() {
  return (
    <span aria-label="…" className="inline-flex gap-[3px] py-1">
      {[0, 0.2, 0.4].map(d => <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: 'currentColor', animationDelay: `${d}s`, animationDuration: '1s' }} />)}
    </span>
  )
}

function timeOf(at: number, pt: boolean) {
  const d = new Date(at), now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay ? d.toLocaleTimeString(pt ? 'pt-BR' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(pt ? 'pt-BR' : 'en-US', { day: '2-digit', month: '2-digit' })
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

function IconBtn({ label, onClick, children, tone }: { label: string; onClick: () => void; children: React.ReactNode; tone?: 'danger' }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className="shrink-0 w-9 h-9 rounded-full grid place-items-center transition-colors hover:bg-[var(--ui-hover)]"
      style={tone === 'danger' ? { backgroundColor: '#dc2626', color: '#fff' } : { color: 'var(--theme-text-secondary)' }}>
      {children}
    </button>
  )
}

/**
 * Conversas com os tutores na própria página (tela Conversar → Histórico): a mesma conversa do chat flutuante, como um
 * app de mensagens. No desktop, lista à esquerda e chat à direita; no celular, lista e depois o chat.
 */
export function TutorInbox({ onClose, onCall, extra }: { onClose: () => void; onCall?: (id: string) => void; extra?: React.ReactNode }) {
  const pt = useLanguage().locale === 'pt-BR'
  const isMobile = useIsMobile()
  const active = useTutorChats(s => s.active)
  const setActive = useTutorChats(s => s.setActive)
  const chats = useTutorChats(s => s.chats)
  const tutorId = lastTutor(active)
  const [showChat, setShowChat] = useState(!isMobile)
  // No celular, com uma conversa aberta, a tab bar sai (volta ao voltar para a lista ou sair da tela).
  const setChatOpen = useTutorDock(s => s.setChatOpen)
  const fullChat = isMobile && showChat
  useEffect(() => { setChatOpen(fullChat); return () => setChatOpen(false) }, [fullChat, setChatOpen])
  const open = (id: string) => { setActive(id); setShowChat(true) }
  const list = (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <IconBtn label={pt ? 'Voltar para a conversa' : 'Back to the call'} onClick={onClose}><ChevronLeft className="w-[18px] h-[18px]" /></IconBtn>
        <p className="flex-1 text-[17px] font-semibold">{pt ? 'Conversas' : 'Chats'}</p>
        {extra}
      </div>
      <ul className="px-2 pb-3 overflow-y-auto flex-1 min-h-0">
        {CHARACTERS.map(c => {
          const p = personaOf(c.id)
          const last = (chats[c.id] ?? []).at(-1)
          return (
            <li key={c.id}>
              <button type="button" onClick={() => open(c.id)}
                className="w-full flex items-center gap-3 px-2 py-2.5 rounded-2xl text-left transition-colors hover:bg-[var(--ui-hover)]"
                style={c.id === tutorId && showChat ? { backgroundColor: 'var(--theme-bg-secondary)' } : undefined}>
                <Face id={c.id} size={48} online />
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline gap-2">
                    <span className="flex-1 text-[15px] font-semibold truncate">{p.name}</span>
                    {last && <span className="shrink-0 text-[11.5px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{timeOf(last.at, pt)}</span>}
                  </span>
                  <span className="block text-[13px] truncate" style={{ color: 'var(--theme-text-secondary)' }}>
                    {last ? `${last.role === 'user' ? (pt ? 'Você: ' : 'You: ') : ''}${last.text}` : (pt ? `Mande uma mensagem para ${p.female ? 'a' : 'o'} ${p.name}` : `Send ${p.name} a message`)}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
  return (
    // Ocupa o corpo inteiro da página (sem cartão): encosta nas bordas do conteúdo e vai até embaixo.
    <div className={`flex -mx-4 md:-mx-10 -mt-3 md:-mt-8 -mb-6 md:-mb-12 ${fullChat ? 'h-[calc(100dvh-var(--safe-t,0px)-var(--navbar-h,0px))]' : 'h-[calc(100dvh-var(--safe-t,0px)-var(--navbar-h,0px)-var(--tabbar-h,0px)-var(--safe-b,0px))]'} md:h-dvh min-h-[420px]`}
      style={{ backgroundColor: 'var(--theme-bg)' }}>
      {(!isMobile || !showChat) && (
        <div className={`${isMobile ? 'w-full' : 'w-[340px] border-r'} shrink-0 min-h-0`} style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>{list}</div>
      )}
      {showChat && (
        <div className="flex-1 min-w-0 min-h-0">
          <TutorChat key={tutorId} tutor={personaOf(tutorId)} slow={false} page onCall={onCall} onList={isMobile ? () => setShowChat(false) : undefined} />
        </div>
      )}
    </div>
  )
}
