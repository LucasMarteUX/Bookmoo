// "Estudar a página": lição completa da página em tela cheia, no formato de um livro de inglês
// (objetivos, vocabulário, unidades com fórmula, exemplos da página e de outras situações, erro comum,
// prática, tempos verbais, perguntas e negativas, expressões, pronúncia e revisão). Gerada uma vez;
// livros da galeria reaproveitam a lição de outra pessoa (sem custo).
import { useEffect, useRef, useState } from 'react'
import * as RDialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, BookOpen, Check, Dices, GraduationCap, Loader2, Sparkles, Users, Volume2, X } from 'lucide-react'
import { useLanguage } from '@/store/useLanguage'
import { useStudyLevel } from '@/hooks/useStudyLevel'
import { grammar, type GrammarContent, type LessonUnit } from '@/lib/billingApi'
import { speak } from '@/lib/tts'
import { HideHelp } from './PageGrammar'

type BookRef = { id: string; title: string; currentPage: number }
const muted = { color: 'var(--theme-text-secondary)' }
const card = { borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }

/** Abre o Estudar de fora (o tutor usa isso para mostrar a lição na tela). */
export const openStudy = (page?: number, section?: string) => window.dispatchEvent(new CustomEvent('bookmoo:study', { detail: { page, section } }))
export const openQuiz = () => window.dispatchEvent(new Event('bookmoo:quiz'))

function Say({ text, label }: { text: string; label: string }) {
  return (
    <button type="button" onClick={() => { void speak(text, { context: 'phrase' }).catch(() => {}) }} aria-label={label} title={label}
      className="shrink-0 w-8 h-8 rounded-lg grid place-items-center transition-colors hover:bg-[var(--ui-hover)]" style={muted}>
      <Volume2 className="w-4 h-4" />
    </button>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em]" style={muted}>{children}</p>
}

