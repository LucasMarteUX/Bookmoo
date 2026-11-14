// Créditos, minutos e custo de IA nas Edge Functions.
// Fluxo de toda geração: checa plano → reserva → chama a IA → confirma (ou devolve) → registra o custo real.
import { AsyncLocalStorage } from 'node:async_hooks'
import { adminClient } from './tts.ts'
import { AiError } from './ai.ts'

export type Limits = {
  library: boolean
  imports: number | null
  text_books: number | null
  pages: number | null
  mosaic: number | null
  custom_style: boolean
  tutor: boolean
  scenes: 'demo' | 'all'
  scenes_create: boolean
  free_talk: boolean
  insights: 'none' | 'weekly' | 'on_demand'
  stories: number | null
  max_scene_minutes: number
  feedback: 'summary' | 'full' | 'detailed'
  monthly_report: boolean
}

export type Entitlements = {
  plan: string
  plan_rank: number
  limits: Limits
  is_admin: boolean
  usage: Record<string, number>
  credits_available: number
  seconds_available: number
  birth_date: string | null
}

/** Custo em créditos de cada operação (seção 2.3 do plano). */
export const CREDIT_COST = {
  'comic-page': 10,
  'comic-replan': 10,
  'comic-panel': 5,
  'style-extract': 3,
  'detect-characters': 1,
  'explain': 1,
  'variant-story': 1,
  'vocab-explain': 1,
  'vocab-story': 1,
  'vocab-image': 1,
  'transcribe-page': 1,
  'scene-cover': 2,
} as const
export type CreditOp = keyof typeof CREDIT_COST

export async function entitlements(userId: string): Promise<Entitlements> {
  const { data, error } = await adminClient().rpc('entitlements_for', { p_user: userId })
  if (error || !data) throw new AiError(`entitlements_failed: ${error?.message ?? ''}`, 500, 'entitlements_failed')
  return data as Entitlements
}

/** Recurso exclusivo de plano pago → 402 plan_required (o app abre o convite de assinatura). */
export function requireFeature(e: Entitlements, ok: boolean, feature: string) {
  if (e.is_admin || ok) return
  throw new AiError(`plan_required:${feature}`, 402, 'plan_required')
}

// ---------------------------------------------------------------------------
// Medição do custo real de cada chamada (tokens e imagens que o provedor devolve)
// ---------------------------------------------------------------------------
type UsageItem = { provider: string; model: string; input: number; output: number; images: number; quality?: string; cost: number }
const sink = new AsyncLocalStorage<UsageItem[]>()

const TEXT_PRICE: Record<string, [number, number]> = {
  // US$ por 1M tokens [entrada, saída]
  'gpt-4.1-mini': [0.4, 1.6],
  'gemini-2.5-flash': [0.3, 2.5],
}
const IMAGE_PRICE: Record<string, number> = {
  // US$ por imagem gpt-image-2 (tabela pública de mai/2026); referências de continuidade somam à parte.
  'low:1024x1024': 0.006, 'low:1024x1536': 0.005,
  'medium:1024x1024': 0.053, 'medium:1024x1536': 0.041,
  'high:1024x1024': 0.211, 'high:1024x1536': 0.165,
}
const REF_IMAGE_USD = 0.01
const GEMINI_IMAGE_USD = 0.039

export function recordText(provider: string, model: string, input: number, output: number) {
  const p = TEXT_PRICE[model] ?? [0.5, 2]
  sink.getStore()?.push({ provider, model, input, output, images: 0, cost: (input * p[0] + output * p[1]) / 1e6 })
}

export function recordImage(provider: string, model: string, quality: string, size: string, refs: number) {
  const base = provider === 'gemini' ? GEMINI_IMAGE_USD : (IMAGE_PRICE[`${quality}:${size}`] ?? 0.05)
  sink.getStore()?.push({ provider, model, input: 0, output: 0, images: 1, quality, cost: base + refs * REF_IMAGE_USD })
}

async function logUsage(userId: string, operation: string, items: UsageItem[], extra: { status: 'ok' | 'failed' | 'cache_hit'; credits?: number; seconds?: number; latency?: number; plan?: string; meta?: Record<string, unknown> }) {
  const sum = items.reduce((a, i) => ({
    input: a.input + i.input, output: a.output + i.output, images: a.images + i.images, cost: a.cost + i.cost,
  }), { input: 0, output: 0, images: 0, cost: 0 })
  const first = items[0]
  await adminClient().from('ai_usage').insert({
    user_id: userId, operation, provider: first?.provider ?? null, model: [...new Set(items.map((i) => i.model))].join(',') || null,
    input_tokens: sum.input, output_tokens: sum.output, images: sum.images, image_quality: items.find((i) => i.quality)?.quality ?? null,
    cost_usd: Number(sum.cost.toFixed(6)), credits: extra.credits ?? 0, seconds: extra.seconds ?? 0, status: extra.status,
    latency_ms: extra.latency ?? null, plan_id: extra.plan ?? null, meta: extra.meta ?? null,
  }).then(() => undefined, () => undefined)
}

