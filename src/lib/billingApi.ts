import type { TutorAction } from '@/lib/tutorActions'
import { getEffort } from '@/lib/effort'
// Chamadas às Edge Functions de assinatura, conversa e análise.
import { supabase } from '@/lib/supabase'
import { paywallForError } from '@/components/billing/Paywall'
import { refreshEntitlements } from '@/store/useEntitlements'
import type { PlanId } from '@/lib/plans'

export class ApiError extends Error {
  constructor(public code: string, public detail?: string) { super(code) }
}

export async function callFn<T>(fn: string, body: Record<string, unknown>, opts: { paywall?: boolean } = {}): Promise<T> {
  if (!supabase) throw new ApiError('supabase_not_configured')
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) {
    let code = 'request_failed'
    let detail: string | undefined = error.message
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      const j = await ctx.json().catch(() => null) as { error?: string; detail?: string } | null
      if (j?.error) code = j.error
      if (j?.detail) detail = j.detail
    }
    if (opts.paywall !== false) paywallForError(code, detail)
    throw new ApiError(code, detail)
  }
  return data as T
}

// ---------------------------------------------------------------------------
// Assinatura
// ---------------------------------------------------------------------------
export type Quote = { kind: 'new' | 'upgrade' | 'same' | 'downgrade'; chargeCents?: number; remainingCents?: number; extraDays?: number }

export const billing = {
  quote: (plan: PlanId, cycle: 'monthly' | 'annual' = 'monthly') => callFn<Quote>('billing', { action: 'quote', plan, cycle }, { paywall: false }),
  checkout: (plan: PlanId, guardian = false, cycle: 'monthly' | 'annual' = 'monthly') => callFn<{ url: string; intent: string }>('billing', { action: 'checkout', plan, guardian, cycle, origin: window.location.origin }, { paywall: false }),
  status: () => callFn<{ subscription: { plan_id: PlanId; status: string; billing_cycle: 'monthly' | 'annual'; current_period_end: string } | null; claimed: string[]; confirmed: boolean }>('billing', { action: 'status' }, { paywall: false }).finally(refreshEntitlements),
  intentStatus: (intent: string) => callFn<{ intent: { id: string; status: string; plan_id: PlanId; kind: string; bonus_credits: number } }>('billing', { action: 'intent-status', intent }, { paywall: false }),
  cancel: (reason?: string) => callFn<{ ok: true; until: string }>('billing', { action: 'cancel', reason }, { paywall: false }).finally(refreshEntitlements),
  resume: () => callFn<{ ok: true }>('billing', { action: 'resume' }, { paywall: false }).finally(refreshEntitlements),
  downgrade: (plan: PlanId) => callFn<{ ok: true; until: string }>('billing', { action: 'downgrade', plan }, { paywall: false }).finally(refreshEntitlements),
  refund: () => callFn<{ ok: true }>('billing', { action: 'refund' }, { paywall: false }),
  invoice: () => callFn<{ url: string; amountCents: number; dueAt: string }>('billing', { action: 'invoice', origin: window.location.origin }, { paywall: false }),
}

