// Assinaturas: adaptador do gateway (Zouti hoje; Apple/Google no futuro) + máquina de estados.
// Só o webhook muda o plano. O retorno do checkout nunca libera nada sozinho.
//
// Modelo Zouti: DOIS links de checkout (mensal e anual). A pessoa escolhe Essencial, Plus ou Pro dentro do
// checkout; o webhook diz quanto foi pago e é o VALOR que decide o plano (e confirma o ciclo).
//
// Secrets das Edge Functions:
//   ZOUTI_WEBHOOK_SECRET        → token do webhook (vai na URL: ?token=...) ou segredo HMAC (header x-zouti-signature)
//   ZOUTI_CHECKOUT_URL_MONTHLY  → link mensal (padrão: o link de produção abaixo)
//   ZOUTI_CHECKOUT_URL_ANNUAL   → link anual  (padrão: o link de produção abaixo)
//   ZOUTI_REF_PARAM (opcional)  → parâmetro da URL que volta no webhook com o id da intenção (padrão "src")
//
// O corpo do webhook da Zouti não tem formato público: a leitura é tolerante (procura e-mail, valores, ids,
// nomes e status em qualquer nível do JSON) e, quando o valor não fecha com nenhum plano, NÃO libera nada:
// guarda o evento para revisão e avisa o admin.
import { adminClient, log } from './tts.ts'
import { emails } from './email.ts'

export const PAID_PLANS = ['essencial', 'plus', 'pro'] as const
export type PaidPlan = typeof PAID_PLANS[number]
export type Cycle = 'monthly' | 'annual'
export type Plan = { id: string; name: string; price_cents: number; annual_price_cents?: number | null; monthly_credits: number; monthly_minutes: number; rank: number }

/** Preços aceitos (centavos). Anual = total do ano. Plus anual aceita 430,80 (checkout) e 431,04 (35,92 × 12). */
export const PRICE_TABLE: Record<Cycle, Record<PaidPlan, number[]>> = {
  monthly: { essencial: [2490], plus: [4490], pro: [8990] },
  annual: { essencial: [23904], plus: [43080, 43104], pro: [86304] },
}

const DEFAULT_CHECKOUT: Record<Cycle, string> = {
  monthly: 'https://pay.zouti.com.br/checkout?product_offer_id=prod_offer_v1hyuydjqi9osaghtixm78',
  annual: 'https://pay.zouti.com.br/checkout?product_offer_id=prod_offer_dco7aoi40qrz8uhlywpd24',
}
const OFFER_CYCLE: Record<string, Cycle> = {
  prod_offer_v1hyuydjqi9osaghtixm78: 'monthly',
  prod_offer_dco7aoi40qrz8uhlywpd24: 'annual',
}

export type NormalizedEvent = {
  eventId: string
  kind: 'paid' | 'failed' | 'canceled' | 'refunded' | 'disputed' | 'ignored'
  type: string
  email: string | null
  intentId: string | null
  subscriptionRef: string | null
  chargeRef: string | null
  planId: string | null
  cycle: Cycle | null
  amountCents: number | null
  feeCents: number | null
  method: string | null
  /** Por que o plano não pôde ser decidido com segurança (vai para revisão manual). */
  review: string | null
  provider?: 'zouti' | 'abacatepay'
  /** O gateway diz explicitamente que é renovação (AbacatePay: subscription.renewed). */
  renewal?: boolean
  /** Fatura avulsa (Pix por ciclo, AbacatePay checkout ONE_TIME). */
  oneTime?: boolean
  /** Cancelamento que mantém o acesso até o fim do ciclo pago. */
  cancelAtPeriodEnd?: boolean
  /** Recibo do gateway e número de parcelas (para o painel de recibos). */
  receiptUrl?: string | null
  installments?: number | null
}

const env = (k: string) => (Deno.env.get(k) ?? '').trim()

export function checkoutUrlFor(cycle: Cycle): string {
  return env(`ZOUTI_CHECKOUT_URL_${cycle.toUpperCase()}`) || DEFAULT_CHECKOUT[cycle]
}

