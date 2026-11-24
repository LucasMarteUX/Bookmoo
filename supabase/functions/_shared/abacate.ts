// AbacatePay: cliente da API v2 + leitura dos webhooks.
// Secrets:  ABACATEPAY_API_KEY (Bearer)  ·  ABACATEPAY_WEBHOOK_SECRET (o "secret" cadastrado no webhook)
// Opcional: ABACATEPAY_PIX_AUTOMATICO = "1" quando o Pix Automático estiver liberado na conta. Sem ele, o Pix é
// cobrado como fatura avulsa a cada ciclo (checkout ONE_TIME), e a função billing-cycle gera e lembra as próximas.
// Os produtos ficam em plans.provider_refs: abacate_monthly/abacate_annual (recorrentes) e abacate_monthly_once/abacate_annual_once (Pix avulso).
import { adminClient } from './tts.ts'
import { PRICE_TABLE, type Cycle, type NormalizedEvent } from './payments.ts'

const BASE = 'https://api.abacatepay.com/v2'
// Chave pública (igual para todas as contas) usada no HMAC do header X-Webhook-Signature. Fonte: docs "Segurança dos webhooks".
const SIGNATURE_KEY = 't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9'

const env = (k: string) => (Deno.env.get(k) ?? '').trim()
export const abacateEnabled = () => !!env('ABACATEPAY_API_KEY')

export class AbacateError extends Error { constructor(public status: number, msg: string) { super(msg) } }

export async function abacate<T>(path: string, body?: unknown, method: 'POST' | 'GET' = 'POST'): Promise<T> {
  const key = env('ABACATEPAY_API_KEY')
  if (!key) throw new AbacateError(503, 'abacate_not_configured')
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
  })
  const json = await res.json().catch(() => null) as { data?: T; error?: string | null; success?: boolean } | null
  if (!res.ok || !json || json.error) throw new AbacateError(res.status, String(json?.error ?? `http_${res.status}`).slice(0, 200))
  return json.data as T
}

// ---------------------------------------------------------------------------
// Produtos: cria (ou reaproveita pelo externalId) um produto por plano e ciclo.
// ---------------------------------------------------------------------------
const NAMES: Record<string, string> = { essencial: 'Essencial', plus: 'Plus', pro: 'Pro' }

export async function setupProducts(): Promise<Record<string, Record<string, string>>> {
  const db = adminClient()
  const out: Record<string, Record<string, string>> = {}
  for (const plan of ['essencial', 'plus', 'pro'] as const) {
    const refs: Record<string, string> = {}
    for (const cycle of ['monthly', 'annual'] as Cycle[]) {
      const externalId = `upoonly-${plan}-${cycle}`
      let product = await abacate<{ id: string; price: number } | null>(`/products/get?externalId=${encodeURIComponent(externalId)}`, undefined, 'GET').catch(() => null)
      const price = PRICE_TABLE[cycle][plan][0]
      if (!product) {
        product = await abacate<{ id: string; price: number }>('/products/create', {
          externalId, name: `Upoonly ${NAMES[plan]} ${cycle === 'annual' ? 'Anual' : 'Mensal'}`, price, currency: 'BRL',
          cycle: cycle === 'annual' ? 'ANNUALLY' : 'MONTHLY',
          description: `Plano ${NAMES[plan]} do Upoonly, cobrado ${cycle === 'annual' ? 'uma vez por ano' : 'todo mês'}.`,
        })
      }
      refs[`abacate_${cycle}`] = product.id
      // Produto sem ciclo, mesmo preço: usado nas faturas Pix avulsas (enquanto o Pix Automático não estiver liberado).
      const onceId = `${externalId}-pix`
      let once = await abacate<{ id: string } | null>(`/products/get?externalId=${encodeURIComponent(onceId)}`, undefined, 'GET').catch(() => null)
      if (!once) once = await abacate<{ id: string }>('/products/create', {
        externalId: onceId, name: `Upoonly ${NAMES[plan]} ${cycle === 'annual' ? 'Anual' : 'Mensal'} (Pix)`, price, currency: 'BRL',
        description: `Plano ${NAMES[plan]} do Upoonly, ${cycle === 'annual' ? '12 meses' : '1 mês'} de acesso, pago por Pix.`,
      })
      refs[`abacate_${cycle}_once`] = once.id
    }
    const { data: row } = await db.from('plans').select('provider_refs').eq('id', plan).single()
    await db.from('plans').update({ provider_refs: { ...(row?.provider_refs ?? {}), ...refs } }).eq('id', plan)
    out[plan] = refs
  }
  return out
}

/** Produto do plano no ciclo (lido de plans.provider_refs). */
export async function productFor(plan: string, cycle: Cycle, once = false): Promise<string> {
  const key = `abacate_${cycle}${once ? '_once' : ''}`
  const { data } = await adminClient().from('plans').select('provider_refs').eq('id', plan).single()
  let id = (data?.provider_refs as Record<string, string> | null)?.[key]
  // Primeiro checkout sem produtos cadastrados: cria todos na loja (idempotente pelo externalId).
  if (!id) id = (await setupProducts())[plan]?.[key]
  if (!id) throw new AbacateError(503, 'abacate_products_missing')
  return id
}