export const BILLING_ERRORS: Record<string, { pt: string; en: string }> = {
  billing_not_configured: { pt: 'O pagamento ainda não está disponível. Tente de novo em breve.', en: 'Payments are not available yet. Please try again soon.' },
  email_unconfirmed: { pt: 'Confirme seu e-mail antes de assinar.', en: 'Confirm your email before subscribing.' },
  guardian_required: { pt: 'Menores de 18 anos precisam da autorização de um responsável.', en: 'Under-18s need a guardian’s permission.' },
  minor_blocked: { pt: 'Menores de 12 anos não podem assinar. Peça a um responsável.', en: 'Under-12s cannot subscribe. Ask a guardian.' },
  account_flagged: { pt: 'Sua conta está em análise. Fale com o suporte.', en: 'Your account is under review. Contact support.' },
  past_due: { pt: 'Regularize o pagamento pendente antes de trocar de plano.', en: 'Settle your pending payment before changing plans.' },
  same_plan: { pt: 'Você já está neste plano.', en: 'You are already on this plan.' },
  use_downgrade: { pt: 'Para um plano menor, use "Mudar para plano menor" em Minha assinatura.', en: 'To move to a smaller plan, use “Downgrade” in My subscription.' },
  refund_window_closed: { pt: 'O prazo de 7 dias para reembolso já passou.', en: 'The 7-day refund window has passed.' },
  no_subscription: { pt: 'Você não tem uma assinatura ativa.', en: 'You have no active subscription.' },
  gateway_error: { pt: 'O pagamento está instável agora. Tente de novo em instantes.', en: 'Payments are unstable right now. Try again shortly.' },
  no_invoice: { pt: 'Esta assinatura não é paga por fatura Pix.', en: 'This subscription is not billed by Pix invoice.' },
  canceled: { pt: 'A assinatura já está cancelada. Para continuar, assine de novo.', en: 'The subscription is already cancelled. Subscribe again to continue.' },
  nothing_to_resume: { pt: 'Esta assinatura não está cancelada.', en: 'This subscription is not cancelled.' },
  invalid_plan: { pt: 'Esse plano não vale para esta mudança.', en: 'That plan is not valid for this change.' },
  intent_not_found: { pt: 'Não encontramos esse pagamento. Atualize a página.', en: 'Payment not found. Refresh the page.' },
  intent_failed: { pt: 'O pagamento não foi concluído. Tente de novo.', en: 'The payment did not go through. Try again.' },
  invalid_email: { pt: 'E-mail inválido.', en: 'Invalid email.' },
  resubscribe_required: { pt: 'A assinatura já foi cancelada no pagamento. Para continuar depois do fim do período, assine de novo.', en: 'The subscription was already canceled. Subscribe again after the period ends.' },
}

// ---------------------------------------------------------------------------
// Conversa (Cenas, Tutor livre, Tutor de leitura)
// ---------------------------------------------------------------------------
export type Feedback = {
  score: number; cefr: string; criteria: Record<string, number>; summary: string; tips: string[]
  corrections: { said: string; better: string; why: string }[]; locked_corrections: number
  new_words: { word: string; meaning: string }[]; goals_met: number[]
}

export const conversation = {
  start: (body: { kind: 'scene' | 'tutor' | 'reader'; sceneKey?: string; sceneId?: string; minutes?: number; bookId?: string; level?: string; opening?: string; characterId?: string }) =>
    callFn<{ sessionId: string; plannedSeconds?: number; opening?: string; secondsAvailable?: number; scene?: { persona: { name: string; emoji: string; gender: 'female' | 'male'; pace: string }; goals: string[]; usefulPhrases: string[]; fillers: string[]; ambient?: string } }>('conversation', { action: 'start', effort: getEffort(), ...body }).finally(refreshEntitlements),
  turn: (body: { sessionId: string; text: string; confidence?: number; filler?: string | null; page?: number; level?: string; langMode?: TutorLangMode; tutorName?: string; characterId?: string }) =>
    callFn<{ reply: string; mood?: string; suggestTutor?: string | null; segments?: SpeechSegment[] | null; actions?: TutorAction[]; goalsMet?: number[]; wrapUp?: boolean; highlight?: string | null; offerSave?: boolean; remaining?: number | null }>('conversation', { action: 'turn', effort: getEffort(), ...body }),
  assist: (sessionId: string, mode: 'hint' | 'translate') =>
    callFn<{ suggestions?: { en: string; pt: string }[]; translation?: string }>('conversation', { action: 'assist', sessionId, mode }),
  end: (sessionId: string, metrics?: { wpm?: number; avgResponseMs?: number; unclear?: number }) =>
    callFn<{ feedback?: Feedback | null; reason?: string; ok?: boolean }>('conversation', { action: 'end', sessionId, metrics }, { paywall: false }).finally(refreshEntitlements),
  createScene: (body: { title?: string; setting: string; personaName?: string; personaRole?: string; personaTraits?: string; goal: string; level: string }) =>
    callFn<{ scene?: Record<string, unknown>; rejected?: boolean; reason?: string }>('conversation', { action: 'create-scene', ...body }),
}

// ---------------------------------------------------------------------------
// Raio-X e Histórias de reforço
// ---------------------------------------------------------------------------
export type SkillKey = 'speaking' | 'conversation' | 'vocabulary' | 'dictation' | 'consistency'
export type Insight = {
  id: string; created_at: string
  summary?: { level?: string; skills?: { scores: Record<SkillKey, number | null>; overall: number | null; metrics: Record<string, number | null>; window_days: number } }
  report: {
    progress?: string; study_plan?: string[]
    headline?: string; strengths?: string[]; difficulties?: { title: string; evidence: string; tip: string }[]
    focus_words?: string[]; grammar_focus?: string; recommendation?: { scene?: string; practice?: string }; level_estimate?: string
  }
}
export type ReinforcementStory = {
  id: string; title: string; body: string; level: string; target_words: string[]; grammar_focus: string
  quiz: { question: string; options: string[]; answer: number }[]; created_at: string
}

