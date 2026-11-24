// Tela de sucesso da Zouti (retorno do checkout mensal e anual): /pagamento/sucesso?ciclo=mensal|anual
// Abre com o coelho olhando a borboleta e então mostra o estado real, que vem do servidor (nunca libera nada sozinha):
//  - sem login: como acessar (mesmo e-mail do pagamento) e "paguei com outro e-mail";
//  - logado: confirmando → plano liberado (resumo + primeiros passos) | aguardando confirmação | e-mail não confirmado.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Check, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { billing, callFn } from '@/lib/billingApi'
import { annualCents, formatBRL, planById } from '@/lib/plans'
import { Logo } from '@/components/brand/Logo'
import { RabbitFlight } from '@/components/brand/RabbitFlight'
import { refreshEntitlements } from '@/store/useEntitlements'
import { Confetti } from '@/components/billing/Confetti'

type State = 'waiting' | 'paid' | 'pending' | 'unconfirmed'
type Sub = { plan_id: string; billing_cycle: 'monthly' | 'annual'; current_period_end: string }

const STEPS = [
  { title: 'Escolha seu primeiro livro', text: 'A biblioteca inteira está liberada. Comece por um clássico do seu nível.', to: '/gallery', cta: 'Abrir a biblioteca' },
  { title: 'Descubra seu nível', text: 'Um teste rápido ajusta as explicações e as conversas para você.', to: '/teste-de-nivel', cta: 'Fazer o teste' },
  { title: 'Converse com um tutor', text: 'Bia, Luck, Yuno e Yuri esperam você para falar sobre a história.', to: '/conversar', cta: 'Conhecer os tutores' },
]

const ink = 'var(--theme-text)'
const muted = 'var(--theme-text-secondary)'
const line = 'var(--theme-border)'

/**
 * "Paguei com outro e-mail". O plano fica na conta do e-mail que pagou, e não vinculamos nada
 * pelo que a pessoa digita aqui (qualquer um poderia pedir a compra alheia): mandamos um link
 * de acesso para aquele endereço. A resposta é a mesma exista ou não compra, de propósito.
 */
function OtherEmail() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'error'>('idle')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setState('busy')
    try {
      await callFn('billing', { action: 'claim-other', email, origin: window.location.origin }, { paywall: false })
      setState('ok')
      refreshEntitlements()
    } catch { setState('error') }
  }
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-6 text-[14px] underline underline-offset-4" style={{ color: muted }}>Paguei com outro e-mail</button>
  if (state === 'ok') {
    return (
      <div className="mt-6 max-w-md rounded-[6px] border p-4" style={{ borderColor: line, backgroundColor: 'var(--theme-card-bg)' }}>
        <p className="text-[14.5px] leading-relaxed">Se houver uma compra em <b>{email}</b>, enviamos para lá um link de acesso. Abra o e-mail e entre por ele: o plano está nessa conta.</p>
      </div>
    )
  }
  return (
    <form onSubmit={submit} className="mt-6 grid gap-2.5 max-w-md rounded-[6px] border p-4" style={{ borderColor: line, backgroundColor: 'var(--theme-card-bg)' }}>
      <p className="text-[14px] leading-relaxed" style={{ color: muted }}>Informe o e-mail usado no pagamento. Enviamos para ele um link de acesso à conta que tem o plano.</p>
      <input required type="email" autoComplete="email" placeholder="E-mail do pagamento" value={email} onChange={e => setEmail(e.target.value)} className="h-11 px-3 rounded-lg border bg-transparent text-[15px]" style={{ borderColor: line }} />
      <button type="submit" disabled={state === 'busy'} className="h-11 rounded-lg text-[14.5px] font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
        {state === 'busy' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Enviar link de acesso'}
      </button>
      {state === 'error' && <p className="text-[13.5px]" style={{ color: 'var(--pastel-red-fg, #b42318)' }}>Não conseguimos enviar agora. Confira o endereço ou escreva para contato@upoonly.com.</p>}
    </form>
  )
}

