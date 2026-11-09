// Aba "Falar": o aluno lê a página em voz alta e cada palavra é pintada conforme a
// pronúncia reconhecida — verde (certa), amarelo (quase), vermelho (errada ou pulada).
// No fim, um painel mostra a % de acerto, os erros e as palavras para treinar.
//
// Mesmo texto e mesma numeração de palavras do leitor: `wordRegex()` de wordTokens.ts gera
// os mesmos `data-word-index` que o `Reader` desenha em `buildWordsHtml`.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Loader2, Mic, Square, RotateCcw, Volume2, ShieldCheck, Zap, Star, Headphones, Snail, ChevronDown, Check } from 'lucide-react'
import type { Book } from '@/store/useBookStore'
import { ToolButton } from '@/components/ui/toolbar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { sayWord } from '@/lib/sayWord'
import { usePracticeStore, wordList } from '@/store/usePracticeStore'
import { PointsEarned } from '@/components/stats/PointsEarned'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useBookSync } from '@/hooks/useBookSync'
import { useReaderSettings } from '@/store/useReaderSettings'
import { useLanguage } from '@/store/useLanguage'
import { wordRegex, listWords } from '@/lib/wordTokens'
import { alignTranscript, scoreResult, type AlignResult, type WordGrade } from '@/lib/speech/align'
import {
  createRecognizer, defaultEngine, isWebSpeechAvailable, isWhisperAvailable, isWhisperModelCached,
  EngineUnavailableError, MicPermissionError, tokenizeForTimings,
  type EngineId, type Recognizer, type TimedWord,
} from '@/lib/speech/recognizers'

const EN = {
    title: 'Read aloud',
    intro: 'Tap the microphone and read the page in English. Each word turns green, yellow or red depending on your pronunciation.',
    start: 'Start reading',
    stop: 'Done',
    starting: 'Turning on the microphone…',
    listening: 'Listening… read at your own pace',
    loading: 'Downloading the speech recognizer (one time only)…',
    transcribing: 'Analyzing your reading…',
    tryAgain: 'Read again',
    nextPage: 'Next page',
    prevPage: 'Previous page',
    page: 'Page',
    of: 'of',
    legendOk: 'Right',
    legendClose: 'Close',
    legendBad: 'Wrong',
    accuracy: 'accuracy',
    statOk: 'right',
    statClose: 'close',
    errors: 'errors',
    words: 'words',
    readOf: (a: number, t: number) => `You read ${a} of ${t} words`,
    notRead: (n: number) => `${n} ${n === 1 ? 'word was' : 'words were'} not read`,
    practice: 'Words to practice',
    practiceHint: 'Tap to hear the right pronunciation.',
    noPractice: 'No words to practice. Perfect!',
    youSaid: 'Heard',
    skipped: 'skipped',
    hearRight: 'Hear it',
    hearSlow: 'Hear it slowly',
    hearYou: 'Hear yourself',
    engineFast: 'Online · live',
    enginePrivate: 'Offline · on device',
    engineTitle: 'Speech recognition',
    engineWhy: 'Both are free. Choose between seeing colours while you read, or keeping your voice on your computer.',
    privateListening: 'Listening… colours appear when you tap Done',
    engineFastHint: 'Words turn green, yellow or red while you read. Uses the browser recognizer: your audio goes to Google (Chrome/Edge) or Apple (Safari).',
    enginePrivateHint: 'Your audio never leaves the computer and it also works offline. Colours appear only when you finish; downloads ~77 MB the first time. Lets you replay your own reading word by word.',
    switched: 'Browser speech recognition is not available here. Using private mode (on device).',
    micDenied: 'I could not access the microphone. Allow the microphone for this site in your browser settings.',
    unsupported: 'This browser has no speech recognition. Try an up-to-date Chrome, Edge, Safari or Firefox.',
    nothingHeard: 'I did not hear anything. Check your microphone and try again.',
    genericError: 'Something went wrong with speech recognition.',
    emptyPage: 'This page has no text to read.',
    medals: ['Keep practicing!', 'Good job!', 'Great work!', 'Amazing!'],
  }

type S = typeof EN

