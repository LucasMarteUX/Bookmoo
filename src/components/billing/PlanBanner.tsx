// Avisos da Home: confirmar e-mail, escolher o livro-presente, pagamento pendente, convite para assinar.
// O convite do Grátis pode ser fechado e volta em 7 dias.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useEntitlements } from '@/store/useEntitlements'

const KEY = 'bookmoo-upsell-dismissed-at'

export function PlanBanner({ pt }: { pt: boolean }) {
  const ent = useEntitlements(s => s.data)
  const { user } = useAuth()
  const [resent, setResent] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    try { return Date.now() - Number(localStorage.getItem(KEY) ?? 0) < 7 * 86400_000 } catch { return false }
  })
  if (!ent || ent.is_admin) return null

  const box = (tone: 'warn' | 'gift' | 'promo', children: React.ReactNode, onClose?: () => void) => (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl p-4 pr-10 flex flex-wrap items-center gap-3 justify-between border"
      style={{ borderColor: 'var(--theme-border)', background: tone === 'warn' ? 'color-mix(in srgb, #f59e0b 14%, var(--theme-card-bg))' : 'linear-gradient(120deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card-bg)), var(--theme-card-bg))' }}>
      {children}
      {onClose && <button type="button" onClick={onClose} aria-label={pt ? 'Fechar' : 'Close'} className="absolute right-2 top-2 w-8 h-8 grid place-items-center rounded-full" style={{ color: 'var(--theme-text-secondary)' }}><X className="w-4 h-4" /></button>}
    </motion.div>
  )

  if (!ent.email_confirmed && ent.plan === 'free' && !ent.is_admin) {
    return box('warn', <>
      <p className="text-[14px]">{pt ? 'Confirme seu e-mail para liberar seus créditos de IA grátis.' : 'Confirm your email to unlock your free AI credits.'}</p>
      <button type="button" disabled={resent} onClick={async () => { if (supabase && user?.email) await supabase.auth.resend({ type: 'signup', email: user.email, options: { emailRedirectTo: window.location.origin } }); setResent(true) }}
        className="h-9 px-4 rounded-full text-[13px] font-semibold border disabled:opacity-60" style={{ borderColor: 'var(--theme-border)' }}>{resent ? (pt ? 'Link reenviado' : 'Link sent') : (pt ? 'Reenviar link' : 'Resend link')}</button>
    </>)
  }
  if (ent.subscription?.status === 'past_due') {
    return box('warn', <>
      <p className="text-[14px]">{pt ? 'Não conseguimos renovar sua assinatura. Atualize o pagamento para não perder a biblioteca.' : 'We could not renew your subscription. Update your payment to keep the library.'}</p>
      <Link to="/assinatura" className="h-9 px-4 rounded-full text-[13px] font-semibold inline-flex items-center" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Resolver' : 'Fix it'}</Link>
    </>)
  }
  if (ent.plan === 'free' && !ent.gift) {
    return box('gift', <>
      <p className="text-[14px]">{pt ? 'Você tem um livro de presente esperando. Escolha qualquer um da galeria!' : 'You have a gift book waiting. Pick any from the gallery!'}</p>
      <Link to="/gallery?presente=1" className="h-9 px-4 rounded-full text-[13px] font-semibold inline-flex items-center" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Escolher meu livro' : 'Choose my book'}</Link>
    </>)
  }
  if (ent.plan === 'free' && !dismissed) {
    return box('promo', <>
      <div>
        <p className="text-[15px] font-semibold">{pt ? 'Liberte a biblioteca inteira' : 'Unlock the whole library'}</p>
        <p className="text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Todos os livros da galeria, importação de EPUB/PDF, mais ilustrações e conversas por voz.' : 'Every gallery book, EPUB/PDF import, more illustrations and voice conversations.'}</p>
      </div>
      <Link to="/planos" className="h-9 px-4 rounded-full text-[13px] font-semibold inline-flex items-center" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Ver planos' : 'See plans'}</Link>
    </>, () => { try { localStorage.setItem(KEY, String(Date.now())) } catch { /* ignore */ } setDismissed(true) })
  }
  return null
}
