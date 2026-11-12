// Treino de ditado (aba Escrever): o app fala cada palavra da página, repetindo (normal e depois
// devagar), e o aluno digita. Acertou → próxima palavra e +1. Errou → mais uma chance; se errar
// de novo, mostra a resposta e segue. No fim: % de acerto, estrelas e palavras para treinar.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Keyboard, RotateCcw, SkipForward, Snail, Square, Star, Volume2 } from 'lucide-react'
import type { Book } from '@/store/useBookStore'
import { useBookSync } from '@/hooks/useBookSync'
import { useLanguage } from '@/store/useLanguage'
import { useReaderSettings } from '@/store/useReaderSettings'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { WORD_PATTERN } from '@/lib/wordTokens'
import { sayWord } from '@/lib/sayWord'
import { stopSpeaking } from '@/lib/tts'
import { PointsEarned } from '@/components/stats/PointsEarned'
import { needsVoiceInstall } from '@/components/reader/VoiceRequiredDialog'
import { askVoiceOnce } from '@/lib/voiceGate'
import { starsFor, usePracticeStore, wordList } from '@/store/usePracticeStore'

type Grade = 'ok' | 'close' | 'bad' | 'skip'

// Unidade do ditado: palavra com apóstrofo ("I’m") ou composta por hífen ("sixty-seven-year-old")
// é ditada e conferida inteira.
const unitRegex = () => new RegExp(`${WORD_PATTERN}(?:[-‐‑][\\p{L}\\p{N}_]+(?:['’][\\p{L}\\p{N}_]+)*)*`, 'gu')
/** Grafia exata (ignora maiúsculas, tipo de apóstrofo e hífen × espaço). */
const strict = (w: string) => w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘`´]/g, "'")
  .replace(/[-‐‑–\s]+/g, '-').replace(/[^a-z0-9'-]/g, '').replace(/^-+|-+$/g, '')
/** Sem apóstrofo nem hífen: "im" = "I’m", "sixtyseven" = "sixty-seven". */
const loose = (w: string) => strict(w).replace(/['-]/g, '')
const norm = (w: string) => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`´]/g, "'").replace(/[^a-z0-9']/g, '')

function similarity(a: string, b: string) {
  if (a === b) return 1
  const m = a.length, n = b.length
  if (!m || !n) return 0
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 1; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  }
  return 1 - d[m][n] / Math.max(m, n)
}

const T = {
  'pt-BR': {
    title: 'Ditado', intro: 'Ouça a palavra e digite. O app repete normal e depois devagar. Acertou, vai para a próxima.',
    start: 'Começar ditado', placeholder: 'Digite a palavra que ouviu…', hear: 'Ouvir', slow: 'Devagar', skip: 'Não sei',
    stop: 'Parar', tryAgain: 'Quase! Tente de novo.', spelling: 'Quase! Escreve-se assim:', hintApostrophe: 'tem apóstrofo ( ’ )', hintHyphen: 'palavras ligadas por hífen ( - )', answer: 'Era', of: 'de', words: 'palavras', accuracy: 'de acerto',
    right: 'certas', close: 'na 2ª tentativa', wrong: 'erros', practice: 'Palavras para treinar', none: 'Nenhuma. Perfeito!',
    again: 'Fazer de novo', next: 'Próxima página', prev: 'Página anterior', page: 'Página', empty: 'Esta página não tem palavras.',
    medals: ['Continue treinando!', 'Bom trabalho!', 'Muito bem!', 'Incrível!'], hint: 'Enter confirma · Esc ouve de novo · Parar encerra sem salvar',
  },
  en: {
    title: 'Dictation', intro: 'Listen to the word and type it. It repeats at normal speed, then slowly. Get it right to move on.',
    start: 'Start dictation', placeholder: 'Type the word you heard…', hear: 'Hear', slow: 'Slowly', skip: "Don't know",
    stop: 'Stop', tryAgain: 'Close! Try again.', spelling: 'Almost! It is spelled:', hintApostrophe: 'has an apostrophe ( ’ )', hintHyphen: 'words joined by a hyphen ( - )', answer: 'It was', of: 'of', words: 'words', accuracy: 'accuracy',
    right: 'right', close: 'on 2nd try', wrong: 'wrong', practice: 'Words to practice', none: 'None. Perfect!',
    again: 'Do it again', next: 'Next page', prev: 'Previous page', page: 'Page', empty: 'This page has no words.',
    medals: ['Keep practicing!', 'Good job!', 'Great work!', 'Amazing!'], hint: 'Enter checks · Esc repeats · Stop ends without saving',
  },
}

export function DictationPractice({ book }: { book: Book }) {
  const { locale } = useLanguage()
  const t = T[locale === 'pt-BR' ? 'pt-BR' : 'en']
  const { fontSize, lineHeight, fontFamily } = useReaderSettings()
  const readerFont = fontFamily === 'sans' ? '"Inter", ui-sans-serif, system-ui, sans-serif' : '"Playfair Display", ui-serif, Georgia, serif'
  const { updateBookAndSync } = useBookSync()
  const { session, hasSupabase } = useAuth()
  const userId = session?.user?.id

  const pages = book.pages?.length ? book.pages : [book.content]
  const page = book.currentPage || 0
  const text = pages[page] || ''
  const segments = useMemo(() => {
    const out: { text: string; idx: number | null }[] = []
    let last = 0, idx = 0
    for (const m of text.matchAll(unitRegex())) {
      if (m.index! > last) out.push({ text: text.slice(last, m.index), idx: null })
      out.push({ text: m[0], idx: idx++ })
      last = m.index! + m[0].length
    }
    if (last < text.length) out.push({ text: text.slice(last), idx: null })
    return out
  }, [text])
  const words = useMemo(() => segments.filter(s => s.idx !== null).map(s => s.text), [segments])

  const [started, setStarted] = useState(false)
  const [current, setCurrent] = useState(0)
  const [grades, setGrades] = useState<Grade[]>([])
  const [input, setInput] = useState('')
  const [secondTry, setSecondTry] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'retry' | 'answer' | 'spelling'; word?: string } | null>(null)
  const [burst, setBurst] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const loop = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Avanço agendado depois de mostrar a resposta; o Parar cancela.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const done = started && current >= words.length

  const stopLoop = () => { if (loop.current) clearTimeout(loop.current); loop.current = null }
  // Fala a palavra e repete: normal → devagar → normal → devagar, depois espera o aluno.
  const play = useCallback((index: number) => {
    stopLoop()
    const word = words[index]
    if (!word) return
    let n = 0
    const step = () => {
      sayWord(word, n % 2 === 1)
      n++
      if (n < 4) loop.current = setTimeout(step, n % 2 === 1 ? 2400 : 1900)
    }
    step()
  }, [words])

  const reset = useCallback(() => {
    stopLoop(); stopSpeaking()
    if (pending.current) { clearTimeout(pending.current); pending.current = null }
    setStarted(false); setCurrent(0); setGrades([]); setInput(''); setSecondTry(false); setFeedback(null)
  }, [])
  useEffect(() => { reset() }, [page, book.id, reset])
  useEffect(() => () => { stopLoop(); stopSpeaking() }, [])
  useEffect(() => {
    if (!started || done) return
    play(current)
    inputRef.current?.focus()
  }, [current, started, done, play])

  const advance = (grade: Grade) => {
    setGrades(g => { const next = [...g]; next[current] = grade; return next })
    setInput(''); setSecondTry(false)
    if (grade === 'ok') setBurst(b => b + 1)
    setCurrent(c => c + 1)
  }

  const check = () => {
    const word = words[current]
    if (!word || feedback?.kind === 'answer') return
    if (!loose(input)) return
    if (strict(input) === strict(word)) { setFeedback(null); advance(secondTry ? 'close' : 'ok'); return }
    // Só faltou (ou sobrou) o apóstrofo / hífen: conta como quase e mostra a grafia certa.
    if (loose(input) === loose(word)) {
      stopLoop()
      setFeedback({ kind: 'spelling', word })
      pending.current = setTimeout(() => { pending.current = null; setFeedback(null); advance('close') }, 1500)
      return
    }
    if (!secondTry && similarity(loose(input), loose(word)) >= 0.5) { setSecondTry(true); setFeedback({ kind: 'retry' }); setInput(''); play(current); return }
    giveUp()
  }
  const giveUp = (skipped = false) => {
    const word = words[current]
    stopLoop()
    setFeedback({ kind: 'answer', word })
    sayWord(word, true)
    pending.current = setTimeout(() => { pending.current = null; setFeedback(null); advance(skipped ? 'skip' : 'bad') }, 1600)
  }

  // Ao terminar a página, grava o resultado para as estatísticas.
  const saved = useRef(false)
  const ok = grades.filter(g => g === 'ok').length
  const close = grades.filter(g => g === 'close').length
  const bad = grades.filter(g => g === 'bad' || g === 'skip').length
  const accuracy = words.length ? Math.round(((ok + close * 0.5) / words.length) * 100) : 0
  const missed = useMemo(() => [...new Set(words.filter((_, i) => grades[i] && grades[i] !== 'ok').map(w => norm(w)))], [words, grades])
  useEffect(() => {
    if (!done) { saved.current = false; return }
    if (saved.current) return
    saved.current = true
    usePracticeStore.getState().add({
      kind: 'write', bookId: book.id, bookTitle: book.title, page, accuracy, ok, close, errors: bad, total: words.length, missed,
      words: {
        ok: wordList(words.filter((_, i) => grades[i] === 'ok')),
        close: wordList(words.filter((_, i) => grades[i] === 'close')),
        bad: wordList(words.filter((_, i) => grades[i] === 'bad')),
        skipped: wordList(words.filter((_, i) => grades[i] === 'skip')),
      },
    }, hasSupabase && supabase && userId ? { supabase, userId } : null)
  }, [done]) // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(pages.length - 1, index))
    if (next !== page) updateBookAndSync(book.id, { currentPage: next, lastRead: Date.now() })
  }

  const stars = starsFor(accuracy)
  const surface = { backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-subtle)' }

  return (
    <div className="max-w-[720px] mx-auto pb-40 px-1">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--theme-text)' }}>{t.title}</h2>
          <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{t.page} {page + 1} {t.of} {pages.length} · {words.length} {t.words}</p>
        </div>
        {started && !done && (
          <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{current + 1}/{words.length}</span>
        )}
      </div>

      {!started && (
        <div className="mb-6 rounded-2xl border p-4 text-sm flex gap-3 items-start" style={{ ...surface, color: 'var(--theme-text-secondary)' }}>
          <Keyboard className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--theme-primary)' }} />
          <p><strong style={{ color: 'var(--theme-text)' }}>{t.title}.</strong> {t.intro}</p>
        </div>
      )}

      {done && (
        <motion.section initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-3xl border p-5" style={surface}>
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="text-center">
              <div className="text-4xl font-bold tabular-nums" style={{ color: 'var(--theme-text)', fontFamily: 'var(--font-sans)' }}>{accuracy}%</div>
              <div className="text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>{t.accuracy}</div>
            </div>
            <div className="flex-1 space-y-2 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-1">
                {[0, 1, 2].map(i => (
                  <motion.span key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 + i * 0.15, type: 'spring', stiffness: 500, damping: 15 }}>
                    <Star className="w-7 h-7" fill={i < stars ? 'var(--pastel-amber-bd)' : 'none'} stroke={i < stars ? 'var(--pastel-amber-fg)' : 'var(--theme-text-secondary)'} />
                  </motion.span>
                ))}
                <span className="ml-2 font-semibold" style={{ color: 'var(--theme-text)', fontFamily: 'var(--font-sans)' }}>{t.medals[stars]}</span>
              </div>
              <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                <b style={{ color: 'var(--pastel-green-fg)' }}>{ok}</b> {t.right} · <b style={{ color: 'var(--pastel-amber-fg)' }}>{close}</b> {t.close} · <b style={{ color: 'var(--pastel-rose-fg)' }}>{bad}</b> {t.wrong}
              </p>
            </div>
          </div>
          <PointsEarned kind="write" bookId={book.id} page={page} pt={locale === 'pt-BR'} />
          <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--theme-border-subtle)' }}>
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--theme-text)' }}>{t.practice}</p>
            {missed.length ? (
              <div className="flex flex-wrap gap-2">
                {missed.map(w => (
                  <button key={w} type="button" onClick={() => sayWord(w)} className="speak-word speak-chip speak-bad text-sm inline-flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5 opacity-70" /> {w}
                  </button>
                ))}
              </div>
            ) : <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{t.none}</p>}
          </div>
        </motion.section>
      )}

      {words.length === 0 ? <p style={{ color: 'var(--theme-text-secondary)' }}>{t.empty}</p> : (
        <article className="whitespace-pre-wrap select-none mb-6" style={{ fontFamily: readerFont, fontSize, lineHeight, color: 'var(--theme-text)' }}>
          {segments.map((seg, k) => {
            if (seg.idx === null) return <span key={k} style={{ opacity: started && !done && seg.idx === null ? 0.5 : 1 }}>{seg.text}</span>
            const g = grades[seg.idx]
            const isCurrent = started && !done && seg.idx === current
            // Palavras ainda não ditadas ficam ocultas (é um ditado), com o mesmo tamanho na linha.
            const hidden = started && !done && seg.idx >= current
            return (
              <span key={k} className={`speak-word ${g === 'ok' ? 'speak-ok' : g === 'close' ? 'speak-close' : g === 'bad' || g === 'skip' ? 'speak-bad' : ''} ${isCurrent ? 'speak-next' : ''}`}
                style={hidden ? { color: 'transparent', backgroundColor: 'color-mix(in srgb, var(--theme-text) 8%, transparent)', borderRadius: 4 } : undefined}>
                {hidden
                  ? [...seg.text].map((ch, i) => /['’\-‐‑]/.test(ch)
                    ? <span key={i} style={{ color: 'var(--theme-text)' }}>{ch}</span> : ch)
                  : seg.text}
              </span>
            )
          })}
        </article>
      )}


      {/* Barra flutuante: campo de digitação e controles */}
      <div className="fixed left-2 right-2 md:left-[var(--sidebar-w,16rem)] md:right-8 md:bottom-8 z-40 flex flex-col items-center gap-2" style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <AnimatePresence>
          {feedback && (
            <motion.div key={feedback.kind + (feedback.word ?? '')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-2xl border shadow-xl px-4 py-2 text-sm" style={{ backgroundColor: 'var(--theme-nav-bg)', borderColor: 'var(--theme-border-subtle)', color: 'var(--theme-text)' }}>
              {feedback.kind === 'retry' ? t.tryAgain : feedback.kind === 'spelling'
                ? <>{t.spelling} <b className="speak-word speak-close">{feedback.word}</b></>
                : <>{t.answer}: <b className="speak-word speak-bad">{feedback.word}</b></>}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {burst > 0 && (
            <motion.div key={burst} className="score-burst pointer-events-none" initial={{ opacity: 0, y: 6, scale: 0.5 }}
              animate={{ opacity: [0, 1, 1, 0], y: -30, scale: [0.5, 1.3, 1, 1] }} transition={{ duration: 0.9 }}>+1</motion.div>
          )}
        </AnimatePresence>
        <div className="backdrop-blur-md border p-1.5 md:p-2.5 rounded-full shadow-2xl flex items-center justify-between gap-1.5 w-full md:w-auto"
          style={{ backgroundColor: 'var(--theme-nav-bg)', borderColor: 'var(--theme-border-subtle)' }}>
          {(!started || done) && <button type="button" onClick={() => goTo(page - 1)} disabled={page === 0} aria-label={t.prev}
            className="w-11 h-11 rounded-full grid place-items-center disabled:opacity-40 hover:bg-[var(--ui-hover)]" style={{ color: 'var(--theme-nav-text)' }}>
            <ChevronLeft className="w-5 h-5" />
          </button>}
          {!started ? (
            <button type="button" disabled={!words.length} onClick={() => { if (needsVoiceInstall('en')) askVoiceOnce(); else setStarted(true) }} className="btn-3d btn-3d--learned text-sm !px-5 !py-3">
              <Volume2 className="w-4 h-4" strokeWidth={3} /> {t.start}
            </button>
          ) : done ? (
            <>
              <button type="button" onClick={reset} className="btn-3d btn-3d--explain text-sm !px-4 !py-3"><RotateCcw className="w-4 h-4" strokeWidth={3} /> {t.again}</button>
              {page < pages.length - 1 && (
                <button type="button" onClick={() => goTo(page + 1)} className="btn-3d btn-3d--learned text-sm !px-4 !py-3">{t.next} <ChevronRight className="w-4 h-4" strokeWidth={3} /></button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1.5 flex-1 md:flex-none">
              <button type="button" onClick={() => { stopLoop(); sayWord(words[current], false) }} title={t.hear}
                className="w-10 h-10 rounded-full grid place-items-center hover:bg-[var(--ui-hover)]" style={{ color: 'var(--theme-nav-text)' }}><Volume2 className="w-5 h-5" /></button>
              <button type="button" onClick={() => { stopLoop(); sayWord(words[current], true) }} title={t.slow}
                className="w-10 h-10 rounded-full grid place-items-center hover:bg-[var(--ui-hover)]" style={{ color: 'var(--theme-nav-text)' }}><Snail className="w-5 h-5" /></button>
              <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} placeholder={t.placeholder} aria-label={t.placeholder}
                autoCapitalize="off" autoCorrect="off" spellCheck={false} disabled={feedback?.kind === 'answer' || feedback?.kind === 'spelling'}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); check() }
                  else if (e.key === 'Escape') { e.preventDefault(); play(current) }
                }}
                className="h-11 min-w-0 flex-1 md:w-72 rounded-full border px-4 text-base outline-none focus:ring-2 focus:ring-[var(--theme-accent,#55534E)]"
                style={{ backgroundColor: 'var(--theme-bg)', borderColor: secondTry ? 'var(--pastel-amber-bd)' : 'var(--theme-border-subtle)', color: 'var(--theme-text)' }} />
              <button type="button" onClick={() => giveUp(true)} disabled={feedback?.kind === 'answer' || feedback?.kind === 'spelling'} title={t.skip}
                className="h-10 px-3 rounded-full inline-flex items-center gap-1 text-xs font-semibold hover:bg-[var(--ui-hover)] disabled:opacity-40" style={{ color: 'var(--theme-nav-text)' }}>
                <SkipForward className="w-4 h-4" /> <span className="hidden sm:inline">{t.skip}</span>
              </button>
              <button type="button" onClick={reset} title={t.stop} aria-label={t.stop}
                className="h-10 w-10 sm:w-auto sm:px-3 rounded-full inline-flex items-center justify-center gap-1 text-xs font-semibold hover:bg-[var(--ui-hover)]" style={{ color: 'var(--pastel-rose-fg)' }}>
                <Square className="w-3.5 h-3.5" fill="currentColor" /> <span className="hidden sm:inline">{t.stop}</span>
              </button>
            </div>
          )}
          {(!started || done) && <button type="button" onClick={() => goTo(page + 1)} disabled={page >= pages.length - 1} aria-label={t.next}
            className="w-11 h-11 rounded-full grid place-items-center disabled:opacity-40 hover:bg-[var(--ui-hover)]" style={{ color: 'var(--theme-nav-text)' }}>
            <ChevronRight className="w-5 h-5" />
          </button>}
        </div>
        {started && !done && <p className="text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>
          {/['’]/.test(words[current] ?? '') && <b className="mr-2" style={{ color: 'var(--theme-text)' }}>💡 {t.hintApostrophe}</b>}
          {/[-‐‑]/.test(words[current] ?? '') && <b className="mr-2" style={{ color: 'var(--theme-text)' }}>💡 {t.hintHyphen}</b>}
          {t.hint}
        </p>}
      </div>
    </div>
  )
}