const PT_BR: S = {
    title: 'Leia em voz alta',
    intro: 'Toque no microfone e leia a página em inglês. Cada palavra vai ficar verde, amarela ou vermelha conforme a sua pronúncia.',
    start: 'Começar a ler',
    stop: 'Terminei',
    starting: 'Ligando o microfone…',
    listening: 'Ouvindo… leia no seu ritmo',
    loading: 'Baixando o reconhecedor de voz (uma vez só)…',
    transcribing: 'Analisando a sua leitura…',
    tryAgain: 'Ler de novo',
    nextPage: 'Próxima página',
    prevPage: 'Página anterior',
    page: 'Página',
    of: 'de',
    legendOk: 'Certa',
    legendClose: 'Quase',
    legendBad: 'Errada',
    accuracy: 'de acerto',
    statOk: 'certas',
    statClose: 'quase',
    errors: 'erros',
    words: 'palavras',
    readOf: (a: number, t: number) => `Você leu ${a} de ${t} palavras`,
    notRead: (n: number) => `${n} ${n === 1 ? 'palavra ficou' : 'palavras ficaram'} sem ler`,
    practice: 'Palavras para treinar',
    practiceHint: 'Toque para ouvir a pronúncia certa.',
    noPractice: 'Nenhuma palavra para treinar. Perfeito!',
    youSaid: 'Ouvi',
    skipped: 'pulada',
    hearRight: 'Ouvir certo',
    hearSlow: 'Ouvir devagar',
    hearYou: 'Ouvir você',
    engineFast: 'Online · ao vivo',
    enginePrivate: 'Offline · no aparelho',
    engineTitle: 'Reconhecimento de voz',
    engineWhy: 'Os dois são grátis. Escolha entre ver as cores enquanto lê ou manter sua voz no seu computador.',
    privateListening: 'Ouvindo… as cores aparecem quando você tocar em Terminei',
    engineFastHint: 'As palavras ficam verdes, amarelas ou vermelhas enquanto você lê. Usa o reconhecedor do navegador: seu áudio vai para o Google (Chrome/Edge) ou a Apple (Safari).',
    enginePrivateHint: 'Seu áudio não sai do computador e funciona até sem internet. As cores aparecem só quando você termina; baixa ~77 MB na primeira vez. Permite ouvir a sua própria leitura palavra por palavra.',
    switched: 'O reconhecimento do navegador não está disponível aqui. Usando o modo privado (no aparelho).',
    micDenied: 'Não consegui acessar o microfone. Libere o microfone para este site nas configurações do navegador.',
    unsupported: 'Este navegador não tem reconhecimento de voz. Tente o Chrome, Edge, Safari ou Firefox atualizado.',
    nothingHeard: 'Não ouvi nada. Verifique o microfone e tente de novo.',
    genericError: 'Algo deu errado no reconhecimento de voz.',
    emptyPage: 'Esta página não tem texto para ler.',
    medals: ['Continue treinando!', 'Bom trabalho!', 'Muito bem!', 'Incrível!'],
  }

const STRINGS: Record<'pt-BR' | 'en', S> = { 'pt-BR': PT_BR, en: EN }

type Phase = 'idle' | 'starting' | 'listening' | 'loading' | 'transcribing' | 'done'

const LS_PRIVATE = 'bookmoo.speak.private'
function readPreferPrivate() {
  try { return localStorage.getItem(LS_PRIVATE) === '1' } catch { return false }
}

const GRADE_CLASS: Record<WordGrade, string> = {
  ok: 'speak-ok',
  close: 'speak-close',
  bad: 'speak-bad',
  pending: 'speak-pending',
}

interface Props { book: Book }

