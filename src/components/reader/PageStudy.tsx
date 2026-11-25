// "Estudar a página": a aula completa da página em tela cheia, adaptada ao nível (a dosagem de português cai conforme
// o nível sobe). Dentro dela: tocar palavras para marcar/explicar, aprofundar cada item (explicar melhor, mais exemplos,
// imagem exemplo), exercícios com pontuação e um chat de dúvidas. Toda ação de IA é cobrada no servidor (função grammar).
// A aula fica salva por página e nível; livros da galeria reaproveitam a aula de outra pessoa do mesmo nível (sem custo).
import { useEffect, useMemo, useRef, useState } from 'react'
import * as RDialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'motion/react'
import { BookOpen, Check, Dices, GraduationCap, Languages, Loader2, RefreshCw, Sparkles, X } from 'lucide-react'
import { useLanguage } from '@/store/useLanguage'
import { useStudyLevel } from '@/hooks/useStudyLevel'
import { grammar, type GrammarContent } from '@/lib/billingApi'
import { CREDIT_COST } from '@/lib/plans'
import { HideHelp } from './PageGrammar'
import { LessonView, Eyebrow, Section, headingsInPt, lessonSections } from './lesson/LessonView'
import { LessonExercises } from './lesson/LessonExercises'
import { LessonChat } from './lesson/LessonChat'
import { LessonSelection } from './lesson/LessonSelection'
import { lessonKey, usePageLesson } from './lesson/lessonStore'
import { Cost, LessonCtx, TONE, muted, tint, type LessonEnv } from './lesson/ui'

type BookRef = { id: string; title: string; currentPage: number }

/** Abre o Estudar de fora (o tutor usa isso para mostrar a lição na tela). */
export const openStudy = (page?: number, section?: string) => window.dispatchEvent(new CustomEvent('bookmoo:study', { detail: { page, section } }))
export const openQuiz = () => window.dispatchEvent(new Event('bookmoo:quiz'))

/** Quanto de português a aula terá no nível da pessoa (mesma regra do servidor). */
function balanceFor(level: string, pt: boolean) {
  if (!pt) return { label: 'In simple English', detail: 'Explanations in simple English.' }
  if (level === 'A1' || level === 'A2') return { label: 'Aula em português', detail: 'No seu nível, tudo é explicado em português e cada exemplo vem traduzido.' }
  if (level === 'B1') return { label: 'Português + inglês', detail: 'No B1 a aula mistura: explicações em português, títulos, fórmulas e revisão em inglês simples.' }
  if (level === 'B2') return { label: 'Quase toda em inglês', detail: 'No B2 a aula é quase toda em inglês, com português só nas armadilhas e palavras difíceis.' }
  return { label: 'Aula em inglês', detail: 'No C1/C2 a aula é toda em inglês, como para um aluno avançado.' }
}

const GEN_STEPS_PT = ['Lendo a página com atenção', 'Desmontando as frases mais ricas', 'Separando o vocabulário no contexto', 'Montando as regras com exemplos', 'Procurando armadilhas para brasileiros', 'Preparando a revisão']
const GEN_STEPS_EN = ['Reading the page carefully', 'Taking the richest sentences apart', 'Picking the vocabulary in context', 'Building the rules with examples', 'Finding the traps for Portuguese speakers', 'Preparing the recap']

function Generating({ pt }: { pt: boolean }) {
  const steps = pt ? GEN_STEPS_PT : GEN_STEPS_EN
  const [i, setI] = useState(0)
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setSecs(s => s + 1), 1000)
    return () => window.clearInterval(t)
  }, [])
  useEffect(() => { setI(Math.min(steps.length - 1, Math.floor(secs / 8))) }, [secs, steps.length])
  return (
    <div className="max-w-xl mx-auto px-5 py-16 md:py-24">
      <Eyebrow>{pt ? 'Preparando sua aula' : 'Preparing your lesson'}</Eyebrow>
      <p className="mt-2 font-display text-[32px] md:text-[38px] leading-tight">{pt ? 'Escrevendo a aula desta página' : 'Writing this page’s lesson'}</p>
      <p className="mt-2 text-[15px]" style={muted}>{pt ? `Uma aula completa leva cerca de 40 a 60 segundos · ${secs}s` : `A full lesson takes about 40 to 60 seconds · ${secs}s`}</p>
      <ul className="mt-8 space-y-3">
        {steps.map((s, k) => (
          <motion.li key={s} initial={{ opacity: 0, x: -6 }} animate={{ opacity: k <= i ? 1 : 0.4, x: 0 }} transition={{ delay: k * 0.05 }} className="flex items-center gap-3 text-[15.5px]">
            <span className="w-6 h-6 rounded-full grid place-items-center shrink-0" style={k < i ? { backgroundColor: TONE.green, color: '#fff' } : { backgroundColor: 'var(--theme-bg-secondary)' }}>
              {k < i ? <Check className="w-3.5 h-3.5" /> : k === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            </span>
            {s}
          </motion.li>
        ))}
      </ul>
    </div>
  )
}

