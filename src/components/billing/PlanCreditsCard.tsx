// Configurações → Plano e créditos (a IA vem inclusa no plano; não há chave para conectar).
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useEntitlements } from '@/store/useEntitlements'
import { UsageMeters } from '@/components/billing/UsageMeters'
import { SettingsSection } from '@/components/settings/SettingsUI'

export function PlanCreditsCard({ pt }: { pt: boolean }) {
  const ent = useEntitlements(s => s.data)
  return (
    <SettingsSection id="plan" icon={Sparkles} title={pt ? 'Plano e créditos' : 'Plan and credits'}
      description={pt ? 'Ilustrações, explicações e conversas já vêm inclusas no seu plano.' : 'Illustrations, explanations and conversations are included in your plan.'}>
      <div className="px-5 py-4">
        <UsageMeters />
      </div>
      <div className="px-5 py-3.5 flex flex-wrap items-center justify-end gap-2" style={{ borderColor: 'var(--theme-border)' }}>
        <Link to="/assinatura" className="ui-hover h-9 px-3.5 rounded-lg inline-flex items-center text-[13.5px] font-medium border" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}>{pt ? 'Minha assinatura' : 'My subscription'}</Link>
        {ent?.plan !== 'pro' && (
          <Link to="/planos" className="h-9 px-3.5 rounded-lg inline-flex items-center text-[13.5px] font-medium hover:opacity-90" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Ver planos' : 'See plans'}</Link>
        )}
      </div>
    </SettingsSection>
  )
}
