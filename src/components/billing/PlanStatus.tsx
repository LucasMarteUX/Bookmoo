// Selo "Premium" ao lado do logotipo (leva à assinatura) e aviso fixo quando o pagamento atrasa.
import { Link } from 'react-router-dom'
import { AlertTriangle, Crown } from 'lucide-react'
import { useEntitlements } from '@/store/useEntitlements'
import { useLanguage } from '@/store/useLanguage'

export function PremiumBadge({ onClick }: { onClick?: () => void }) {
  const ent = useEntitlements(s => s.data)
  const pt = useLanguage().locale === 'pt-BR'
  if (!ent || ent.plan === 'free') return null
  return (
    <Link to="/assinatura" onClick={onClick} title={pt ? `Plano ${ent.plan_name} · ver assinatura` : `${ent.plan_name} plan · see subscription`}
      className="premium-pill shrink-0 inline-flex items-center gap-1 h-[22px] px-2 rounded-md text-[10.5px] font-semibold uppercase tracking-[0.06em]">
      <Crown className="w-3 h-3" strokeWidth={2.4} />Premium
    </Link>
  )
}

/** Pagamento em atraso: na carência ainda tem o plano; depois cai para o Grátis até renovar. */
export function BillingAlert({ onClick, compact }: { onClick?: () => void; compact?: boolean }) {
  const ent = useEntitlements(s => s.data)
  const pt = useLanguage().locale === 'pt-BR'
  if (!ent) return null
  const sub = ent.subscription
  const inGrace = sub?.status === 'past_due'
  const lapsed = ent.plan === 'free' && ['past_due', 'expired'].includes(ent.last_subscription_status ?? '')
  if (!inGrace && !lapsed) return null
  const until = sub?.grace_until ? new Date(sub.grace_until).toLocaleDateString(pt ? 'pt-BR' : 'en-US', { day: '2-digit', month: 'short' }) : ''
  const title = inGrace ? (pt ? 'Pagamento pendente' : 'Payment pending') : (pt ? 'Você está no plano Grátis' : 'You are on the Free plan')
  const text = inGrace
    ? (pt ? `Não conseguimos cobrar sua assinatura. Renove até ${until} para não perder o ${ent.plan_name}.` : `We couldn't charge your subscription. Renew by ${until} to keep ${ent.plan_name}.`)
    : (pt ? 'O pagamento não foi aprovado e você foi alocado ao plano gratuito. Renove sua assinatura para voltar.' : 'Your payment failed and you were moved to the free plan. Renew to get it back.')
  return (
    <div role="alert" className={`rounded-lg border ${compact ? 'p-2.5' : 'p-3'}`} style={{ borderColor: 'var(--pastel-amber-bd, #e7cf9d)', backgroundColor: 'var(--pastel-amber-bg, #fbf1dc)', color: 'var(--pastel-amber-fg, #6b4e16)' }}>
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{title}</p>
      <p className="mt-1 text-[12px] leading-snug">{text}</p>
      <Link to="/planos" onClick={onClick} className="mt-2 inline-flex items-center justify-center h-8 w-full rounded-md text-[12.5px] font-semibold"
        style={{ backgroundColor: 'var(--pastel-amber-fg, #6b4e16)', color: '#fff' }}>{pt ? 'Renovar assinatura' : 'Renew subscription'}</Link>
    </div>
  )
}

/** Convite fixo para quem está no Grátis (sem atraso): o que o Premium libera, em uma linha, e o caminho para os planos. */
export function UpgradeCard({ onClick }: { onClick?: () => void }) {
  const ent = useEntitlements(s => s.data)
  const pt = useLanguage().locale === 'pt-BR'
  if (!ent || ent.plan !== 'free' || ent.is_admin) return null
  if (['past_due', 'expired'].includes(ent.last_subscription_status ?? '')) return null
  return (
    <Link to="/planos" onClick={onClick} className="group block rounded-lg border p-3 transition-colors hover:bg-[var(--ui-hover)]" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: 'var(--theme-nav-text)' }}>
        <span className="premium-pill inline-flex items-center gap-1 h-[18px] px-1.5 rounded text-[9.5px] uppercase tracking-[0.06em]"><Crown className="w-2.5 h-2.5" strokeWidth={2.6} />Premium</span>
        {pt ? 'Leia sem limites' : 'Read without limits'}
      </p>
      <p className="mt-1 text-[11.5px] leading-snug" style={{ color: 'var(--theme-nav-text-muted)' }}>
        {pt ? 'A biblioteca inteira, ilustrações e tutores por voz. A partir de R$ 19,92/mês.' : 'The whole library, illustrations and voice tutors. From R$ 19.92/mo.'}
      </p>
      <span className="mt-2 inline-flex text-[12px] font-semibold underline underline-offset-4" style={{ color: 'var(--theme-nav-text)' }}>{pt ? 'Ver planos' : 'See plans'}</span>
    </Link>
  )
}
