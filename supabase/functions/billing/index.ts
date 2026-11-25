// Ações de assinatura da pessoa logada: checkout, orçamento de upgrade, cancelar/reativar,
// downgrade, reembolso (arrependimento) e status da intenção (tela de retorno do pagamento).
import { adminClient, corsHeaders, getUser, json, log } from '../_shared/tts.ts'
import { rateLimit } from '../_shared/rate.ts'
import { buildCheckoutUrl, checkoutUrlFor, claimPending, exactEmail, PAID_PLANS, priceFor, switchCredit, type Cycle, type Plan } from '../_shared/payments.ts'
import { emails } from '../_shared/email.ts'
import { abacateEnabled, cancelSubscription, changePlan, createOneTimeCheckout, createSubscriptionCheckout, ensureCustomer, pixAutomaticoEnabled, productFor } from '../_shared/abacate.ts'
import { openRenewalInvoice } from '../_shared/invoices.ts'

type Body = { origin?: string; action?: string; method?: string; plan?: string; cycle?: string; intent?: string; guardian?: boolean; reason?: string; email?: string; order?: string }

class BillingError extends Error { constructor(public code: string, public status = 400) { super(code) } }

function ageFrom(birth: string | null | undefined): number | null {
  if (!birth) return null
  const b = new Date(`${birth}T12:00:00Z`)
  if (Number.isNaN(+b)) return null
  const now = new Date()
  let age = now.getUTCFullYear() - b.getUTCFullYear()
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) age--
  return age
}

/** Mensal → anual (mesmo plano ou maior) e plano maior no mesmo ciclo são upgrade. Anual → mensal espera o fim do ano. */
function switchKind(live: { plan_id: string; billing_cycle?: string | null }, next: Plan, cycle: Cycle, plans?: Plan[]): 'upgrade' | 'same' | 'downgrade' {
  const curRank = (plans ?? CURRENT_PLANS).find(p => p.id === live.plan_id)?.rank ?? 0
  const curCycle = (live.billing_cycle ?? 'monthly') as Cycle
  if (next.rank === curRank && curCycle === cycle) return 'same'
  if (curCycle === 'annual' && cycle === 'monthly') return 'downgrade'
  if (next.rank < curRank) return 'downgrade'
  return 'upgrade'
}
let CURRENT_PLANS: Plan[] = []