export function buildCheckoutUrl(base: string, intentId: string, email: string, name?: string) {
  const u = new URL(base)
  u.searchParams.set(env('ZOUTI_REF_PARAM') || 'src', intentId)
  u.searchParams.set('utm_content', intentId)
  u.searchParams.set('email', email)
  if (name) u.searchParams.set('name', name)
  return u.toString()
}

export function priceFor(plan: string, cycle: Cycle): number | null {
  return (PRICE_TABLE[cycle] as Record<string, number[]>)[plan]?.[0] ?? null
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

/** Valor pago pelo formato real da Zouti (centavos): pagamento → amount_paid; pedido → payment_total.amount / amount_total.
 *  Os juros do parcelamento vêm em interest_amount e são descontados para chegar ao preço do plano. */
function zoutiAmounts(payload: Record<string, unknown>): number[] {
  const rec = (v: unknown) => (v && typeof v === 'object' ? v as Record<string, unknown> : {})
  // Zouti manda centavos inteiros; valor com casas decimais (24.9, "89,90") é reais.
  const num = (v: unknown) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? (Number.isInteger(n) ? n : Math.round(n * 100)) : null }
  const total = rec(payload.payment_total), pay = rec(payload.payment), plan = rec(payload.plan)
  // Assinatura (sub_…): o preço do ciclo vem em plan.amount.
  const paid = num(payload.amount_paid) ?? num(total.amount) ?? num(payload.amount_total) ?? num(pay.amount) ?? num(payload.amount) ?? num(plan.amount)
  if (paid == null) return []
  const interest = num(payload.interest_amount) ?? num(total.interest_amount) ?? num(pay.interest_amount) ?? 0
  return [...new Set([paid - interest, paid])]
}

/** Todos os valores monetários do corpo, em centavos (um número inteiro pode estar em reais ou em centavos). */
function amountCandidates(obj: unknown, out = new Set<number>(), depth = 0): Set<number> {
  if (!obj || typeof obj !== 'object' || depth > 7) return out
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v && typeof v === 'object') { amountCandidates(v, out, depth + 1); continue }
    if (!/amount|total|value|price|valor|subtotal|preco|preço/i.test(k) || /fee|tax|taxa|discount|desconto|installment_count|parcelas?$/i.test(k)) continue
    const n = Number(String(v ?? '').replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0) continue
    if (/cents|centavos/i.test(k)) out.add(Math.round(n))
    else if (!Number.isInteger(n)) out.add(Math.round(n * 100))
    else { out.add(n); out.add(n * 100) }
  }
  return out
}

function textOf(payload: unknown): string {
  try { return JSON.stringify(payload).toLowerCase() } catch { return '' }
}

/** Nome do plano citado no corpo (produto, oferta, variação). Só conta se aparecer um único plano. */
function planNameIn(text: string): PaidPlan | null {
  const hits = PAID_PLANS.filter((p) => new RegExp(`(^|[^a-z])${p}([^a-z]|$)`).test(p === 'pro' ? text.replace(/product|produto|prod_|promo|process|profile|proof|provider/g, ' ') : text))
  return hits.length === 1 ? hits[0] : null
}

/** Decide plano e ciclo pelo valor pago. */
export function matchPlan(candidates: number[], installments: number | null, cycleHint: Cycle | null): { plan: PaidPlan; cycle: Cycle; exact: boolean } | { error: string } {
  const cycles: Cycle[] = cycleHint ? [cycleHint, cycleHint === 'monthly' ? 'annual' : 'monthly'] : ['monthly', 'annual']
  const exact = new Map<string, { plan: PaidPlan; cycle: Cycle }>()
  for (const c of cycles) for (const p of PAID_PLANS) for (const price of PRICE_TABLE[c][p]) {
    if (candidates.includes(price)) exact.set(`${c}:${p}`, { plan: p, cycle: c })
  }
  if (exact.size > 1) {
    // Dois planos batem por valores diferentes do corpo: só aceita se a dica de ciclo desempatar num único plano.
    const inHint = [...exact.values()].filter((m) => m.cycle === cycleHint)
    if (inHint.length === 1) return { ...inHint[0], exact: true }
    return { error: 'ambiguous_amount' }
  }
  if (exact.size === 1) return { ...[...exact.values()][0], exact: true }
  return { error: 'amount_not_matched' }
}

