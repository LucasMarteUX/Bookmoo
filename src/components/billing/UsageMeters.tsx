// Medidores de créditos de IA e minutos de conversa (sidebar, página "Eu", assinatura).
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Mic, Sparkles } from 'lucide-react'
import { useLanguage } from '@/store/useLanguage'
import { useEntitlements } from '@/store/useEntitlements'

function tone(ratio: number) {
  if (ratio <= 0) return '#dc2626'
  if (ratio < 0.2) return '#d97706'
  return 'var(--theme-accent)'
}

function Meter({ icon, label, left, total, compact }: { icon: React.ReactNode; label: string; left: number; total: number; compact?: boolean }) {
  const ratio = total > 0 ? left / total : 0
  return (
    <div className={compact ? 'flex flex-col gap-1' : 'flex flex-col gap-1.5'}>
      <div className={`flex items-center justify-between gap-2 ${compact ? 'text-[11.5px]' : 'text-[13px]'}`}>
        <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--theme-nav-text-muted, var(--theme-text-secondary))' }}>{icon}{label}</span>
        <span className="tabular-nums font-medium" style={{ color: ratio < 0.2 ? tone(ratio) : undefined }}>{left}<span className="opacity-60">/{total}</span></span>
      </div>
      <div className={`${compact ? 'h-1' : 'h-1.5'} rounded-full overflow-hidden`} style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
        <motion.div className="h-full rounded-full" style={{ backgroundColor: tone(ratio) }}
          initial={false} animate={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} transition={{ type: 'spring', stiffness: 160, damping: 24 }} />
      </div>
    </div>
  )
}

export function UsageMeters({ compact }: { compact?: boolean }) {
  const pt = useLanguage().locale === 'pt-BR'
  const ent = useEntitlements(s => s.data)
  if (!ent) return null
  const days = Math.max(0, Math.ceil((new Date(ent.period.ends_at).getTime() - Date.now()) / 86400_000))
  const minutesLeft = Math.floor(ent.seconds.available / 60)
  const minutesTotal = Math.round(ent.seconds.granted / 60)
  const body = (
    <div className="flex flex-col gap-2">
      <Meter compact={compact} icon={<Sparkles className="w-3.5 h-3.5" />} label={pt ? 'Créditos' : 'Credits'} left={ent.credits.available} total={ent.credits.granted} />
      <Meter compact={compact} icon={<Mic className="w-3.5 h-3.5" />} label={pt ? 'Minutos' : 'Minutes'} left={minutesLeft} total={minutesTotal} />
      <p className={compact ? 'text-[11px]' : 'text-[12.5px]'} style={{ color: 'var(--theme-nav-text-muted, var(--theme-text-secondary))' }}>
        {!ent.email_confirmed && ent.plan === 'free' ? (pt ? 'Confirme seu e-mail para receber os créditos' : 'Confirm your email to get credits')
          : (pt ? `${ent.plan_name} · renova em ${days} ${days === 1 ? 'dia' : 'dias'}` : `${ent.plan_name} · renews in ${days} day${days === 1 ? '' : 's'}`)}
      </p>
    </div>
  )
  return compact ? (
    <Link to="/assinatura" className="block rounded-lg px-2 py-2 transition-colors hover:bg-[var(--ui-hover)]" title={pt ? 'Ver extrato e plano' : 'See plan and history'}>{body}</Link>
  ) : body
}
