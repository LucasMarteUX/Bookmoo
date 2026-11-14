// Assinaturas: adaptador do gateway (Zouti hoje; Apple/Google no futuro) + máquina de estados.
// Só o webhook muda o plano. O retorno do checkout nunca libera nada sozinho.
//
// Configuração (secrets das Edge Functions):
//   ZOUTI_CHECKOUT_URL_ESSENCIAL / _PLUS / _PRO  → link de checkout de cada plano no painel da Zouti
//   ZOUTI_PRODUCT_ESSENCIAL / _PLUS / _PRO       → id do produto/oferta (como vem no webhook), para reconhecer o plano
//   ZOUTI_WEBHOOK_SECRET                          → segredo do webhook (HMAC-SHA256 do corpo, header x-zouti-signature)
//   ZOUTI_REF_PARAM (opcional, padrão "src")      → parâmetro da URL que a Zouti devolve no webhook com o id da intenção
//
// ⚠️ O formato do corpo do webhook da Zouti não é público. A leitura abaixo é tolerante (procura e-mail, status,
// produto, valor e ids em qualquer nível do JSON). Validar com o "Testar webhook" do painel antes de vender.
import { adminClient, log } from './tts.ts'
import { emails } from './email.ts'

export const PAID_PLANS = ['essencial', 'plus', 'pro'] as const
export type PaidPlan = typeof PAID_PLANS[number]
export type Plan = { id: string; name: string; price_cents: number; monthly_credits: number; monthly_minutes: number; rank: number }

export type NormalizedEvent = {
  eventId: string
  kind: 'paid' | 'failed' | 'canceled' | 'refunded' | 'disputed' | 'ignored'
  type: string
  email: string | null
  intentId: string | null
  subscriptionRef: string | null
  chargeRef: string | null
  planId: string | null
  amountCents: number | null
  feeCents: number | null
  method: string | null
}

const env = (k: string) => (Deno.env.get(k) ?? '').trim()

export function checkoutUrlFor(plan: string): string | null {
  const url = env(`ZOUTI_CHECKOUT_URL_${plan.toUpperCase()}`)
  return url || null
}

export function buildCheckoutUrl(base: string, intentId: string, email: string, name?: string) {
  const u = new URL(base)
  u.searchParams.set(env('ZOUTI_REF_PARAM') || 'src', intentId)
  u.searchParams.set('utm_content', intentId)
  u.searchParams.set('email', email)
  if (name) u.searchParams.set('name', name)
  return u.toString()
}

// ---------------------------------------------------------------------------
// Assinatura do webhook
// ---------------------------------------------------------------------------
function hex(buf: ArrayBuffer) { return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('') }

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

export async function verifySignature(raw: string, req: Request): Promise<boolean> {
  const secret = env('ZOUTI_WEBHOOK_SECRET')
  if (!secret) return false
  const header = req.headers.get('x-zouti-signature') ?? req.headers.get('x-signature') ?? ''
  const token = req.headers.get('x-webhook-token') ?? new URL(req.url).searchParams.get('token') ?? ''
  if (token && safeEqual(token, secret)) return true // alternativa: token fixo na URL/headers
  if (!header) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)))
  const given = header.replace(/^sha256=/i, '').split(',').map((p) => p.split('=').pop()!.trim())
  return given.some((g) => safeEqual(g.toLowerCase(), mac))
}

// ---------------------------------------------------------------------------
// Leitura tolerante do evento
// ---------------------------------------------------------------------------
function findValue(obj: unknown, names: string[], depth = 0): unknown {
  if (!obj || typeof obj !== 'object' || depth > 6) return undefined
  const rec = obj as Record<string, unknown>
  for (const n of names) if (rec[n] != null && typeof rec[n] !== 'object') return rec[n]
  for (const v of Object.values(rec)) {
    const found = findValue(v, names, depth + 1)
    if (found !== undefined) return found
  }
  return undefined
}

function toCents(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(String(v).replace(',', '.'))
  if (!Number.isFinite(n)) return null
  return Number.isInteger(n) && n > 1000 ? n : Math.round(n * 100) // valores grandes inteiros já vêm em centavos
}