export function PaymentSuccess() {
  const [params] = useSearchParams()
  const annualHint = params.get('ciclo') === 'anual'
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [intro, setIntro] = useState(!reduce)
  const [state, setState] = useState<State>('waiting')
  const [sub, setSub] = useState<Sub | null>(null)
  const tries = useRef(0)

  useEffect(() => {
    if (!intro) return
    const t = setTimeout(() => setIntro(false), 2400)
    return () => clearTimeout(t)
  }, [intro])

  useEffect(() => {
    if (loading || !session) return
    let stop = false
    let timer: number | undefined
    // A consulta nunca para: Pix e cartão podem demorar, e parar deixaria a pessoa presa em "confirmando".
    // Depois de ~30s a tela passa a explicar a espera, mas continua checando a cada 15s.
    const tick = async () => {
      if (stop) return
      try {
        const r = await billing.status()
        if (!r.confirmed) { setState('unconfirmed'); return }
        if (r.subscription && r.subscription.plan_id !== 'free') { setSub(r.subscription); setState('paid'); return }
      } catch { /* instabilidade ou limite de requisições: tenta de novo mais devagar */ }
      tries.current++
      if (tries.current >= 10) setState(s => (s === 'waiting' ? 'pending' : s))
      timer = window.setTimeout(tick, tries.current < 6 ? 2500 : tries.current < 12 ? 5000 : 15000)
    }
    void tick()
    return () => { stop = true; window.clearTimeout(timer) }
  }, [session, loading])

  const p = planById(sub?.plan_id)
  const annual = sub ? sub.billing_cycle === 'annual' : annualHint
  const price = sub ? (annual ? `${formatBRL(annualCents(p.priceCents))} por ano` : `${formatBRL(p.priceCents)} por mês`) : ''
  const next = sub ? new Date(sub.current_period_end).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : ''
  const back = encodeURIComponent(`/pagamento/sucesso${annualHint ? '?ciclo=anual' : ''}`)
  const fade = (d = 0) => ({ initial: reduce ? false : { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: d, ease: [0.2, 0.8, 0.2, 1] as const } })

  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--theme-bg)', color: ink, paddingTop: 'var(--safe-t, 0px)' }}>
      <AnimatePresence>
        {intro && (
          <motion.div key="intro" className="fixed inset-0 z-50 grid place-items-center" style={{ backgroundColor: 'var(--theme-bg)' }}
            exit={{ opacity: 0 }} transition={{ duration: 0.5 }} onClick={() => setIntro(false)}>
            <RabbitFlight width={128} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-6xl px-5 sm:px-8 pb-20">
        <header className="h-20 flex items-center justify-between">
          <Link to="/" aria-label="Upoonly"><Logo height={34} style={{ color: ink }} /></Link>
          {session && state === 'paid' && <Link to="/" className="text-[14px] underline underline-offset-4" style={{ color: muted }}>Ir para o início</Link>}
        </header>

        {!intro && (
          <main className={`grid gap-10 lg:grid-cols-[1fr_0.92fr] lg:gap-16 pt-4 lg:pt-10 ${state === 'paid' ? 'items-start' : 'items-center'}`}>
            <div>
              <motion.div {...fade()}><RabbitFlight width={58} loop /></motion.div>

              {!loading && !session && (
                <>
                  <motion.p {...fade(0.05)} className="mt-6 text-[12px] font-medium uppercase tracking-[0.1em]" style={{ color: muted }}>Pagamento recebido</motion.p>
                  <motion.h1 {...fade(0.1)} className="font-display text-[46px] sm:text-[68px] leading-[0.98] mt-3">Sua história <i>começa agora.</i></motion.h1>
                  <motion.p {...fade(0.18)} className="mt-6 max-w-[46ch] text-[16px] leading-relaxed" style={{ color: muted }}>
                    Entre ou crie sua conta com <b style={{ color: ink }}>o mesmo e-mail usado no pagamento</b>. O plano{annualHint ? ' anual' : ''} é liberado sozinho assim que o e-mail for confirmado.
                  </motion.p>
                  <motion.div {...fade(0.24)} className="mt-8 flex flex-wrap gap-2.5">
                    <Link to={`/signup?next=${back}`} className="h-12 px-5 rounded-lg inline-flex items-center gap-2 text-[15px] font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>Criar minha conta <ArrowRight className="w-4 h-4" /></Link>
                    <Link to={`/login?next=${back}`} className="h-12 px-5 rounded-lg inline-flex items-center text-[15px] font-medium border" style={{ borderColor: line }}>Já tenho conta</Link>
                  </motion.div>
                  <motion.p {...fade(0.3)} className="mt-6 text-[13.5px]" style={{ color: muted }}>O recibo do pagamento chegou no seu e-mail.</motion.p>
                </>
              )}

              {session && state === 'waiting' && (
                <>
                  <motion.p {...fade(0.05)} className="mt-6 text-[12px] font-medium uppercase tracking-[0.1em] flex items-center gap-2" style={{ color: muted }}><Loader2 className="w-3.5 h-3.5 animate-spin" />Confirmando</motion.p>
                  <motion.h1 {...fade(0.1)} className="font-display text-[46px] sm:text-[64px] leading-[0.98] mt-3">Abrindo a porta <i>da sua história…</i></motion.h1>
                  <motion.p {...fade(0.18)} className="mt-6 max-w-[44ch] text-[16px]" style={{ color: muted }}>Estamos confirmando o pagamento. Leva alguns segundos.</motion.p>
                </>
              )}

              {session && state === 'unconfirmed' && (
                <>
                  <motion.p {...fade(0.05)} className="mt-6 text-[12px] font-medium uppercase tracking-[0.1em]" style={{ color: muted }}>Falta um passo</motion.p>
                  <motion.h1 {...fade(0.1)} className="font-display text-[46px] sm:text-[64px] leading-[0.98] mt-3">Confirme <i>seu e-mail.</i></motion.h1>
                  <motion.p {...fade(0.18)} className="mt-6 max-w-[44ch] text-[16px]" style={{ color: muted }}>Abra o link que enviamos. Assim que confirmar, o plano é liberado nesta conta.</motion.p>
                </>
              )}

              {session && state === 'pending' && (
                <>
                  <motion.p {...fade(0.05)} className="mt-6 text-[12px] font-medium uppercase tracking-[0.1em]" style={{ color: muted }}>Quase lá</motion.p>
                  <motion.h1 {...fade(0.1)} className="font-display text-[46px] sm:text-[64px] leading-[0.98] mt-3">Ainda <i>confirmando.</i></motion.h1>
                  <motion.p {...fade(0.18)} className="mt-6 max-w-[46ch] text-[16px] leading-relaxed" style={{ color: muted }}>Pix e boleto podem levar alguns minutos. O plano aparece sozinho quando o pagamento for confirmado. Se pagou com outro e-mail, vincule abaixo.</motion.p>
                  <OtherEmail />
                </>
              )}

              {session && state === 'paid' && (
                <>
                  <Confetti pieces={110} />
                  <motion.p {...fade(0.05)} className="mt-6 text-[12px] font-medium uppercase tracking-[0.1em] flex items-center gap-2" style={{ color: 'var(--pastel-green-fg, #2d6040)' }}><Check className="w-4 h-4" />Pagamento aprovado</motion.p>
                  <motion.h1 {...fade(0.1)} className="font-display text-[50px] sm:text-[76px] leading-[0.96] mt-3">Bem-vindo(a) <br />ao <i>{p.name}.</i></motion.h1>
                  <motion.dl {...fade(0.18)} className="mt-8 grid grid-cols-2 sm:grid-cols-4 border-y max-w-xl" style={{ borderColor: line }}>
                    {[
                      ['Plano', p.name],
                      ['Ciclo', annual ? 'Anual' : 'Mensal'],
                      ['Valor', price],
                      ['Renova em', next],
                    ].map(([k, v]) => (
                      <div key={k} className="py-3.5 pr-3">
                        <dt className="text-[11px] uppercase tracking-[0.08em]" style={{ color: muted }}>{k}</dt>
                        <dd className="mt-1 text-[14px] font-medium leading-snug">{v}</dd>
                      </div>
                    ))}
                  </motion.dl>
                  <motion.p {...fade(0.24)} className="mt-6 max-w-[46ch] text-[15.5px] leading-relaxed" style={{ color: muted }}>
                    A biblioteca inteira é sua, com {p.credits.toLocaleString('pt-BR')} créditos de IA por mês para ilustrações, explicações e conversas.
                  </motion.p>
                  <motion.div {...fade(0.3)} className="mt-8">
                    <button type="button" onClick={() => navigate('/gallery', { replace: true })} className="h-12 px-6 rounded-lg inline-flex items-center gap-2 text-[15px] font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
                      Começar a ler <ArrowRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                </>
              )}
            </div>

            <motion.figure {...fade(0.15)} className="relative m-0">
              <div className="relative overflow-hidden rounded-[4px] aspect-[4/5]" style={{ outline: `1px solid ${line}` }}>
                <motion.img src="/site/home/convite.webp" alt="O Coelho Branco abre a porta da estufa" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: '84% center' }}
                  initial={reduce ? false : { scale: 1.1 }} animate={{ scale: 1 }} transition={{ duration: 2.2, ease: [0.2, 0.8, 0.2, 1] }} />
              </div>
              <figcaption className="mt-3 flex justify-between text-[12px]" style={{ color: muted }}><i className="font-display text-[15px]" style={{ color: ink }}>A porta da estufa</i><span>Óleo sobre tela</span></figcaption>
            </motion.figure>
          </main>
        )}

        {!intro && session && state === 'paid' && (
          <section className="mt-20" aria-label="Primeiros passos">
            <p className="text-[12px] font-medium uppercase tracking-[0.1em]" style={{ color: muted }}>Primeiros passos</p>
            <ol className="mt-5 grid md:grid-cols-3 border-t" style={{ borderColor: line }}>
              {STEPS.map((s, i) => (
                <motion.li key={s.to} {...fade(0.35 + i * 0.08)} className="border-b md:border-b-0 md:border-r last:border-r-0 py-6 md:px-6 first:md:pl-0" style={{ borderColor: line }}>
                  <span className="text-[11px] font-medium tabular-nums" style={{ color: muted }}>0{i + 1}</span>
                  <h2 className="font-display text-[26px] leading-tight mt-2">{s.title}</h2>
                  <p className="mt-2 text-[14px] leading-relaxed" style={{ color: muted }}>{s.text}</p>
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
