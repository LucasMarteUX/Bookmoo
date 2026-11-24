// Faturas Pix avulsas (enquanto o Pix Automático não está liberado na AbacatePay).
// Cada fatura é um checkout ONE_TIME ligado a uma intenção "renewal" da assinatura; pagar estende o período.
import { adminClient } from './tts.ts'
import { priceFor, type Cycle } from './payments.ts'
import { createOneTimeCheckout, ensureCustomer, productFor } from './abacate.ts'

type Sub = { id: string; user_id: string; plan_id: string; pending_plan_id?: string | null; billing_cycle?: string | null; current_period_start?: string | null; current_period_end: string; price_cents: number }

/** Devolve a fatura em aberto do próximo ciclo, criando-a se preciso (Pix e cartão como segunda opção). */
export async function openRenewalInvoice(sub: Sub, opts: { email: string; name?: string; origin: string }): Promise<{ url: string; amountCents: number; created: boolean }> {
  const db = adminClient()
  const planId = sub.pending_plan_id ?? sub.plan_id
  const cycle = (sub.billing_cycle ?? 'monthly') as Cycle
  const { data: open } = await db.from('checkout_intents').select('id, checkout_url, amount_cents, plan_id')
    .eq('from_subscription_id', sub.id).eq('kind', 'renewal').eq('status', 'open')
    .gte('created_at', sub.current_period_start ?? '1970-01-01').order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (open?.checkout_url && open.plan_id === planId) return { url: open.checkout_url, amountCents: open.amount_cents, created: false }

  const amountCents = priceFor(planId, cycle) ?? sub.price_cents
  const graceEnd = new Date(new Date(sub.current_period_end).getTime() + 3 * 86400_000)
  const { data: intent, error } = await db.from('checkout_intents').insert({
    user_id: sub.user_id, plan_id: planId, kind: 'renewal', billing_cycle: cycle, amount_cents: amountCents,
    from_subscription_id: sub.id, provider: 'abacatepay', expires_at: graceEnd.toISOString(),
  }).select('id').single()
  if (error) throw new Error(`invoice_intent: ${error.message}`)
  const customerId = await ensureCustomer(sub.user_id, opts.email, opts.name)
  const bill = await createOneTimeCheckout({
    productId: await productFor(planId, cycle, true), customerId, intentId: intent.id, cycle, withCard: true,
    completionUrl: `${opts.origin}/pagamento/sucesso?ciclo=${cycle === 'annual' ? 'anual' : 'mensal'}`, returnUrl: `${opts.origin}/assinatura`,
  })
  await db.from('checkout_intents').update({ checkout_url: bill.url, provider_ref: bill.id }).eq('id', intent.id)
  // Faturas antigas do mesmo ciclo (ex.: plano trocado) deixam de valer.
  await db.from('checkout_intents').update({ status: 'canceled' }).eq('from_subscription_id', sub.id).eq('kind', 'renewal').eq('status', 'open').neq('id', intent.id)
  return { url: bill.url, amountCents, created: true }
}