export function PageStudyDialog({ open, onOpenChange, book, section, autoGenerate }: { open: boolean; onOpenChange: (o: boolean) => void; book: BookRef; section?: string; autoGenerate?: boolean }) {
  const pt = useLanguage().locale === 'pt-BR'
  const lang = pt ? 'pt' : 'en'
  const level = useStudyLevel()
  const [state, setState] = useState<'loading' | 'missing' | 'generating' | 'ready' | 'error'>('loading')
  const [content, setContent] = useState<GrammarContent | null>(null)
  const [shared, setShared] = useState(false)
  const [outdated, setOutdated] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [active, setActive] = useState('')
  const [progress, setProgress] = useState(0)
  const [chatOpen, setChatOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const article = useRef<HTMLDivElement>(null)
  const chips = useRef<HTMLDivElement>(null)
  const page = book.currentPage
  const store = usePageLesson(lessonKey(book.id, page, level.id))
  const bal = balanceFor(level.id, pt)

  const load = () => {
    setState('loading'); setContent(null)
    return grammar.get(book.id, page, lang, level.id).then(r => {
      if (r.found && r.content) { setContent(r.content); setShared(r.shared); setOutdated(r.outdated); setState('ready') } else setState('missing')
    }).catch(() => setState('error'))
  }
  useEffect(() => { if (open) { setChatOpen(false); void load() } }, [open, book.id, page, lang, level.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async () => {
    const hadLesson = state === 'ready' && content
    if (hadLesson) setUpgrading(true); else setState('generating')
    try {
      const r = await grammar.generate(book.id, page, lang, level.id)
      if (!r.content) throw new Error('empty')
      setContent(r.content); setShared(r.shared); setOutdated(false); setState('ready')
      scroller.current?.scrollTo({ top: 0 })
    } catch (e) {
      if (hadLesson) return
      const code = (e as { code?: string }).code
      setState(code === 'no_credits' || code === 'cap_reached' || code === 'plan_required' ? 'missing' : 'error')
    } finally { setUpgrading(false) }
  }

  // A tutora pediu para criar a lição: gera sem esperar o toque.
  useEffect(() => { if (open && autoGenerate && state === 'missing') void generate() }, [open, autoGenerate, state]) // eslint-disable-line react-hooks/exhaustive-deps

  // O tutor pode pedir uma seção específica: rola até ela quando a lição estiver pronta.
  useEffect(() => {
    if (state !== 'ready' || !section) return
    const t = window.setTimeout(() => document.getElementById(`study-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250)
    return () => window.clearTimeout(t)
  }, [state, section])

  // Sumário acompanha a rolagem; barra de progresso de leitura no topo.
  useEffect(() => {
    const root = scroller.current
    if (state !== 'ready' || !root) return
    const io = new IntersectionObserver(entries => {
      const top = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (top) setActive((top.target as HTMLElement).dataset.studySection ?? '')
    }, { root, rootMargin: '0px 0px -70% 0px' })
    root.querySelectorAll('[data-study-section]').forEach(el => io.observe(el))
    const onScroll = () => setProgress(root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight))
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => { io.disconnect(); root.removeEventListener('scroll', onScroll) }
  }, [state, content])

  // No celular, o chip da seção atual fica sempre visível.
  useEffect(() => {
    const el = chips.current?.querySelector<HTMLElement>(`[data-chip="${active}"]`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [active])

  const toc = useMemo(() => (content ? lessonSections(content, pt) : []), [content, pt])
  const goto = (id: string) => document.getElementById(`study-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const h = content ? headingsInPt(content, pt) : pt

  const env: LessonEnv = {
    bookId: book.id, bookTitle: book.title, page, lang, level: level.id, pt, data: store.data, patch: store.patch,
    ask: (q: string) => { setDraft(q); setChatOpen(true) },
  }

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Content aria-describedby={undefined} className="fixed inset-0 z-[150] flex flex-col outline-none"
          style={{ backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }}
          onOpenAutoFocus={e => e.preventDefault()}
          onEscapeKeyDown={e => { if (chatOpen) { e.preventDefault(); setChatOpen(false) } }}>
          <LessonCtx.Provider value={env}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="flex flex-col h-full min-h-0">
              <header className="shrink-0 border-b relative" style={{ borderColor: 'var(--theme-border)', paddingTop: 'var(--safe-t, 0px)' }}>
                <div className="h-14 flex items-center gap-3 px-4 md:px-8">
                  <GraduationCap className="w-5 h-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <RDialog.Title className="text-[14.5px] font-semibold leading-tight">{pt ? `Aula · página ${page + 1}` : `Lesson · page ${page + 1}`}</RDialog.Title>
                    <p className="text-[12.5px] truncate" style={muted}>{book.title}</p>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-semibold" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} title={bal.detail}>
                    <Languages className="w-3.5 h-3.5" />{level.id} · {bal.label}
                  </span>
                  <RDialog.Close className="w-10 h-10 rounded-full grid place-items-center hover:bg-[var(--ui-hover)]" aria-label={pt ? 'Fechar' : 'Close'}><X className="w-5 h-5" /></RDialog.Close>
                </div>
                {state === 'ready' && <div className="absolute left-0 bottom-[-1px] h-[2px] transition-[width] duration-150" style={{ width: `${progress * 100}%`, backgroundColor: 'var(--theme-primary)' }} />}
              </header>

              {state === 'ready' && toc.length > 0 && (
                <div ref={chips} className="md:hidden shrink-0 flex gap-1.5 overflow-x-auto px-4 py-2.5 border-b no-scrollbar" style={{ borderColor: 'var(--theme-border)' }}>
                  {toc.map(({ id, label }) => (
                    <button key={id} type="button" data-chip={id} onClick={() => goto(id)} className="shrink-0 h-8 px-3 rounded-full text-[12.5px] whitespace-nowrap max-w-[200px] truncate"
                      style={active === id ? { backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)', fontWeight: 600 } : { backgroundColor: 'var(--theme-bg-secondary)' }}>{label}</button>
                  ))}
                </div>
              )}

              <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto">
                <AnimatePresence mode="wait">
                  {state === 'loading' && (
                    <motion.div key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto px-5 py-16">
                      <Loader2 className="w-6 h-6 animate-spin" style={muted} />
                      <p className="mt-4 font-display text-[28px] leading-tight">{pt ? 'Abrindo a aula' : 'Opening the lesson'}</p>
                      <div className="mt-8 space-y-3" aria-hidden>{[80, 95, 70, 88, 60].map((w, i) => <div key={i} className="h-3 rounded-full animate-pulse" style={{ width: `${w}%`, backgroundColor: 'var(--theme-bg-secondary)' }} />)}</div>
                    </motion.div>
                  )}

                  {state === 'generating' && <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Generating pt={pt} /></motion.div>}

                  {state === 'missing' && (
                    <motion.div key="missing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto px-5 py-14 md:py-20">
                      <Eyebrow>{pt ? `Página ${page + 1} · nível ${level.id}` : `Page ${page + 1} · level ${level.id}`}</Eyebrow>
                      <h2 className="mt-2 font-display text-[36px] md:text-[44px] leading-[1.05]">{pt ? 'Transforme esta página numa aula de verdade' : 'Turn this page into a real lesson'}</h2>
                      <p className="mt-4 text-[16.5px] leading-relaxed" style={muted}>{pt ? 'Cada frase importante desmontada, o vocabulário no contexto, as regras com exemplos do livro e do dia a dia, as armadilhas de quem fala português e exercícios no final.' : 'Every key sentence taken apart, vocabulary in context, rules with examples from the book and daily life, traps for Portuguese speakers and exercises at the end.'}</p>
                      <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                        {(pt ? ['Frase a frase: por que foi escrita assim', 'Vocabulário com pronúncia e exemplos', 'Gramática explicada com fórmula', 'Armadilhas para brasileiros', 'Imagens e mais exemplos quando quiser', 'Exercícios com nota e chat de dúvidas']
                          : ['Sentence by sentence: why it is written so', 'Vocabulary with pronunciation and examples', 'Grammar explained with patterns', 'Traps for Portuguese speakers', 'Images and more examples on demand', 'Scored exercises and a question chat']).map(t => (
                          <li key={t} className="flex gap-2.5 text-[14.5px]"><Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: TONE.green }} />{t}</li>
                        ))}
                      </ul>
                      <div className="mt-6 rounded-2xl border p-4 flex gap-3" style={tint(TONE.blue, 6)}>
                        <Languages className="w-4 h-4 mt-0.5 shrink-0" style={{ color: TONE.blue }} />
                        <p className="text-[14px] leading-snug"><b>{bal.label}.</b> {bal.detail}</p>
                      </div>
                      <button type="button" onClick={() => void generate()} className="mt-7 h-12 px-6 rounded-full text-[15px] font-semibold inline-flex items-center gap-2" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
                        <Sparkles className="w-4 h-4" />{pt ? 'Criar a aula' : 'Create the lesson'}<Cost n={CREDIT_COST.lesson} pt={pt} />
                      </button>
                      <div className="mt-8"><HideHelp pt={pt} onDone={() => onOpenChange(false)} /></div>
                    </motion.div>
                  )}

                  {state === 'error' && (
                    <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-xl mx-auto px-5 py-20">
                      <p className="text-[16px]" style={muted}>{pt ? 'Não foi possível abrir a aula agora.' : 'Could not open the lesson right now.'}</p>
                      <button type="button" onClick={() => void load()} className="mt-4 h-10 px-5 rounded-full border text-[14px]" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Tentar de novo' : 'Try again'}</button>
                    </motion.div>
                  )}

                  {state === 'ready' && content && (
                    <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto px-5 md:px-8 pt-8 md:pt-14 pb-32 md:grid md:grid-cols-[210px_minmax(0,1fr)] md:gap-14">
                      <nav className="hidden md:block" aria-label={pt ? 'Sumário da aula' : 'Lesson contents'}>
                        <div className="sticky top-8">
                          <Eyebrow>{pt ? 'Sumário' : 'Contents'}</Eyebrow>
                          <ul className="mt-3 space-y-0.5 border-l" style={{ borderColor: 'var(--theme-border)' }}>{toc.map(({ id, label }) => (
                            <li key={id}><button type="button" onClick={() => goto(id)}
                              className="w-full text-left text-[13.5px] leading-snug pl-3.5 pr-2 py-1.5 -ml-px border-l-2 transition-colors hover:text-[var(--theme-text)]"
                              style={{ borderColor: active === id ? 'var(--theme-text)' : 'transparent', color: active === id ? 'var(--theme-text)' : 'var(--theme-text-secondary)', fontWeight: active === id ? 600 : 400 }}>{label}</button></li>
                          ))}</ul>
                        </div>
                      </nav>
                      <div ref={article} className="max-w-[740px] min-w-0">
                        {outdated && (
                          <div className="mb-8 rounded-3xl border p-5 flex flex-col sm:flex-row sm:items-center gap-4" style={tint(TONE.violet, 7)}>
                            <div className="flex-1">
                              <p className="text-[15px] font-semibold">{pt ? 'Há uma aula nova, mais completa, para o seu nível' : 'A new, fuller lesson is available for your level'}</p>
                              <p className="mt-1 text-[13.5px] leading-snug" style={muted}>{pt ? `Frase a frase, armadilhas para brasileiros, inglês de época e a dosagem de idiomas do ${level.id}.` : `Sentence by sentence, traps, old-style English and the ${level.id} language balance.`}</p>
                            </div>
                            <button type="button" onClick={() => void generate()} disabled={upgrading} className="h-11 px-5 rounded-full text-[14px] font-semibold inline-flex items-center justify-center gap-2 shrink-0 disabled:opacity-70" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
                              {upgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}{upgrading ? (pt ? 'Gerando… (até 1 min)' : 'Generating… (up to 1 min)') : (pt ? 'Gerar aula nova' : 'New lesson')}
                              {!upgrading && <Cost n={CREDIT_COST.lesson} pt={pt} />}
                            </button>
                          </div>
                        )}
                        <LessonView c={content} pt={pt} page={page} shared={shared} />
                        <Section id="exercises" eyebrow={h ? 'Pratique' : 'Practice'} title={h ? 'Exercícios da aula' : 'Lesson exercises'}>
                          <LessonExercises h={h} />
                        </Section>
                        <div className="mt-16 pt-8 border-t flex flex-wrap items-center gap-3" style={{ borderColor: 'var(--theme-border)' }}>
                          {page >= 1 && <button type="button" onClick={() => { onOpenChange(false); window.setTimeout(openQuiz, 200) }} className="h-11 px-5 rounded-full border text-[14px] font-medium inline-flex items-center gap-2 hover:bg-[var(--ui-hover)]" style={{ borderColor: 'var(--theme-border)' }}><Dices className="w-4 h-4" />{pt ? 'Desafio da página' : 'Page challenge'}</button>}
                          <button type="button" onClick={() => onOpenChange(false)} className="h-11 px-5 rounded-full text-[14px] font-semibold inline-flex items-center gap-2" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}><BookOpen className="w-4 h-4" />{pt ? 'Voltar à leitura' : 'Back to reading'}</button>
                          <span className="ml-auto"><HideHelp pt={pt} onDone={() => onOpenChange(false)} /></span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {state === 'ready' && content && <>
              <LessonSelection rootRef={article} scrollRef={scroller} />
              <LessonChat open={chatOpen} onOpenChange={setChatOpen} content={content} draft={draft} onDraftUsed={() => setDraft('')} />
            </>}
          </LessonCtx.Provider>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}