export function SpeakPractice({ book }: Props) {
  const { locale } = useLanguage()
  const s = STRINGS[locale === 'pt-BR' ? 'pt-BR' : 'en']
  const { theme, fontSize, lineHeight, fontFamily } = useReaderSettings()
  const readerFontFamily = fontFamily === 'sans' ? '"Inter", ui-sans-serif, system-ui, sans-serif' : '"Playfair Display", ui-serif, Georgia, serif'
  const { updateBookAndSync } = useBookSync()
  const { session, hasSupabase } = useAuth()
  const userId = session?.user?.id

  const pages = book.pages || [book.content]
  const currentPage = book.currentPage || 0
  const currentContent = pages[currentPage] || ''

  // Mesma tokenização do leitor → mesmos índices de palavra.
  const pageWords = useMemo(() => listWords(currentContent), [currentContent])
  const segments = useMemo(() => {
    const out: Array<{ text: string; idx: number | null }> = []
    let last = 0
    let idx = 0
    for (const m of currentContent.matchAll(wordRegex())) {
      if (m.index! > last) out.push({ text: currentContent.slice(last, m.index), idx: null })
      out.push({ text: m[0], idx: idx++ })
      last = m.index! + m[0].length
    }
    if (last < currentContent.length) out.push({ text: currentContent.slice(last), idx: null })
    return out
  }, [currentContent])

  const [preferPrivate, setPreferPrivate] = useState(readPreferPrivate)
  const [engine, setEngine] = useState<EngineId | null>(() => defaultEngine(readPreferPrivate()))
  const [phase, setPhase] = useState<Phase>('idle')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modelProgress, setModelProgress] = useState<number | null>(null)
  const [transcript, setTranscript] = useState('')
  const [result, setResult] = useState<AlignResult | null>(null)
  const [timings, setTimings] = useState<TimedWord[] | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  // Igual ao Google: tocar de novo na mesma palavra fala mais devagar.
  const [slowNext, setSlowNext] = useState(false)
  useEffect(() => { setSlowNext(false) }, [selected])
  const recRef = useRef<Recognizer | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const articleRef = useRef<HTMLElement | null>(null)

  // Resultado ao vivo (Web Speech): realinha a transcrição no máximo ~4×/s.
  const [liveResult, setLiveResult] = useState<AlignResult | null>(null)
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (phase !== 'listening' || !transcript) return
    if (liveTimer.current) return
    liveTimer.current = setTimeout(() => {
      liveTimer.current = null
      setLiveResult(alignTranscript(pageWords, transcriptRef.current))
    }, 250)
  }, [transcript, phase, pageWords])
  const transcriptRef = useRef('')
  transcriptRef.current = transcript

  const shown = result ?? (phase === 'listening' ? liveResult : null)
  const score = useMemo(() => (result ? scoreResult(result) : null), [result])

  // Rola a tela acompanhando a leitura ao vivo.
  const lastReached = shown?.lastReached ?? -1
  useEffect(() => {
    if (phase !== 'listening' || lastReached < 0) return
    const el = articleRef.current?.querySelector(`[data-word-index="${lastReached}"]`) as HTMLElement | null
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.top > window.innerHeight * 0.7 || r.top < 80) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [lastReached, phase])

  const reset = useCallback(() => {
    recRef.current?.abort()
    recRef.current = null
    setPhase('idle')
    setTranscript('')
    setResult(null)
    setLiveResult(null)
    setTimings(null)
    setSelected(null)
    setError(null)
    setModelProgress(null)
    setAudioUrl((u) => { if (u) URL.revokeObjectURL(u); return null })
  }, [])

  // Trocar de página (ou de livro) zera a tentativa.
  useEffect(() => { reset() }, [currentPage, book.id, reset])
  useEffect(() => () => { recRef.current?.abort() }, [])

  const begin = async (eng: EngineId) => {
    reset()
    setNotice((n) => (eng === 'whisper' && n ? n : null))
    setPhase('starting')
    const rec = createRecognizer(eng, {
      onTranscript: (t) => setTranscript(t),
      onModelProgress: (f) => setModelProgress(f),
      onPhase: (p) => setPhase(p === 'recording' ? 'listening' : p),
    })
    recRef.current = rec
    try {
      await rec.start()
      setPhase('listening')
    } catch (e) {
      recRef.current = null
      if (e instanceof MicPermissionError) { setPhase('idle'); setError(s.micDenied); return }
      if (eng === 'webspeech' && isWhisperAvailable()) {
        // fallback automático para o modo privado
        setEngine('whisper')
        setNotice(s.switched)
        return begin('whisper')
      }
      setPhase('idle')
      setError(e instanceof EngineUnavailableError ? s.unsupported : s.genericError)
    }
  }

  const finish = async () => {
    const rec = recRef.current
    if (!rec) return
    if (rec.engine === 'webspeech') setPhase('transcribing')
    try {
      const out = await rec.stop()
      recRef.current = null
      // Whisper: alinhamos as palavras com tempo, para o aluno ouvir cada uma.
      const tokens = out.words ? tokenizeForTimings(out.words) : null
      const final = alignTranscript(pageWords, tokens ? tokens.map((t) => t.text) : out.text, { final: true })
      if (final.lastReached < 0) {
        setPhase('idle')
        setError(s.nothingHeard)
        return
      }
      if (import.meta.env.DEV) (window as unknown as { __speakDebug: unknown }).__speakDebug = { text: out.text, result: final }
      setTranscript(out.text)
      setTimings(tokens)
      if (out.audio) setAudioUrl(URL.createObjectURL(out.audio))
      setResult(final)
      setPhase('done')
      // Guarda a tentativa para as estatísticas (nota da página e palavras a treinar).
      const sc = scoreResult(final)
      usePracticeStore.getState().add({
        kind: 'speak', bookId: book.id, bookTitle: book.title, page: currentPage,
        accuracy: sc.accuracy, ok: sc.ok, close: sc.close, errors: sc.errors, total: sc.total,
        missed: wordList(final.words.filter(w => w.grade === 'bad' || w.grade === 'close').map(w => w.expected)),
        words: {
          ok: wordList(final.words.filter(w => w.grade === 'ok').map(w => w.expected)),
          close: wordList(final.words.filter(w => w.grade === 'close').map(w => w.expected)),
          bad: wordList(final.words.filter(w => w.grade === 'bad' && w.heard).map(w => w.expected)),
          skipped: wordList(final.words.filter(w => (w.grade === 'bad' && !w.heard) || w.grade === 'pending').map(w => w.expected)),
        },
      }, hasSupabase && supabase && userId ? { supabase, userId } : null)
    } catch (e) {
      recRef.current = null
      if (rec.engine === 'webspeech' && e instanceof EngineUnavailableError && isWhisperAvailable()) {
        setEngine('whisper')
        setNotice(s.switched)
        setPhase('idle')
        return
      }
      setPhase('idle')
      setError(e instanceof Error && e.message === 'aborted' ? null : s.genericError)
    }
  }

  const chooseEngine = (eng: EngineId) => {
    if (phase === 'listening' || phase === 'starting' || phase === 'transcribing' || phase === 'loading') return
    setEngine(eng)
    setNotice(null)
    const priv = eng === 'whisper'
    setPreferPrivate(priv)
    try { localStorage.setItem(LS_PRIVATE, priv ? '1' : '0') } catch { /* ignore */ }
  }

  const goToPage = (index: number) => {
    const newPage = Math.max(0, Math.min(pages.length - 1, index))
    if (newPage === currentPage) return
    const total = book.totalPages && book.totalPages > 0 ? book.totalPages : pages.length
    const progress = total > 0 ? Math.min(100, Math.round((pages.length / total) * 100)) : 0
    updateBookAndSync(book.id, { currentPage: newPage, progress, lastRead: Date.now() })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const playYou = (wordIdx: number) => {
    const w = result?.words[wordIdx]
    if (!w?.heardRange || !timings || !audioRef.current) return
    const a = timings[w.heardRange[0]]
    const b = timings[w.heardRange[1]]
    if (!a || !b) return
    const el = audioRef.current
    const from = Math.max(0, a.start - 0.08)
    const to = b.end + 0.12
    el.currentTime = from
    void el.play()
    const stopAt = () => { if (el.currentTime >= to) { el.pause(); el.removeEventListener('timeupdate', stopAt) } }
    el.addEventListener('timeupdate', stopAt)
  }

  const practiceWords = useMemo(() => {
    if (!result) return []
    const seen = new Set<string>()
    return result.words
      .filter((w) => w.grade === 'bad' || w.grade === 'close')
      .sort((a, b) => (a.grade === b.grade ? 0 : a.grade === 'bad' ? -1 : 1))
      .filter((w) => { const k = w.expected.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
      .slice(0, 24)
  }, [result])

  const busy = phase === 'starting' || phase === 'listening' || phase === 'loading' || phase === 'transcribing'
  const sel = selected !== null && result ? result.words[selected] : null
  const canHearYou = !!(sel?.heardRange && timings && audioUrl)
  const nextIdx = phase === 'listening' ? lastReached + 1 : -1

  return (
    <div className={`reader-root min-h-full transition-colors duration-300 theme-${theme} pb-40`}>
      <div className="max-w-[720px] mx-auto pt-6 md:pt-10 px-4 md:px-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
          <div>
            <h1 className="font-semibold tracking-tight" style={{ fontSize: '1.25em', fontFamily: 'var(--font-sans)', color: 'var(--theme-text)' }}>{book.title}</h1>
            <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{s.page} {currentPage + 1} {s.of} {pages.length}</p>
          </div>
          <EngineSwitch engine={engine} onChange={chooseEngine} disabled={busy} s={s} />
        </div>

        {phase === 'idle' && !result && (
          <div className="mb-6 rounded-2xl border p-4 text-sm flex gap-3 items-start" style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-subtle)', color: 'var(--theme-text-secondary)' }}>
            <Mic className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--theme-primary)' }} />
            <div className="space-y-2">
              <p><strong style={{ color: 'var(--theme-text)' }}>{s.title}.</strong> {s.intro}</p>
              <Legend s={s} />
            </div>
          </div>
        )}

        {(notice || error) && (
          <div className="mb-4 rounded-xl border px-4 py-3 text-sm" role="status" style={{ borderColor: error ? '#F0524F' : 'var(--theme-border-subtle)', color: error ? '#C2312E' : 'var(--theme-text-secondary)', backgroundColor: 'var(--theme-bg-secondary)' }}>
            {error ?? notice}
          </div>
        )}

        {score && result && (
          <ScorePanel score={score} s={s} practiceWords={practiceWords} onPick={(i) => { setSelected(i); setSlowNext(!sayWord(result.words[i].expected)) }} />
        )}
        {score && result && (
          <div className="-mt-6 mb-8"><PointsEarned kind="speak" bookId={book.id} page={currentPage} pt={locale === 'pt-BR'} /></div>
        )}

        {pageWords.length === 0 ? (
          <p style={{ color: 'var(--theme-text-secondary)' }}>{s.emptyPage}</p>
        ) : (
          <article
            ref={articleRef}
            className="whitespace-pre-wrap relative select-none"
            style={{ fontFamily: readerFontFamily, fontSize: `${fontSize}px`, lineHeight, color: 'var(--theme-text)' }}
          >
            {segments.map((seg, k) => {
              if (seg.idx === null) return <span key={k}>{seg.text}</span>
              const w = shown?.words[seg.idx]
              const grade = w?.grade ?? 'pending'
              const cls = `word-span speak-word ${GRADE_CLASS[grade]}${seg.idx === nextIdx ? ' speak-next' : ''}${selected === seg.idx ? ' speak-selected' : ''}`
              return (
                <span
                  key={k}
                  data-word-index={seg.idx}
                  className={cls}
                  onClick={result ? () => setSelected(seg.idx) : undefined}
                  style={result ? { cursor: 'pointer' } : undefined}
                >
                  {seg.text}
                </span>
              )
            })}
          </article>
        )}

        {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" className="hidden" />}
      </div>

      {/* Barra flutuante: microfone, estado e navegação — mesma posição da barra do leitor */}
      <div className="fixed left-2 right-2 md:left-[var(--sidebar-w,16rem)] md:right-8 md:bottom-8 z-40 flex flex-col items-center gap-2" style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <AnimatePresence>
          {sel && (
            <motion.div
              key={selected}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="rounded-2xl border shadow-xl px-4 py-3 flex flex-wrap items-center gap-3 text-sm max-w-full"
              style={{ backgroundColor: 'var(--theme-nav-bg)', borderColor: 'var(--theme-border-subtle)', color: 'var(--theme-text)' }}
            >
              <span className={`speak-word ${GRADE_CLASS[sel.grade]} font-semibold text-base`}>{sel.expected}</span>
              <span style={{ color: 'var(--theme-text-secondary)' }}>
                {s.youSaid}: <em>{sel.heard ?? `— (${s.skipped})`}</em>
              </span>
              <button type="button" className="btn-3d btn-3d--explain text-xs" onClick={() => setSlowNext(!sayWord(sel.expected))}>
                {slowNext ? <Snail className="w-3.5 h-3.5" strokeWidth={2.5} /> : <Volume2 className="w-3.5 h-3.5" strokeWidth={3} />} {slowNext ? s.hearSlow : s.hearRight}
              </button>
              {canHearYou && (
                <button type="button" className="btn-3d btn-3d--important text-xs" onClick={() => playYou(selected!)}>
                  <Headphones className="w-3.5 h-3.5" strokeWidth={3} /> {s.hearYou}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="backdrop-blur-md border p-2.5 rounded-full shadow-2xl flex items-center justify-between gap-2 w-full md:w-auto"
          style={{ backgroundColor: 'var(--theme-nav-bg)', borderColor: 'var(--theme-border-subtle)' }}
        >
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 0 || busy}
            className="flex items-center justify-center w-12 h-12 rounded-full transition-colors shrink-0 disabled:opacity-40 hover:bg-[var(--theme-nav-hover)]"
            style={{ color: 'var(--theme-nav-text)' }}
            title={s.prevPage}
            aria-label={s.prevPage}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 min-w-0 px-1">
            {phase === 'listening' ? (
              <button type="button" onClick={finish} className="btn-3d btn-3d--review text-sm !px-5 !py-3 speak-mic-live" aria-label={s.stop}>
                <Square className="w-4 h-4" fill="currentColor" /> {s.stop}
              </button>
            ) : phase === 'done' ? (
              <>
                <button type="button" onClick={() => engine && begin(engine)} className="btn-3d btn-3d--explain text-sm !px-4 !py-3">
                  <RotateCcw className="w-4 h-4" strokeWidth={3} /> {s.tryAgain}
                </button>
                {currentPage < pages.length - 1 && (
                  <button type="button" onClick={() => goToPage(currentPage + 1)} className="btn-3d btn-3d--learned text-sm !px-4 !py-3">
                    {s.nextPage} <ChevronRight className="w-4 h-4" strokeWidth={3} />
                  </button>
                )}
              </>
            ) : busy ? (
              <div className="flex items-center gap-2 px-3 py-2 text-sm" style={{ color: 'var(--theme-nav-text)' }}>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="truncate">
                  {phase === 'starting' ? s.starting : phase === 'loading' ? s.loading : s.transcribing}
                  {phase === 'loading' && modelProgress !== null ? ` ${Math.round(modelProgress * 100)}%` : ''}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => engine && begin(engine)}
                disabled={!engine || pageWords.length === 0}
                className="btn-3d btn-3d--learned text-sm !px-5 !py-3 disabled:opacity-50"
              >
                <Mic className="w-4 h-4" strokeWidth={3} /> {s.start}
              </button>
            )}
            {phase === 'listening' && (
              <span className="hidden sm:inline text-sm truncate" style={{ color: 'var(--theme-nav-text-muted)' }}>
                {engine === 'whisper' ? s.privateListening : `${s.listening} · ${Math.max(0, lastReached + 1)}/${pageWords.length}`}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= pages.length - 1 || busy}
            className="flex items-center justify-center w-12 h-12 rounded-full transition-colors shrink-0 disabled:opacity-40 hover:bg-[var(--theme-nav-hover)]"
            style={{ color: 'var(--theme-nav-text)' }}
            title={s.nextPage}
            aria-label={s.nextPage}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function Legend({ s }: { s: S }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="speak-word speak-ok">{s.legendOk}</span>
      <span className="speak-word speak-close">{s.legendClose}</span>
      <span className="speak-word speak-bad">{s.legendBad}</span>
    </div>
  )
}

function EngineSwitch({ engine, onChange, disabled, s }: { engine: EngineId | null; onChange: (e: EngineId) => void; disabled: boolean; s: S }) {
  const [open, setOpen] = useState(false)
  const options: Array<{ id: EngineId; label: string; hint: string; icon: typeof Zap; available: boolean }> = [
    { id: 'webspeech' as EngineId, label: s.engineFast, hint: s.engineFastHint, icon: Zap, available: isWebSpeechAvailable() },
    { id: 'whisper' as EngineId, label: s.enginePrivate, hint: s.enginePrivateHint + (isWhisperModelCached() ? ' ✓' : ''), icon: ShieldCheck, available: isWhisperAvailable() },
  ].filter(o => o.available)
  const current = options.find(o => o.id === engine) ?? options[0]
  if (!current) return null
  const CurrentIcon = current.icon
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ToolButton disabled={disabled} icon={<CurrentIcon className="w-4 h-4" />} hint={s.engineTitle}
          label={<>{current.label} <ChevronDown className="inline w-3.5 h-3.5 opacity-60" /></>}
          className="border self-start sm:self-auto" style={{ borderColor: 'var(--theme-border-subtle)' }} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,360px)] p-2 rounded-2xl shadow-2xl border z-50"
        style={{ backgroundColor: 'var(--theme-nav-bg)', borderColor: 'var(--theme-border-subtle)', color: 'var(--theme-text)' }}>
        <p className="px-2 pt-1 text-sm font-semibold">{s.engineTitle}</p>
        <p className="px-2 pb-2 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>{s.engineWhy}</p>
        {options.map(({ id, label, hint, icon: Icon }) => (
          <button key={id} type="button" onClick={() => { onChange(id); setOpen(false) }}
            className="w-full flex items-start gap-3 p-2.5 rounded-xl text-left hover:bg-[var(--theme-nav-hover)]"
            style={{ boxShadow: engine === id ? 'inset 0 0 0 1.5px var(--theme-accent, #7756c6)' : undefined }}>
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="flex-1">
              <span className="flex items-center gap-1 text-sm font-medium">{label}{engine === id && <Check className="w-3.5 h-3.5" />}</span>
              <span className="block text-xs mt-0.5 leading-snug" style={{ color: 'var(--theme-text-secondary)' }}>{hint}</span>
            </span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

function ScorePanel({ score, s, practiceWords, onPick }: {
  score: ReturnType<typeof scoreResult>
  s: S
  practiceWords: AlignResult['words']
  onPick: (idx: number) => void
}) {
  const [shownPct, setShownPct] = useState(0)
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 900)
      setShownPct(Math.round(score.accuracy * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [score.accuracy])

  const stars = score.accuracy >= 95 ? 3 : score.accuracy >= 80 ? 2 : score.accuracy >= 60 ? 1 : 0
  const ringColor = score.accuracy >= 80 ? '#34C46F' : score.accuracy >= 60 ? '#FFAE2B' : '#F0524F'
  const R = 46
  const C = 2 * Math.PI * R

  return (
    <motion.section
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="mb-8 rounded-3xl border p-5 md:p-6"
      style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-subtle)', fontFamily: 'var(--font-sans)' }}
      aria-live="polite"
    >
      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div className="relative w-32 h-32 shrink-0">
          <svg viewBox="0 0 110 110" className="w-full h-full -rotate-90">
            <circle cx="55" cy="55" r={R} fill="none" stroke="var(--theme-border-subtle)" strokeWidth="10" />
            <circle cx="55" cy="55" r={R} fill="none" stroke={ringColor} strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - shownPct / 100)} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold tabular-nums" style={{ color: 'var(--theme-text)', fontFamily: "'Fredoka', system-ui, sans-serif" }}>{shownPct}%</span>
            <span className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--theme-text-secondary)' }}>{s.accuracy}</span>
          </div>
        </div>

        <div className="flex-1 w-full text-center sm:text-left space-y-3">
          <div className="flex items-center justify-center sm:justify-start gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.5 + i * 0.18, type: 'spring', stiffness: 500, damping: 15 }}>
                <Star className="w-7 h-7" fill={i < stars ? '#FFC83D' : 'none'} stroke={i < stars ? '#E0A800' : 'var(--theme-text-secondary)'} strokeWidth={2} />
              </motion.span>
            ))}
            <span className="ml-2 text-lg font-semibold" style={{ color: 'var(--theme-text)', fontFamily: "'Fredoka', system-ui, sans-serif" }}>{s.medals[stars]}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat value={score.ok} label={s.statOk} color="#34C46F" />
            <Stat value={score.close} label={s.statClose} color="#E59A12" />
            <Stat value={score.errors} label={s.errors} color="#F0524F" />
            <Stat value={score.total} label={s.words} color="var(--theme-primary)" />
          </div>
          <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
            {s.readOf(score.attempted, score.total)}
            {score.missed > 0 ? ` · ${s.notRead(score.missed)}` : ''}
          </p>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--theme-border-subtle)' }}>
        <p className="text-sm font-semibold mb-1" style={{ color: 'var(--theme-text)' }}>{s.practice}</p>
        {practiceWords.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{s.noPractice}</p>
        ) : (
          <>
            <p className="text-xs mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{s.practiceHint}</p>
            <div className="flex flex-wrap gap-2">
              {practiceWords.map((w) => (
                <button key={w.index} type="button" onClick={() => onPick(w.index)} className={`speak-word speak-chip ${GRADE_CLASS[w.grade]} text-sm inline-flex items-center gap-1`}>
                  <Volume2 className="w-3.5 h-3.5 opacity-70" /> {w.expected}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </motion.section>
  )
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="rounded-2xl border px-2 py-2.5 text-center" style={{ borderColor: 'var(--theme-border-subtle)', backgroundColor: 'var(--theme-bg)' }}>
      <div className="text-2xl font-bold tabular-nums leading-none" style={{ color, fontFamily: "'Fredoka', system-ui, sans-serif" }}>{value}</div>
      <div className="text-[11px] mt-1 leading-tight" style={{ color: 'var(--theme-text-secondary)' }}>{label}</div>
    </div>
  )
}