/** Teto global de gasto por dia: protege contra abuso e bug de laço. */
async function assertBudget() {
  const db = adminClient()
  const [{ data: setting }, { data: spent }] = await Promise.all([
    db.from('app_settings').select('value').eq('key', 'ai_daily_budget_usd').maybeSingle(),
    db.rpc('ai_spent_today'),
  ])
  const budget = Number(setting?.value ?? 40)
  if (Number(spent ?? 0) >= budget) throw new AiError('ai_paused', 503, 'ai_paused')
}

function reserveError(message: string): AiError {
  if (/no_credits/.test(message)) return new AiError('no_credits', 402, 'no_credits')
  if (/no_minutes/.test(message)) return new AiError('no_minutes', 402, 'no_minutes')
  if (/cap_reached/.test(message)) return new AiError('cap_reached', 402, 'cap_reached')
  return new AiError(`reserve_failed: ${message}`, 500, 'reserve_failed')
}

/**
 * Executa uma geração cobrando créditos. `cap` = teto mensal do recurso no plano (ex.: 3 páginas no Grátis).
 * Sucesso: confirma; falha: devolve. O custo real sempre fica registrado (inclusive em falha).
 */
export async function metered<T>(userId: string, op: CreditOp | string, fn: () => Promise<T>, opts: {
  credits?: number; capField?: string; cap?: number | null; ref?: string; key?: string; plan?: string; meta?: Record<string, unknown>
} = {}): Promise<T> {
  const credits = opts.credits ?? (CREDIT_COST as Record<string, number>)[op] ?? 0
  await assertBudget()
  const db = adminClient()
  let reservation: string | null = null
  if (credits > 0 || (opts.capField && opts.cap != null)) {
    const { data, error } = await db.rpc('credits_reserve', {
      p_user: userId, p_unit: 'credits', p_amount: credits, p_operation: op, p_ref: opts.ref ?? null,
      p_key: opts.key ?? null, p_cap_field: opts.capField ?? null, p_cap: opts.cap ?? null,
    })
    if (error) throw reserveError(error.message)
    reservation = data as string
  }
  const items: UsageItem[] = []
  const t0 = Date.now()
  try {
    const out = await sink.run(items, fn)
    if (reservation) await db.rpc('credits_commit', { p_reservation: reservation, p_actual: null })
    await logUsage(userId, op, items, { status: 'ok', credits, latency: Date.now() - t0, plan: opts.plan, meta: opts.meta })
    return out
  } catch (e) {
    if (reservation) await db.rpc('credits_release', { p_reservation: reservation })
    await logUsage(userId, op, items, { status: 'failed', latency: Date.now() - t0, plan: opts.plan, meta: { ...(opts.meta ?? {}), error: String((e as Error)?.message ?? e).slice(0, 200) } })
    throw e
  }
}

/** Geração sem custo em créditos (ex.: glosa, layout de balões), só para medir custo. */
export async function measured<T>(userId: string, op: string, fn: () => Promise<T>, plan?: string): Promise<T> {
  await assertBudget()
  const items: UsageItem[] = []
  const t0 = Date.now()
  try {
    const out = await sink.run(items, fn)
    await logUsage(userId, op, items, { status: 'ok', latency: Date.now() - t0, plan })
    return out
  } catch (e) {
    await logUsage(userId, op, items, { status: 'failed', latency: Date.now() - t0, plan })
    throw e
  }
}

export async function logCacheHit(userId: string, op: string, plan?: string) {
  await logUsage(userId, op, [], { status: 'cache_hit', plan })
}

// ---------------------------------------------------------------------------
// Minutos de conversa
// ---------------------------------------------------------------------------
export async function reserveSeconds(userId: string, seconds: number, op: string, ref: string, key?: string): Promise<string> {
  const { data, error } = await adminClient().rpc('credits_reserve', {
    p_user: userId, p_unit: 'seconds', p_amount: seconds, p_operation: op, p_ref: ref, p_key: key ?? null, p_cap_field: null, p_cap: null,
  })
  if (error) throw reserveError(error.message)
  return data as string
}

export async function commitSeconds(reservation: string, actual: number) {
  await adminClient().rpc('credits_commit', { p_reservation: reservation, p_actual: Math.max(0, Math.round(actual)) })
}

export async function releaseSeconds(reservation: string) {
  await adminClient().rpc('credits_release', { p_reservation: reservation })
}

export { sink as usageSink }