function classify(type: string, status: string): NormalizedEvent['kind'] {
  const t = `${type} ${status}`.toLowerCase()
  if (/chargeback|disput|contest/.test(t)) return 'disputed'
  if (/estorn|refund|reembols/.test(t)) return 'refunded'
  if (/cancel/.test(t)) return 'canceled'
  if (/recus|refused|declin|failed|falh|atras|overdue|unpaid|expired/.test(t)) return 'failed'
  if (/aprovad|approved|paid|pago|ativad|activ|renov|renew|complete/.test(t)) return 'paid'
  return 'ignored'
}

export function normalize(payload: Record<string, unknown>, headerEventId: string | null): NormalizedEvent {
  const type = String(findValue(payload, ['event', 'type', 'event_type', 'evento']) ?? '')
  const status = String(findValue(payload, ['status', 'payment_status', 'order_status', 'situacao']) ?? '')
  const ref = env('ZOUTI_REF_PARAM') || 'src'
  const intent = String(findValue(payload, [ref, 'utm_content', 'external_reference', 'external_id', 'src']) ?? '')
  const product = String(findValue(payload, ['product_id', 'offer_id', 'plan_id', 'productId', 'offerId']) ?? '')
  const planId = PAID_PLANS.find((p) => env(`ZOUTI_PRODUCT_${p.toUpperCase()}`) && env(`ZOUTI_PRODUCT_${p.toUpperCase()}`) === product) ?? null
  const chargeRef = String(findValue(payload, ['transaction_id', 'charge_id', 'order_id', 'payment_id', 'id']) ?? '') || null
  const subRef = String(findValue(payload, ['subscription_id', 'subscriptionId', 'assinatura_id', 'contract_id']) ?? '') || null
  return {
    eventId: headerEventId || String(findValue(payload, ['event_id', 'webhook_id']) ?? '') || `${type}:${chargeRef ?? ''}:${status}`,
    kind: classify(type, status),
    type: `${type}|${status}`.slice(0, 120),
    email: String(findValue(payload, ['email', 'customer_email', 'buyer_email']) ?? '').toLowerCase() || null,
    intentId: /^[\da-f-]{36}$/i.test(intent) ? intent : null,
    subscriptionRef: subRef,
    chargeRef,
    planId,
    amountCents: toCents(findValue(payload, ['amount', 'total', 'value', 'price', 'valor', 'amount_paid'])),
    feeCents: toCents(findValue(payload, ['fee', 'fees', 'tax', 'taxa'])),
    method: String(findValue(payload, ['payment_method', 'method', 'forma_pagamento']) ?? '') || null,
  }
}

// ---------------------------------------------------------------------------
// Máquina de estados
// ---------------------------------------------------------------------------
const addMonth = (d: Date) => { const x = new Date(d); x.setMonth(x.getMonth() + 1); return x }

async function userByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const { data } = await adminClient().rpc('user_id_by_email', { p_email: email })
  return data ? { id: data as string, email } : null
}