/** Plano e ciclo a partir do id do produto. */
async function planOfProduct(productId: string): Promise<{ plan: string; cycle: Cycle } | null> {
  const { data } = await adminClient().from('plans').select('id, provider_refs')
  for (const p of data ?? []) {
    const refs = (p.provider_refs ?? {}) as Record<string, string>
    if (refs.abacate_monthly === productId) return { plan: p.id, cycle: 'monthly' }
    if (refs.abacate_annual === productId) return { plan: p.id, cycle: 'annual' }
    if (refs.abacate_monthly_once === productId) return { plan: p.id, cycle: 'monthly' }
    if (refs.abacate_annual_once === productId) return { plan: p.id, cycle: 'annual' }
  }
  return null
}

// ---------------------------------------------------------------------------
// Cliente, checkout de assinatura, cancelar e trocar de plano
// ---------------------------------------------------------------------------
export async function ensureCustomer(userId: string, email: string, name?: string): Promise<string> {
  const db = adminClient()
  const { data: acc } = await db.from('user_accounts').select('abacate_customer_id').eq('user_id', userId).maybeSingle()
  if (acc?.abacate_customer_id) return acc.abacate_customer_id
  const c = await abacate<{ id: string }>('/customers/create', { email, ...(name ? { name } : {}), metadata: { userId } })
  await db.from('user_accounts').update({ abacate_customer_id: c.id }).eq('user_id', userId)
  return c.id
}

/**
 * Checkout de assinatura:
 *  - mensal: cartão (débito automático todo mês) ou Pix Automático, à vista;
 *  - anual: cartão em até 12x com os juros/taxa pagos pelo cliente (repasse) ou Pix Automático à vista.
 * Se a conta ainda não tiver Pix Automático, repasse ou parcelamento liberados, tenta de novo sem o recurso que faltou
 * (a venda não trava) e avisa o admin.
 */
export const pixAutomaticoEnabled = () => env('ABACATEPAY_PIX_AUTOMATICO') === '1'

export async function createSubscriptionCheckout(opts: { productId: string; customerId: string; intentId: string; cycle: Cycle; completionUrl: string; returnUrl: string; methods?: ('CARD' | 'PIX')[] }) {
  let methods: string[] = opts.methods?.length ? [...opts.methods] : pixAutomaticoEnabled() ? ['CARD', 'PIX'] : ['CARD']
  let card: Record<string, unknown> | undefined = opts.cycle === 'annual' ? { maxInstallments: 12, passFeesToCustomer: true } : undefined
  const dropped: string[] = []
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const bill = await abacate<{ id: string; url: string }>('/subscriptions/create', {
        items: [{ id: opts.productId, quantity: 1 }],
        customerId: opts.customerId,
        externalId: opts.intentId,
        completionUrl: opts.completionUrl,
        returnUrl: opts.returnUrl,
        methods,
        metadata: { intentId: opts.intentId },
        retryPolicy: { maxRetry: 3, retryEvery: 2 },
        ...(card && methods.includes('CARD') ? { card } : {}),
      })
      return { ...bill, dropped }
    } catch (e) {
      const msg = String((e as Error).message)
      if (/PIX Autom/i.test(msg) && methods.includes('PIX') && methods.length > 1) { methods = methods.filter(m => m !== 'PIX'); dropped.push('pix_automatico'); continue }
      if (/passFeesToCustomer/i.test(msg) && card?.passFeesToCustomer) { card = { ...card, passFeesToCustomer: undefined }; delete card.passFeesToCustomer; dropped.push('repasse_juros'); continue }
      if (/installment/i.test(msg) && card?.maxInstallments && card.maxInstallments !== 1) { card = { ...card, maxInstallments: 1 }; dropped.push('parcelamento'); continue }
      throw e
    }
  }
  throw new AbacateError(502, 'checkout_failed')
}

/** Fatura avulsa (uma cobrança, um ciclo de acesso): Pix, e cartão como segunda opção quando `withCard`. */
export async function createOneTimeCheckout(opts: { productId: string; customerId: string; intentId: string; cycle: Cycle; completionUrl: string; returnUrl: string; withCard?: boolean }) {
  const methods = opts.withCard ? ['PIX', 'CARD'] : ['PIX']
  const body: Record<string, unknown> = {
    items: [{ id: opts.productId, quantity: 1 }], customerId: opts.customerId, externalId: opts.intentId,
    completionUrl: opts.completionUrl, returnUrl: opts.returnUrl, methods, metadata: { intentId: opts.intentId },
    ...(opts.withCard && opts.cycle === 'annual' ? { card: { maxInstallments: 12 } } : {}),
  }
  try { return await abacate<{ id: string; url: string }>('/checkouts/create', body) }
  catch (e) {
    if (!/installment|minimum/i.test(String((e as Error).message)) || !body.card) throw e
    delete body.card
    return await abacate<{ id: string; url: string }>('/checkouts/create', body)
  }
}

