// "Decifrar a página": regras de gramática da página, antes de ler. Gerada uma vez; livros da galeria
// reaproveitam a explicação de outra pessoa (sem custo). "Desafio": quiz da página com dificuldade gradual.
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Flame, Loader2, RotateCcw, Sparkles, Star, Users, X } from 'lucide-react'
import { useLanguage } from '@/store/useLanguage'
import { useReaderSettings } from '@/store/useReaderSettings'
import { useStudyLevel } from '@/hooks/useStudyLevel'
import { useXpStore, XP } from '@/store/useXpStore'
import { grammar, type GrammarContent, type Quiz, type QuizQuestion } from '@/lib/billingApi'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'

const muted = { color: 'var(--theme-text-secondary)' }
type BookRef = { id: string; title: string; currentPage: number }

/** Desliga os botões de ajuda de gramática (a pessoa escolhe a partir do B1). */
function HideHelp({ pt, onDone }: { pt: boolean; onDone: () => void }) {
  const level = useStudyLevel()
  const setGrammarHelp = useReaderSettings(s => s.setGrammarHelp)
  const advanced = ['B1', 'B2', 'C1', 'C2'].includes(level.id)
  return (
    <button type="button" onClick={() => { setGrammarHelp(false); onDone(); toast(pt ? 'Botões ocultos. Reative em Configurações → Leitura.' : 'Buttons hidden. Turn them back on in Settings → Reading.') }}
      className="text-[12.5px] underline underline-offset-4" style={muted}>
      {advanced ? (pt ? 'Já leio bem sem isso: ocultar estes botões' : 'I read fine without this: hide these buttons') : (pt ? 'Ocultar estes botões' : 'Hide these buttons')}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Decifrar a página
// ---------------------------------------------------------------------------
export function PageGrammarDialog({ open, onOpenChange, book }: { open: boolean; onOpenChange: (o: boolean) => void; book: BookRef }) {
  const pt = useLanguage().locale === 'pt-BR'
  const lang = pt ? 'pt' : 'en'
  const level = useStudyLevel()
  const [state, setState] = useState<'loading' | 'missing' | 'generating' | 'ready' | 'error'>('loading')
  const [content, setContent] = useState<GrammarContent | null>(null)
  const [shared, setShared] = useState(false)
  const page = book.currentPage

  useEffect(() => {
    if (!open) return
    let alive = true
    setState('loading'); setContent(null)
    grammar.get(book.id, page, lang).then(r => {
      if (!alive) return
      if (r.found && r.content) { setContent(r.content); setShared(r.shared); setState('ready') } else setState('missing')
    }).catch(() => { if (alive) setState('error') })
    return () => { alive = false }
  }, [open, book.id, page, lang])

  const generate = async () => {
    setState('generating')
    try {
      const r = await grammar.generate(book.id, page, lang, level.id)
      setContent(r.content); setShared(r.shared); setState('ready')
    } catch (e) {
      const code = (e as { code?: string }).code
      setState(code === 'no_credits' || code === 'cap_reached' || code === 'plan_required' ? 'missing' : 'error')
    }
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section><h3 className="text-[12.5px] font-semibold uppercase tracking-[0.08em]" style={muted}>{title}</h3><div className="mt-2.5 space-y-2.5">{children}</div></section>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{pt ? `Decifrar a página ${page + 1}` : `Decode page ${page + 1}`}</DialogTitle>
          <DialogDescription>{pt ? 'As regras de inglês que aparecem nesta página, antes de você ler.' : 'The English rules on this page, before you read it.'}</DialogDescription>
        </DialogHeader>

        {(state === 'loading' || state === 'generating') && (
          <div className="py-8 text-center">
            <Loader2 className="w-6 h-6 mx-auto animate-spin" style={muted} />
            <p className="mt-3 text-[14px]" style={muted}>{state === 'generating' ? (pt ? 'Analisando a página…' : 'Analysing the page…') : (pt ? 'Procurando a explicação…' : 'Looking for the explanation…')}</p>
          </div>
        )}

        {state === 'missing' && (
          <div className="py-4 text-center">
            <p className="text-[15px] leading-relaxed">{pt ? 'Ninguém gerou a explicação desta página ainda. Gere agora: ela fica salva e vale para todos os leitores deste livro.' : 'Nobody has generated this page’s explanation yet. Generate it now: it is saved for every reader of this book.'}</p>
            <button type="button" onClick={generate} className="mt-5 h-12 px-6 rounded-full text-[15px] font-semibold inline-flex items-center gap-2" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
              <Sparkles className="w-4 h-4" />{pt ? 'Gerar explicação (1 crédito)' : 'Generate explanation (1 credit)'}
            </button>
          </div>
        )}

        {state === 'error' && (
          <div className="py-6 text-center">
            <p className="text-[14.5px]" style={muted}>{pt ? 'Não foi possível carregar agora.' : 'Could not load right now.'}</p>
            <button type="button" onClick={() => { setState('loading'); grammar.get(book.id, page, lang).then(r => { if (r.found && r.content) { setContent(r.content); setShared(r.shared); setState('ready') } else setState('missing') }).catch(() => setState('error')) }}
              className="mt-3 h-10 px-5 rounded-full border text-[14px]" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Tentar de novo' : 'Try again'}</button>
          </div>
        )}

        {state === 'ready' && content && (
          <div className="space-y-6 max-h-[62dvh] overflow-y-auto pr-1">
            {shared && <p className="inline-flex items-center gap-1.5 text-[12.5px] px-2.5 h-6 rounded-full border" style={{ borderColor: 'var(--theme-border)', ...muted }}><Users className="w-3.5 h-3.5" />{pt ? 'Explicação reaproveitada da comunidade' : 'Reused from the community'}</p>}
            {content.summary && <p className="text-[15.5px] leading-relaxed">{content.summary}</p>}
            {content.tip && <p className="text-[14px] rounded-xl p-3 border" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}><b>{pt ? 'Dica: ' : 'Tip: '}</b>{content.tip}</p>}

            {content.rules.length > 0 && (
              <Section title={pt ? 'Regras desta página' : 'Rules on this page'}>
                {content.rules.map((r, i) => (
                  <div key={i} className="rounded-xl border p-3.5" style={{ borderColor: 'var(--theme-border)' }}>
                    <p className="text-[14.5px] font-semibold">{r.title}</p>
                    <p className="mt-1 text-[14px] leading-relaxed" style={muted}>{r.explanation}</p>
                    {r.examples.length > 0 && <ul className="mt-2 space-y-1">{r.examples.map((e, j) => <li key={j} className="text-[14px] font-serif italic pl-3 border-l-2" style={{ borderColor: 'var(--theme-text)' }}>{e}</li>)}</ul>}
                  </div>
                ))}
              </Section>
            )}
            {content.tenses.length > 0 && (
              <Section title={pt ? 'Passado, presente e futuro' : 'Past, present and future'}>
                {content.tenses.map((t, i) => (
                  <div key={i} className="text-[14px]"><p className="font-serif italic">{t.sentence}</p><p className="mt-0.5"><span className="inline-flex h-5 px-2 rounded-full text-[11.5px] font-semibold items-center mr-2" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>{t.tense}</span><span style={muted}>{t.why}</span></p></div>
                ))}
              </Section>
            )}
            {content.questions_negatives.length > 0 && (
              <Section title={pt ? 'Perguntas e negativas' : 'Questions and negatives'}>
                {content.questions_negatives.map((q, i) => <div key={i} className="text-[14px]"><p className="font-serif italic">{q.sentence}</p><p className="mt-0.5" style={muted}>{q.why}</p></div>)}
              </Section>
            )}
            {content.phrasal.length > 0 && (
              <Section title={pt ? 'Palavras que mudam quando juntas' : 'Words that change when together'}>
                {content.phrasal.map((p, i) => (
                  <div key={i} className="text-[14px]"><p className="font-semibold">{p.phrase}</p><p style={muted}>{pt ? 'Junto' : 'Together'}: {p.together}{p.apart ? ` · ${pt ? 'Separado' : 'Apart'}: ${p.apart}` : ''}</p></div>
                ))}
              </Section>
            )}
          </div>
        )}

        <div className="pt-1"><HideHelp pt={pt} onDone={() => onOpenChange(false)} /></div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Desafio
// ---------------------------------------------------------------------------
const TIER_NAME = { 1: ['Iniciante', 'Beginner'], 2: ['Intermediário', 'Intermediate'], 3: ['Avançado', 'Advanced'] } as const

function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

export function PageQuizDialog({ open, onOpenChange, book }: { open: boolean; onOpenChange: (o: boolean) => void; book: BookRef }) {
  const pt = useLanguage().locale === 'pt-BR'
  const lang = pt ? 'pt' : 'en'
  const level = useStudyLevel()
  const award = useXpStore(s => s.award)
  const page = book.currentPage
  const [tier, setTier] = useState<1 | 2 | 3>(1)
  const [phase, setPhase] = useState<'intro' | 'loading' | 'play' | 'done' | 'error'>('intro')
  const [saved, setSaved] = useState(false)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [built, setBuilt] = useState<string[]>([])
  const [checked, setChecked] = useState<boolean | null>(null)
  const [correct, setCorrect] = useState(0)
  const [streak, setStreak] = useState(0)
  const [best, setBest] = useState(0)
  const [gained, setGained] = useState(0)

  // Dificuldade gradual: começa fácil nas primeiras páginas e sobe com o avanço no livro e o desempenho recente.
  useEffect(() => {
    if (!open) return
    setPhase('intro'); setQuiz(null); setIdx(0); setPicked(null); setBuilt([]); setChecked(null); setCorrect(0); setStreak(0); setBest(0); setGained(0)
    let alive = true
    void grammar.history(book.id).then(({ results }) => {
      if (!alive) return
      const base = page < 6 ? 1 : page < 18 ? 2 : 3
      const recent = results.slice(0, 5)
      const acc = recent.length ? recent.reduce((s, r) => s + r.correct / r.total, 0) / recent.length : null
      const adj = acc === null ? 0 : acc >= 0.85 ? 1 : acc < 0.5 ? -1 : 0
      setTier(Math.max(1, Math.min(3, base + adj)) as 1 | 2 | 3)
    }).catch(() => {})
    return () => { alive = false }
  }, [open, book.id, page])
  useEffect(() => {
    if (!open) return
    let alive = true
    void grammar.quizGet(book.id, page, tier, lang).then(r => { if (alive) setSaved(!!r.quiz) }).catch(() => {})
    return () => { alive = false }
  }, [open, book.id, page, tier, lang])

  const q: QuizQuestion | undefined = quiz?.questions[idx]
  const pool = useMemo(() => (q?.type === 'order' ? shuffle(q.words.map((w, i) => ({ w, i }))) : []), [q])

  const start = async () => {
    setPhase('loading')
    try {
      const r = await grammar.quiz(book.id, page, tier, lang, level.id)
      setQuiz(r.quiz); setIdx(0); setPhase('play')
    } catch { setPhase('error') }
  }
  const finish = (finalCorrect: number, total: number, bestStreak: number) => {
    const points = XP.quiz(finalCorrect, total, tier)
    const first = award(`quiz:${book.id}:${page}:${tier}`, points)
    setGained(first ? points : 0); setBest(bestStreak); setPhase('done')
    void grammar.result(book.id, page, tier, finalCorrect, total).catch(() => {})
  }
  const answer = (ok: boolean) => {
    setChecked(ok)
    if (ok) { setCorrect(c => c + 1); setStreak(s => s + 1) } else setStreak(0)
  }
  const next = () => {
    if (!quiz) return
    if (idx + 1 >= quiz.questions.length) {
      // o último acerto já entrou no estado; calcula o final com o que foi marcado agora
      finish(correct, quiz.questions.length, Math.max(best, streak))
      return
    }
    setBest(b => Math.max(b, streak))
    setIdx(idx + 1); setPicked(null); setBuilt([]); setChecked(null)
  }
  const total = quiz?.questions.length ?? 6
  const stars = correct / total >= 0.9 ? 3 : correct / total >= 0.65 ? 2 : correct / total >= 0.35 ? 1 : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pt ? 'Desafio da página' : 'Page challenge'}</DialogTitle>
          <DialogDescription>{pt ? 'Treine o que você acabou de ler. Começa fácil e vai ficando mais difícil.' : 'Practise what you just read. It starts easy and gets harder.'}</DialogDescription>
        </DialogHeader>

        {phase === 'intro' && (
          <div className="text-center py-2">
            <div className="flex items-center justify-center gap-1.5" aria-label={`${TIER_NAME[tier][pt ? 0 : 1]}`}>
              {[1, 2, 3].map(n => <span key={n} className="h-1.5 w-10 rounded-full" style={{ backgroundColor: n <= tier ? 'var(--theme-text)' : 'var(--theme-border)' }} />)}
            </div>
            <p className="mt-2 text-[14px] font-medium">{pt ? 'Nível' : 'Level'}: {TIER_NAME[tier][pt ? 0 : 1]}</p>
            <p className="mt-3 text-[14px] leading-relaxed" style={muted}>{pt ? '6 perguntas com as regras da página, a página anterior e as suas palavras salvas.' : '6 questions using the page rules, the previous page and your saved words.'}</p>
            <button type="button" onClick={start} className="mt-5 h-12 px-8 rounded-full text-[15px] font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
              {pt ? 'Começar' : 'Start'}
            </button>
            <p className="mt-2 text-[12.5px]" style={muted}>{saved ? (pt ? 'Desafio já gerado: sem custo.' : 'Already generated: free.') : (pt ? 'Usa 1 crédito na primeira vez.' : 'Uses 1 credit the first time.')}</p>
            <div className="mt-4"><HideHelp pt={pt} onDone={() => onOpenChange(false)} /></div>
          </div>
        )}

        {phase === 'loading' && <div className="py-10 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin" style={muted} /><p className="mt-3 text-[14px]" style={muted}>{pt ? 'Montando o desafio…' : 'Building the challenge…'}</p></div>}
        {phase === 'error' && <div className="py-8 text-center"><p className="text-[14.5px]" style={muted}>{pt ? 'Não foi possível montar o desafio agora.' : 'Could not build the challenge right now.'}</p><button type="button" onClick={() => setPhase('intro')} className="mt-3 h-10 px-5 rounded-full border text-[14px]" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Voltar' : 'Back'}</button></div>}

        {phase === 'play' && quiz && q && (
          <div>
            <div className="flex items-center justify-between text-[12.5px]" style={muted}>
              <span className="tabular-nums">{idx + 1} / {quiz.questions.length}</span>
              <AnimatePresence>{streak >= 2 && <motion.span key={streak} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--theme-text)' }}><Flame className="w-3.5 h-3.5" />{streak} {pt ? 'seguidas' : 'in a row'}</motion.span>}</AnimatePresence>
            </div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
              <motion.div className="h-full rounded-full" style={{ backgroundColor: 'var(--theme-text)' }} initial={false} animate={{ width: `${((idx + (checked !== null ? 1 : 0)) / quiz.questions.length) * 100}%` }} transition={{ type: 'spring', stiffness: 160, damping: 24 }} />
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={idx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }} className="mt-5">
                <p className="text-[17px] leading-snug font-medium">{q.prompt}</p>

                {q.type === 'choice' ? (
                  <ul className="mt-4 space-y-2">
                    {q.options.map((o, i) => {
                      const done = checked !== null
                      const right = i === q.answer
                      const mine = picked === i
                      return (
                        <li key={i}>
                          <button type="button" disabled={done} onClick={() => { setPicked(i); answer(i === q.answer) }}
                            className="w-full min-h-[48px] rounded-xl border px-4 text-left text-[15px] flex items-center justify-between gap-3 transition-colors"
                            style={{ borderColor: done && right ? '#059669' : done && mine ? '#dc2626' : 'var(--theme-border)', borderWidth: done && (right || mine) ? 2 : 1, backgroundColor: 'var(--theme-card-bg)' }}>
                            <span>{o}</span>{done && right ? <Check className="w-4 h-4" style={{ color: '#059669' }} /> : done && mine ? <X className="w-4 h-4" style={{ color: '#dc2626' }} /> : null}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <div className="mt-4">
                    <div className="min-h-[56px] rounded-xl border p-2.5 flex flex-wrap gap-1.5" style={{ borderColor: checked === null ? 'var(--theme-border)' : checked ? '#059669' : '#dc2626', borderWidth: checked === null ? 1 : 2 }}>
                      {built.length === 0 && <span className="text-[13px] self-center px-1" style={muted}>{pt ? 'Toque nas palavras para montar a frase' : 'Tap the words to build the sentence'}</span>}
                      {built.map((w, i) => <button key={i} type="button" disabled={checked !== null} onClick={() => setBuilt(b => b.filter((_, k) => k !== i))} className="h-9 px-3 rounded-lg text-[14.5px] border" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>{w}</button>)}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {pool.map(({ w, i }) => {
                        const used = built.filter(x => x === w).length >= pool.filter(p => p.w === w).length
                        return <button key={i} type="button" disabled={checked !== null || used} onClick={() => setBuilt(b => [...b, w])} className="h-9 px-3 rounded-lg text-[14.5px] border disabled:opacity-30" style={{ borderColor: 'var(--theme-border)' }}>{w}</button>
                      })}
                    </div>
                    {checked === null && <button type="button" disabled={built.length !== q.words.length} onClick={() => answer(built.join(' ').replace(/\s+([.,!?;:])/g, '$1').toLowerCase() === q.answer.replace(/\s+/g, ' ').trim().toLowerCase())}
                      className="mt-4 h-11 px-6 rounded-full text-[14.5px] font-semibold disabled:opacity-40" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Verificar' : 'Check'}</button>}
                    {checked === false && <p className="mt-3 text-[14px]"><span style={muted}>{pt ? 'Resposta' : 'Answer'}: </span><b>{q.answer}</b></p>}
                  </div>
                )}

                {checked !== null && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                    <p className="text-[14px] leading-relaxed"><b style={{ color: checked ? '#059669' : '#dc2626' }}>{checked ? (pt ? 'Certo! ' : 'Correct! ') : (pt ? 'Quase. ' : 'Not quite. ')}</b><span style={muted}>{q.explain}</span></p>
                    <button type="button" onClick={next} className="mt-3 h-11 px-6 rounded-full text-[14.5px] font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{idx + 1 >= quiz.questions.length ? (pt ? 'Ver resultado' : 'See result') : (pt ? 'Continuar' : 'Continue')}</button>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {phase === 'done' && (
          <div className="text-center py-2">
            <div className="flex items-center justify-center gap-1.5">
              {[1, 2, 3].map(n => (
                <motion.span key={n} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.12 * n, type: 'spring', stiffness: 300, damping: 14 }}>
                  <Star className="w-9 h-9" strokeWidth={1.6} fill={n <= stars ? 'currentColor' : 'none'} style={{ color: n <= stars ? 'var(--theme-text)' : 'var(--theme-border)' }} />
                </motion.span>
              ))}
            </div>
            <p className="mt-3 font-display text-[30px] leading-tight tabular-nums">{correct} / {total}</p>
            <p className="mt-1 text-[14px]" style={muted}>
              {stars === 3 ? (pt ? 'Perfeito. Você dominou esta página.' : 'Perfect. You nailed this page.') : stars >= 1 ? (pt ? 'Bom trabalho. Reler a explicação da página ajuda a fixar.' : 'Good job. Re-reading the page explanation helps it stick.') : (pt ? 'Tudo bem: errar faz parte. Abra "Decifrar" e tente de novo.' : 'That’s fine: mistakes are part of it. Open "Decode" and try again.')}
            </p>
            <p className="mt-2 text-[13px]" style={muted}>{gained > 0 ? `+${gained} ${pt ? 'pontos' : 'points'}` : (pt ? 'Pontos já contados para este desafio.' : 'Points already counted for this challenge.')}{best >= 3 ? ` · ${pt ? 'melhor sequência' : 'best streak'}: ${best}` : ''}</p>
            <div className="mt-5 flex justify-center gap-2">
              <button type="button" onClick={() => { setPhase('play'); setIdx(0); setPicked(null); setBuilt([]); setChecked(null); setCorrect(0); setStreak(0); setBest(0); setGained(0) }} className="h-11 px-5 rounded-full border text-[14px] inline-flex items-center gap-2" style={{ borderColor: 'var(--theme-border)' }}><RotateCcw className="w-4 h-4" />{pt ? 'Refazer' : 'Retry'}</button>
              <button type="button" onClick={() => onOpenChange(false)} className="h-11 px-6 rounded-full text-[14px] font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Continuar lendo' : 'Keep reading'}</button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
