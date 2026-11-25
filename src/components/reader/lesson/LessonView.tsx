// A aula da página, diagramada como um bom livro de inglês: frase a frase, vocabulário, regras, expressões,
// tempos verbais, armadilhas para quem fala português, inglês de época, pronúncia e revisão.
// Todo texto em inglês leva data-en: tocar numa palavra seleciona e abre marcar/explicar.
import type { ReactNode } from 'react'
import { AlertTriangle, ArrowRight, BookOpen, Check, Clock, Hash, Languages, Lightbulb, MessageCircleQuestion, Quote, Sparkles, Users, X } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'motion/react'
import type { GrammarContent, LessonUnit } from '@/lib/billingApi'
import { useVocabularyStore } from '@/store/useVocabularyStore'
import { ItemTools } from './ItemTools'
import { Chip, En, Say, TONE, card, muted, tint } from './ui'

export type SectionDef = { id: string; label: string }

/** Títulos em inglês quando a aula já é (quase) toda em inglês. */
export const headingsInPt = (c: GrammarContent, pt: boolean) => pt && (!c.balance || c.balance === 'pt' || c.balance === 'mix')

export function lessonSections(c: GrammarContent, pt: boolean): SectionDef[] {
  const h = headingsInPt(c, pt)
  return [
    ...(c.sentences.length ? [{ id: 'sentences', label: h ? 'Frase a frase' : 'Sentence by sentence' }] : []),
    ...(c.vocabulary.length ? [{ id: 'vocab', label: h ? 'Vocabulário' : 'Vocabulary' }] : []),
    ...c.units.map((u, i) => ({ id: `unit-${i + 1}`, label: u.title })),
    ...(c.phrasal.length ? [{ id: 'phrasal', label: h ? 'Expressões' : 'Expressions' }] : []),
    ...(c.tenses.length ? [{ id: 'tenses', label: h ? 'Tempos verbais' : 'Tenses' }] : []),
    ...(c.questions_negatives.length ? [{ id: 'questions', label: h ? 'Perguntas e negativas' : 'Questions and negatives' }] : []),
    ...(c.attention.length ? [{ id: 'attention', label: h ? 'Atenção, brasileiro' : 'Watch out' }] : []),
    ...(c.style.length ? [{ id: 'style', label: h ? 'Inglês de época' : 'Old-style English' }] : []),
    ...(c.pronunciation.length ? [{ id: 'pronunciation', label: h ? 'Pronúncia' : 'Pronunciation' }] : []),
    ...(c.recap.length || c.tip ? [{ id: 'recap', label: h ? 'Revisão' : 'Recap' }] : []),
    { id: 'exercises', label: h ? 'Exercícios' : 'Exercises' },
  ]
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em]" style={muted}>{children}</p>
}

export function Section({ id, n, eyebrow, title, intro, children }: { id: string; n?: number; eyebrow?: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={`study-${id}`} data-study-section={id} className="scroll-mt-24 md:scroll-mt-8 pt-14 first:pt-0">
      <div className="flex items-start gap-3.5">
        {n != null && <span className="mt-1 shrink-0 font-display text-[15px] tabular-nums w-9 h-9 rounded-full grid place-items-center border" style={{ borderColor: 'var(--theme-border)' }}>{String(n).padStart(2, '0')}</span>}
        <div className="min-w-0">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h2 className="mt-0.5 font-display text-[26px] md:text-[31px] leading-[1.1]">{title}</h2>
          {intro && <p className="mt-2 text-[15px] leading-relaxed" style={muted}>{intro}</p>}
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  )
}

function Example({ en, pt, fromPage }: { en: string; pt?: string; fromPage?: boolean }) {
  return (
    <li className="flex gap-3 py-2.5">
      <span className="mt-1 shrink-0" style={muted}>{fromPage ? <BookOpen className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}</span>
      <span className="min-w-0 flex-1">
        <En as="p" className="font-serif italic text-[17px] leading-snug">{en}</En>
        {pt && <span className="block mt-0.5 text-[14px]" style={muted}>{pt}</span>}
      </span>
      <Say text={en} />
    </li>
  )
}

