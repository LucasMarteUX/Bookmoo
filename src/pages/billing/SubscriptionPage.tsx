// Minha assinatura: plano, saldo, como funcionam os créditos, pagamentos, trocar/cancelar/reativar, reembolso em 7 dias.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/store/useLanguage'
import { useEntitlements } from '@/store/useEntitlements'
import { askConfirm } from '@/components/ui/confirm'
import { toast } from '@/components/ui/toast'
import { COST_TABLE, formatBRL, planById, PLANS, planRank, type PlanId } from '@/lib/plans'
import { billing, BILLING_ERRORS } from '@/lib/billingApi'
import { UsageMeters } from '@/components/billing/UsageMeters'

type Payment = { id: string; amount_cents: number; status: string; kind: string; paid_at: string | null; method: string | null }


export function SubscriptionPage() {
  const pt = useLanguage().locale === 'pt-BR'
  const { data: ent, load } = useEntitlements()
  const [payments, setPayments] = useState<Payment[]>([])
  const [busy, setBusy] = useState(false)
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly')

  useEffect(() => {
    if (!supabase) return
    void supabase.from('payments').select('id, amount_cents, status, kind, paid_at, method').order('created_at', { ascending: false }).limit(24).then(({ data }) => setPayments((data ?? []) as Payment[]))
  }, [ent?.subscription?.id])
  useEffect(() => {
    const id = ent?.subscription?.id
    if (!supabase || !id) return
    void supabase.from('subscriptions').select('billing_cycle').eq('id', id).maybeSingle().then(({ data }) => setCycle((data?.billing_cycle as 'monthly' | 'annual') ?? 'monthly'))
  }, [ent?.subscription?.id])

  if (!ent) return null
  const plan = planById(ent.plan)
  const sub = ent.subscription
  // Cortesia sem expiração é gravada com data em 2099.
  const date = (iso?: string | null) => !iso ? '' : new Date(iso).getFullYear() >= 2099 ? (pt ? 'sem data de término' : 'no end date') : new Date(iso).toLocaleDateString(pt ? 'pt-BR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })
  const fail = (e: unknown) => {
    const code = (e as { code?: string }).code ?? ''
    toast(BILLING_ERRORS[code]?.[pt ? 'pt' : 'en'] ?? (pt ? 'Não foi possível concluir.' : 'Could not complete.'), { tone: 'error' })
  }
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try { await fn(); toast(ok); await load() } catch (e) { fail(e) } finally { setBusy(false) }
  }
  const cancel = async () => {
    const lower = PLANS.filter(p => p.id !== 'free' && planRank(p.id) < planRank(ent.plan))
    const ok = await askConfirm(pt ? 'Cancelar a assinatura?' : 'Cancel subscription?', {
      detail: pt ? `Você continua com o ${plan.name} até ${date(sub?.current_period_end)}. Depois sua conta volta para o Grátis: seu progresso, notas e vocabulário ficam guardados, e os livros da galeria ficam travados até você assinar de novo (o livro-presente continua).${lower.length ? ` Que tal mudar para o ${lower[lower.length - 1].name} em vez de cancelar?` : ''}`
        : `You keep ${plan.name} until ${date(sub?.current_period_end)}. Then your account goes back to Free: progress, notes and vocabulary are kept, and gallery books lock until you subscribe again.`,
      confirmLabel: pt ? 'Cancelar assinatura' : 'Cancel subscription', danger: true,
    })
    if (ok) await run(() => billing.cancel(), pt ? 'Assinatura cancelada. Você recebeu a confirmação por e-mail.' : 'Subscription cancelled.')
  }
  const downgrade = async (to: PlanId) => {
    const target = planById(to)
    const ok = await askConfirm(pt ? `Mudar para o ${target.name}?` : `Switch to ${target.name}?`, {
      detail: pt ? `O ${plan.name} continua até ${date(sub?.current_period_end)}. A partir dessa data você passa para o ${target.name}${sub?.provider === 'abacatepay' ? ', cobrado automaticamente na mesma forma de pagamento' : sub?.provider === 'abacatepay_pix' ? ', e a próxima fatura já sai com o valor novo' : ' (avisaremos para concluir)'}.` : `${plan.name} stays until ${date(sub?.current_period_end)}. Then you subscribe to ${target.name}.`,
      confirmLabel: pt ? 'Agendar mudança' : 'Schedule change',
    })
    if (ok) await run(() => billing.downgrade(to), pt ? 'Mudança agendada.' : 'Change scheduled.')
  }
  const refund = async () => {
    const ok = await askConfirm(pt ? 'Pedir reembolso (7 dias)?' : 'Request a refund (7 days)?', {
      detail: pt ? 'O valor é estornado integralmente e sua conta volta para o Grátis assim que o estorno for processado.' : 'You get a full refund and your account goes back to Free once processed.',
      confirmLabel: pt ? 'Pedir reembolso' : 'Request refund', danger: true,
    })
    if (ok) await run(() => billing.refund(), pt ? 'Pedido de reembolso enviado. Você receberá a confirmação por e-mail.' : 'Refund requested.')
  }
  const payInvoice = async () => {
    setBusy(true)
    try { const inv = await billing.invoice(); window.location.href = inv.url } catch (e) { fail(e); setBusy(false) }
  }
  const firstPaid = [...payments].reverse().find(p => p.status === 'paid')
  const managed = !!sub && (sub.provider === 'zouti' || sub.provider === 'abacatepay' || sub.provider === 'abacatepay_pix')
  const byInvoice = sub?.provider === 'abacatepay_pix'
  const per = cycle === 'annual' ? (pt ? '/ano' : '/yr') : (pt ? '/mês' : '/mo')
  const canRefund = managed && firstPaid?.paid_at && Date.now() - new Date(firstPaid.paid_at).getTime() < 7 * 86400_000 && !payments.some(p => p.kind === 'refund')

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header>
        <h1 className="font-display text-[34px] leading-tight">{pt ? 'Minha assinatura' : 'My subscription'}</h1>
      </header>

      <section className="rounded-3xl border p-5 sm:p-6" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12.5px] uppercase tracking-wide" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Plano atual' : 'Current plan'}</p>
            <p className="mt-1 text-[26px] font-semibold">{plan.name}</p>
            {sub && (
              <p className="mt-1 text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>
                {sub.status === 'past_due' ? (pt ? `Pagamento pendente, acesso até ${date(sub.grace_until)}` : `Payment pending, access until ${date(sub.grace_until)}`)
                  : sub.cancel_at_period_end ? (pt ? `Cancelada, ativa até ${date(sub.current_period_end)}${sub.pending_plan ? ` (depois: ${planById(sub.pending_plan).name})` : ''}` : `Cancelled, active until ${date(sub.current_period_end)}`)
                  : sub.provider === 'admin' ? (pt ? `Cortesia até ${date(sub.current_period_end)}` : `Complimentary until ${date(sub.current_period_end)}`)
                  : (pt ? `${formatBRL(sub.price_cents)}${per} · renova em ${date(sub.current_period_end)}` : `${formatBRL(sub.price_cents)}${per} · renews ${date(sub.current_period_end)}`)}
              </p>
            )}
          </div>
          <Link to="/planos" className="h-10 px-4 rounded-xl inline-flex items-center text-[14px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            {ent.plan === 'pro' ? (pt ? 'Ver planos' : 'See plans') : (pt ? 'Fazer upgrade' : 'Upgrade')}
          </Link>
        </div>
        {byInvoice && !sub.cancel_at_period_end && (
          <p className="mt-3 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>
            {pt ? 'Pagamento por fatura Pix: enviamos o link por e-mail antes de cada vencimento. Não há débito automático.' : 'Paid by Pix invoice: we email you the link before each due date. There is no automatic debit.'}
          </p>
        )}
        <div className="mt-5"><UsageMeters /></div>
        {managed && (
          <div className="mt-5 flex flex-wrap gap-2">
            {sub.cancel_at_period_end ? (
              sub.provider === 'abacatepay'
                ? <Link to="/planos" className="h-10 px-4 rounded-xl inline-flex items-center text-[14px] border" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Assinar de novo' : 'Subscribe again'}</Link>
                : <button type="button" disabled={busy} onClick={() => run(() => billing.resume(), pt ? 'Assinatura reativada!' : 'Subscription resumed!')} className="h-10 px-4 rounded-xl text-[14px] border" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Reativar assinatura' : 'Resume subscription'}</button>
            ) : !sub.pending_plan && PLANS.filter(p => p.id !== 'free' && planRank(p.id) < planRank(ent.plan)).map(p => (
              <button key={p.id} type="button" disabled={busy} onClick={() => downgrade(p.id)} className="h-10 px-4 rounded-xl text-[14px] border" style={{ borderColor: 'var(--theme-border)' }}>{pt ? `Mudar para ${p.name}` : `Switch to ${p.name}`}</button>
            ))}
            {byInvoice && !sub.cancel_at_period_end && (
              <button type="button" disabled={busy} onClick={payInvoice} className="h-10 px-4 rounded-xl text-[14px] font-medium" style={{ backgroundColor: sub.status === 'past_due' ? 'var(--theme-primary)' : 'transparent', color: sub.status === 'past_due' ? 'var(--theme-primary-text)' : 'var(--theme-text)', border: sub.status === 'past_due' ? 'none' : '1px solid var(--theme-border)' }}>
                {sub.status === 'past_due' ? (pt ? 'Pagar agora' : 'Pay now') : (pt ? 'Pagar a próxima fatura' : 'Pay next invoice')}
              </button>
            )}
            <Link to="/recibos" className="h-10 px-4 rounded-xl inline-flex items-center text-[14px] border" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Recibos' : 'Receipts'}</Link>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[16px] font-semibold">{pt ? 'Como funcionam os créditos' : 'How credits work'}</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt
            ? `Todo mês o seu plano recebe ${plan.credits} créditos novos, e o que sobra do mês anterior não acumula. Ler, ouvir e marcar vocabulário não gastam nada: os créditos são só para o que a IA cria na hora.`
            : `Each month your plan gets ${plan.credits} fresh credits; leftovers do not roll over. Reading, listening and saving vocabulary cost nothing: credits are only for what the AI creates on the spot.`}
        </p>
        <ul className="mt-3 divide-y rounded-2xl border" style={{ borderColor: 'var(--theme-border)' }}>
          {COST_TABLE.map(c => (
            <li key={c.pt} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13.5px]" style={{ borderColor: 'var(--theme-border)' }}>
              <span className="min-w-0">{pt ? c.pt : c.en}</span>
              <span className="shrink-0 tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>
                {c.credits === '0' ? (pt ? 'de graça' : 'free') : c.credits}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {payments.length > 0 && (
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold">{pt ? 'Pagamentos' : 'Payments'}</h2>
            <Link to="/recibos" className="text-[13.5px] underline underline-offset-4" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Ver recibos' : 'See receipts'}</Link>
          </div>
          <ul className="mt-3 divide-y rounded-2xl border" style={{ borderColor: 'var(--theme-border)' }}>
            {payments.map(p => (
              <li key={p.id} className="flex items-center justify-between px-4 py-2.5 text-[13.5px]" style={{ borderColor: 'var(--theme-border)' }}>
                <span>{p.kind === 'refund' ? (pt ? 'Reembolso' : 'Refund') : p.kind === 'renewal' ? (pt ? 'Renovação' : 'Renewal') : p.kind === 'upgrade' ? 'Upgrade' : (pt ? 'Assinatura' : 'Subscription')}{p.paid_at ? ` · ${new Date(p.paid_at).toLocaleDateString(pt ? 'pt-BR' : 'en-US')}` : ''}</span>
                <span className="tabular-nums">{formatBRL(p.amount_cents)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {managed && !sub.cancel_at_period_end && (
        <footer className="pt-2 pb-6 text-[12.5px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? 'Você pode encerrar a renovação automática quando quiser; o acesso continua até o fim do período pago. ' : 'You can stop automatic renewal at any time; access continues until the end of the paid period. '}
          <button type="button" disabled={busy} onClick={cancel} className="underline underline-offset-4 hover:opacity-80">{pt ? 'Cancelar assinatura' : 'Cancel subscription'}</button>
          {canRefund && <>{' · '}<button type="button" disabled={busy} onClick={refund} className="underline underline-offset-4 hover:opacity-80">{pt ? 'Desistir e pedir reembolso (7 dias)' : 'Withdraw and request a refund (7 days)'}</button></>}
        </footer>
      )}
    </div>
  )
}
