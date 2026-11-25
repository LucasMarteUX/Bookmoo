// Exercícios da aula: múltipla escolha sobre o que foi ensinado, com correção na hora, explicação e pontuação.
// "Gerar exercícios" cobra no servidor; refazer o mesmo conjunto é grátis.
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, Dices, Loader2, RotateCcw, Sparkles, Trophy, X } from 'lucide-react'
import { grammar, type LessonExercise } from '@/lib/billingApi'
import { CREDIT_COST } from '@/lib/plans'
import { useXpStore } from '@/store/useXpStore'
import { toast } from '@/components/ui/toast'
import { failMessage, type ExerciseRun } from './lessonStore'
import { Chip, Cost, En, TONE, card, muted, tint, useLessonEnv } from './ui'

const SKILL: Record<LessonExercise['skill'], [string, string, string]> = {
  vocabulario: ['Vocabulário', 'Vocabulary', TONE.blue],
  gramatica: ['Gramática', 'Grammar', TONE.violet],
  expressao: ['Expressão', 'Expression', TONE.green],
  armadilha: ['Armadilha', 'Trap', TONE.amber],
  compreensao: ['Compreensão', 'Comprehension', TONE.red],
}
const LETTERS = ['A', 'B', 'C', 'D']

/** Texto com trechos em inglês entre aspas ou com lacuna: tudo tocável para marcar/explicar. */
const Prompt = ({ text }: { text: string }) => <En as="p" className="font-display text-[22px] md:text-[25px] leading-[1.25]">{text}</En>

