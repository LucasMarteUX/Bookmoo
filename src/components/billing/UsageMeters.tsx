// Saldo de créditos de IA (um só para imagens, texto e voz). No sidebar é só um feedback discreto:
// uma barra que vai diminuindo de 100%; ao clicar abre os detalhes (consumo, custos, renovação).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Sparkles } from 'lucide-react'
import { useLanguage } from '@/store/useLanguage'
import { useEntitlements, type Entitlements } from '@/store/useEntitlements'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

function balance(ent: Entitlements) {
  const total = Math.max(0, ent.credits.granted)
  const left = Math.max(0, ent.credits.available)
  const ratio = total > 0 ? left / total : 0
  return { total, left, ratio, pct: Math.round(ratio * 100) }
}

function barColor(ratio: number) {
  if (ratio <= 0.05) return '#dc2626'
  if (ratio < 0.2) return '#d97706'
  return 'var(--theme-text)'
}

function Bar({ ratio, thin }: { ratio: number; thin?: boolean }) {
  return (
    <div className={`${thin ? 'h-[3px]' : 'h-1.5'} w-full rounded-full overflow-hidden`} style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
      <motion.div className="h-full rounded-full" style={{ backgroundColor: barColor(ratio), opacity: thin ? 0.7 : 0.9 }}
        initial={false} animate={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} transition={{ type: 'spring', stiffness: 140, damping: 24 }} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl px-3 py-2.5" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
      <p className="text-[11.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{label}</p>
      <p className="mt-0.5 truncate text-[15px] font-semibold tabular-nums">{value}</p>
    </div>
  )
}

/** Resumo do saldo: quanto tem, quanto já usou e quando renova. O detalhe por operação fica no extrato. */
export function CreditsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const pt = useLanguage().locale === 'pt-BR'
  const ent = useEntitlements(s => s.data)
  if (!ent) return null
  const b = balance(ent)
  const nf = (n: number) => n.toLocaleString(pt ? 'pt-BR' : 'en-US')
  const renews = new Date(ent.period.ends_at)
  const days = Math.max(0, Math.ceil((renews.getTime() - Date.now()) / 86400_000))
  const renewDate = renews.toLocaleDateString(pt ? 'pt-BR' : 'en-US', { day: 'numeric', month: 'short' })
  const used = Math.max(0, ent.credits.used)
  const locked = !ent.email_confirmed && ent.plan === 'free'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{pt ? 'Créditos de IA' : 'AI credits'}</DialogTitle>
          <DialogDescription>{pt ? `Plano ${ent.plan_name}. Um saldo só para ilustrações, explicações e voz.` : `${ent.plan_name} plan. One balance for illustrations, explanations and voice.`}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {ent.is_admin ? (
            <div>
              <span className="text-[34px] font-semibold leading-none">∞</span>
              <p className="mt-2 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Conta admin: uso ilimitado. O custo fica em Admin, Financeiro.' : 'Admin account: unlimited. Cost is tracked in Admin, Finance.'}</p>
            </div>
          ) : (
            <div>
              <div className="flex items-end justify-between">
                <span className="text-[34px] font-semibold tabular-nums leading-none">{b.pct}%</span>
                <span className="text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'disponível' : 'left'}</span>
              </div>
              <div className="mt-2"><Bar ratio={b.ratio} /></div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <Stat label={pt ? 'Disponível' : 'Left'} value={ent.is_admin ? '∞' : nf(b.left)} />
            <Stat label={pt ? 'Usado' : 'Used'} value={nf(used)} />
            <Stat label={pt ? 'Renova' : 'Renews'} value={renewDate} />
          </div>
          {!ent.is_admin && (
            <p className="text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
              {locked ? (pt ? 'Confirme seu e-mail para liberar os créditos do plano Grátis.' : 'Confirm your email to unlock your Free credits.')
                : pt ? `Faltam ${days} ${days === 1 ? 'dia' : 'dias'} para renovar. O que sobrar não acumula.` : `${days} day${days === 1 ? '' : 's'} until it renews. Unused credits do not roll over.`}
            </p>
          )}
          <div className="flex gap-2">
            <Link to="/assinatura" onClick={() => onOpenChange(false)} className="flex-1 h-10 rounded-xl grid place-items-center text-[14px] border" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Ver extrato' : 'View history'}</Link>
            {ent.plan !== 'pro' && !ent.is_admin && <Link to="/planos" onClick={() => onOpenChange(false)} className="flex-1 h-10 rounded-xl grid place-items-center text-[14px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Mais créditos' : 'More credits'}</Link>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** compact: linha discreta do sidebar (clique abre os detalhes). Sem compact: bloco para páginas. */
export function UsageMeters({ compact }: { compact?: boolean }) {
  const pt = useLanguage().locale === 'pt-BR'
  const ent = useEntitlements(s => s.data)
  const [open, setOpen] = useState(false)
  if (!ent) return null
  const b = balance(ent)
  if (compact) {
    return (
      <>
        <button type="button" onClick={() => setOpen(true)} className="w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[var(--ui-hover)]"
          aria-label={ent.is_admin ? (pt ? 'Créditos: ilimitado' : 'Credits: unlimited') : (pt ? `Créditos de IA: ${b.pct}% restantes` : `AI credits: ${b.pct}% left`)}>
          <span className="flex items-center justify-between gap-2 text-[12px]" style={{ color: 'var(--theme-nav-text-muted)' }}>
            <span className="inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />{pt ? 'Créditos' : 'Credits'}</span>
            <span className="tabular-nums" style={{ color: !ent.is_admin && b.ratio < 0.2 ? barColor(b.ratio) : undefined }}>{ent.is_admin ? '∞' : `${b.pct}%`}</span>
          </span>
          <span className="mt-1.5 block"><Bar ratio={ent.is_admin ? 1 : b.ratio} thin /></span>
        </button>
        <CreditsDialog open={open} onOpenChange={setOpen} />
      </>
    )
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[13.5px]">
        <span className="inline-flex items-center gap-1.5"><Sparkles className="w-4 h-4" />{pt ? 'Créditos de IA' : 'AI credits'}</span>
        <button type="button" onClick={() => setOpen(true)} className="tabular-nums underline-offset-4 hover:underline">
          {ent.is_admin ? (pt ? 'Ilimitado' : 'Unlimited') : `${b.left.toLocaleString(pt ? 'pt-BR' : 'en-US')} / ${b.total.toLocaleString(pt ? 'pt-BR' : 'en-US')}`}
        </button>
      </div>
      <Bar ratio={ent.is_admin ? 1 : b.ratio} />
      <CreditsDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