function classify(type: string, status: string): NormalizedEvent['kind'] {
  const t = `${type} ${status}`.toLowerCase()
  if (/chargeback|disput|contest/.test(t)) return 'disputed'
  if (/estorn|refund|reembols/.test(t)) return 'refunded'
  if (/cancel/.test(t)) return 'canceled'
  if (/recus|refused|declin|failed|falh|atras|overdue|unpaid|n[aã]o.pago|expired|expirad/.test(t)) return 'failed'
  if (/aprovad|approved|paid|pago|ativad|activ|renov|renew|complete/.test(t)) return 'paid'
  return 'ignored'
}

export function normalize(payload: Record<string, unknown>, headerEventId: string | null, cycleParam: string | null = null): NormalizedEvent {
  const type = String((typeof payload.event === 'string' ? payload.event : null) ?? (typeof payload.event_type === 'string' ? payload.event_type : null) ?? findValue(payload, ['event', 'event_type', 'evento', 'event_name']) ?? '')
  const status = String((typeof payload.status === 'string' ? payload.status : null) ?? findValue(payload, ['status', 'payment_status', 'order_status', 'situacao']) ?? '')
  const ref = env('ZOUTI_REF_PARAM') || 'src'
  const intent = String(findValue(payload, [ref, 'utm_content', 'external_reference', 'external_id', 'src']) ?? '')
  const topId = typeof payload.id === 'string' ? payload.id : ''
  const chargeRef = (typeof payload.order_id === 'string' && payload.order_id) || (topId.startsWith('ord_') ? topId : '') || String(findValue(payload, ['transaction_id', 'charge_id', 'order_id', 'payment_id', 'id']) ?? '') || null
  const subRef = (typeof payload.id === 'string' && payload.id.startsWith('sub_') ? payload.id : '') || String(findValue(payload, ['subscription_id', 'subscriptionId', 'assinatura_id', 'contract_id']) ?? '') || null
  const text = textOf(payload)
  // Ciclo: parâmetro da URL do webhook (?ciclo=mensal|anual) > id da oferta no corpo > palavras no corpo.
  const param = (cycleParam ?? '').toLowerCase()
  let cycle: Cycle | null = /anual|annual|year/.test(param) ? 'annual' : /mensal|month/.test(param) ? 'monthly' : null
  const interval = String((payload.plan as Record<string, unknown> | undefined)?.interval ?? '').toUpperCase()
  if (!cycle && interval) cycle = /ANNUAL|YEAR/.test(interval) ? 'annual' : /MONTH/.test(interval) ? 'monthly' : null
  if (!cycle) for (const [offer, c] of Object.entries(OFFER_CYCLE)) if (text.includes(offer)) { cycle = c; break }
  if (!cycle && /\b(anual|annual|yearly)\b/.test(text)) cycle = 'annual'
  const installments = Number(findValue(payload, ['installments', 'installment_count', 'parcelas', 'number_of_installments'])) || null
  // Formato real da Zouti primeiro; a busca genérica só entra se ele não vier.
  const official = zoutiAmounts(payload)
  // Corpo da Zouti (tem account_id): só os campos oficiais. A busca genérica fica para formatos desconhecidos.
  const fromZouti = typeof payload.account_id === 'string'
  const candidates = official.length || fromZouti ? official : [...amountCandidates(payload)]
  const kind = classify(type, status)
  let planId: string | null = null
  let review: string | null = null
  let amountCents = official[official.length - 1] ?? toCents(findValue(payload, ['amount_paid', 'paid_amount', 'total', 'amount', 'value', 'price', 'valor']))
  if (kind === 'paid') {
    const m = matchPlan(candidates, installments, cycle)
    const named = planNameIn(text)
    if ('error' in m) review = m.error
    else {
      planId = m.plan
      if (cycle && cycle !== m.cycle) review = 'cycle_mismatch'
      cycle = m.cycle
      if (named && named !== m.plan) review = 'plan_name_mismatch'
      if (m.exact) amountCents = PRICE_TABLE[m.cycle][m.plan].find((p) => candidates.includes(p)) ?? amountCents
    }
  }
  return {
    eventId: headerEventId || String(findValue(payload, ['event_id', 'webhook_id']) ?? '') || `${type}:${chargeRef ?? ''}:${status}`,
    kind,
    type: `${type}|${status}`.slice(0, 120),
    email: String(findValue(payload, ['email', 'customer_email', 'buyer_email']) ?? '').toLowerCase() || null,
    intentId: /^[\da-f-]{36}$/i.test(intent) ? intent : null,
    subscriptionRef: subRef,
    chargeRef,
    planId,
    cycle,
    amountCents,
    feeCents: toCents(findValue(payload, ['fee', 'fees', 'tax', 'taxa'])),
    method: String(findValue(payload, ['payment_method', 'method', 'forma_pagamento']) ?? '') || null,
    review,
    provider: 'zouti',
  }
}

