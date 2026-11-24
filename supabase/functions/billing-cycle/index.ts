// Rotina diária das assinaturas pagas por fatura Pix (provider "abacatepay_pix"). Chamada pelo pg_cron.
// Publicar com --no-verify-jwt. Tudo é idempotente (decidido pelo estado no banco), então rodar duas vezes não duplica nada:
//  1. até 5 dias antes do vencimento: gera a fatura do próximo ciclo (Pix ou cartão) e manda o link por e-mail;
//  2. venceu sem pagamento: passa para past_due com 3 dias de tolerância e avisa (com a fatura e a opção de cartão);
//  3. tolerância acabou: encerra (a conta volta para o Grátis) e avisa;
//  4. cancelada e vencida: encerra sem e-mail (o de cancelamento já foi).
import { adminClient, json, log } from '../_shared/tts.ts'
import { emails } from '../_shared/email.ts'
import { openRenewalInvoice } from '../_shared/invoices.ts'

const APP_URL = (Deno.env.get('APP_URL') ?? 'https://upoonly.com').replace(/\/+$/, '')
const DAY = 86400_000

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const db = adminClient()
  const now = Date.now()
  const { data: plans } = await db.from('plans').select('id, name')
  const planName = (id: string) => (plans ?? []).find(p => p.id === id)?.name ?? id
  const { data: subs } = await db.from('subscriptions').select('*').eq('provider', 'abacatepay_pix').in('status', ['active', 'past_due'])
  const out = { invoices: 0, overdue: 0, expired: 0, closed: 0, errors: 0 }

  for (const sub of subs ?? []) {
    try {
      const end = new Date(sub.current_period_end).getTime()
      const { data: u } = await db.auth.admin.getUserById(sub.user_id)
      const email = u.user?.email ?? null
      const name = (u.user?.user_metadata as { full_name?: string } | undefined)?.full_name
      const plan = planName(sub.pending_plan_id ?? sub.plan_id)

      if (sub.cancel_at_period_end) {
        if (end <= now) { await db.from('subscriptions').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', sub.id); out.closed++ }
        continue
      }
      if (sub.status === 'active' && end > now && end - now <= 5 * DAY) {
        if (!email) continue
        const inv = await openRenewalInvoice(sub, { email, name, origin: APP_URL })
        if (inv.created) { await emails.invoiceReady(email, plan, inv.amountCents, sub.current_period_end, inv.url); out.invoices++ }
        continue
      }
      if (sub.status === 'active' && end <= now) {
        const grace = new Date(end + 3 * DAY)
        await db.from('subscriptions').update({ status: 'past_due', grace_until: grace.toISOString(), updated_at: new Date().toISOString() }).eq('id', sub.id)
        if (email) {
          const inv = await openRenewalInvoice(sub, { email, name, origin: APP_URL })
          await emails.invoiceOverdue(email, plan, inv.amountCents, grace.toISOString(), inv.url)
        }
        out.overdue++
        continue
      }
      if (sub.status === 'past_due' && new Date(sub.grace_until ?? sub.current_period_end).getTime() <= now) {
        await db.from('subscriptions').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', sub.id)
        await db.from('checkout_intents').update({ status: 'expired' }).eq('from_subscription_id', sub.id).eq('kind', 'renewal').eq('status', 'open')
        if (email) await emails.movedToFree(email, planName(sub.plan_id))
        out.expired++
      }
    } catch (e) {
      out.errors++
      log('billing-cycle', 'sub_failed', { sub: sub.id, msg: String((e as Error).message).slice(0, 200) })
    }
  }
  if (out.errors) await emails.adminAlert('Rotina de faturas Pix com erros', `<p>${out.errors} assinatura(s) falharam. Veja os logs da função billing-cycle.</p>`)
  log('billing-cycle', 'done', out)
  return json({ ok: true, ...out })
})