export function LessonExercises({ h }: { h: boolean }) {
  const env = useLessonEnv()
  const { pt } = env
  const run = env.data?.exercises ?? null
  const award = useXpStore(s => s.award)
  const [loading, setLoading] = useState(false)
  const [idx, setIdx] = useState(() => (run && !run.done ? Math.max(0, run.answers.findIndex(a => a === null)) : 0))

  const save = (r: ExerciseRun | undefined) => env.patch(d => ({ ...d, exercises: r }))

  const generate = async () => {
    if (loading) return
    setLoading(true)
    try {
      const avoid = (run?.questions ?? []).map(q => q.prompt)
      const r = await grammar.exercises(env.bookId, env.page, env.lang, env.level, avoid)
      save({ questions: r.questions, answers: r.questions.map(() => null), done: false, at: Date.now() })
      setIdx(0)
    } catch (e) {
      const m = failMessage(e, pt)
      if (m) toast(m, { tone: 'error' })
    } finally { setLoading(false) }
  }

  const retry = () => { if (!run) return; save({ ...run, answers: run.questions.map(() => null), done: false }); setIdx(0) }

  const pick = (i: number) => {
    if (!run || run.answers[idx] !== null) return
    const answers = run.answers.map((a, j) => (j === idx ? i : a))
    save({ ...run, answers })
  }
  const nextQ = () => {
    if (!run) return
    if (idx + 1 < run.questions.length) { setIdx(idx + 1); return }
    const correct = run.questions.filter((q, i) => run.answers[i] === q.answer).length
    save({ ...run, done: true })
    // Pontos só na primeira vez que este conjunto é concluído.
    const pts = correct * 2 + (correct === run.questions.length ? 5 : 0)
    if (pts > 0 && award(`quiz:lesson:${env.bookId}:${env.page}:${run.at}`, pts)) toast(pt ? `+${pts} pontos` : `+${pts} points`, { tone: 'success' })
    document.getElementById('study-exercises')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Sem exercícios ainda
  if (!run) {
    return (
      <div className="rounded-3xl border p-6 md:p-8 text-center" style={tint(TONE.violet, 6)}>
        <div className="mx-auto w-12 h-12 rounded-2xl grid place-items-center" style={{ backgroundColor: `color-mix(in srgb, ${TONE.violet} 16%, transparent)`, color: TONE.violet }}><Dices className="w-6 h-6" /></div>
        <p className="mt-4 font-display text-[26px] leading-tight">{h ? 'Hora de praticar' : 'Time to practise'}</p>
        <p className="mt-2 text-[15px] leading-relaxed max-w-md mx-auto" style={muted}>{h ? 'Perguntas de múltipla escolha sobre esta aula: vocabulário, gramática, expressões e armadilhas. Correção na hora, com a explicação de cada resposta.' : 'Multiple-choice questions about this lesson: vocabulary, grammar, expressions and traps. Instant feedback with an explanation for each answer.'}</p>
        <button type="button" data-lesson-ui onClick={() => void generate()} disabled={loading}
          className="mt-6 h-12 px-6 rounded-full text-[15px] font-semibold inline-flex items-center gap-2 disabled:opacity-70" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{loading ? (pt ? 'Criando exercícios…' : 'Creating exercises…') : (pt ? 'Gerar exercícios' : 'Generate exercises')}
          {!loading && <Cost n={CREDIT_COST.lessonExercises} pt={pt} />}
        </button>
      </div>
    )
  }

  const total = run.questions.length
  const correct = run.questions.filter((q, i) => run.answers[i] === q.answer).length

  // Resultado
  if (run.done) {
    const pct = Math.round((correct / total) * 100)
    const msg = pct === 100 ? (pt ? 'Perfeito! Você dominou esta página.' : 'Perfect! You mastered this page.')
      : pct >= 75 ? (pt ? 'Muito bem! Revise só os pontos que errou.' : 'Great job! Review only what you missed.')
        : pct >= 50 ? (pt ? 'Bom começo. Releia as seções marcadas e tente de novo.' : 'Good start. Reread the sections and try again.')
          : (pt ? 'Vale reler a aula com calma e refazer.' : 'Reread the lesson calmly and try again.')
    const ring = 2 * Math.PI * 34
    return (
      <div className="rounded-3xl border overflow-hidden" style={card}>
        <div className="p-6 md:p-8 flex flex-col sm:flex-row items-center gap-6" style={tint(pct >= 75 ? TONE.green : pct >= 50 ? TONE.amber : TONE.red, 7)}>
          <svg viewBox="0 0 80 80" className="w-28 h-28 shrink-0 -rotate-90">
            <circle cx="40" cy="40" r="34" fill="none" strokeWidth="7" style={{ stroke: 'var(--theme-border)' }} />
            <motion.circle cx="40" cy="40" r="34" fill="none" strokeWidth="7" strokeLinecap="round" stroke={pct >= 75 ? TONE.green : pct >= 50 ? TONE.amber : TONE.red}
              strokeDasharray={ring} initial={{ strokeDashoffset: ring }} animate={{ strokeDashoffset: ring * (1 - correct / total) }} transition={{ duration: 0.9, ease: 'easeOut' }} />
            <text x="40" y="40" textAnchor="middle" dominantBaseline="central" transform="rotate(90 40 40)" className="font-display" style={{ fill: 'var(--theme-text)', fontSize: 20 }}>{correct}/{total}</text>
          </svg>
          <div className="text-center sm:text-left">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] flex items-center gap-1.5 justify-center sm:justify-start" style={muted}><Trophy className="w-3.5 h-3.5" />{pt ? 'Sua pontuação' : 'Your score'} · {pct}%</p>
            <p className="mt-1.5 font-display text-[26px] leading-tight">{msg}</p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start" data-lesson-ui>
              <button type="button" onClick={retry} className="h-10 px-4 rounded-full border text-[13.5px] font-medium inline-flex items-center gap-1.5 hover:bg-[var(--ui-hover)]" style={{ borderColor: 'var(--theme-border)' }}><RotateCcw className="w-4 h-4" />{pt ? 'Refazer' : 'Retry'}</button>
              <button type="button" onClick={() => void generate()} disabled={loading} className="h-10 px-4 rounded-full text-[13.5px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-70" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{pt ? 'Novos exercícios' : 'New exercises'}<Cost n={CREDIT_COST.lessonExercises} pt={pt} />
              </button>
            </div>
          </div>
        </div>
        <ul className="divide-y divide-[var(--theme-border)]">
          {run.questions.map((q, i) => {
            const ok = run.answers[i] === q.answer
            return (
              <li key={i} className="p-5 flex gap-3">
                <span className="w-6 h-6 mt-0.5 shrink-0 rounded-full grid place-items-center" style={{ backgroundColor: ok ? TONE.green : TONE.red, color: '#fff' }}>{ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}</span>
                <div className="min-w-0">
                  <En as="p" className="text-[15px] font-medium leading-snug">{q.prompt}</En>
                  {!ok && run.answers[i] != null && <p className="mt-1 text-[13.5px] line-through opacity-70"><En>{q.options[run.answers[i] as number]}</En></p>}
                  <p className="mt-1 text-[14px] font-semibold" style={{ color: TONE.green }}><En>{q.options[q.answer]}</En></p>
                  <p className="mt-1 text-[13.5px] leading-snug" style={muted}>{q.explain}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  // Jogando
  const q = run.questions[idx]
  const chosen = run.answers[idx]
  const answered = chosen !== null
  const [skillPt, skillEn, skillColor] = SKILL[q.skill] ?? SKILL.gramatica
  return (
    <div className="rounded-3xl border p-5 md:p-7" style={card}>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
          <motion.div className="h-full rounded-full" style={{ backgroundColor: 'var(--theme-primary)' }} animate={{ width: `${((idx + (answered ? 1 : 0)) / total) * 100}%` }} />
        </div>
        <span className="text-[13px] tabular-nums font-medium" style={muted}>{idx + 1}/{total}</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={idx} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
          <div className="mt-6 flex flex-wrap gap-2"><Chip style={tint(skillColor, 12)}>{pt ? skillPt : skillEn}</Chip>{q.topic && <Chip>{q.topic}</Chip>}</div>
          <div className="mt-3"><Prompt text={q.prompt} /></div>
          <div className="mt-5 grid gap-2.5" data-lesson-ui>
            {q.options.map((o, i) => {
              const isRight = i === q.answer
              const isChosen = i === chosen
              const style = !answered ? { borderColor: 'var(--theme-border)' }
                : isRight ? { ...tint(TONE.green, 12), borderColor: TONE.green }
                  : isChosen ? { ...tint(TONE.red, 10), borderColor: TONE.red } : { borderColor: 'var(--theme-border)', opacity: 0.55 }
              return (
                <motion.button key={i} type="button" onClick={() => pick(i)} disabled={answered} whileTap={answered ? undefined : { scale: 0.98 }}
                  animate={answered && isChosen && !isRight ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
                  className="w-full min-h-12 rounded-2xl border-2 px-4 py-3 text-left flex items-center gap-3 transition-colors enabled:hover:bg-[var(--ui-hover)]" style={style}>
                  <span className="w-7 h-7 shrink-0 rounded-full grid place-items-center text-[12.5px] font-bold" style={{ backgroundColor: answered && (isRight || isChosen) ? (isRight ? TONE.green : TONE.red) : 'var(--theme-bg-secondary)', color: answered && (isRight || isChosen) ? '#fff' : undefined }}>
                    {answered && isRight ? <Check className="w-4 h-4" /> : answered && isChosen ? <X className="w-4 h-4" /> : LETTERS[i]}
                  </span>
                  <span className="text-[15.5px] leading-snug">{o}</span>
                </motion.button>
              )
            })}
          </div>
          <AnimatePresence>
            {answered && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 rounded-2xl border p-4" style={tint(chosen === q.answer ? TONE.green : TONE.red, 7)}>
                <p className="text-[15px] font-semibold" style={{ color: chosen === q.answer ? TONE.green : TONE.red }}>{chosen === q.answer ? (pt ? 'Isso mesmo!' : 'Correct!') : (pt ? 'Quase!' : 'Not quite!')}</p>
                <p className="mt-1 text-[14.5px] leading-relaxed">{q.explain}</p>
                <div className="mt-4 flex items-center justify-between gap-3" data-lesson-ui>
                  <span className="text-[13px] tabular-nums" style={muted}>{pt ? 'Acertos' : 'Correct'}: {run.questions.slice(0, idx + 1).filter((qq, j) => run.answers[j] === qq.answer).length}/{idx + 1}</span>
                  <button type="button" onClick={nextQ} className="h-10 px-5 rounded-full text-[14px] font-semibold inline-flex items-center gap-1.5" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
                    {idx + 1 < total ? (pt ? 'Próxima' : 'Next') : (pt ? 'Ver resultado' : 'See result')}<ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