/** Origem do site para as URLs de retorno do checkout (só https ou localhost). */
function safeOrigin(o?: string): string {
  const fallback = (Deno.env.get('APP_URL') ?? 'https://upoonly.com').replace(/\/+$/, '')
  try {
    const u = new URL(String(o ?? ''))
    if (u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1') return u.origin
  } catch { /* usa o padrão */ }
  return fallback
}

async function handle(userId: string, email: string, name: string | undefined, confirmed: boolean, b: Body) {
  const db = adminClient()
  const { data: plans } = await db.from('plans').select('*').order('rank')
  const planOf = (id?: string | null) => (plans ?? []).find((p: Plan) => p.id === id) as Plan | undefined
  CURRENT_PLANS = (plans ?? []) as Plan[]
  const { data: liveRow } = await db.from('subscriptions').select('*').eq('user_id', userId).in('status', ['active', 'past_due']).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const live = liveRow && new Date(liveRow.status === 'past_due' ? (liveRow.grace_until ?? liveRow.current_period_end) : liveRow.current_period_end) > new Date() ? liveRow : null
  const currentPeriod = async () => (await db.rpc('ensure_period', { p_user: userId })).data as {
    credits_granted: number; bonus_credits: number; credits_used: number; credits_reserved: number
  } | null

  switch (b.action) {
    case 'quote': {
      const next = planOf(b.plan)
      const cycle: Cycle = b.cycle === 'annual' ? 'annual' : 'monthly'
      if (!next || next.id === 'free') throw new BillingError('invalid_plan')
      const chargeCents = priceFor(next.id, cycle) ?? next.price_cents
      if (!live || live.provider === 'admin') return { kind: 'new', chargeCents, extraDays: 0, remainingCents: 0 }
      const kind = switchKind(live, next, cycle)
      if (kind !== 'upgrade') return { kind }
      return { kind, chargeCents, ...switchCredit(live, await currentPeriod(), chargeCents, cycle) }
    }

    case 'checkout': {
      const next = planOf(b.plan)
      if (!next || !PAID_PLANS.includes(next.id as typeof PAID_PLANS[number])) throw new BillingError('invalid_plan')
      if (!confirmed) throw new BillingError('email_unconfirmed', 403)
      const { data: acc } = await db.from('user_accounts').select('birth_date, flagged').eq('user_id', userId).maybeSingle()
      if (acc?.flagged) throw new BillingError('account_flagged', 403)
      const age = ageFrom(acc?.birth_date)
      if (age !== null && age < 12) throw new BillingError('minor_blocked', 403)
      if (age !== null && age < 18 && !b.guardian) throw new BillingError('guardian_required', 403)
      const cycle: Cycle = b.cycle === 'annual' ? 'annual' : 'monthly'
      const method: 'card' | 'pix' = b.method === 'pix' ? 'pix' : 'card'
      let kind: 'new' | 'upgrade' | 'switch' = 'new'
      if (live && live.provider !== 'admin') {
        const k = switchKind(live, next, cycle)
        // Quem paga por fatura Pix pode passar para o cartão recorrente no mesmo plano: os dias pagos viram dias extras.
        const toCard = live.provider === 'abacatepay_pix' && method === 'card' && k === 'same'
        if (live.status === 'past_due' && !toCard) throw new BillingError('past_due')
        if (k === 'same' && !toCard) throw new BillingError('same_plan')
        if (k === 'downgrade') throw new BillingError('use_downgrade')
        kind = toCard ? 'switch' : 'upgrade'
      }
      // Uma intenção aberta por pessoa.
      await db.from('checkout_intents').update({ status: 'canceled' }).eq('user_id', userId).eq('status', 'open')
      const { data: intent, error } = await db.from('checkout_intents').insert({
        user_id: userId, plan_id: next.id, kind, billing_cycle: cycle, amount_cents: priceFor(next.id, cycle) ?? next.price_cents,
        from_subscription_id: kind !== 'new' ? live!.id : null,
      }).select('*').single()
      if (error) throw new BillingError('intent_failed', 500)
      let url: string
      if (abacateEnabled()) {
        // AbacatePay: checkout de assinatura criado pela API, já ligado a esta conta (externalId = intenção).
        const origin = safeOrigin(b.origin)
        const customerId = await ensureCustomer(userId, email, name)
        const completionUrl = `${origin}/pagamento/sucesso?ciclo=${cycle === 'annual' ? 'anual' : 'mensal'}`
        // Pix sem Pix Automático liberado: fatura avulsa deste ciclo; as próximas saem antes de cada vencimento.
        const manualPix = method === 'pix' && !pixAutomaticoEnabled()
        const bill = manualPix
          ? { ...(await createOneTimeCheckout({ productId: await productFor(next.id, cycle, true), customerId, intentId: intent.id, cycle, completionUrl, returnUrl: `${origin}/planos` })), dropped: [] as string[] }
          : await createSubscriptionCheckout({ productId: await productFor(next.id, cycle), customerId, intentId: intent.id, cycle, completionUrl, returnUrl: `${origin}/planos`, methods: method === 'pix' ? ['PIX'] : ['CARD'] })
        url = bill.url
        await db.from('checkout_intents').update({ checkout_url: url, provider: 'abacatepay', provider_ref: bill.id }).eq('id', intent.id)
        if (bill.dropped.length) {
          const label: Record<string, string> = { pix_automatico: 'Pix Automático', repasse_juros: 'repasse dos juros ao cliente', parcelamento: 'parcelamento' }
          await emails.adminAlert('Recurso da AbacatePay não liberado', `<p>O checkout saiu sem: ${bill.dropped.map(d => label[d] ?? d).join(', ')}. Peça a liberação ao suporte da AbacatePay.</p>`)
        }
      } else {
        url = buildCheckoutUrl(checkoutUrlFor(cycle), intent.id, email, name)
        await db.from('checkout_intents').update({ checkout_url: url }).eq('id', intent.id)
      }
      return { url, intent: intent.id, kind, cycle }
    }

    case 'invoice': {
      // Fatura Pix em aberto do próximo ciclo (cria se ainda não existir). Só para quem paga por fatura.
      if (!liveRow || liveRow.provider !== 'abacatepay_pix') throw new BillingError('no_invoice')
      if (liveRow.cancel_at_period_end) throw new BillingError('canceled')
      const inv = await openRenewalInvoice(liveRow, { email, name, origin: safeOrigin(b.origin) })
      return { url: inv.url, amountCents: inv.amountCents, dueAt: liveRow.current_period_end }
    }

    case 'status': {
      // Estado da assinatura para as telas de retorno do pagamento e de planos.
      // Também libera aqui a compra feita antes da conta existir (mesmo e-mail, já confirmado).
      const claimed = confirmed ? await claimPending(userId, email).catch(() => [] as string[]) : []
      const { data: row } = await db.from('subscriptions')
        .select('plan_id, status, billing_cycle, current_period_end, provider, cancel_at_period_end, pending_plan_id, grace_until')
        .eq('user_id', userId).in('status', ['active', 'past_due']).order('created_at', { ascending: false }).limit(1).maybeSingle()
      const alive = row && new Date(row.status === 'past_due' ? (row.grace_until ?? row.current_period_end) : row.current_period_end) > new Date() ? row : null
      return { subscription: alive, claimed, confirmed }
    }

    case 'claim': {
      if (!confirmed) return { claimed: [] as string[] }
      return { claimed: await claimPending(userId, email).catch(() => [] as string[]) }
    }

    case 'claim-other': {
      // "Paguei com outro e-mail": nunca vinculamos pelo que a pessoa digita (qualquer um poderia
      // reivindicar a compra alheia). Mandamos um link de acesso para o e-mail do pagamento.
      const other = String(b.email ?? '').trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(other) || other.length > 254) throw new BillingError('invalid_email')
      const { data: known } = await db.rpc('user_id_by_email', { p_email: other })
      const { data: pend } = await db.from('pending_purchases').select('id').eq('email', exactEmail(other)).is('claimed_at', null).limit(1)
      const origin = safeOrigin(b.origin)
      if (known) {
        const { data: link } = await db.auth.admin.generateLink({ type: 'magiclink', email: other, options: { redirectTo: `${origin}/pagamento/sucesso` } })
        const url = (link as { properties?: { action_link?: string } } | null)?.properties?.action_link
        if (url) await emails.accessLink(other, url)
      } else if (pend?.length) {
        await emails.purchaseNeedsAccount(other, `${origin}/signup?email=${encodeURIComponent(other)}`)
      }
      // Resposta igual em todos os casos: não revela se existe compra nesse e-mail.
      return { sent: true }
    }

    case 'welcome': {
      // Boas-vindas uma vez só por conta (a trava é a própria atualização condicional).
      const { data: first } = await db.from('user_accounts').update({ welcome_sent_at: new Date().toISOString() })
        .eq('user_id', userId).is('welcome_sent_at', null).select('user_id')
      if (!first?.length) return { sent: false }
      await emails.welcome(email, name)
      return { sent: true }
    }

    case 'intent-status': {
      const { data: intent } = await db.from('checkout_intents').select('id, status, plan_id, kind, bonus_credits').eq('id', String(b.intent ?? '')).eq('user_id', userId).maybeSingle()
      if (!intent) throw new BillingError('intent_not_found', 404)
      return { intent }
    }

    case 'cancel': {
      if (!live || live.provider === 'admin') throw new BillingError('no_subscription')
      // AbacatePay: para a recorrência na hora pela API; o acesso continua aqui até o fim do período já pago.
      if (live.provider === 'abacatepay' && live.provider_subscription_id) await cancelSubscription(live.provider_subscription_id)
      // Fatura Pix: nada a cancelar no gateway; faturas abertas do próximo ciclo deixam de valer.
      if (live.provider === 'abacatepay_pix') await db.from('checkout_intents').update({ status: 'canceled' }).eq('from_subscription_id', live.id).eq('kind', 'renewal').eq('status', 'open')
      await db.from('subscriptions').update({ cancel_at_period_end: true, canceled_at: new Date().toISOString(), pending_plan_id: null, updated_at: new Date().toISOString() }).eq('id', live.id)
      await db.from('payment_events').insert({ provider: 'app', provider_event_id: `cancel:${live.id}:${Date.now()}`, type: 'cancel_request', payload: { user: userId, subscription: live.id, provider_subscription_id: live.provider_subscription_id, reason: String(b.reason ?? '').slice(0, 300) } })
      if (live.provider === 'zouti') await emails.adminAlert('Cancelamento pedido no app', `<p>${email} cancelou o plano ${live.plan_id}. Garanta que a recorrência ${live.provider_subscription_id ?? ''} esteja cancelada na Zouti.</p>`)
      await emails.canceled(email, planOf(live.plan_id)?.name ?? live.plan_id, new Date(live.current_period_end).toLocaleDateString('pt-BR'))
      return { ok: true, until: live.current_period_end }
    }

    case 'resume': {
      if (!live || !live.cancel_at_period_end) throw new BillingError('nothing_to_resume')
      // Na AbacatePay o cancelamento é definitivo: para voltar, assina de novo no fim do período.
      if (live.provider === 'abacatepay') throw new BillingError('resubscribe_required')
      await db.from('subscriptions').update({ cancel_at_period_end: false, canceled_at: null, pending_plan_id: null, updated_at: new Date().toISOString() }).eq('id', live.id)
      if (live.provider === 'abacatepay_pix') return { ok: true }
      await emails.adminAlert('Assinatura reativada no app', `<p>${email} desfez o cancelamento do plano ${live.plan_id}. Confira se a recorrência continua ativa na Zouti.</p>`)
      return { ok: true }
    }

    case 'downgrade': {
      // O gateway cobra o valor do link do plano: downgrade = encerrar no fim do ciclo e assinar o plano menor depois.
      const next = planOf(b.plan)
      if (!live || live.provider === 'admin') throw new BillingError('no_subscription')
      const cur = planOf(live.plan_id)!
      if (!next || next.rank >= cur.rank) throw new BillingError('invalid_plan')
      if (live.provider === 'abacatepay_pix') {
        // Fatura Pix: a próxima fatura já sai no plano menor (ou não sai, se for o Grátis).
        if (next.id === 'free') await db.from('subscriptions').update({ cancel_at_period_end: true, canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', live.id)
        else {
          await db.from('subscriptions').update({ pending_plan_id: next.id, updated_at: new Date().toISOString() }).eq('id', live.id)
          await emails.downgradeScheduled(email, cur.name, next.name, new Date(live.current_period_end).toLocaleDateString('pt-BR'))
        }
        await db.from('checkout_intents').update({ status: 'canceled' }).eq('from_subscription_id', live.id).eq('kind', 'renewal').eq('status', 'open')
        return { ok: true, until: live.current_period_end, next: next.id }
      }
      if (live.provider === 'abacatepay' && live.provider_subscription_id) {
        if (next.id === 'free') {
          await cancelSubscription(live.provider_subscription_id)
          await db.from('subscriptions').update({ cancel_at_period_end: true, canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', live.id)
        } else {
          // Troca agendada para a próxima cobrança: a AbacatePay já cobra o valor novo; o webhook aplica o plano.
          await changePlan(live.provider_subscription_id, await productFor(next.id, (live.billing_cycle ?? 'monthly') as Cycle))
          await db.from('subscriptions').update({ pending_plan_id: next.id, updated_at: new Date().toISOString() }).eq('id', live.id)
          await emails.downgradeScheduled(email, cur.name, next.name, new Date(live.current_period_end).toLocaleDateString('pt-BR'))
        }
        return { ok: true, until: live.current_period_end, next: next.id }
      }
      await db.from('subscriptions').update({ cancel_at_period_end: true, pending_plan_id: next.id === 'free' ? null : next.id, updated_at: new Date().toISOString() }).eq('id', live.id)
      await emails.adminAlert('Downgrade agendado', `<p>${email}: ${cur.id} → ${next.id} no fim do ciclo. Cancele a recorrência atual na Zouti.</p>`)
      return { ok: true, until: live.current_period_end, next: next.id }
    }

    case 'refund': {
      // Direito de arrependimento (CDC art. 49): até 7 dias da primeira compra.
      if (!live || !['zouti', 'abacatepay', 'abacatepay_pix'].includes(live.provider)) throw new BillingError('no_subscription')
      const { data: first } = await db.from('payments').select('paid_at, amount_cents, provider_charge_id').eq('user_id', userId).eq('status', 'paid').order('paid_at', { ascending: true }).limit(1).maybeSingle()
      const { count: refunds } = await db.from('payments').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('kind', 'refund')
      if (!first?.paid_at || Date.now() - new Date(first.paid_at).getTime() > 7 * 86400_000 || (refunds ?? 0) > 0) throw new BillingError('refund_window_closed')
      await db.from('payment_events').insert({ provider: 'app', provider_event_id: `refund:${live.id}`, type: 'refund_request', payload: { user: userId, charge: first.provider_charge_id, amount_cents: first.amount_cents } })
      // Para a recorrência já: ninguém deve ser cobrado de novo enquanto o estorno é feito.
      if (live.provider === 'abacatepay' && live.provider_subscription_id && !live.cancel_at_period_end) {
        await cancelSubscription(live.provider_subscription_id)
        await db.from('subscriptions').update({ cancel_at_period_end: true, canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', live.id)
      }
      if (live.provider === 'abacatepay_pix' && !live.cancel_at_period_end) await db.from('subscriptions').update({ cancel_at_period_end: true, canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', live.id)
      const gw = live.provider === 'zouti' ? 'Zouti' : 'AbacatePay'
      await emails.adminAlert('Reembolso solicitado (7 dias)', `<p>${email} pediu reembolso de ${(first.amount_cents / 100).toFixed(2)} (cobrança ${first.provider_charge_id}). Estorne no painel da ${gw}: o webhook de estorno encerra o acesso automaticamente.</p>`)
      return { ok: true }
    }

    default:
      throw new BillingError('unknown_action')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const user = await getUser(req)
  if (!user?.email) return json({ error: 'unauthorized' }, 401)
  const body = await req.json().catch(() => null) as Body | null
  if (!body) return json({ error: 'invalid_json' }, 400)
  // Leituras são consultadas em sequência pela tela de retorno do pagamento; escritas seguem apertadas.
  const readOnly = ['status', 'quote', 'intent-status'].includes(String(body.action ?? ''))
  const limited = await rateLimit(req, user.id, 'billing', readOnly ? 120 : 20)
  if (limited) return limited
  try {
    return json(await handle(user.id, user.email, (user.user_metadata as { full_name?: string })?.full_name, !!user.email_confirmed_at, body))
  } catch (e) {
    const ab = e as { status?: number; message?: string; name?: string }
    const isAbacate = e instanceof Error && e.constructor.name === 'AbacateError'
    const code = e instanceof BillingError ? e.code : isAbacate ? (ab.message === 'abacate_products_missing' || ab.message === 'abacate_not_configured' ? 'billing_not_configured' : 'gateway_error') : 'billing_failed'
    const status = e instanceof BillingError ? e.status : isAbacate ? 502 : 500
    if (isAbacate) log('billing', 'abacate_error', { action: body.action, msg: String(ab.message).slice(0, 200) })
    if (!(e instanceof BillingError)) log('billing', 'error', { action: body.action, msg: String((e as Error)?.message ?? e).slice(0, 200) })
    return json({ error: code }, status)
  }
})
