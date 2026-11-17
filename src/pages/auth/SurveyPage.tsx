// Questionário inicial: uma pergunta por tela, minimalista. As respostas alimentam recomendações e a segmentação do admin.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/store/useLanguage'
import { useEntitlements } from '@/store/useEntitlements'
import { LEVEL_HELP, levelFromHelp, SURVEY } from '@/lib/survey'
import { useUiStore } from '@/store/useUiStore'

export function SurveyPage() {
  const pt = useLanguage().locale === 'pt-BR'
  const navigate = useNavigate()
  const load = useEntitlements(s => s.load)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Ajuda para escolher o nível ("Não sei"): 3 perguntas rápidas; o resultado vira a escolha sugerida (pode trocar).
  const [help, setHelp] = useState<{ i: number; hits: number } | null>(null)
  const [suggested, setSuggested] = useState<string | null>(null)
  const setDailyGoal = useUiStore(s => s.setDailyGoalMinutes)
  const q = SURVEY[step]
  const value = answers[q.key]
  const picked = q.multi ? (Array.isArray(value) ? value : []) : (typeof value === 'string' ? [value] : [])
  const last = step === SURVEY.length - 1

  const answerHelp = (k: number) => {
    if (!help) return
    const hits = help.hits + (k === LEVEL_HELP[help.i].answer ? 1 : 0)
    if (help.i + 1 < LEVEL_HELP.length) { setHelp({ i: help.i + 1, hits }); return }
    const lvl = levelFromHelp(hits)
    setHelp(null); setSuggested(lvl)
    setAnswers(a => ({ ...a, self_level: lvl }))
  }
  const next = () => {
    if (q.key === 'self_level' && value === 'unsure') { setHelp({ i: 0, hits: 0 }); return }
    if (last) void finish(false); else setStep(s => s + 1)
  }

  const toggle = (v: string) => {
    if (q.multi) setAnswers(a => ({ ...a, [q.key]: picked.includes(v) ? picked.filter(x => x !== v) : [...picked, v] }))
    else setAnswers(a => ({ ...a, [q.key]: v }))
  }

  const finish = async (skip: boolean) => {
    if (!supabase) return
    setBusy(true); setError('')
    const { error: e } = await supabase.rpc('save_survey', { p_answers: skip ? {} : answers, p_skip: skip })
    if (e) { setBusy(false); setError(pt ? 'Não foi possível salvar. Tente de novo.' : 'Could not save. Try again.'); return }
    // O tempo por dia que a pessoa disse vira a meta de hoje da Home.
    const minutes = Number(answers.daily_minutes)
    if (!skip && minutes > 0) setDailyGoal(minutes)
    await load()
    navigate('/planos?welcome=1', { replace: true })
  }

  return (
    <div className="min-h-dvh flex flex-col px-5" style={{ backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)', paddingTop: 'calc(var(--safe-t, 0px) + 1.25rem)', paddingBottom: 'calc(var(--safe-b, 0px) + 1.25rem)' }}>
      <header className="mx-auto w-full max-w-md flex items-center justify-between h-10">
        {step > 0
          ? <button type="button" onClick={() => (help ? setHelp(null) : setStep(s => s - 1))} className="inline-flex items-center gap-1.5 h-10 px-2 -ml-2 text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}><ArrowLeft className="w-4 h-4" />{pt ? 'Voltar' : 'Back'}</button>
          : <span className="text-[14px] font-semibold">Bookmoo</span>}
        <button type="button" disabled={busy} onClick={() => void finish(true)} className="h-10 px-2 text-[13.5px] underline underline-offset-4" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Pular' : 'Skip'}</button>
      </header>

      <div className="mx-auto w-full max-w-md mt-4 flex gap-1.5" aria-hidden>
        {SURVEY.map((_, i) => <span key={i} className="h-1 flex-1 rounded-full transition-colors duration-300" style={{ backgroundColor: i <= step ? 'var(--theme-text)' : 'var(--theme-border)' }} />)}
      </div>

      <main className="mx-auto w-full max-w-md flex-1 pt-8">
        <AnimatePresence mode="wait">
          <motion.section key={q.key} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
            <p className="text-[12.5px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{step + 1} / {SURVEY.length}</p>
            <h1 className="mt-2 font-display text-[28px] sm:text-[32px] leading-tight">{pt ? q.title.pt : q.title.en}</h1>
            {q.hint && <p className="mt-2 text-[14.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? q.hint.pt : q.hint.en}</p>}
            {help ? (
              <div className="mt-6">
                <p className="text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? `Pergunta ${help.i + 1} de ${LEVEL_HELP.length}` : `Question ${help.i + 1} of ${LEVEL_HELP.length}`} · {pt ? LEVEL_HELP[help.i].q.pt : LEVEL_HELP[help.i].q.en}</p>
                <p className="mt-2 text-[18px] font-medium">“{LEVEL_HELP[help.i].text}”</p>
                <ul className="mt-4 space-y-2">
                  {LEVEL_HELP[help.i].options.map((opt, k) => (
                    <li key={opt}><button type="button" onClick={() => answerHelp(k)} className="w-full min-h-[52px] rounded-2xl border px-4 text-left text-[15px]" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>{opt}</button></li>
                  ))}
                </ul>
                <button type="button" onClick={() => answerHelp(-1)} className="mt-3 text-[13px] underline underline-offset-4" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Não sei' : 'I do not know'}</button>
              </div>
            ) : (
            <>
            {suggested && q.key === 'self_level' && <p className="mt-4 text-[13.5px] rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>{pt ? `Pelas suas respostas, sugerimos ${suggested}. Pode trocar se preferir.` : `From your answers we suggest ${suggested}. You can change it.`}</p>}
            <ul className="mt-6 space-y-2" role={q.multi ? 'group' : 'radiogroup'}>
              {q.options.map(o => {
                const on = picked.includes(o.value)
                return (
                  <li key={o.value}>
                    <button type="button" role={q.multi ? 'checkbox' : 'radio'} aria-checked={on} onClick={() => toggle(o.value)}
                      className="w-full min-h-[52px] rounded-2xl border px-4 flex items-center justify-between gap-3 text-left text-[15px] transition-colors"
                      style={{ borderColor: on ? 'var(--theme-text)' : 'var(--theme-border)', borderWidth: on ? 2 : 1, backgroundColor: 'var(--theme-card-bg)' }}>
                      <span className="py-2.5">
                        <span className="block">{pt ? o.pt : o.en}{suggested === o.value && <span className="ml-2 text-[12px] font-medium" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? '· sugerido' : '· suggested'}</span>}</span>
                        {o.desc && <span className="block mt-0.5 text-[12.5px] leading-snug" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? o.desc.pt : o.desc.en}</span>}
                        {o.example && <span className="block mt-1 text-[12.5px] italic" style={{ color: 'var(--theme-text-secondary)' }}>“{o.example}”</span>}
                      </span>
                      {on && <Check className="w-4 h-4 shrink-0" strokeWidth={2.4} />}
                    </button>
                  </li>
                )
              })}
            </ul>
            </>
            )}
          </motion.section>
        </AnimatePresence>
      </main>

      <footer className="mx-auto w-full max-w-md pt-4">
        {error && <p role="alert" className="mb-3 text-[14px]" style={{ color: '#b42318' }}>{error}</p>}
        {!help && <button type="button" disabled={busy || picked.length === 0} onClick={next}
          className="h-12 w-full rounded-2xl text-[15.5px] font-semibold disabled:opacity-40" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : last ? (pt ? 'Concluir' : 'Finish') : (pt ? 'Continuar' : 'Continue')}
        </button>}
      </footer>
    </div>
  )
}