function Section({ id, eyebrow, title, children }: { id: string; eyebrow?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={`study-${id}`} data-study-section={id} className="scroll-mt-6 pt-10 first:pt-0">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-1 font-display text-[26px] md:text-[30px] leading-tight">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Example({ en, pt, fromPage }: { en: string; pt?: string; fromPage?: boolean }) {
  return (
    <li className="flex gap-3 py-2">
      <span className="mt-1 shrink-0" style={muted}>{fromPage ? <BookOpen className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-serif italic text-[17px] leading-snug">{en}</span>
        {pt && <span className="block mt-0.5 text-[14px]" style={muted}>{pt}</span>}
      </span>
      <Say text={en} label="Ouvir" />
    </li>
  )
}

function Unit({ unit, n, pt }: { unit: LessonUnit; n: number; pt: boolean }) {
  const [show, setShow] = useState(false)
  return (
    <Section id={`unit-${n}`} eyebrow={`${pt ? 'Unidade' : 'Unit'} ${n}`} title={unit.title}>
      <p className="text-[16px] leading-relaxed">{unit.explanation}</p>
      {unit.formula && (
        <div className="mt-4 inline-flex max-w-full rounded-xl border px-4 py-2.5 text-[15px] font-medium tracking-tight" style={{ ...card, backgroundColor: 'var(--theme-bg-secondary)' }}>
          {unit.formula}
        </div>
      )}
      {unit.from_page.length > 0 && <>
        <p className="mt-6 text-[13px] font-semibold" style={muted}>{pt ? 'Na página' : 'On the page'}</p>
        <ul className="mt-1 divide-y" style={{ borderColor: 'var(--theme-border)' }}>{unit.from_page.map((e, i) => <Example key={i} en={e.en} pt={e.pt} fromPage />)}</ul>
      </>}
      {unit.other.length > 0 && <>
        <p className="mt-5 text-[13px] font-semibold" style={muted}>{pt ? 'Em outras situações' : 'In other situations'}</p>
        <ul className="mt-1">{unit.other.map((e, i) => <Example key={i} en={e.en} pt={e.pt} />)}</ul>
      </>}
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {unit.mistake && (
          <div className="rounded-2xl border p-4" style={card}>
            <p className="text-[13px] font-semibold">{pt ? 'Erro comum' : 'Common mistake'}</p>
            <p className="mt-2 text-[15px] flex items-start gap-2"><X className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#dc2626' }} /><span className="line-through decoration-1" style={muted}>{unit.mistake.wrong}</span></p>
            <p className="mt-1 text-[15px] flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#059669' }} /><span className="font-medium">{unit.mistake.right}</span></p>
            {unit.mistake.why && <p className="mt-2 text-[13.5px] leading-snug" style={muted}>{unit.mistake.why}</p>}
          </div>
        )}
        {unit.practice && (
          <div className="rounded-2xl border p-4" style={card}>
            <p className="text-[13px] font-semibold">{pt ? 'Pratique' : 'Practise'}</p>
            <p className="mt-2 text-[15px] leading-snug">{unit.practice.prompt}</p>
            {show
              ? <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-[15px] font-medium" style={{ color: '#059669' }}>{unit.practice.answer}</motion.p>
              : <button type="button" onClick={() => setShow(true)} className="mt-3 h-9 px-4 rounded-full border text-[13px]" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Ver resposta' : 'Show answer'}</button>}
          </div>
        )}
      </div>
    </Section>
  )
}

export function Lesson({ c, pt, page, shared }: { c: GrammarContent; pt: boolean; page: number; shared: boolean }) {
  const times = [['past', pt ? 'Passado' : 'Past'], ['present', pt ? 'Presente' : 'Present'], ['future', pt ? 'Futuro' : 'Future']] as const
  return (
    <article>
      <Eyebrow>{pt ? `Lição · página ${page + 1}` : `Lesson · page ${page + 1}`}</Eyebrow>
      <h1 className="mt-2 font-display text-[34px] md:text-[44px] leading-[1.05]">{c.title || (pt ? 'Estudo da página' : 'Page study')}</h1>
      {shared && <p className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] px-2.5 h-6 rounded-full border" style={{ borderColor: 'var(--theme-border)', ...muted }}><Users className="w-3.5 h-3.5" />{pt ? 'Lição reaproveitada da comunidade' : 'Reused from the community'}</p>}
      {c.summary && <p className="mt-5 text-[17px] leading-relaxed">{c.summary}</p>}
      {c.goals.length > 0 && (
        <div className="mt-6 rounded-2xl border p-5" style={card}>
          <p className="text-[13px] font-semibold">{pt ? 'Nesta lição você vai' : 'In this lesson you will'}</p>
          <ul className="mt-3 space-y-2">{c.goals.map((g, i) => <li key={i} className="flex gap-2.5 text-[15px]"><Check className="w-4 h-4 mt-1 shrink-0" />{g}</li>)}</ul>
        </div>
      )}

      {c.vocabulary.length > 0 && (
        <Section id="vocab" eyebrow={pt ? 'Antes de ler' : 'Before reading'} title={pt ? 'Vocabulário da página' : 'Page vocabulary'}>
          <div className="grid gap-3 sm:grid-cols-2">
            {c.vocabulary.map((v, i) => (
              <div key={i} className="rounded-2xl border p-4" style={card}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="text-[17px] font-semibold">{v.word}</p><p className="text-[14px]" style={muted}>{v.meaning}</p></div>
                  <Say text={v.word} label={pt ? `Ouvir ${v.word}` : `Hear ${v.word}`} />
                </div>
                {v.example && <p className="mt-2 font-serif italic text-[15px] leading-snug">“{v.example}”</p>}
                {v.note && <p className="mt-2 text-[12.5px]" style={muted}>{v.note}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {c.units.map((u, i) => <Unit key={i} unit={u} n={i + 1} pt={pt} />)}

      {c.tenses.length > 0 && (
        <Section id="tenses" eyebrow={pt ? 'Linha do tempo' : 'Timeline'} title={pt ? 'Passado, presente e futuro' : 'Past, present and future'}>
          <div className="grid gap-3 md:grid-cols-3">
            {times.map(([k, label]) => {
              const list = c.tenses.filter(t => t.time === k)
              return (
                <div key={k} className="rounded-2xl border p-4" style={{ ...card, opacity: list.length ? 1 : 0.55 }}>
                  <p className="text-[13px] font-semibold">{label}</p>
                  {list.length === 0 && <p className="mt-2 text-[13px]" style={muted}>{pt ? 'Não aparece nesta página' : 'Not on this page'}</p>}
                  <ul className="mt-2 space-y-3">{list.map((t, i) => (
                    <li key={i}><p className="font-serif italic text-[15px] leading-snug">{t.sentence}</p>
                      <p className="mt-1 text-[12.5px]"><span className="inline-flex h-5 px-2 mr-1.5 rounded-full items-center font-semibold" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>{t.tense}</span><span style={muted}>{t.why}</span></p></li>
                  ))}</ul>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {c.questions_negatives.length > 0 && (
        <Section id="questions" title={pt ? 'Perguntas e negativas' : 'Questions and negatives'}>
          <ul className="space-y-4">{c.questions_negatives.map((q, i) => (
            <li key={i} className="rounded-2xl border p-4" style={card}>
              <div className="flex items-start gap-2"><p className="flex-1 font-serif italic text-[17px] leading-snug">{q.sentence}</p><Say text={q.sentence} label="Ouvir" /></div>
              {q.build && <p className="mt-2 text-[14px]"><span className="font-semibold">{pt ? 'Como montar: ' : 'How to build it: '}</span>{q.build}</p>}
              <p className="mt-1 text-[14px]" style={muted}>{q.why}</p>
            </li>
          ))}</ul>
        </Section>
      )}

      {c.phrasal.length > 0 && (
        <Section id="phrasal" title={pt ? 'Palavras que mudam quando juntas' : 'Words that change together'}>
          <ul className="divide-y rounded-2xl border" style={card}>{c.phrasal.map((p, i) => (
            <li key={i} className="p-4">
              <p className="text-[16px] font-semibold">{p.phrase}</p>
              <p className="mt-0.5 text-[14px]">{p.together}{p.apart ? <span style={muted}> · {pt ? 'separadas' : 'apart'}: {p.apart}</span> : null}</p>
              {p.example && <p className="mt-1.5 font-serif italic text-[15px]">{p.example}</p>}
            </li>
          ))}</ul>
        </Section>
      )}

      {c.pronunciation.length > 0 && (
        <Section id="pronunciation" title={pt ? 'Pronúncia' : 'Pronunciation'}>
          <div className="grid gap-3 sm:grid-cols-2">{c.pronunciation.map((p, i) => (
            <div key={i} className="rounded-2xl border p-4 flex items-start gap-3" style={card}>
              <div className="flex-1 min-w-0"><p className="text-[16px] font-semibold">{p.word}</p><p className="mt-0.5 text-[14px]" style={muted}>{p.tip}</p></div>
              <Say text={p.word} label={pt ? `Ouvir ${p.word}` : `Hear ${p.word}`} />
            </div>
          ))}</div>
        </Section>
      )}

      {(c.recap.length > 0 || c.tip) && (
        <Section id="recap" eyebrow={pt ? 'Para fechar' : 'Wrap-up'} title={pt ? 'Revisão' : 'Recap'}>
          <ul className="space-y-2">{c.recap.map((r, i) => <li key={i} className="flex gap-3 text-[16px]"><span className="font-display text-[18px] w-5 shrink-0 tabular-nums" style={muted}>{i + 1}</span>{r}</li>)}</ul>
          {c.tip && <p className="mt-5 text-[15px] rounded-2xl p-4 border" style={{ ...card, backgroundColor: 'var(--theme-bg-secondary)' }}><b>{pt ? 'Dica de leitura: ' : 'Reading tip: '}</b>{c.tip}</p>}
        </Section>
      )}
    </article>
  )
}

export function PageStudyDialog({ open, onOpenChange, book, section, autoGenerate }: { open: boolean; onOpenChange: (o: boolean) => void; book: BookRef; section?: string; autoGenerate?: boolean }) {
  const pt = useLanguage().locale === 'pt-BR'
  const lang = pt ? 'pt' : 'en'
  const level = useStudyLevel()
  const [state, setState] = useState<'loading' | 'missing' | 'generating' | 'ready' | 'error'>('loading')
  const [content, setContent] = useState<GrammarContent | null>(null)
  const [shared, setShared] = useState(false)
  const [active, setActive] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const page = book.currentPage

  const load = () => {
    setState('loading'); setContent(null)
    return grammar.get(book.id, page, lang).then(r => {
      if (r.found && r.content) { setContent(r.content); setShared(r.shared); setState('ready') } else setState('missing')
    }).catch(() => setState('error'))
  }
  useEffect(() => { if (open) void load() }, [open, book.id, page, lang]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // A tutora pediu para criar a lição: gera sem esperar o toque.
  useEffect(() => { if (open && autoGenerate && state === 'missing') void generate() }, [open, autoGenerate, state]) // eslint-disable-line react-hooks/exhaustive-deps

  // O tutor pode pedir uma seção específica: rola até ela quando a lição estiver pronta.
  useEffect(() => {
    if (state !== 'ready' || !section) return
    const t = window.setTimeout(() => document.getElementById(`study-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250)
    return () => window.clearTimeout(t)
  }, [state, section])

  // Sumário lateral acompanha a rolagem.
  useEffect(() => {
    const root = scroller.current
    if (state !== 'ready' || !root) return
    const io = new IntersectionObserver(entries => {
      const top = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (top) setActive((top.target as HTMLElement).dataset.studySection ?? '')
    }, { root, rootMargin: '0px 0px -70% 0px' })
    root.querySelectorAll('[data-study-section]').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [state, content])

  const toc = content ? [
    ...(content.vocabulary.length ? [['vocab', pt ? 'Vocabulário' : 'Vocabulary']] : []),
    ...content.units.map((u, i) => [`unit-${i + 1}`, `${i + 1}. ${u.title}`]),
    ...(content.tenses.length ? [['tenses', pt ? 'Tempos verbais' : 'Tenses']] : []),
    ...(content.questions_negatives.length ? [['questions', pt ? 'Perguntas e negativas' : 'Questions']] : []),
    ...(content.phrasal.length ? [['phrasal', pt ? 'Expressões' : 'Expressions']] : []),
    ...(content.pronunciation.length ? [['pronunciation', pt ? 'Pronúncia' : 'Pronunciation']] : []),
    ...(content.recap.length || content.tip ? [['recap', pt ? 'Revisão' : 'Recap']] : []),
  ] as [string, string][] : []

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Content aria-describedby={undefined} className="fixed inset-0 z-[150] flex flex-col outline-none"
          style={{ backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }} className="flex flex-col h-full min-h-0">
            <header className="h-14 shrink-0 border-b flex items-center gap-3 px-4 md:px-8" style={{ borderColor: 'var(--theme-border)', paddingTop: 'var(--safe-t, 0px)' }}>
              <GraduationCap className="w-5 h-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <RDialog.Title className="text-[14.5px] font-semibold leading-tight">{pt ? `Estudar · página ${page + 1}` : `Study · page ${page + 1}`}</RDialog.Title>
                <p className="text-[12.5px] truncate" style={muted}>{book.title}</p>
              </div>
              <RDialog.Close className="w-10 h-10 rounded-full grid place-items-center hover:bg-[var(--ui-hover)]" aria-label={pt ? 'Fechar' : 'Close'}><X className="w-5 h-5" /></RDialog.Close>
            </header>

            <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto">
              <AnimatePresence mode="wait">
                {(state === 'loading' || state === 'generating') && (
                  <motion.div key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto px-5 py-16">
                    <Loader2 className="w-6 h-6 animate-spin" style={muted} />
                    <p className="mt-4 font-display text-[28px] leading-tight">{state === 'generating' ? (pt ? 'Escrevendo a lição desta página' : 'Writing this page’s lesson') : (pt ? 'Abrindo a lição' : 'Opening the lesson')}</p>
                    {state === 'generating' && <p className="mt-2 text-[15px]" style={muted}>{pt ? 'Vocabulário, regras com exemplos, tempos verbais e exercícios. Leva alguns segundos.' : 'Vocabulary, rules with examples, tenses and exercises. Takes a few seconds.'}</p>}
                    <div className="mt-8 space-y-3" aria-hidden>{[80, 95, 70, 88, 60].map((w, i) => <div key={i} className="h-3 rounded-full animate-pulse" style={{ width: `${w}%`, backgroundColor: 'var(--theme-bg-secondary)' }} />)}</div>
                  </motion.div>
                )}

                {state === 'missing' && (
                  <motion.div key="missing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-xl mx-auto px-5 py-16 md:py-24">
                    <Eyebrow>{pt ? `Página ${page + 1}` : `Page ${page + 1}`}</Eyebrow>
                    <h2 className="mt-2 font-display text-[34px] leading-tight">{pt ? 'Transforme esta página numa aula' : 'Turn this page into a lesson'}</h2>
                    <p className="mt-4 text-[16px] leading-relaxed" style={muted}>{pt ? 'Uma lição como a de um livro de inglês: vocabulário da página, cada regra explicada com exemplos do livro e de outras situações, erros comuns, exercícios e pronúncia. Fica salva e vale para todos os leitores deste livro.' : 'A lesson like an English course book: page vocabulary, each rule explained with examples from the book and other situations, common mistakes, exercises and pronunciation. Saved for every reader of this book.'}</p>
                    <button type="button" onClick={generate} className="mt-7 h-12 px-6 rounded-full text-[15px] font-semibold inline-flex items-center gap-2" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
                      <Sparkles className="w-4 h-4" />{pt ? 'Criar a lição' : 'Create the lesson'}
                    </button>
                    <div className="mt-8"><HideHelp pt={pt} onDone={() => onOpenChange(false)} /></div>
                  </motion.div>
                )}

                {state === 'error' && (
                  <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-xl mx-auto px-5 py-20">
                    <p className="text-[16px]" style={muted}>{pt ? 'Não foi possível abrir a lição agora.' : 'Could not open the lesson right now.'}</p>
                    <button type="button" onClick={() => void load()} className="mt-4 h-10 px-5 rounded-full border text-[14px]" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Tentar de novo' : 'Try again'}</button>
                  </motion.div>
                )}

                {state === 'ready' && content && (
                  <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto px-5 md:px-8 py-10 md:py-14 md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-12">
                    <nav className="hidden md:block" aria-label={pt ? 'Sumário da lição' : 'Lesson contents'}>
                      <div className="sticky top-6">
                        <Eyebrow>{pt ? 'Sumário' : 'Contents'}</Eyebrow>
                        <ul className="mt-3 space-y-0.5">{toc.map(([id, label]) => (
                          <li key={id}><button type="button" onClick={() => document.getElementById(`study-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                            className="w-full text-left text-[13.5px] leading-snug px-2.5 py-1.5 rounded-lg transition-colors hover:bg-[var(--ui-hover)]"
                            style={{ color: active === id ? 'var(--theme-text)' : 'var(--theme-text-secondary)', backgroundColor: active === id ? 'var(--theme-bg-secondary)' : undefined, fontWeight: active === id ? 600 : 400 }}>{label}</button></li>
                        ))}</ul>
                      </div>
                    </nav>
                    <div className="max-w-[720px] min-w-0">
                      <Lesson c={content} pt={pt} page={page} shared={shared} />
                      <div className="mt-14 pt-8 border-t flex flex-wrap items-center gap-3" style={{ borderColor: 'var(--theme-border)' }}>
                        {page >= 1 && <button type="button" onClick={() => { onOpenChange(false); window.setTimeout(openQuiz, 200) }} className="h-12 px-6 rounded-full text-[15px] font-semibold inline-flex items-center gap-2" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}><Dices className="w-4 h-4" />{pt ? 'Fazer o desafio' : 'Take the challenge'}</button>}
                        <button type="button" onClick={() => onOpenChange(false)} className="h-12 px-6 rounded-full border text-[15px]" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Voltar à leitura' : 'Back to reading'}</button>
                        <span className="ml-auto"><HideHelp pt={pt} onDone={() => onOpenChange(false)} /></span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}
