// Volta do checkout. Nunca libera nada sozinha: espera o webhook confirmar (consulta a intenção).
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/store/useLanguage'
import { useEntitlements } from '@/store/useEntitlements'
import { planById } from '@/lib/plans'
import { Confetti } from '@/components/billing/Confetti'

export function CheckoutReturn() {
  const pt = useLanguage().locale === 'pt-BR'
  const navigate = useNavigate()
  const load = useEntitlements(s => s.load)
  const [state, setState] = useState<'waiting' | 'paid' | 'pending' | 'none'>('waiting')
  const [plan, setPlan] = useState<string>('')
  const [bonus, setBonus] = useState(0)
  const tries = useRef(0)

  useEffect(() => {
    let stop = false
    const tick = async () => {
      if (!supabase || stop) return
      const { data } = await supabase.from('checkout_intents').select('id, status, plan_id, bonus_credits, created_at').order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!data) { setState('none'); return }
      setPlan(data.plan_id)
      setBonus(data.bonus_credits ?? 0)
      if (data.status === 'paid') { await load(); setState('paid'); return }
      tries.current++
      if (tries.current >= 30) { setState('pending'); return }
      setTimeout(tick, 2000)
    }
    void tick()
    return () => { stop = true }
  }, [load])

  const p = planById(plan)
  return (
    <div className="min-h-dvh grid place-items-center px-5" style={{ backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
      {state === 'paid' && <Confetti pieces={90} />}
      <div className="w-full max-w-md text-center">
        {state === 'waiting' && (
          <>
            <Loader2 className="w-10 h-10 mx-auto animate-spin" style={{ color: 'var(--theme-text-secondary)' }} />
            <h1 className="mt-5 font-display text-[28px]">{pt ? 'Confirmando seu pagamento…' : 'Confirming your payment…'}</h1>
            <p className="mt-2 text-[15px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Isso leva alguns segundos. Não feche esta página.' : 'This takes a few seconds. Keep this page open.'}</p>
          </>
        )}
        {state === 'paid' && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}>
            <div className="mx-auto w-20 h-20 rounded-3xl grid place-items-center text-[44px] shadow-xl" style={{ backgroundColor: 'var(--theme-card-bg)' }}>🎉</div>
            <h1 className="mt-6 font-display text-[32px] leading-tight">{pt ? `Bem-vindo(a) ao ${p.name}!` : `Welcome to ${p.name}!`}</h1>
            <p className="mt-3 text-[15.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
              {pt ? `A biblioteca inteira é sua e você tem ${p.credits + bonus} créditos de IA e ${p.minutes} minutos de conversa este mês.` : `The whole library is yours, with ${p.credits + bonus} AI credits and ${p.minutes} conversation minutes this month.`}
            </p>
            <motion.button whileTap={{ scale: 0.96 }} type="button" onClick={() => navigate('/gallery', { replace: true })}
              className="mt-8 h-12 w-full rounded-2xl text-[15.5px] font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
              {pt ? 'Escolher um livro para começar' : 'Pick a book to start'}
            </motion.button>
          </motion.div>
        )}
        {(state === 'pending' || state === 'none') && (
          <>
            <div className="text-[44px]">⏳</div>
            <h1 className="mt-4 font-display text-[28px]">{state === 'none' ? (pt ? 'Nenhum pagamento em andamento' : 'No payment in progress') : (pt ? 'Pagamento em processamento' : 'Payment processing')}</h1>
            <p className="mt-2 text-[15px]" style={{ color: 'var(--theme-text-secondary)' }}>
              {state === 'none' ? (pt ? 'Se você acabou de pagar, aguarde um instante e confira em Minha assinatura.' : 'If you just paid, wait a moment and check My subscription.')
                : (pt ? 'Pix e boleto podem levar alguns minutos. Avisaremos por e-mail assim que for aprovado — o plano libera sozinho.' : 'Pix and bank slips can take a few minutes. We will email you once approved — your plan unlocks automatically.')}
            </p>
            <button type="button" onClick={() => navigate('/', { replace: true })} className="mt-8 h-12 w-full rounded-2xl text-[15px] font-medium border" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Ir para o início' : 'Go home'}</button>
          </>
        )}
      </div>
    </div>
  )
}