const unitText = (u: LessonUnit) => [u.title, u.explanation, u.formula && `Pattern: ${u.formula}`, ...u.from_page.map(e => `Page: ${e.en}`), ...u.other.map(e => `Example: ${e.en}`)].filter(Boolean).join('\n')

function Unit({ unit, n, badge, h }: { unit: LessonUnit; n: number; badge: number; h: boolean }) {
  const [show, setShow] = useState(false)
  return (
    <Section id={`unit-${n}`} n={badge} eyebrow={`${h ? 'Gramática' : 'Grammar'} · ${n}`} title={unit.title}>
      <div className="text-[16.5px] leading-[1.7]">{unit.explanation}</div>
      {unit.formula && (
        <div className="mt-5 rounded-2xl border px-4 py-3 flex items-center gap-3" style={tint(TONE.blue, 6)}>
          <Hash className="w-4 h-4 shrink-0" style={{ color: TONE.blue }} />
          <span className="text-[15.5px] font-semibold tracking-tight" data-en>{unit.formula}</span>
        </div>
      )}
      {unit.from_page.length > 0 && <>
        <p className="mt-6 text-[12px] font-semibold uppercase tracking-[0.12em]" style={muted}>{h ? 'Na página' : 'On the page'}</p>
        <ul className="mt-1 divide-y divide-[var(--theme-border)]">{unit.from_page.map((e, i) => <Example key={i} en={e.en} pt={e.pt} fromPage />)}</ul>
      </>}
      {unit.other.length > 0 && <>
        <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.12em]" style={muted}>{h ? 'Em outras situações' : 'In other situations'}</p>
        <ul className="mt-1">{unit.other.map((e, i) => <Example key={i} en={e.en} pt={e.pt} />)}</ul>
      </>}
      {unit.contrast && (
        <p className="mt-4 text-[15px] leading-relaxed rounded-2xl border p-4 flex gap-2.5" style={card}><Languages className="w-4 h-4 mt-1 shrink-0" style={muted} /><span>{unit.contrast}</span></p>
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {unit.mistake && (
          <div className="rounded-2xl border p-4" style={card}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={muted}>{h ? 'Erro comum' : 'Common mistake'}</p>
            <p className="mt-2.5 text-[15px] flex items-start gap-2"><X className="w-4 h-4 mt-0.5 shrink-0" style={{ color: TONE.red }} /><En className="line-through decoration-1 opacity-70">{unit.mistake.wrong}</En></p>
            <p className="mt-1.5 text-[15px] flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: TONE.green }} /><En className="font-medium">{unit.mistake.right}</En></p>
            {unit.mistake.why && <p className="mt-2 text-[13.5px] leading-snug" style={muted}>{unit.mistake.why}</p>}
          </div>
        )}
        {unit.practice && (
          <div className="rounded-2xl border p-4" style={card}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={muted}>{h ? 'Pratique' : 'Practise'}</p>
            <p className="mt-2.5 text-[15px] leading-snug">{unit.practice.prompt}</p>
            {show
              ? <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-2.5 text-[15px] font-semibold" style={{ color: TONE.green }}><En>{unit.practice.answer}</En></motion.p>
              : <button type="button" data-lesson-ui onClick={() => setShow(true)} className="mt-3 h-9 px-4 rounded-full border text-[13px] font-medium hover:bg-[var(--ui-hover)]" style={{ borderColor: 'var(--theme-border)' }}>{h ? 'Ver resposta' : 'Show answer'}</button>}
          </div>
        )}
      </div>
      <ItemTools id={`unit-${n}`} text={unitText(unit)} sentence={unit.other[0]?.en ?? unit.from_page[0]?.en} topic={unit.title} />
    </Section>
  )
}

const STATUS_STYLE = { learned: { c: TONE.green, pt: 'Aprendi', en: 'Learned' }, review: { c: TONE.amber, pt: 'Revisar', en: 'Review' }, important: { c: TONE.violet, pt: 'Importante', en: 'Important' } } as const

const BALANCE_LABEL = { pt: ['Aula em português', 'Lesson in Portuguese'], mix: ['Português + inglês', 'Portuguese + English'], 'en-pt': ['Quase toda em inglês', 'Mostly English'], en: ['Aula em inglês', 'Lesson in English'] } as const

export function LessonView({ c, pt, page, shared }: { c: GrammarContent; pt: boolean; page: number; shared: boolean }) {
  const h = headingsInPt(c, pt)
  const vocabs = useVocabularyStore(s => s.vocabularies)
  const statusOf = (w: string) => vocabs.find(v => v.text.trim().toLowerCase() === w.trim().toLowerCase())?.status
  const times = [['past', h ? 'Passado' : 'Past'], ['present', h ? 'Presente' : 'Present'], ['future', h ? 'Futuro' : 'Future']] as const
  let n = 0
  const next = () => ++n

  return (
    <article>
      {/* Abertura */}
      <header>
        <Eyebrow>{pt ? `Aula · página ${page + 1}` : `Lesson · page ${page + 1}`}{c.level ? ` · ${pt ? 'nível' : 'level'} ${c.level}` : ''}</Eyebrow>
        <h1 className="mt-3 font-display text-[38px] md:text-[52px] leading-[1.02] tracking-tight">{c.title || (pt ? 'Estudo da página' : 'Page study')}</h1>
        <div className="mt-5 flex flex-wrap gap-2">
          {c.minutes ? <Chip><Clock className="w-3.5 h-3.5 mr-1" />{c.minutes} min</Chip> : null}
          {c.vocabulary.length > 0 && <Chip>{c.vocabulary.length} {pt ? 'palavras' : 'words'}</Chip>}
          {c.units.length > 0 && <Chip>{c.units.length} {pt ? 'regras' : 'rules'}</Chip>}
          {c.balance && <Chip style={tint(TONE.blue, 10)}><Languages className="w-3.5 h-3.5 mr-1" />{BALANCE_LABEL[c.balance][pt ? 0 : 1]}</Chip>}
          {shared && <Chip><Users className="w-3.5 h-3.5 mr-1" />{pt ? 'Da comunidade' : 'From the community'}</Chip>}
        </div>
        {c.summary && <p className="mt-6 text-[18px] md:text-[19px] leading-[1.65]">{c.summary}</p>}
        {c.goals.length > 0 && (
          <div className="mt-7 rounded-3xl border p-5 md:p-6" style={tint(TONE.green, 6)}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: TONE.green }}>{h ? 'Ao final desta aula você vai' : 'By the end of this lesson you will'}</p>
            <ul className="mt-3 grid gap-2.5 md:grid-cols-2">{c.goals.map((g, i) => <li key={i} className="flex gap-2.5 text-[15px] leading-snug"><Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: TONE.green }} />{g}</li>)}</ul>
          </div>
        )}
        <p className="mt-5 text-[13px] flex items-center gap-2" style={muted}><MessageCircleQuestion className="w-4 h-4 shrink-0" />{pt ? 'Toque em qualquer palavra em inglês para marcar ou pedir uma explicação. Dúvidas? Use o chat no canto da tela.' : 'Tap any English word to mark it or get an explanation. Questions? Use the chat in the corner.'}</p>
      </header>

      <div className="mt-6" />

      {/* Frase a frase */}
      {c.sentences.length > 0 && (
        <Section id="sentences" n={next()} eyebrow={h ? 'Entenda a página' : 'Understand the page'} title={h ? 'Frase a frase' : 'Sentence by sentence'}
          intro={h ? 'As frases mais ricas da página, desmontadas: o que cada parte faz e por que o autor escreveu assim.' : 'The richest sentences of the page, taken apart: what each piece does and why the author wrote it this way.'}>
          <div className="space-y-5">
            {c.sentences.map((s, i) => (
              <div key={i} className="rounded-3xl border p-5 md:p-6" style={card}>
                <div className="flex items-start gap-3">
                  <Quote className="w-5 h-5 mt-1 shrink-0" style={muted} />
                  <div className="flex-1 min-w-0">
                    <En as="p" className="font-serif text-[20px] md:text-[22px] leading-[1.45]">{s.en}</En>
                    {s.pt && <p className="mt-1.5 text-[15px] leading-snug" style={muted}>{s.pt}</p>}
                  </div>
                  <Say text={s.en} />
                </div>
                {s.parts.length > 0 && (
                  <ul className="mt-5 grid gap-2 sm:grid-cols-2">{s.parts.map((p, pi) => (
                    <li key={pi} className="rounded-xl px-3.5 py-2.5" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                      <En as="p" className="text-[15px] font-semibold leading-snug">{p.chunk}</En>
                      <p className="mt-0.5 text-[13.5px] leading-snug" style={muted}>{p.role}</p>
                    </li>
                  ))}</ul>
                )}
                {s.why && (
                  <div className="mt-4 rounded-2xl border p-4 flex gap-3" style={tint(TONE.amber, 7)}>
                    <Lightbulb className="w-4 h-4 mt-1 shrink-0" style={{ color: TONE.amber }} />
                    <div><p className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: TONE.amber }}>{h ? 'Por que foi escrita assim' : 'Why it is written this way'}</p><p className="mt-1 text-[15px] leading-relaxed">{s.why}</p></div>
                  </div>
                )}
                <ItemTools id={`sentence-${i}`} text={`Sentence: ${s.en}\nTranslation: ${s.pt}\nWhy: ${s.why}\n${s.parts.map(p => `${p.chunk}: ${p.role}`).join('\n')}`} sentence={s.en} topic={s.why.slice(0, 120)} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Vocabulário */}
      {c.vocabulary.length > 0 && (
        <Section id="vocab" n={next()} eyebrow={h ? 'Palavras no contexto' : 'Words in context'} title={h ? 'Vocabulário da página' : 'Page vocabulary'}>
          <div className="grid gap-4 md:grid-cols-2">
            {c.vocabulary.map((v, i) => {
              const st = statusOf(v.word)
              return (
                <div key={i} className="rounded-3xl border p-5 flex flex-col" style={card}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <En className="font-display text-[24px] leading-none">{v.word}</En>
                        {v.ipa && <span className="text-[13px]" style={muted}>{v.ipa.startsWith('/') ? v.ipa : `/${v.ipa}/`}</span>}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {v.pos && <Chip>{v.pos}</Chip>}
                        {st && <Chip style={tint(STATUS_STYLE[st].c, 14)}>{STATUS_STYLE[st][pt ? 'pt' : 'en']}</Chip>}
                      </div>
                    </div>
                    <Say text={v.word} />
                  </div>
                  <p className="mt-3 text-[15.5px] font-medium leading-snug">{v.meaning}</p>
                  {v.in_context && <p className="mt-1.5 text-[14px] leading-snug" style={muted}><b>{h ? 'Aqui: ' : 'Here: '}</b>{v.in_context}</p>}
                  {v.example && (
                    <div className="mt-3 border-l-2 pl-3" style={{ borderColor: 'var(--theme-border)' }}>
                      <En as="p" className="font-serif italic text-[15.5px] leading-snug">“{v.example}”</En>
                      {v.example_pt && <p className="text-[13px] mt-0.5" style={muted}>{v.example_pt}</p>}
                    </div>
                  )}
                  {v.other && (
                    <div className="mt-2.5 flex gap-2"><ArrowRight className="w-3.5 h-3.5 mt-1 shrink-0" style={muted} /><div><En as="p" className="text-[14.5px] leading-snug">{v.other.en}</En><p className="text-[13px]" style={muted}>{v.other.pt}</p></div></div>
                  )}
                  {v.note && <p className="mt-3 text-[13px] leading-snug rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>{v.note}</p>}
                  <div className="mt-auto"><ItemTools id={`vocab-${i}`} text={`Word: ${v.word}\nMeaning: ${v.meaning}\nIn context: ${v.in_context ?? ''}\nPage: ${v.example}`} sentence={v.other?.en || v.example} topic={v.word} /></div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {c.units.map((u, i) => <Unit key={i} unit={u} n={i + 1} badge={n + i + 1} h={h} />)}

      {/* Expressões */}
      {c.phrasal.length > 0 && (
        <Section id="phrasal" n={next() + c.units.length} eyebrow={h ? 'Juntas elas mudam de sentido' : 'Together they mean more'} title={h ? 'Expressões e phrasal verbs' : 'Expressions and phrasal verbs'}>
          <div className="space-y-3">{c.phrasal.map((p, i) => (
            <div key={i} className="rounded-3xl border p-5" style={card}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><En className="text-[18px] font-semibold">{p.phrase}</En>{p.register && <Chip>{p.register}</Chip>}</div>
                  <p className="mt-1.5 text-[15px]">{p.together}</p>
                  {p.apart && <p className="mt-0.5 text-[13.5px]" style={muted}>{h ? 'Ao pé da letra: ' : 'Literally: '}{p.apart}</p>}
                </div>
                <Say text={p.phrase} />
              </div>
              {p.example && <div className="mt-3 flex gap-2"><ArrowRight className="w-4 h-4 mt-1 shrink-0" style={muted} /><div><En as="p" className="font-serif italic text-[16px] leading-snug">{p.example}</En>{p.example_pt && <p className="text-[13.5px]" style={muted}>{p.example_pt}</p>}</div></div>}
              <ItemTools id={`phrasal-${i}`} text={`Expression: ${p.phrase}\nMeaning: ${p.together}\nExample: ${p.example}`} sentence={p.example} topic={p.phrase} />
            </div>
          ))}</div>
        </Section>
      )}

      {/* Tempos verbais */}
      {c.tenses.length > 0 && (
        <Section id="tenses" n={next() + c.units.length} eyebrow={h ? 'Linha do tempo' : 'Timeline'} title={h ? 'Passado, presente e futuro' : 'Past, present and future'}>
          <div className="grid gap-3 md:grid-cols-3">
            {times.map(([k, label]) => {
              const list = c.tenses.filter(t => t.time === k)
              return (
                <div key={k} className="rounded-3xl border p-4" style={{ ...card, opacity: list.length ? 1 : 0.55 }}>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={muted}>{label}</p>
                  {list.length === 0 && <p className="mt-2 text-[13px]" style={muted}>{h ? 'Não aparece nesta página' : 'Not on this page'}</p>}
                  <ul className="mt-2 space-y-4">{list.map((t, i) => (
                    <li key={i}><En as="p" className="font-serif italic text-[15.5px] leading-snug">{t.sentence}</En>
                      <p className="mt-1.5"><Chip style={tint(TONE.blue, 10)}>{t.tense}</Chip></p>
                      <p className="mt-1 text-[13px] leading-snug" style={muted}>{t.why}</p></li>
                  ))}</ul>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Perguntas e negativas */}
      {c.questions_negatives.length > 0 && (
        <Section id="questions" n={next() + c.units.length} title={h ? 'Perguntas e negativas' : 'Questions and negatives'}>
          <ul className="space-y-3">{c.questions_negatives.map((q, i) => (
            <li key={i} className="rounded-3xl border p-5" style={card}>
              <div className="flex items-start gap-2"><En as="p" className="flex-1 font-serif italic text-[18px] leading-snug">{q.sentence}</En><Say text={q.sentence} /></div>
              {q.build && <p className="mt-2.5 text-[14.5px]"><span className="font-semibold">{h ? 'Como montar: ' : 'How to build it: '}</span>{q.build}</p>}
              <p className="mt-1 text-[14px]" style={muted}>{q.why}</p>
              <ItemTools id={`question-${i}`} text={`Sentence: ${q.sentence}\nWhy: ${q.why}\nBuild: ${q.build}`} />
            </li>
          ))}</ul>
        </Section>
      )}

      {/* Armadilhas */}
      {c.attention.length > 0 && (
        <Section id="attention" n={next() + c.units.length} eyebrow={h ? 'Pontos de atenção' : 'Watch out'} title={h ? 'Onde o brasileiro tropeça' : 'Where Portuguese speakers slip'}>
          <div className="grid gap-3 md:grid-cols-2">{c.attention.map((a, i) => (
            <div key={i} className="rounded-3xl border p-5" style={tint(TONE.amber, 8)}>
              <p className="text-[16px] font-semibold flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-1 shrink-0" style={{ color: TONE.amber }} />{a.title}</p>
              <p className="mt-2 text-[14.5px] leading-relaxed">{a.explain}</p>
              {a.wrong && <p className="mt-2.5 text-[14.5px] flex items-start gap-2"><X className="w-4 h-4 mt-0.5 shrink-0" style={{ color: TONE.red }} /><En className="line-through decoration-1 opacity-70">{a.wrong}</En></p>}
              {a.right && <p className="mt-1 text-[14.5px] flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: TONE.green }} /><En className="font-medium">{a.right}</En></p>}
              <ItemTools id={`attention-${i}`} text={`Trap: ${a.title}\n${a.explain}\nWrong: ${a.wrong}\nRight: ${a.right}`} />
            </div>
          ))}</div>
        </Section>
      )}

      {/* Inglês de época */}
      {c.style.length > 0 && (
        <Section id="style" n={next() + c.units.length} eyebrow={h ? 'Clássicos falam diferente' : 'Classics sound different'} title={h ? 'Como se diz hoje' : 'How we say it today'}>
          <div className="rounded-3xl border overflow-hidden" style={card}>
            {c.style.map((s, i) => (
              <div key={i} className="grid md:grid-cols-[1fr_auto_1fr] gap-x-4 gap-y-1 p-4 md:p-5 border-t first:border-t-0 items-start" style={{ borderColor: 'var(--theme-border)' }}>
                <En as="p" className="font-serif italic text-[16px] leading-snug">{s.form}</En>
                <ArrowRight className="w-4 h-4 mt-1 hidden md:block" style={muted} />
                <div><En as="p" className="text-[16px] font-semibold leading-snug">{s.modern}</En><p className="mt-1 text-[13.5px] leading-snug" style={muted}>{s.explain}</p></div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Pronúncia */}
      {c.pronunciation.length > 0 && (
        <Section id="pronunciation" n={next() + c.units.length} title={h ? 'Pronúncia' : 'Pronunciation'}>
          <div className="grid gap-3 sm:grid-cols-2">{c.pronunciation.map((p, i) => (
            <div key={i} className="rounded-3xl border p-4 flex items-start gap-3" style={card}>
              <div className="flex-1 min-w-0">
                <p className="flex items-baseline gap-2 flex-wrap"><En className="text-[18px] font-semibold">{p.word}</En>{p.ipa && <span className="text-[13px]" style={muted}>{p.ipa.startsWith('/') ? p.ipa : `/${p.ipa}/`}</span>}</p>
                <p className="mt-1 text-[14px] leading-snug" style={muted}>{p.tip}</p>
              </div>
              <Say text={p.word} />
            </div>
          ))}</div>
        </Section>
      )}

      {/* Revisão */}
      {(c.recap.length > 0 || c.tip) && (
        <Section id="recap" n={next() + c.units.length} eyebrow={h ? 'Para fechar' : 'Wrap-up'} title={h ? 'Revisão' : 'Recap'}>
          <ol className="space-y-3">{c.recap.map((r, i) => (
            <li key={i} className="flex gap-3.5 text-[16px] leading-snug"><span className="font-display text-[20px] w-6 shrink-0 tabular-nums leading-none mt-0.5" style={muted}>{i + 1}</span>{r}</li>
          ))}</ol>
          {c.tip && <p className="mt-6 text-[15px] leading-relaxed rounded-3xl p-5 border flex gap-3" style={tint(TONE.green, 6)}><Sparkles className="w-4 h-4 mt-1 shrink-0" style={{ color: TONE.green }} /><span><b>{h ? 'Dica de leitura: ' : 'Reading tip: '}</b>{c.tip}</span></p>}
        </Section>
      )}
    </article>
  )
}