// ---------------------------------------------------------------------------
// Máquina de estados
// ---------------------------------------------------------------------------
const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }
const periodEnd = (from: Date, cycle: Cycle) => addMonths(from, cycle === 'annual' ? 12 : 1)

async function userByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const { data } = await adminClient().rpc('user_id_by_email', { p_email: email })
  return data ? { id: data as string, email } : null
}

/** Pagamento que não dá para atribuir a um plano com segurança: nada é liberado e o admin é avisado. */
export class NeedsReview extends Error { constructor(public reason: string) { super(reason) } }

export async function applyEvent(ev: NormalizedEvent, opts: { forceUserId?: string; eventRowId?: string } = {}): Promise<string> {
  const db = adminClient()
  const provider = ev.provider ?? 'zouti'
  if (ev.kind === 'ignored') return 'ignored'

  // A mesma cobrança nunca é aplicada duas vezes (a Zouti pode mandar "Pedido pago" e "Assinatura ativada" juntos).
  if (ev.kind === 'paid' && ev.chargeRef) {
    const { data: seen } = await db.from('payments').select('id').eq('provider', provider).eq('provider_charge_id', ev.chargeRef).maybeSingle()
    if (seen) return 'duplicate_charge'
  }
  if (ev.kind === 'paid' && ev.review) throw new NeedsReview(ev.review)

  // Quem é: pela intenção (mais seguro), pela assinatura já conhecida, ou pelo e-mail.
  const { data: intent } = ev.intentId
    ? await db.from('checkout_intents').select('*').eq('id', ev.intentId).maybeSingle()
    : { data: null }
  const { data: knownSub } = ev.subscriptionRef
    ? await db.from('subscriptions').select('*').eq('provider', provider).eq('provider_subscription_id', ev.subscriptionRef).maybeSingle()
    : { data: null }
  let userId: string | null = opts.forceUserId ?? intent?.user_id ?? knownSub?.user_id ?? null
  let email = ev.email
  if (!userId && email) userId = (await userByEmail(email))?.id ?? null
  if (!userId) {
    // Comprou antes de criar a conta: guarda e libera no primeiro login com este e-mail confirmado.
    if (ev.kind === 'paid' && email && ev.planId && ev.cycle) {
      const { error } = await db.from('pending_purchases').insert({
        email, plan_id: ev.planId, billing_cycle: ev.cycle, amount_cents: ev.amountCents ?? priceFor(ev.planId, ev.cycle) ?? 0,
        event_row_id: opts.eventRowId ?? null, provider_charge_id: ev.chargeRef, provider_subscription_id: ev.subscriptionRef,
      })
      if (error && !/duplicate/i.test(error.message)) throw new Error(`pending_insert: ${error.message}`)
      return 'pending_signup'
    }
    if (ev.kind !== 'paid' && email) {
      // Estorno/cancelamento de compra que ainda não foi reivindicada: some da fila.
      if (ev.chargeRef) await db.from('pending_purchases').delete().eq('provider_charge_id', ev.chargeRef).is('claimed_at', null)
      return 'pending_removed'
    }
    throw new NeedsReview('user_not_matched')
  }
  if (!email) {
    const { data: u } = await db.auth.admin.getUserById(userId)
    email = u.user?.email ?? null
  }
  const { data: plans } = await db.from('plans').select('*')
  const planOf = (id: string | null | undefined) => (plans ?? []).find((p: Plan) => p.id === id) as Plan | undefined
  const graceDays = 3

  if (ev.kind === 'paid') {
    const now = new Date()
    // Renovação de assinatura conhecida (mesma recorrência na Zouti).
    // Na AbacatePay o checkout (e a intenção) é o mesmo em todas as renovações: vale o sinal explícito de renovação.
    if (knownSub && (ev.renewal || !intent) && ['active', 'past_due', 'expired'].includes(knownSub.status)) {
      const cycle: Cycle = (knownSub.billing_cycle as Cycle) ?? 'monthly'
      const end = knownSub.current_period_end ? new Date(knownSub.current_period_end) : now
      // Segunda notificação da mesma cobrança sem id de pedido: não estende duas vezes (a mesma cobrança com
      // id já foi barrada no começo). Uma renovação de verdade nunca chega 2 dias depois da compra/renovação anterior.
      const { data: recent } = await db.from('payments').select('id').eq('subscription_id', knownSub.id).eq('status', 'paid')
        .gte('paid_at', new Date(now.getTime() - 48 * 3600_000).toISOString()).limit(1)
      if (recent?.length) return 'renewal_already_applied'
      const start = end > now ? end : now
      // Troca de plano agendada (downgrade pela API) aplicada nesta cobrança: o produto novo vem no evento.
      const switched = ev.planId && ev.planId !== knownSub.plan_id ? { plan_id: ev.planId, billing_cycle: ev.cycle ?? cycle, price_cents: priceFor(ev.planId, ev.cycle ?? cycle) ?? knownSub.price_cents, pending_plan_id: null } : {}
      await db.from('subscriptions').update({
        status: 'active', current_period_start: start.toISOString(), current_period_end: periodEnd(start, (ev.cycle ?? cycle) as Cycle).toISOString(),
        grace_until: null, updated_at: now.toISOString(), ...switched,
      }).eq('id', knownSub.id)
      await recordPayment(ev, userId, knownSub.id, null, 'renewal')
      if (email) await emails.renewed(email, planOf(ev.planId ?? knownSub.plan_id)?.name ?? knownSub.plan_id, ev.amountCents ?? knownSub.price_cents, periodEnd(start, (ev.cycle ?? cycle) as Cycle).toISOString())
      return 'renewed'
    }
    const planId = ev.planId ?? intent?.plan_id ?? knownSub?.plan_id
    const cycle: Cycle = ev.cycle ?? (intent?.billing_cycle as Cycle) ?? 'monthly'
    const plan = planOf(planId)
    if (!plan || plan.id === 'free') throw new NeedsReview('plan_not_matched')
    // A intenção diz um plano e o valor pago diz outro (trocou o plano dentro do checkout): vale o que foi pago.
    if (intent && intent.plan_id !== plan.id) log('billing', 'intent_plan_differs', { intent: intent.plan_id, paid: plan.id })
    if (intent?.status === 'paid') return 'duplicate_intent'
    const priceCents = priceFor(plan.id, cycle) ?? plan.price_cents

    const { data: live } = await db.from('subscriptions').select('*').eq('user_id', userId).in('status', ['active', 'past_due']).maybeSingle()
    // Fatura Pix do próximo ciclo paga: estende a mesma assinatura (a partir do fim do período, ou de hoje se já venceu).
    if (intent?.kind === 'renewal' && live && live.id === intent.from_subscription_id) {
      const end = live.current_period_end ? new Date(live.current_period_end) : now
      const start = end > now ? end : now
      const until = periodEnd(start, cycle)
      await db.from('subscriptions').update({
        status: 'active', plan_id: plan.id, billing_cycle: cycle, price_cents: priceCents, pending_plan_id: null, grace_until: null,
        current_period_start: start.toISOString(), current_period_end: until.toISOString(), updated_at: now.toISOString(),
      }).eq('id', live.id)
      await db.from('checkout_intents').update({ status: 'paid' }).eq('id', intent.id)
      await recordPayment(ev, userId, live.id, intent.id, 'renewal')
      if (email) await emails.renewed(email, plan.name, ev.amountCents ?? priceCents, until.toISOString())
      return 'renewed_invoice'
    }
    const sameLine = !!live && live.id === intent?.from_subscription_id
    if (live && live.provider !== 'admin') {
      // Mesma compra notificada de novo por outro evento (ex.: "Pedido pago" + "Assinatura ativada").
      const fresh = now.getTime() - new Date(live.created_at).getTime() < 72 * 3600_000
      if (live.plan_id === plan.id && live.billing_cycle === cycle && fresh && !sameLine) {
        if (!live.provider_subscription_id && ev.subscriptionRef) await db.from('subscriptions').update({ provider_subscription_id: ev.subscriptionRef }).eq('id', live.id)
        return 'duplicate_event'
      }
      const cur = planOf(live.plan_id)
      const isUpgrade = !!cur && (plan.rank > cur.rank || (plan.rank === cur.rank && live.billing_cycle === 'monthly' && cycle === 'annual'))
      if (!isUpgrade && live.id !== intent?.from_subscription_id) {
        await emails.adminAlert('Pagamento duplicado', `<p>${email} pagou ${plan.name} (${cycle}) tendo assinatura ativa (${live.plan_id}, ${live.billing_cycle}). Estornar um dos pagamentos.</p>`)
        await recordPayment(ev, userId, live.id, intent?.id ?? null, 'new')
        return 'duplicate_subscription'
      }
    }
    // Upgrade (ou cortesia do admin): o que sobrou vira dias a mais; encerra a anterior só agora que a nova está paga.
    let extraDays = 0
    if (live && (live.provider === 'zouti' || live.provider === 'abacatepay' || live.provider === 'abacatepay_pix')) {
      const { data: curPeriod } = await db.rpc('ensure_period', { p_user: userId })
      extraDays = switchCredit(live, curPeriod as never, priceCents, cycle).extraDays
    }
    if (live) {
      await db.from('subscriptions').update({ status: 'canceled', canceled_at: now.toISOString(), current_period_end: now.toISOString(), updated_at: now.toISOString() }).eq('id', live.id)
      if (live.provider === 'abacatepay' && live.provider_subscription_id) {
        try { await (await import('./abacate.ts')).cancelSubscription(live.provider_subscription_id) }
        catch (e) { await emails.adminAlert('Falha ao cancelar recorrência antiga na AbacatePay', `<p>${email}: cancele ${live.provider_subscription_id} no painel (${String((e as Error).message)}).</p>`) }
      } else if (live.provider === 'zouti') await emails.adminAlert('Cancelar recorrência antiga na Zouti', `<p>${email} mudou de ${live.plan_id} (${live.billing_cycle}) para ${plan.id} (${cycle}). Cancele a recorrência antiga (${live.provider_subscription_id ?? 'sem id'}) no painel da Zouti, se ela não for cancelada automaticamente.</p>`)
    }
    const { data: sub, error } = await db.from('subscriptions').insert({
      user_id: userId, plan_id: plan.id, status: 'active', price_cents: priceCents, billing_cycle: cycle,
      // Pago por fatura avulsa: sem recorrência no gateway; a função billing-cycle gera a próxima fatura.
      provider: ev.oneTime && provider === 'abacatepay' ? 'abacatepay_pix' : provider,
      provider_subscription_id: ev.subscriptionRef, current_period_start: now.toISOString(),
      current_period_end: new Date(periodEnd(now, cycle).getTime() + extraDays * 86400_000).toISOString(),
    }).select('*').single()
    if (error) {
      // Dois avisos da mesma compra ao mesmo tempo ("pedido pago" + "assinatura ativada"): o outro já liberou.
      if (/subscriptions_one_live|duplicate key/i.test(error.message)) {
        const { data: other } = await db.from('subscriptions').select('id, plan_id, billing_cycle').eq('user_id', userId).in('status', ['active', 'past_due']).maybeSingle()
        if (other && other.plan_id === plan.id && other.billing_cycle === cycle) return 'duplicate_event_race'
      }
      throw new Error(`subscription_insert: ${error.message}`)
    }
    if (intent) await db.from('checkout_intents').update({ status: 'paid' }).eq('id', intent.id)
    await db.from('user_accounts').update({ onboarding_step: 'done', updated_at: now.toISOString() }).eq('user_id', userId).neq('onboarding_step', 'complete_profile')
    // Período novo com os créditos do plano (no anual, mês a mês) + bônus do upgrade.
    const { data: period } = await db.rpc('ensure_period', { p_user: userId })
    if (intent?.bonus_credits && period) {
      await db.from('credit_periods').update({ bonus_credits: (period as { bonus_credits: number }).bonus_credits + intent.bonus_credits }).eq('id', (period as { id: string }).id)
      await db.from('credit_ledger').insert({ user_id: userId, period_id: (period as { id: string }).id, unit: 'credits', delta: intent.bonus_credits, kind: 'bonus', operation: 'upgrade_proration' })
    }
    await recordPayment(ev, userId, sub.id, intent?.id ?? null, intent?.kind === 'upgrade' || (live && live.provider !== 'admin') ? 'upgrade' : 'new')
    if (email) await emails.paymentConfirmed(email, plan.name, ev.amountCents ?? priceCents, plan.monthly_credits + (intent?.bonus_credits ?? 0), { cycle, until: sub.current_period_end, extraDays })
    return 'activated'
  }

  const sub = knownSub ?? (await db.from('subscriptions').select('*').eq('user_id', userId).in('status', ['active', 'past_due']).order('created_at', { ascending: false }).limit(1).maybeSingle()).data
  if (!sub) return 'no_subscription'
  const plan = planOf(sub.plan_id)

  if (ev.kind === 'failed') {
    const grace = new Date(Date.now() + graceDays * 86400_000)
    await db.from('subscriptions').update({ status: 'past_due', grace_until: grace.toISOString(), updated_at: new Date().toISOString() }).eq('id', sub.id)
    const final = /cancel/i.test(ev.type)
    if (email) await (final ? emails.movedToFree(email, plan?.name ?? sub.plan_id) : emails.paymentFailed(email, plan?.name ?? sub.plan_id, graceDays))
    return 'past_due'
  }
  if (ev.kind === 'canceled') {
    if (['canceled', 'refunded', 'disputed', 'expired'].includes(sub.status)) return 'already_closed'
    await db.from('subscriptions').update({ cancel_at_period_end: true, canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', sub.id)
    return 'cancel_scheduled'
  }
  // Reembolso ou chargeback: acesso cai na hora.
  const now = new Date().toISOString()
  await db.from('subscriptions').update({ status: ev.kind === 'disputed' ? 'disputed' : 'refunded', current_period_end: now, updated_at: now }).eq('id', sub.id)
  if (ev.chargeRef) await db.from('payments').update({ status: ev.kind === 'disputed' ? 'disputed' : 'refunded' }).eq('provider', provider).eq('provider_charge_id', ev.chargeRef)
  const { error: refundErr } = await db.from('payments').insert({
    user_id: userId, subscription_id: sub.id, provider: provider, provider_charge_id: `${ev.chargeRef ?? ev.eventId}:${ev.kind}`,
    amount_cents: -(ev.amountCents ?? sub.price_cents), status: ev.kind === 'disputed' ? 'disputed' : 'refunded', kind: 'refund', paid_at: now,
  })
  if (refundErr && /duplicate/i.test(refundErr.message)) return `${ev.kind}_duplicate`
  if (ev.kind === 'disputed') {
    await db.from('user_accounts').update({ flagged: true, flag_reason: 'chargeback', updated_at: now }).eq('user_id', userId)
    await emails.adminAlert('Chargeback', `<p>${email}: assinatura ${sub.plan_id} contestada. Conta sinalizada.</p>`)
  } else if (email) {
    await emails.refunded(email, ev.amountCents ?? sub.price_cents)
  }
  return ev.kind
}

/** Libera compras feitas antes de existir a conta (chamado no login, com o e-mail já confirmado). */
/**
 * E-mail da compra pendente, comparado por igualdade (as compras são gravadas em minúsculas). Antes era `ilike`, em
 * que `_` e `%` (válidos em e-mail) viravam curingas: quem tivesse `j_ao@…` confirmado vinculava a compra de `joao@…`.
 */
export const exactEmail = (email: string) => email.trim().toLowerCase()

export async function claimPending(userId: string, email: string, onlyId?: string): Promise<string[]> {
  const db = adminClient()
  let q = db.from('pending_purchases').select('*').eq('email', exactEmail(email)).is('claimed_at', null)
  if (onlyId) q = q.eq('id', onlyId)
  const { data: rows } = await q.order('created_at')
  const results: string[] = []
  for (const row of rows ?? []) {
    const ev: NormalizedEvent = {
      eventId: `claim:${row.id}`, kind: 'paid', type: 'claim', email, intentId: null, subscriptionRef: row.provider_subscription_id,
      chargeRef: row.provider_charge_id, planId: row.plan_id, cycle: row.billing_cycle, amountCents: row.amount_cents, feeCents: null, method: null, review: null,
    }
    const r = await applyEvent(ev, { forceUserId: userId })
    await db.from('pending_purchases').update({ claimed_by: userId, claimed_at: new Date().toISOString() }).eq('id', row.id)
    results.push(r)
  }
  return results
}

async function recordPayment(ev: NormalizedEvent, userId: string, subId: string, intentId: string | null, kind: 'new' | 'renewal' | 'upgrade') {
  const { error } = await adminClient().from('payments').insert({
    user_id: userId, subscription_id: subId, intent_id: intentId, provider: ev.provider ?? 'zouti',
    provider_charge_id: ev.chargeRef ?? ev.eventId, amount_cents: ev.amountCents ?? 0, fee_cents: ev.feeCents ?? 0,
    method: ev.method, status: 'paid', kind, paid_at: new Date().toISOString(),
    invoice_url: ev.receiptUrl ?? null,
    raw: { cycle: ev.cycle, plan: ev.planId, installments: ev.installments ?? null },
  })
  if (error && !/duplicate/i.test(error.message)) log('billing', 'payment_insert_failed', { msg: error.message })
}

// ---------------------------------------------------------------------------
// Troca de plano/ciclo: o que sobra do plano atual vira DIAS A MAIS no plano novo.
// A Zouti cobra o valor cheio do link; a compensação é dar mais tempo no plano novo, proporcional ao que sobrou.
//   sobra = preço pago no ciclo atual × fração não usada (no mensal: o menor entre dias e créditos que sobraram)
//   dias a mais = sobra ÷ preço diário do plano novo
// ---------------------------------------------------------------------------
export function switchCredit(current: { price_cents: number; billing_cycle?: string | null; current_period_start: string; current_period_end: string },
  period: { credits_granted: number; bonus_credits: number; credits_used: number; credits_reserved: number } | null,
  nextPriceCents: number, nextCycle: Cycle) {
  const start = new Date(current.current_period_start).getTime()
  const end = new Date(current.current_period_end).getTime()
  const daysRatio = Math.max(0, Math.min(1, (end - Date.now()) / Math.max(1, end - start)))
  const granted = (period?.credits_granted ?? 0) + (period?.bonus_credits ?? 0)
  const left = Math.max(0, granted - (period?.credits_used ?? 0) - (period?.credits_reserved ?? 0))
  const creditRatio = granted > 0 ? Math.max(0, Math.min(1, left / granted)) : 1
  // No anual os créditos são do mês corrente: vale só o tempo.
  const ratio = current.billing_cycle === 'annual' ? daysRatio : Math.min(daysRatio, creditRatio)
  const remainingCents = Math.floor(current.price_cents * ratio)
  const nextDays = nextCycle === 'annual' ? 365 : 30
  const extraDays = nextPriceCents > 0 ? Math.floor(remainingCents / (nextPriceCents / nextDays)) : 0
  return { remainingCents, extraDays: Math.min(extraDays, 366) }
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
