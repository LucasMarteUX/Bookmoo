// Saldo de créditos de IA (um só para imagens, texto e voz). No sidebar é só um feedback discreto:
// uma barra que vai diminuindo de 100%; ao clicar abre os detalhes (consumo, custos, renovação).
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/store/useLanguage'
import { useEntitlements, type Entitlements } from '@/store/useEntitlements'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { COST_TABLE } from '@/lib/plans'

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

const OP_LABEL: Record<string, [string, string]> = {
  'comic-page': ['Página ilustrada', 'Illustrated page'], 'comic-replan': ['Página redesenhada', 'Redrawn page'], 'comic-panel': ['Quadro editado', 'Edited panel'],
  explain: ['Explicação', 'Explanation'], 'variant-story': ['História', 'Story'], 'vocab-explain': ['Explicação de palavra', 'Word explanation'],
  'vocab-story': ['História da palavra', 'Word story'], 'vocab-image': ['Imagem do mosaico', 'Mosaic image'], 'style-extract': ['Estilo próprio', 'Own style'],
  'detect-characters': ['Personagens', 'Characters'], 'transcribe-page': ['Transcrição de PDF', 'PDF transcription'], scene: ['Conversa — Cena', 'Conversation — Scene'],
  tutor: ['Conversa livre', 'Free talk'], reader: ['Tutor de leitura', 'Reading tutor'], admin_grant: ['Bônus', 'Bonus'], upgrade_proration: ['Bônus do upgrade', 'Upgrade bonus'],
}

export function CreditsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const pt = useLanguage().locale === 'pt-BR'
  const ent = useEntitlements(s => s.data)
  const [recent, setRecent] = useState<{ id: number; delta: number; operation: string | null; created_at: string }[]>([])
  useEffect(() => {
    if (!open || !supabase) return
    void supabase.from('credit_ledger').select('id, delta, operation, created_at').eq('unit', 'credits').eq('kind', 'commit').order('created_at', { ascending: false }).limit(8)
      .then(({ data }) => setRecent(data ?? []))
  }, [open])
  if (!ent) return null
  const b = balance(ent)
  const renews = new Date(ent.period.ends_at)
  const days = Math.max(0, Math.ceil((renews.getTime() - Date.now()) / 86400_000))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{pt ? 'Seus créditos de IA' : 'Your AI credits'}</DialogTitle>
          <DialogDescription>{pt ? 'Um saldo só para ilustrações, explicações e conversas por voz.' : 'One balance for illustrations, explanations and voice conversations.'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {ent.is_admin ? (
            <p className="text-[15px]">{pt ? 'Conta admin: uso ilimitado. O custo continua registrado em Admin → Financeiro.' : 'Admin account: unlimited. Cost is still tracked in Admin → Finance.'}</p>
          ) : (
            <div>
              <div className="flex items-end justify-between">
                <span className="text-[34px] font-semibold tabular-nums leading-none">{b.pct}%</span>
                <span className="text-[13px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{b.left.toLocaleString(pt ? 'pt-BR' : 'en-US')} {pt ? 'de' : 'of'} {b.total.toLocaleString(pt ? 'pt-BR' : 'en-US')}</span>
              </div>
              <div className="mt-2"><Bar ratio={b.ratio} /></div>
              <p className="mt-2 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>
                {!ent.email_confirmed && ent.plan === 'free' ? (pt ? 'Confirme seu e-mail para liberar os créditos do plano Grátis.' : 'Confirm your email to unlock your Free credits.')
                  : pt ? `Plano ${ent.plan_name}. Renova em ${days} ${days === 1 ? 'dia' : 'dias'} (${renews.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}). O que sobrar não acumula.`
                    : `${ent.plan_name} plan. Renews in ${days} day${days === 1 ? '' : 's'}. Unused credits do not roll over.`}
              </p>
            </div>
          )}
          <div>
            <p className="text-[13px] font-semibold">{pt ? 'Quanto cada coisa usa' : 'What each thing costs'}</p>
            <ul className="mt-2 divide-y rounded-xl border text-[13.5px]" style={{ borderColor: 'var(--theme-border)' }}>
              {COST_TABLE.map(r => (
                <li key={r.pt} className="flex justify-between px-3 py-2" style={{ borderColor: 'var(--theme-border)' }}>
                  <span>{pt ? r.pt : r.en}</span><span className="tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{r.credits}</span>
                </li>
              ))}
            </ul>
          </div>
          {recent.length > 0 && (
            <div>
              <p className="text-[13px] font-semibold">{pt ? 'Últimos usos' : 'Recent use'}</p>
              <ul className="mt-2 space-y-1 text-[13px]">
                {recent.map(r => (
                  <li key={r.id} className="flex justify-between">
                    <span>{(OP_LABEL[r.operation ?? ''] ?? [r.operation ?? '', r.operation ?? ''])[pt ? 0 : 1]}</span>
                    <span className="tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{r.delta} · {new Date(r.created_at).toLocaleDateString(pt ? 'pt-BR' : 'en-US', { day: 'numeric', month: 'short' })}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex gap-2">
            <Link to="/assinatura" onClick={() => onOpenChange(false)} className="flex-1 h-10 rounded-xl grid place-items-center text-[14px] border" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Extrato completo' : 'Full history'}</Link>
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