export async function applyEvent(ev: NormalizedEvent): Promise<string> {
  const db = adminClient()
  if (ev.kind === 'ignored') return 'ignored'

  // Quem é: pela intenção (mais seguro), pela assinatura já conhecida, ou pelo e-mail.
  const { data: intent } = ev.intentId
    ? await db.from('checkout_intents').select('*').eq('id', ev.intentId).maybeSingle()
    : { data: null }
  const { data: knownSub } = ev.subscriptionRef
    ? await db.from('subscriptions').select('*').eq('provider', 'zouti').eq('provider_subscription_id', ev.subscriptionRef).maybeSingle()
    : { data: null }
  let userId: string | null = intent?.user_id ?? knownSub?.user_id ?? null
  let email = ev.email
  if (!userId && email) userId = (await userByEmail(email))?.id ?? null
  if (!userId) throw new Error('user_not_matched')
  if (!email) {
    const { data: u } = await db.auth.admin.getUserById(userId)
    email = u.user?.email ?? null
  }
  const { data: plans } = await db.from('plans').select('*')
  const planOf = (id: string | null | undefined) => (plans ?? []).find((p: Plan) => p.id === id) as Plan | undefined
  const graceDays = 3

  if (ev.kind === 'paid') {
    const now = new Date()
    // Renovação de assinatura conhecida
    if (knownSub && !intent) {
      const start = knownSub.current_period_end && new Date(knownSub.current_period_end) > now ? new Date(knownSub.current_period_end) : now
      await db.from('subscriptions').update({
        status: 'active', current_period_start: start.toISOString(), current_period_end: addMonth(start).toISOString(),
        grace_until: null, updated_at: now.toISOString(),
      }).eq('id', knownSub.id)
      await recordPayment(ev, userId, knownSub.id, null, 'renewal')
      return 'renewed'
    }
    const planId = intent?.plan_id ?? ev.planId ?? knownSub?.plan_id
    const plan = planOf(planId)
    if (!plan || plan.id === 'free') throw new Error('plan_not_matched')
    if (intent?.status === 'paid') return 'duplicate_intent'

    // Já tem outra assinatura viva paga? (dois checkouts) → mantém a mais alta e alerta para estorno.
    const { data: live } = await db.from('subscriptions').select('*').eq('user_id', userId).in('status', ['active', 'past_due']).maybeSingle()
    if (live && live.id !== intent?.from_subscription_id && live.provider !== 'admin') {
      await emails.adminAlert('Pagamento duplicado', `<p>${email} pagou ${plan.name} tendo assinatura ativa (${live.plan_id}). Estornar um dos pagamentos.</p>`)
      await recordPayment(ev, userId, live.id, intent?.id ?? null, 'new')
      return 'duplicate_subscription'
    }
    // Upgrade (ou cortesia do admin): encerra a anterior só agora que a nova está paga.
    if (live) {
      await db.from('subscriptions').update({ status: 'canceled', canceled_at: now.toISOString(), current_period_end: now.toISOString(), updated_at: now.toISOString() }).eq('id', live.id)
      if (live.provider === 'zouti') await emails.adminAlert('Cancelar recorrência antiga na Zouti', `<p>${email} fez upgrade de ${live.plan_id} para ${plan.id}. Cancele a recorrência antiga (${live.provider_subscription_id ?? 'sem id'}) no painel da Zouti, se ela não for cancelada automaticamente.</p>`)
    }
    const { data: sub, error } = await db.from('subscriptions').insert({
      user_id: userId, plan_id: plan.id, status: 'active', price_cents: plan.price_cents, provider: 'zouti',
      provider_subscription_id: ev.subscriptionRef, current_period_start: now.toISOString(), current_period_end: addMonth(now).toISOString(),
    }).select('*').single()
    if (error) throw new Error(`subscription_insert: ${error.message}`)
    if (intent) await db.from('checkout_intents').update({ status: 'paid' }).eq('id', intent.id)
    await db.from('user_accounts').update({ onboarding_step: 'done', updated_at: now.toISOString() }).eq('user_id', userId).neq('onboarding_step', 'complete_profile')
    // Período novo com os créditos do plano + bônus do upgrade.
    const { data: period } = await db.rpc('ensure_period', { p_user: userId })
    if (intent?.bonus_credits && period) {
      await db.from('credit_periods').update({ bonus_credits: (period as { bonus_credits: number }).bonus_credits + intent.bonus_credits }).eq('id', (period as { id: string }).id)
      await db.from('credit_ledger').insert({ user_id: userId, period_id: (period as { id: string }).id, unit: 'credits', delta: intent.bonus_credits, kind: 'bonus', operation: 'upgrade_proration' })
    }
    await recordPayment(ev, userId, sub.id, intent?.id ?? null, intent?.kind === 'upgrade' ? 'upgrade' : 'new')
    if (email) await emails.paymentConfirmed(email, plan.name, ev.amountCents ?? plan.price_cents, plan.monthly_credits + (intent?.bonus_credits ?? 0))
    return 'activated'
  }

  const sub = knownSub ?? (await db.from('subscriptions').select('*').eq('user_id', userId).in('status', ['active', 'past_due']).order('created_at', { ascending: false }).limit(1).maybeSingle()).data
  if (!sub) return 'no_subscription'
  const plan = planOf(sub.plan_id)

  if (ev.kind === 'failed') {
    const grace = new Date(Date.now() + graceDays * 86400_000)
    await db.from('subscriptions').update({ status: 'past_due', grace_until: grace.toISOString(), updated_at: new Date().toISOString() }).eq('id', sub.id)
    if (email) await emails.paymentFailed(email, plan?.name ?? sub.plan_id, graceDays)
    return 'past_due'
  }
  if (ev.kind === 'canceled') {
    await db.from('subscriptions').update({ cancel_at_period_end: true, canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', sub.id)
    return 'cancel_scheduled'
  }
  // Reembolso ou chargeback: acesso cai na hora.
  const now = new Date().toISOString()
  await db.from('subscriptions').update({ status: ev.kind === 'disputed' ? 'disputed' : 'refunded', current_period_end: now, updated_at: now }).eq('id', sub.id)
  if (ev.chargeRef) await db.from('payments').update({ status: ev.kind === 'disputed' ? 'disputed' : 'refunded' }).eq('provider', 'zouti').eq('provider_charge_id', ev.chargeRef)
  await db.from('payments').insert({
    user_id: userId, subscription_id: sub.id, provider: 'zouti', provider_charge_id: `${ev.chargeRef ?? ev.eventId}:${ev.kind}`,
    amount_cents: -(ev.amountCents ?? sub.price_cents), status: ev.kind === 'disputed' ? 'disputed' : 'refunded', kind: 'refund', paid_at: now,
  })
  if (ev.kind === 'disputed') {
    await db.from('user_accounts').update({ flagged: true, flag_reason: 'chargeback', updated_at: now }).eq('user_id', userId)
    await emails.adminAlert('Chargeback', `<p>${email}: assinatura ${sub.plan_id} contestada. Conta sinalizada.</p>`)
  } else if (email) {
    await emails.refunded(email, ev.amountCents ?? sub.price_cents)
  }
  return ev.kind
}

async function recordPayment(ev: NormalizedEvent, userId: string, subId: string, intentId: string | null, kind: 'new' | 'renewal' | 'upgrade') {
  const { error } = await adminClient().from('payments').insert({
    user_id: userId, subscription_id: subId, intent_id: intentId, provider: 'zouti',
    provider_charge_id: ev.chargeRef ?? ev.eventId, amount_cents: ev.amountCents ?? 0, fee_cents: ev.feeCents ?? 0,
    method: ev.method, status: 'paid', kind, paid_at: new Date().toISOString(),
  })
  if (error && !/duplicate/i.test(error.message)) log('billing', 'payment_insert_failed', { msg: error.message })
}

// ---------------------------------------------------------------------------
// Upgrade: desconto proporcional ao que sobrou (o menor entre dias e créditos)
// ---------------------------------------------------------------------------
export function upgradeQuote(current: { price_cents: number; current_period_start: string; current_period_end: string },
  period: { credits_granted: number; bonus_credits: number; credits_used: number; credits_reserved: number } | null, next: Plan) {
  const start = new Date(current.current_period_start).getTime()
  const end = new Date(current.current_period_end).getTime()
  const daysRatio = Math.max(0, Math.min(1, (end - Date.now()) / Math.max(1, end - start)))
  const granted = (period?.credits_granted ?? 0) + (period?.bonus_credits ?? 0)
  const left = Math.max(0, granted - (period?.credits_used ?? 0) - (period?.credits_reserved ?? 0))
  const creditRatio = granted > 0 ? Math.max(0, Math.min(1, left / granted)) : 0
  const discountCents = Math.floor(current.price_cents * Math.min(daysRatio, creditRatio))
  // A Zouti cobra o valor cheio do link do plano: o desconto vira créditos bônus no novo ciclo.
  const bonusCredits = next.price_cents > 0 ? Math.round((discountCents / next.price_cents) * next.monthly_credits) : 0
  return { discountCents, bonusCredits, chargeCents: next.price_cents, daysRatio, creditRatio }
}