export const coach = {
  insights: (level: string) => callFn<{ insight: Insight; next_at: string; reused?: boolean }>('coach', { action: 'insights', level }),
  story: (level: string, words?: string[], focus?: string) => callFn<{ story: ReinforcementStory }>('coach', { action: 'story', level, words, focus }).finally(refreshEntitlements),
}

// ---------------------------------------------------------------------------
/** Idioma da tutora: automático (híbrido no A1/A2), híbrido, só português (exemplos em inglês) ou só inglês. */
export type TutorLangMode = 'auto' | 'hybrid' | 'pt' | 'en'
export type SpeechSegment = { lang: 'en' | 'pt'; text: string }

// Estudar a página (lição) e Desafio (quiz)
// ---------------------------------------------------------------------------
export type LessonPair = { en: string; pt: string }
export type LessonUnit = {
  title: string; explanation: string; formula: string; contrast?: string
  from_page: LessonPair[]; other: LessonPair[]
  mistake: { wrong: string; right: string; why: string } | null
  practice: { prompt: string; answer: string } | null
}
/** Dosagem de idiomas da aula conforme o nível: 'pt' (A1-A2), 'mix' (B1), 'en-pt' (B2), 'en' (C1-C2). */
export type LessonBalance = 'pt' | 'mix' | 'en-pt' | 'en'
/** Aula da página ("Estudar"). v3 = aula completa por nível; v2 (antiga) é normalizada com os campos novos vazios. */
export type GrammarContent = {
  v: 2 | 3
  level?: string
  balance?: LessonBalance
  title: string
  summary: string
  minutes?: number
  goals: string[]
  sentences: { en: string; pt: string; why: string; parts: { chunk: string; role: string }[] }[]
  vocabulary: { word: string; ipa?: string; pos?: string; meaning: string; in_context?: string; example: string; example_pt?: string; other?: LessonPair | null; note: string }[]
  units: LessonUnit[]
  tenses: { sentence: string; tense: string; time: 'past' | 'present' | 'future'; why: string }[]
  questions_negatives: { sentence: string; why: string; build: string }[]
  phrasal: { phrase: string; together: string; apart: string; example: string; example_pt?: string; register?: string }[]
  attention: { title: string; explain: string; wrong: string; right: string }[]
  style: { form: string; modern: string; explain: string }[]
  pronunciation: { word: string; ipa?: string; tip: string }[]
  recap: string[]
  tip: string
}
/** Completa os campos que a aula antiga (v2) não tem, para a tela nunca quebrar. */
export function normalizeLesson(raw: Partial<GrammarContent> | null | undefined): GrammarContent | null {
  if (!raw || typeof raw !== 'object') return null
  const list = <T,>(v: T[] | undefined) => (Array.isArray(v) ? v : [])
  return {
    ...raw,
    v: raw.v === 3 ? 3 : 2,
    title: raw.title ?? '', summary: raw.summary ?? '', tip: raw.tip ?? '',
    goals: list(raw.goals), sentences: list(raw.sentences), vocabulary: list(raw.vocabulary), units: list(raw.units),
    tenses: list(raw.tenses), questions_negatives: list(raw.questions_negatives), phrasal: list(raw.phrasal),
    attention: list(raw.attention), style: list(raw.style), pronunciation: list(raw.pronunciation), recap: list(raw.recap),
  }
}
export type QuizQuestion =
  | { type: 'choice'; prompt: string; options: string[]; answer: number; explain: string }
  | { type: 'order'; prompt: string; words: string[]; answer: string; explain: string }
export type Quiz = { title: string; questions: QuizQuestion[] }
export type LessonExercise = { prompt: string; options: string[]; answer: number; explain: string; skill: 'vocabulario' | 'gramatica' | 'expressao' | 'armadilha' | 'compreensao'; topic: string }
export type LessonChatMsg = { role: 'user' | 'assistant'; content: string }
export type LessonExplain = { term: string; ipa: string; pos: string; meaning: string; in_context: string; examples: LessonPair[]; note: string }
export type LessonDeepen =
  | { mode: 'expand'; explanation: string; steps: string[]; examples: LessonPair[]; remember: string }
  | { mode: 'examples'; examples: (LessonPair & { note: string })[] }

