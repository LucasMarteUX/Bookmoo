// Ações de assinatura da pessoa logada: checkout, orçamento de upgrade, cancelar/reativar,
// downgrade, reembolso (arrependimento) e status da intenção (tela de retorno do pagamento).
import { adminClient, corsHeaders, getUser, json, log } from '../_shared/tts.ts'
import { buildCheckoutUrl, checkoutUrlFor, PAID_PLANS, upgradeQuote, type Plan } from '../_shared/payments.ts'
import { emails } from '../_shared/email.ts'

type Body = { action?: string; plan?: string; intent?: string; guardian?: boolean; reason?: string }

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

async function handle(userId: string, email: string, name: string | undefined, confirmed: boolean, b: Body) {
  const db = adminClient()
  const { data: plans } = await db.from('plans').select('*').order('rank')
  const planOf = (id?: string | null) => (plans ?? []).find((p: Plan) => p.id === id) as Plan | undefined
  const { data: liveRow } = await db.from('subscriptions').select('*').eq('user_id', userId).in('status', ['active', 'past_due']).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const live = liveRow && new Date(liveRow.status === 'past_due' ? (liveRow.grace_until ?? liveRow.current_period_end) : liveRow.current_period_end) > new Date() ? liveRow : null
  const currentPeriod = async () => (await db.rpc('ensure_period', { p_user: userId })).data as {
    credits_granted: number; bonus_credits: number; credits_used: number; credits_reserved: number
  } | null

  switch (b.action) {
    case 'quote': {
      const next = planOf(b.plan)
      if (!next || next.id === 'free') throw new BillingError('invalid_plan')
      if (!live || live.provider === 'admin') return { kind: 'new', chargeCents: next.price_cents, discountCents: 0, bonusCredits: 0 }
      const cur = planOf(live.plan_id)!
      if (next.rank <= cur.rank) return { kind: next.rank === cur.rank ? 'same' : 'downgrade' }
      return { kind: 'upgrade', ...upgradeQuote(live, await currentPeriod(), next) }
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
      let kind: 'new' | 'upgrade' = 'new'
      let quote = { discountCents: 0, bonusCredits: 0 }
      if (live && live.provider !== 'admin') {
        if (live.status === 'past_due') throw new BillingError('past_due')
        const cur = planOf(live.plan_id)!
        if (next.rank === cur.rank) throw new BillingError('same_plan')
        if (next.rank < cur.rank) throw new BillingError('use_downgrade')
        kind = 'upgrade'
        quote = upgradeQuote(live, await currentPeriod(), next)
      }
      const base = checkoutUrlFor(next.id)
      if (!base) throw new BillingError('billing_not_configured', 503)
      // Uma intenção aberta por pessoa.
      await db.from('checkout_intents').update({ status: 'canceled' }).eq('user_id', userId).eq('status', 'open')
      const { data: intent, error } = await db.from('checkout_intents').insert({
        user_id: userId, plan_id: next.id, kind, amount_cents: next.price_cents, proration_cents: quote.discountCents,
        bonus_credits: quote.bonusCredits, from_subscription_id: kind === 'upgrade' ? live!.id : null,
      }).select('*').single()
      if (error) throw new BillingError('intent_failed', 500)
      const url = buildCheckoutUrl(base, intent.id, email, name)
      await db.from('checkout_intents').update({ checkout_url: url }).eq('id', intent.id)
      return { url, intent: intent.id, kind, ...quote }
    }

    case 'intent-status': {
      const { data: intent } = await db.from('checkout_intents').select('id, status, plan_id, kind, bonus_credits').eq('id', String(b.intent ?? '')).eq('user_id', userId).maybeSingle()
      if (!intent) throw new BillingError('intent_not_found', 404)
      return { intent }
    }

    case 'cancel': {
      if (!live || live.provider === 'admin') throw new BillingError('no_subscription')
      await db.from('subscriptions').update({ cancel_at_period_end: true, canceled_at: new Date().toISOString(), pending_plan_id: null, updated_at: new Date().toISOString() }).eq('id', live.id)
      await db.from('payment_events').insert({ provider: 'app', provider_event_id: `cancel:${live.id}:${Date.now()}`, type: 'cancel_request', payload: { user: userId, subscription: live.id, provider_subscription_id: live.provider_subscription_id, reason: String(b.reason ?? '').slice(0, 300) } })
      await emails.adminAlert('Cancelamento pedido no app', `<p>${email} cancelou o plano ${live.plan_id}. Garanta que a recorrência ${live.provider_subscription_id ?? ''} esteja cancelada na Zouti.</p>`)
      await emails.canceled(email, planOf(live.plan_id)?.name ?? live.plan_id, new Date(live.current_period_end).toLocaleDateString('pt-BR'))
      return { ok: true, until: live.current_period_end }
    }

    case 'resume': {
      if (!live || !live.cancel_at_period_end) throw new BillingError('nothing_to_resume')
      await db.from('subscriptions').update({ cancel_at_period_end: false, canceled_at: null, pending_plan_id: null, updated_at: new Date().toISOString() }).eq('id', live.id)
      await emails.adminAlert('Assinatura reativada no app', `<p>${email} desfez o cancelamento do plano ${live.plan_id}. Confira se a recorrência continua ativa na Zouti.</p>`)
      return { ok: true }
    }

    case 'downgrade': {
      // O gateway cobra o valor do link do plano: downgrade = encerrar no fim do ciclo e assinar o plano menor depois.
      const next = planOf(b.plan)
      if (!live || live.provider === 'admin') throw new BillingError('no_subscription')
      const cur = planOf(live.plan_id)!
      if (!next || next.rank >= cur.rank) throw new BillingError('invalid_plan')
      await db.from('subscriptions').update({ cancel_at_period_end: true, pending_plan_id: next.id === 'free' ? null : next.id, updated_at: new Date().toISOString() }).eq('id', live.id)
      await emails.adminAlert('Downgrade agendado', `<p>${email}: ${cur.id} → ${next.id} no fim do ciclo. Cancele a recorrência atual na Zouti.</p>`)
      return { ok: true, until: live.current_period_end, next: next.id }
    }

    case 'refund': {
      // Direito de arrependimento (CDC art. 49): até 7 dias da primeira compra.
      if (!live || live.provider !== 'zouti') throw new BillingError('no_subscription')
      const { data: first } = await db.from('payments').select('paid_at, amount_cents, provider_charge_id').eq('user_id', userId).eq('status', 'paid').order('paid_at', { ascending: true }).limit(1).maybeSingle()
      const { count: refunds } = await db.from('payments').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('kind', 'refund')
      if (!first?.paid_at || Date.now() - new Date(first.paid_at).getTime() > 7 * 86400_000 || (refunds ?? 0) > 0) throw new BillingError('refund_window_closed')
      await db.from('payment_events').insert({ provider: 'app', provider_event_id: `refund:${live.id}`, type: 'refund_request', payload: { user: userId, charge: first.provider_charge_id, amount_cents: first.amount_cents } })
      await emails.adminAlert('Reembolso solicitado (7 dias)', `<p>${email} pediu reembolso de ${(first.amount_cents / 100).toFixed(2)} (cobrança ${first.provider_charge_id}). Estorne na Zouti: o webhook de estorno encerra o acesso automaticamente.</p>`)
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
  try {
    return json(await handle(user.id, user.email, (user.user_metadata as { full_name?: string })?.full_name, !!user.email_confirmed_at, body))
  } catch (e) {
    const code = e instanceof BillingError ? e.code : 'billing_failed'
    const status = e instanceof BillingError ? e.status : 500
    if (!(e instanceof BillingError)) log('billing', 'error', { action: body.action, msg: String((e as Error)?.message ?? e).slice(0, 200) })
    return json({ error: code }, status)
  }
})
