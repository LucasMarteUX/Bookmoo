// Cartão-presente do plano Grátis: envelope abre, cartão gira, confete → escolher o livro na galeria.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { BookOpen, Gift } from 'lucide-react'
import { useLanguage } from '@/store/useLanguage'
import { useEntitlements } from '@/store/useEntitlements'
import { Confetti } from '@/components/billing/Confetti'

export function GiftPage() {
  const pt = useLanguage().locale === 'pt-BR'
  const navigate = useNavigate()
  const ent = useEntitlements(s => s.data)
  const [stage, setStage] = useState<'closed' | 'open' | 'card'>('closed')

  useEffect(() => { if (ent?.gift) navigate('/', { replace: true }) }, [ent?.gift, navigate])
  useEffect(() => {
    const a = setTimeout(() => setStage('open'), 700)
    const b = setTimeout(() => setStage('card'), 1500)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [])

  return (
    <div className="min-h-dvh grid place-items-center px-5 overflow-hidden" style={{ backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
      {stage === 'card' && <Confetti />}
      <div className="relative w-full max-w-sm text-center">
        <div className="relative h-72" style={{ perspective: 1200 }}>
          <AnimatePresence>
            {stage !== 'card' && (
              <motion.div key="envelope" className="absolute inset-x-6 top-10 h-48 rounded-2xl shadow-2xl"
                style={{ background: 'linear-gradient(160deg, #f6d6a8, #e7a96b)' }}
                initial={{ y: 40, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 120, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18 }}>
                <motion.div className="absolute inset-x-0 top-0 h-28 origin-top rounded-t-2xl"
                  style={{ background: 'linear-gradient(180deg, #e9b47d, #d99358)', clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}
                  animate={{ rotateX: stage === 'open' ? 180 : 0 }} transition={{ duration: 0.6, ease: 'easeInOut' }} />
                <div className="absolute inset-0 grid place-items-center"><Gift className="w-12 h-12 text-white/90" /></div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {stage === 'card' && (
              <motion.div key="card" className="absolute inset-x-2 top-0 h-72 rounded-3xl shadow-2xl p-6 flex flex-col items-center justify-center"
                style={{ background: 'linear-gradient(145deg, #1f2937, #4b5563)', color: '#fff' }}
                initial={{ rotateY: 180, y: 60, opacity: 0 }} animate={{ rotateY: 0, y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 120, damping: 14 }}>
                <span className="text-[13px] uppercase tracking-[0.2em] opacity-70">{pt ? 'Cartão-presente' : 'Gift card'}</span>
                <BookOpen className="mt-4 w-12 h-12" strokeWidth={1.4} />
                <span className="mt-2 font-display text-[26px] leading-tight">{pt ? '1 livro à sua escolha' : '1 book of your choice'}</span>
                <span className="mt-2 text-[13.5px] opacity-80">{pt ? 'da nossa galeria, seu para sempre' : 'from our gallery, yours forever'}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {stage === 'card' && (
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-8">
              <h1 className="font-display text-[30px] leading-tight">{pt ? 'Você ganhou um presente' : 'You got a gift'}</h1>
              <p className="mt-2 text-[15px]" style={{ color: 'var(--theme-text-secondary)' }}>
                {pt ? 'Escolha qualquer livro da galeria para levar para a sua estante. Os outros ficam com o selo Premium: dá para ver, e quando quiser você libera todos.' : 'Pick any gallery book for your shelf. The others carry a Premium badge: you can browse them and unlock all whenever you like.'}
              </p>
              <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => navigate('/gallery?presente=1', { replace: true })}
                className="mt-6 h-12 w-full rounded-2xl text-[15.5px] font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
                {pt ? 'Escolher meu livro' : 'Choose my book'}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