export const cancelSubscription = (subsId: string) => abacate('/subscriptions/cancel', { id: subsId })
export const changePlan = (subsId: string, productId: string) => abacate('/subscriptions/change-plan', { id: subsId, productId, quantity: 1 })

// ---------------------------------------------------------------------------
// Webhook: secret (origem) + HMAC (integridade)
// ---------------------------------------------------------------------------
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

export async function verifyAbacate(raw: string, req: Request): Promise<boolean> {
  const secret = env('ABACATEPAY_WEBHOOK_SECRET')
  if (!secret) return false
  const given = req.headers.get('x-webhook-secret') ?? new URL(req.url).searchParams.get('webhookSecret') ?? ''
  if (!safeEqual(given, secret)) return false
  const sig = req.headers.get('x-webhook-signature') ?? ''
  if (!sig) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SIGNATURE_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)))
  const expected = btoa(String.fromCharCode(...mac))
  return safeEqual(expected, sig.trim())
}

type Obj = Record<string, unknown>
const o = (v: unknown) => (v && typeof v === 'object' ? v as Obj : {})
const str = (v: unknown) => (typeof v === 'string' && v ? v : null)

/** Traduz o evento da AbacatePay para o formato da máquina de estados. O plano vem do PRODUTO (não do valor). */
export async function normalizeAbacate(payload: Obj, lookup: (productId: string) => Promise<{ plan: string; cycle: Cycle } | null> = planOfProduct): Promise<NormalizedEvent> {
  const event = String(payload.event ?? '')
  const data = o(payload.data)
  const sub = o(data.subscription), checkout = o(data.checkout), payment = o(data.payment), customer = o(data.customer)
  const items = Array.isArray(checkout.items) ? checkout.items as Obj[] : []
  const productId = str(o(data.newProduct).id) ?? str(items[0]?.id)
  const mapped = productId ? await lookup(productId) : null
  const freq = String(sub.frequency ?? '')
  const cycle: Cycle | null = mapped?.cycle ?? (freq === 'ANNUALLY' ? 'annual' : freq === 'MONTHLY' ? 'monthly' : null)
  const cancelledDueTo = String(sub.cancelledDueTo ?? '')
  let kind: NormalizedEvent['kind'] = 'ignored'
  let review: string | null = null
  if (event === 'subscription.completed' || event === 'subscription.renewed') kind = 'paid'
  else if (event === 'subscription.payment_failed') kind = 'failed'
  else if (event === 'subscription.cancelled') kind = /reembolso|refund/i.test(cancelledDueTo) ? 'refunded' : /max_payment_retries/i.test(cancelledDueTo) ? 'failed' : 'canceled'
  else if (event === 'checkout.refunded' && ['SUBSCRIPTION', 'ONE_TIME'].includes(String(checkout.frequency ?? ''))) kind = 'refunded'
  // Fatura avulsa (Pix por ciclo) paga: o checkout ONE_TIME é a única notificação desse pagamento.
  else if (event === 'checkout.completed' && String(checkout.frequency ?? '') === 'ONE_TIME') kind = 'paid'
  else if (event === 'checkout.disputed' || event === 'checkout.lost' || event === 'checkout.chargeback') kind = 'disputed'
  // checkout.completed (frequency SUBSCRIPTION) repete o mesmo pagamento: tratamos só pelos subscription.*
  if (kind === 'paid' && (event === 'subscription.completed' || event === 'checkout.completed') && !mapped) review = 'product_not_mapped'
  const oneTime = String(checkout.frequency ?? '') === 'ONE_TIME'
  const amountCents = Number(payment.paidAmount ?? payment.amount ?? sub.amount ?? (oneTime ? (checkout.paidAmount ?? checkout.amount) : undefined)) || null
  return {
    eventId: str(payload.id) ?? `${event}:${str(payment.id) ?? ''}`,
    kind,
    type: event.slice(0, 120),
    email: str(customer.email)?.toLowerCase() ?? null,
    intentId: (() => { const x = str(checkout.externalId) ?? str(o(checkout.metadata).intentId); return x && /^[\da-f-]{36}$/i.test(x) ? x : null })(),
    subscriptionRef: str(sub.id),
    chargeRef: str(payment.id) ?? (oneTime ? str(checkout.id) : null),
    planId: mapped?.plan ?? null,
    cycle,
    amountCents,
    feeCents: Number(payment.platformFee ?? checkout.platformFee) || null,
    method: str(sub.method) ?? str(o(data.payerInformation).method),
    review,
    provider: 'abacatepay',
    renewal: event === 'subscription.renewed',
    oneTime,
    cancelAtPeriodEnd: event === 'subscription.cancelled' ? String(sub.cancelPolicy ?? '') !== 'NOW' : undefined,
    receiptUrl: str(payment.receiptUrl) ?? str(checkout.receiptUrl),
    installments: Number(payment.installmentsCount ?? checkout.installmentsCount ?? o(data.payerInformation).installments) || null,
  }
}