type LessonGet = { found: boolean; content: GrammarContent | null; shared: boolean; outdated: boolean }
const lessonOf = <T extends { content: GrammarContent | null }>(r: T) => ({ ...r, content: normalizeLesson(r.content) })

export const grammar = {
  get: (bookId: string, page: number, lang: 'pt' | 'en', level: string) =>
    callFn<LessonGet>('grammar', { action: 'get', bookId, page, lang, level }, { paywall: false }).then(lessonOf),
  generate: (bookId: string, page: number, lang: 'pt' | 'en', level: string) =>
    callFn<LessonGet & { charged: boolean }>('grammar', { action: 'generate', bookId, page, lang, level }).then(lessonOf).finally(refreshEntitlements),
  exercises: (bookId: string, page: number, lang: 'pt' | 'en', level: string, avoid: string[]) =>
    callFn<{ questions: LessonExercise[] }>('grammar', { action: 'exercises', bookId, page, lang, level, avoid }).finally(refreshEntitlements),
  chat: (bookId: string, page: number, lang: 'pt' | 'en', level: string, question: string, history: LessonChatMsg[]) =>
    callFn<{ answer: string }>('grammar', { action: 'chat', bookId, page, lang, level, question, history }).finally(refreshEntitlements),
  explain: (bookId: string, page: number, lang: 'pt' | 'en', level: string, term: string, context: string) =>
    callFn<LessonExplain>('grammar', { action: 'explain', bookId, page, lang, level, term, context }).finally(refreshEntitlements),
  deepen: (bookId: string, page: number, lang: 'pt' | 'en', level: string, mode: 'expand' | 'examples', item: string, opts: { question?: string; avoid?: string[] } = {}) =>
    callFn<LessonDeepen>('grammar', { action: 'deepen', bookId, page, lang, level, mode, item, ...opts }).finally(refreshEntitlements),
  image: (bookId: string, page: number, lang: 'pt' | 'en', sentence: string, item: string) =>
    callFn<{ path: string; url: string | null }>('grammar', { action: 'image', bookId, page, lang, sentence, item }).finally(refreshEntitlements),
  quizGet: (bookId: string, page: number, tier: number, lang: 'pt' | 'en') =>
    callFn<{ quiz: Quiz | null; tier: number }>('grammar', { action: 'quiz-get', bookId, page, tier, lang }, { paywall: false }),
  quiz: (bookId: string, page: number, tier: number, lang: 'pt' | 'en', level: string) =>
    callFn<{ quiz: Quiz; tier: number; charged: boolean }>('grammar', { action: 'quiz', bookId, page, tier, lang, level }).finally(refreshEntitlements),
  result: (bookId: string, page: number, tier: number, correct: number, total: number) =>
    callFn<{ ok: true }>('grammar', { action: 'quiz-result', bookId, page, tier, correct, total }, { paywall: false }),
  history: (bookId: string) =>
    callFn<{ results: { correct: number; total: number; tier: number; page: number }[] }>('grammar', { action: 'quiz-history', bookId }, { paywall: false }),
}

/** Plano escolhido no site antes do login: guardado para abrir o checkout assim que a conta estiver pronta. */
export const WANTED_PLAN_KEY = 'upo-wanted-plan'
export function rememberWantedPlan(plan: string | null, cycle: string | null) {
  try { if (plan && plan !== 'free') localStorage.setItem(WANTED_PLAN_KEY, JSON.stringify({ plan, cycle: cycle === 'mensal' ? 'mensal' : 'anual', at: Date.now() })) } catch { /* sem storage */ }
}
export function takeWantedPlan(): { plan: PlanId; cycle: 'mensal' | 'anual' } | null {
  try {
    const raw = localStorage.getItem(WANTED_PLAN_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { plan: PlanId; cycle: 'mensal' | 'anual'; at: number }
    if (Date.now() - v.at > 3 * 86400_000) { localStorage.removeItem(WANTED_PLAN_KEY); return null }
    return v
  } catch { return null }
}
export function clearWantedPlan() { try { localStorage.removeItem(WANTED_PLAN_KEY) } catch { /* sem storage */ } }
