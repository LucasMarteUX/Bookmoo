// Tela de sucesso da Zouti (URL de retorno do checkout mensal e anual): /pagamento/sucesso?ciclo=mensal|anual
// Pública: quem pagou sem estar logado vê como acessar com o mesmo e-mail. Logado, espera o webhook liberar o
// plano (nunca libera nada sozinha) e mostra o onboarding: primeiro livro, nível e tutor.
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, BookOpen, Check, Clock, Gauge, Loader2, Mail, MessageCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { billing } from '@/lib/billingApi'
import { planById } from '@/lib/plans'
import { Logo } from '@/components/brand/Logo'
import { Confetti } from '@/components/billing/Confetti'

type State = 'waiting' | 'paid' | 'pending' | 'unconfirmed'

const STEPS = [
  { icon: BookOpen, title: 'Escolha seu primeiro livro', text: 'A biblioteca inteira está liberada. Comece por um clássico do seu nível.', to: '/gallery', cta: 'Abrir a biblioteca' },
  { icon: Gauge, title: 'Descubra seu nível', text: 'Um teste rápido ajusta as explicações e as conversas para você.', to: '/teste-de-nivel', cta: 'Fazer o teste' },
  { icon: MessageCircle, title: 'Converse com um tutor', text: 'Bia, Luck, Yuno e Yuri esperam você para falar sobre a história.', to: '/conversar', cta: 'Conhecer os tutores' },
]

