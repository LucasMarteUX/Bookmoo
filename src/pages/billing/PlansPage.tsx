// Tela de planos: primeiro acesso (welcome) e troca de plano. Mobile-first.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, Check, Loader2, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/store/useLanguage'
import { useEntitlements } from '@/store/useEntitlements'
import { formatBRL, PLANS, planRank, type PlanId } from '@/lib/plans'
import { billing, BILLING_ERRORS, type Quote } from '@/lib/billingApi'

function ageFrom(birth: string | null | undefined) {
  if (!birth) return null
  const b = new Date(`${birth}T12:00:00`)
  const n = new Date()
  let a = n.getFullYear() - b.getFullYear()
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--
  return a
}

export function PlansPage() {
  const pt = useLanguage().locale === 'pt-BR'
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const welcome = params.get('welcome') === '1'
  const wanted = params.get('plan') as PlanId | null
  const { data: ent, load } = useEntitlements()
  const [busy, setBusy] = useState<PlanId | null>(null)
  const [error, setError] = useState('')
  const [guardian, setGuardian] = useState(false)
  const [quotes, setQuotes] = useState<Partial<Record<PlanId, Quote>>>({})
  const current = ent?.plan ?? 'free'
  const age = ageFrom(ent?.birth_date)
  const minor = age !== null && age < 18

  useEffect(() => {
    if (!ent?.subscription || ent.subscription.provider === 'admin') return
    for (const p of PLANS) if (planRank(p.id) > planRank(current)) void billing.quote(p.id).then(q => setQuotes(prev => ({ ...prev, [p.id]: q }))).catch(() => {})
  }, [ent?.subscription?.id, current])

  useEffect(() => {
    if (wanted) document.getElementById(`plan-${wanted}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [wanted])

  const startFree = async () => {
    setBusy('free')
    if (supabase && ent?.onboarding_step !== 'done') await supabase.rpc('set_onboarding_step', { p_step: ent?.gift ? 'done' : 'gift' })
    await load()
    setBusy(null)
    navigate(ent?.gift ? '/' : '/presente', { replace: true })
  }

  const subscribe = async (plan: PlanId) => {
    setError('')
    if (minor && !guardian) { setError(BILLING_ERRORS.guardian_required[pt ? 'pt' : 'en']); return }
    setBusy(plan)
    try {
      const { url } = await billing.checkout(plan, guardian)
      window.location.href = url
    } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      setError(BILLING_ERRORS[code]?.[pt ? 'pt' : 'en'] ?? (pt ? 'Não foi possível abrir o pagamento. Tente de novo.' : 'Could not open checkout. Try again.'))
      setBusy(null)
    }
  }

  const cards = useMemo(() => PLANS, [])
  const highlight = wanted ?? 'plus'

  return (
    <div className="min-h-dvh px-4 pb-16" style={{ backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)', paddingTop: 'calc(var(--safe-t, 0px) + 1.25rem)' }}>
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between h-10">
          {welcome ? <span className="text-[14px] font-semibold">Bookmoo</span> : (
            <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} className="inline-flex items-center gap-1.5 h-10 px-2 -ml-2 rounded-md text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
              <ArrowLeft className="w-4 h-4" />{pt ? 'Voltar' : 'Back'}
            </button>
          )}
          {!welcome && ent?.subscription && <Link to="/assinatura" className="text-[13.5px] underline underline-offset-4" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Minha assinatura' : 'My subscription'}</Link>}
        </div>

        <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6 text-center">
          <h1 className="font-display text-[34px] sm:text-[44px] leading-tight">
            {welcome ? (pt ? 'Bem-vindo! Como você quer começar?' : 'Welcome! How do you want to start?') : (pt ? 'Escolha seu plano' : 'Choose your plan')}
          </h1>
          <p className="mt-3 text-[15.5px] max-w-xl mx-auto" style={{ color: 'var(--theme-text-secondary)' }}>
            {pt ? 'Comece grátis com um livro de presente, ou libere a biblioteca inteira, mais IA e conversas por voz.' : 'Start free with a gift book, or unlock the whole library, more AI and voice conversations.'}
          </p>
        </motion.header>

        {minor && (
          <label className="mt-6 mx-auto max-w-xl flex items-start gap-2.5 rounded-xl border p-3 text-[13.5px]" style={{ borderColor: 'var(--theme-border)' }}>
            <input type="checkbox" checked={guardian} onChange={e => setGuardian(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[var(--theme-text)]" />
            <span>{pt ? 'Sou o responsável legal (ou tenho a autorização dele) para esta assinatura.' : 'I am the legal guardian (or have their permission) for this subscription.'}</span>
          </label>
        )}
        {error && <p role="alert" className="mt-4 text-center text-[14px] font-medium" style={{ color: 'var(--pastel-red-fg, #b42318)' }}>{error}</p>}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((plan, i) => {
            const isCurrent = plan.id === current && (plan.id !== 'free' || !welcome)
            const lower = planRank(plan.id) < planRank(current)
            const best = plan.id === highlight && plan.id !== 'free'
            const q = quotes[plan.id]
            return (
              <motion.section key={plan.id} id={`plan-${plan.id}`} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, type: 'spring', stiffness: 260, damping: 24 }}
                className="relative rounded-3xl border p-5 flex flex-col"
                style={{ borderColor: best ? 'var(--theme-accent)' : 'var(--theme-border)', borderWidth: best ? 2 : 1, backgroundColor: 'var(--theme-card-bg)', boxShadow: best ? '0 18px 40px -20px color-mix(in srgb, var(--theme-accent) 60%, transparent)' : undefined }}>
                {plan.highlight && <span className="absolute -top-3 left-5 h-6 px-2.5 rounded-full text-[11.5px] font-semibold inline-flex items-center gap-1" style={{ backgroundColor: 'var(--theme-accent)', color: '#fff' }}><Sparkles className="w-3.5 h-3.5" />{pt ? 'Mais escolhido' : 'Most popular'}</span>}
                <h2 className="text-[18px] font-semibold">{plan.name}</h2>
                <p className="text-[13px] mt-0.5" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? plan.tagline.pt : plan.tagline.en}</p>
                <p className="mt-4 text-[32px] font-semibold tabular-nums leading-none">
                  {plan.priceCents ? formatBRL(plan.priceCents) : 'R$ 0'}<span className="text-[13px] font-normal" style={{ color: 'var(--theme-text-secondary)' }}>/{pt ? 'mês' : 'mo'}</span>
                </p>
                <p className="mt-2 text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{plan.credits} {pt ? 'créditos de IA' : 'AI credits'} · {plan.minutes} min {pt ? 'de conversa' : 'of conversation'}</p>
                <ul className="mt-4 space-y-2 flex-1">
                  {plan.benefits.map(b => (
                    <li key={b.pt} className="flex gap-2 text-[13.5px] leading-snug"><Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--theme-accent)' }} />{pt ? b.pt : b.en}</li>
                  ))}
                </ul>
                {q?.kind === 'upgrade' && (q.bonusCredits ?? 0) > 0 && (
                  <p className="mt-3 text-[12.5px] rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                    {pt ? `Upgrade hoje: ${formatBRL(q.chargeCents ?? plan.priceCents)} e você ganha +${q.bonusCredits} créditos bônus pelo que sobrou do plano atual. Novo ciclo começa hoje.` : `Upgrade today: ${formatBRL(q.chargeCents ?? plan.priceCents)} plus ${q.bonusCredits} bonus credits for what's left on your current plan. New cycle starts today.`}
                  </p>
                )}
                <div className="mt-5">
                  {isCurrent ? (
                    <span className="h-12 w-full rounded-2xl grid place-items-center text-[14.5px] font-medium border" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}>{pt ? 'Seu plano atual' : 'Your current plan'}</span>
                  ) : plan.id === 'free' ? (
                    current === 'free' ? (
                      <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={startFree} disabled={busy !== null}
                        className="h-12 w-full rounded-2xl text-[15px] font-semibold border disabled:opacity-60" style={{ borderColor: 'var(--theme-border)' }}>
                        {busy === 'free' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (pt ? 'Começar grátis 🎁' : 'Start free 🎁')}
                      </motion.button>
                    ) : null
                  ) : lower ? (
                    <Link to="/assinatura" className="h-12 w-full rounded-2xl grid place-items-center text-[14px] border" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Mudar para este plano' : 'Switch to this plan'}</Link>
                  ) : (
                    <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => subscribe(plan.id)} disabled={busy !== null}
                      className="h-12 w-full rounded-2xl text-[15px] font-semibold disabled:opacity-60"
                      style={{ backgroundColor: best ? 'var(--theme-primary)' : 'var(--theme-bg-secondary)', color: best ? 'var(--theme-primary-text)' : 'var(--theme-text)' }}>
                      {busy === plan.id ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : current !== 'free' ? (pt ? `Fazer upgrade para ${plan.name}` : `Upgrade to ${plan.name}`) : (pt ? `Assinar ${plan.name}` : `Get ${plan.name}`)}
                    </motion.button>
                  )}
                </div>
              </motion.section>
            )
          })}
        </div>

        <section className="mt-12 grid gap-4 sm:grid-cols-3 text-[13.5px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
          <p><b style={{ color: 'var(--theme-text)' }}>{pt ? 'Créditos de IA' : 'AI credits'}</b><br />{pt ? 'Página ilustrada = 10 créditos; explicação, história ou imagem do mosaico = 1. O que a comunidade já gerou é grátis. Os créditos renovam todo mês e não acumulam.' : 'Illustrated page = 10 credits; explanation, story or mosaic image = 1. What the community already generated is free. Credits renew monthly and do not roll over.'}</p>
          <p><b style={{ color: 'var(--theme-text)' }}>{pt ? 'Cancele quando quiser' : 'Cancel anytime'}</b><br />{pt ? 'Você mantém o plano até o fim do período pago. Arrependeu-se? Reembolso integral em até 7 dias da primeira compra.' : 'You keep your plan until the end of the paid period. Full refund within 7 days of your first purchase.'}</p>
          <p><b style={{ color: 'var(--theme-text)' }}>{pt ? 'Upgrade a qualquer momento' : 'Upgrade anytime'}</b><br />{pt ? 'No upgrade o novo ciclo começa no dia, e o que sobrou do plano atual vira créditos bônus.' : 'When you upgrade the new cycle starts that day, and what is left of your current plan becomes bonus credits.'}</p>
        </section>
        <p className="mt-8 text-center text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? 'Pagamento seguro pela Zouti. Preços em reais, impostos inclusos. ' : 'Secure payment by Zouti. Prices in BRL, taxes included. '}
          <Link to="/terms?back=/planos#planos" className="underline underline-offset-2">{pt ? 'Termos' : 'Terms'}</Link>
        </p>
      </div>
    </div>
  )
}
