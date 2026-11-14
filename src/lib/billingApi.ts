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
export type Quote = { kind: 'new' | 'upgrade' | 'same' | 'downgrade'; chargeCents?: number; discountCents?: number; bonusCredits?: number }

export const billing = {
  quote: (plan: PlanId) => callFn<Quote>('billing', { action: 'quote', plan }, { paywall: false }),
  checkout: (plan: PlanId, guardian = false) => callFn<{ url: string; intent: string }>('billing', { action: 'checkout', plan, guardian }, { paywall: false }),
  intentStatus: (intent: string) => callFn<{ intent: { id: string; status: string; plan_id: PlanId; kind: string; bonus_credits: number } }>('billing', { action: 'intent-status', intent }, { paywall: false }),
  cancel: (reason?: string) => callFn<{ ok: true; until: string }>('billing', { action: 'cancel', reason }, { paywall: false }).finally(refreshEntitlements),
  resume: () => callFn<{ ok: true }>('billing', { action: 'resume' }, { paywall: false }).finally(refreshEntitlements),
  downgrade: (plan: PlanId) => callFn<{ ok: true; until: string }>('billing', { action: 'downgrade', plan }, { paywall: false }).finally(refreshEntitlements),
  refund: () => callFn<{ ok: true }>('billing', { action: 'refund' }, { paywall: false }),
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
  start: (body: { kind: 'scene' | 'tutor' | 'reader'; sceneKey?: string; sceneId?: string; minutes?: number; bookId?: string }) =>
    callFn<{ sessionId: string; plannedSeconds?: number; opening?: string; secondsAvailable?: number; scene?: { persona: { name: string; emoji: string; gender: 'female' | 'male'; pace: string }; goals: string[]; usefulPhrases: string[]; fillers: string[]; ambient?: string } }>('conversation', { action: 'start', ...body }).finally(refreshEntitlements),
  turn: (body: { sessionId: string; text: string; confidence?: number; filler?: string | null; page?: number }) =>
    callFn<{ reply: string; goalsMet?: number[]; wrapUp?: boolean; highlight?: string | null; offerSave?: boolean; remaining?: number | null }>('conversation', { action: 'turn', ...body }),
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
export type Insight = {
  id: string; created_at: string
  report: {
    headline?: string; strengths?: string[]; difficulties?: { title: string; evidence: string; tip: string }[]
    focus_words?: string[]; grammar_focus?: string; recommendation?: { scene?: string; practice?: string }; level_estimate?: string
  }
}
export type ReinforcementStory = {
  id: string; title: string; body: string; level: string; target_words: string[]; grammar_focus: string
  quiz: { question: string; options: string[]; answer: number }[]; created_at: string
}

export const coach = {
  insights: () => callFn<{ insight: Insight; next_at: string }>('coach', { action: 'insights' }),
  story: (words?: string[], focus?: string) => callFn<{ story: ReinforcementStory }>('coach', { action: 'story', words, focus }).finally(refreshEntitlements),
}