export function PaymentSuccess() {
  const [params] = useSearchParams()
  const annual = params.get('ciclo') === 'anual'
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [state, setState] = useState<State>('waiting')
  const [plan, setPlan] = useState<string>('')
  const tries = useRef(0)

  useEffect(() => {
    if (loading || !session) return
    let stop = false
    const tick = async () => {
      if (stop) return
      try {
        const r = await billing.status()
        if (!r.confirmed) { setState('unconfirmed'); return }
        if (r.subscription && r.subscription.plan_id !== 'free') { setPlan(r.subscription.plan_id); setState('paid'); return }
      } catch { /* tenta de novo */ }
      tries.current++
      if (tries.current >= 40) { setState('pending'); return }
      setTimeout(tick, 2500)
    }
    void tick()
    return () => { stop = true }
  }, [session, loading])

  const p = planById(plan)
  const back = encodeURIComponent(`/pagamento/sucesso${annual ? '?ciclo=anual' : ''}`)

  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)', paddingTop: 'var(--safe-t, 0px)' }}>
      {state === 'paid' && <Confetti pieces={90} />}
      <div className="mx-auto max-w-5xl px-5 pb-16">
        <div className="h-16 flex items-center"><Link to="/" aria-label="Upoonly"><Logo height={34} style={{ color: 'var(--theme-text)' }} /></Link></div>

        <div className="grid gap-8 md:grid-cols-[1.05fr_1fr] md:items-center mt-4">
          <figure className="relative overflow-hidden rounded-[6px] aspect-[4/3] md:aspect-[4/5] m-0" style={{ outline: '1px solid var(--theme-border)' }}>
            <motion.img src="/site/home/convite.webp" alt="O Coelho Branco abre a porta da estufa" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: '82% center' }}
              initial={reduce ? false : { scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 1.6, ease: [0.2, 0.8, 0.2, 1] }} />
          </figure>

          <div>
            {!loading && !session && (
              <>
                <p className="text-[12px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--theme-text-secondary)' }}>Pagamento recebido</p>
                <h1 className="font-display text-[40px] sm:text-[52px] leading-[1.02] mt-3">Sua história <i>começa agora.</i></h1>
                <p className="mt-4 text-[15.5px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
                  Para acessar o plano{annual ? ' anual' : ''}, entre ou crie sua conta com <b style={{ color: 'var(--theme-text)' }}>o mesmo e-mail usado no pagamento</b>. O plano é liberado sozinho assim que o e-mail for confirmado.
                </p>
                <div className="mt-7 flex flex-wrap gap-2.5">
                  <Link to={`/signup?next=${back}`} className="h-12 px-5 rounded-lg inline-flex items-center gap-2 text-[15px] font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>Criar minha conta <ArrowRight className="w-4 h-4" /></Link>
                  <Link to={`/login?next=${back}`} className="h-12 px-5 rounded-lg inline-flex items-center text-[15px] font-medium border" style={{ borderColor: 'var(--theme-border)' }}>Já tenho conta</Link>
                </div>
                <p className="mt-5 text-[13px] flex items-center gap-2" style={{ color: 'var(--theme-text-secondary)' }}><Mail className="w-4 h-4" />Enviamos o recibo para o seu e-mail.</p>
              </>
            )}

            {session && state === 'waiting' && (
              <>
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--theme-text-secondary)' }} />
                <h1 className="font-display text-[36px] sm:text-[44px] leading-[1.05] mt-4">Confirmando seu pagamento…</h1>
                <p className="mt-3 text-[15.5px]" style={{ color: 'var(--theme-text-secondary)' }}>Leva alguns segundos. Pode deixar esta página aberta.</p>
              </>
            )}

            {session && state === 'unconfirmed' && (
              <>
                <Mail className="w-8 h-8" style={{ color: 'var(--theme-text-secondary)' }} />
                <h1 className="font-display text-[36px] sm:text-[44px] leading-[1.05] mt-4">Confirme seu e-mail</h1>
                <p className="mt-3 text-[15.5px]" style={{ color: 'var(--theme-text-secondary)' }}>Abra o link que enviamos para o seu e-mail. Assim que confirmar, o plano é liberado nesta conta.</p>
              </>
            )}

            {session && state === 'pending' && (
              <>
                <Clock className="w-8 h-8" style={{ color: 'var(--theme-text-secondary)' }} />
                <h1 className="font-display text-[36px] sm:text-[44px] leading-[1.05] mt-4">Quase lá</h1>
                <p className="mt-3 text-[15.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
                  O pagamento ainda está sendo confirmado (Pix e boleto podem levar alguns minutos). Avisamos por e-mail quando o plano for liberado. Se pagou com outro e-mail, entre com ele.
                </p>
                <button type="button" onClick={() => navigate('/', { replace: true })} className="mt-6 h-12 px-5 rounded-lg text-[15px] font-medium border" style={{ borderColor: 'var(--theme-border)' }}>Ir para o início</button>
              </>
            )}

            {session && state === 'paid' && (
              <motion.div initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                <p className="text-[12px] font-medium uppercase tracking-[0.08em] flex items-center gap-2" style={{ color: 'var(--theme-text-secondary)' }}><Check className="w-4 h-4" />Plano {p.name}{annual ? ' anual' : ''} liberado</p>
                <h1 className="font-display text-[40px] sm:text-[52px] leading-[1.02] mt-3">Bem-vindo(a) ao <i>{p.name}.</i></h1>
                <p className="mt-4 text-[15.5px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
                  A biblioteca inteira é sua, com {p.credits.toLocaleString('pt-BR')} créditos de IA por mês para ilustrações, explicações e conversas.
                </p>
                <button type="button" onClick={() => navigate('/gallery', { replace: true })} className="mt-7 h-12 px-5 rounded-lg inline-flex items-center gap-2 text-[15px] font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
                  Começar a ler <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </div>
        </div>

        {session && state === 'paid' && (
          <section className="mt-14" aria-label="Primeiros passos">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--theme-text-secondary)' }}>Primeiros passos</p>
            <ol className="mt-4 grid gap-3 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <motion.li key={s.to} initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.08 }}
                  className="rounded-[6px] border p-5 flex flex-col" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
                  <span className="text-[11px] font-medium tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>0{i + 1}</span>
                  <s.icon className="w-5 h-5 mt-3" />
                  <h2 className="font-display text-[22px] leading-tight mt-3">{s.title}</h2>
                  <p className="mt-2 text-[14px] flex-1" style={{ color: 'var(--theme-text-secondary)' }}>{s.text}</p>
                  <Link to={s.to} className="mt-4 text-[14px] font-medium inline-flex items-center gap-1.5 underline underline-offset-4">{s.cta} <ArrowRight className="w-3.5 h-3.5" /></Link>
                </motion.li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  )
}
