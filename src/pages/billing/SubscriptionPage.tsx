// Minha assinatura: plano, saldo, extrato, pagamentos, trocar/cancelar/reativar, reembolso em 7 dias.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/store/useLanguage'
import { useEntitlements } from '@/store/useEntitlements'
import { askConfirm } from '@/components/ui/confirm'
import { toast } from '@/components/ui/toast'
import { formatBRL, planById, PLANS, planRank, type PlanId } from '@/lib/plans'
import { billing, BILLING_ERRORS } from '@/lib/billingApi'
import { UsageMeters } from '@/components/billing/UsageMeters'

type Ledger = { id: number; unit: 'credits' | 'seconds'; delta: number; kind: string; operation: string | null; ref: string | null; created_at: string }
type Payment = { id: string; amount_cents: number; status: string; kind: string; paid_at: string | null; method: string | null }

const OP_LABEL: Record<string, string> = {
  'comic-page': 'Página ilustrada', 'comic-replan': 'Página redesenhada', 'comic-panel': 'Quadro editado', 'explain': 'Explicação',
  'variant-story': 'História', 'vocab-explain': 'Explicação de palavra', 'vocab-story': 'História da palavra', 'vocab-image': 'Imagem do mosaico',
  'style-extract': 'Estilo próprio', 'detect-characters': 'Personagens', 'transcribe-page': 'Transcrição de PDF', scene: 'Cena', tutor: 'Conversa com tutor',
  reader: 'Tutor de leitura', plan_change: 'Troca de plano', upgrade_proration: 'Bônus do upgrade', admin_grant: 'Bônus',
}

export function SubscriptionPage() {
  const pt = useLanguage().locale === 'pt-BR'
  const { data: ent, load } = useEntitlements()
  const [ledger, setLedger] = useState<Ledger[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supabase) return
    void supabase.from('credit_ledger').select('id, unit, delta, kind, operation, ref, created_at').order('created_at', { ascending: false }).limit(60).then(({ data }) => setLedger((data ?? []) as Ledger[]))
    void supabase.from('payments').select('id, amount_cents, status, kind, paid_at, method').order('created_at', { ascending: false }).limit(24).then(({ data }) => setPayments((data ?? []) as Payment[]))
  }, [ent?.subscription?.id])

  if (!ent) return null
  const plan = planById(ent.plan)
  const sub = ent.subscription
  const date = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString(pt ? 'pt-BR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
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
      detail: pt ? `O ${plan.name} continua até ${date(sub?.current_period_end)}. Nessa data a cobrança atual é encerrada e você assina o ${target.name} (${formatBRL(target.priceCents)}/mês) — avisaremos para concluir.` : `${plan.name} stays until ${date(sub?.current_period_end)}. Then you subscribe to ${target.name}.`,
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
  const firstPaid = [...payments].reverse().find(p => p.status === 'paid')
  const canRefund = sub?.provider === 'zouti' && firstPaid?.paid_at && Date.now() - new Date(firstPaid.paid_at).getTime() < 7 * 86400_000 && !payments.some(p => p.kind === 'refund')

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
                {sub.status === 'past_due' ? (pt ? `Pagamento pendente — acesso até ${date(sub.grace_until)}` : `Payment pending — access until ${date(sub.grace_until)}`)
                  : sub.cancel_at_period_end ? (pt ? `Cancelada — ativa até ${date(sub.current_period_end)}${sub.pending_plan ? ` (depois: ${planById(sub.pending_plan).name})` : ''}` : `Cancelled — active until ${date(sub.current_period_end)}`)
                  : sub.provider === 'admin' ? (pt ? `Cortesia até ${date(sub.current_period_end)}` : `Complimentary until ${date(sub.current_period_end)}`)
                  : (pt ? `${formatBRL(sub.price_cents)}/mês · renova em ${date(sub.current_period_end)}` : `${formatBRL(sub.price_cents)}/mo · renews ${date(sub.current_period_end)}`)}
              </p>
            )}
          </div>
          <Link to="/planos" className="h-10 px-4 rounded-xl inline-flex items-center text-[14px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            {ent.plan === 'pro' ? (pt ? 'Ver planos' : 'See plans') : (pt ? 'Fazer upgrade' : 'Upgrade')}
          </Link>
        </div>
        <div className="mt-5"><UsageMeters /></div>
        {sub && sub.provider === 'zouti' && (
          <div className="mt-5 flex flex-wrap gap-2">
            {sub.cancel_at_period_end ? (
              <button type="button" disabled={busy} onClick={() => run(() => billing.resume(), pt ? 'Assinatura reativada!' : 'Subscription resumed!')} className="h-10 px-4 rounded-xl text-[14px] border" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Reativar assinatura' : 'Resume subscription'}</button>
            ) : (
              <>
                {PLANS.filter(p => p.id !== 'free' && planRank(p.id) < planRank(ent.plan)).map(p => (
                  <button key={p.id} type="button" disabled={busy} onClick={() => downgrade(p.id)} className="h-10 px-4 rounded-xl text-[14px] border" style={{ borderColor: 'var(--theme-border)' }}>{pt ? `Mudar para ${p.name}` : `Switch to ${p.name}`}</button>
                ))}
                <button type="button" disabled={busy} onClick={cancel} className="h-10 px-4 rounded-xl text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Cancelar assinatura' : 'Cancel subscription'}</button>
              </>
            )}
            {canRefund && <button type="button" disabled={busy} onClick={refund} className="h-10 px-4 rounded-xl text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Pedir reembolso (7 dias)' : 'Request refund (7 days)'}</button>}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[16px] font-semibold">{pt ? 'Extrato de créditos e minutos' : 'Credit and minute history'}</h2>
        <ul className="mt-3 divide-y rounded-2xl border" style={{ borderColor: 'var(--theme-border)' }}>
          {ledger.length === 0 && <li className="p-4 text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Nada por aqui ainda.' : 'Nothing yet.'}</li>}
          {ledger.map(l => (
            <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13.5px]" style={{ borderColor: 'var(--theme-border)' }}>
              <span className="min-w-0 truncate">{l.kind === 'grant' ? (pt ? 'Renovação do plano' : 'Plan renewal') : l.kind === 'expire' ? (pt ? 'Saldo expirado' : 'Expired balance') : OP_LABEL[l.operation ?? ''] ?? l.operation}{l.ref && l.kind === 'commit' && !l.ref.includes(':') ? ` · ${l.ref}` : ''}</span>
              <span className="shrink-0 tabular-nums" style={{ color: l.delta >= 0 ? 'var(--pastel-green-fg, #15803d)' : 'var(--theme-text-secondary)' }}>
                {l.delta > 0 ? '+' : ''}{l.unit === 'seconds' ? `${Math.round(l.delta / 6) / 10} min` : `${l.delta} ${pt ? 'créditos' : 'credits'}`} · {new Date(l.created_at).toLocaleDateString(pt ? 'pt-BR' : 'en-US')}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {payments.length > 0 && (
        <section>
          <h2 className="text-[16px] font-semibold">{pt ? 'Pagamentos' : 'Payments'}</h2>
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
    </div>
  )
}
