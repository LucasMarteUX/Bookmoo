// Configurações → Plano e créditos (substitui as antigas "Conexões de IA": a IA agora vem inclusa no plano).
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useEntitlements } from '@/store/useEntitlements'
import { UsageMeters } from '@/components/billing/UsageMeters'
import { isTutorHidden, setTutorHidden } from '@/components/reader/ReaderTutor'

export function PlanCreditsCard({ pt }: { pt: boolean }) {
  const ent = useEntitlements(s => s.data)
  const [tutorOn, setTutorOn] = useState(!isTutorHidden())
  useEffect(() => {
    const sync = () => setTutorOn(!isTutorHidden())
    window.addEventListener('bookmoo-tutor-visibility', sync)
    return () => window.removeEventListener('bookmoo-tutor-visibility', sync)
  }, [])
  return (
    <section className="rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold">{pt ? 'Plano e créditos' : 'Plan and credits'}</h2>
          <p className="mt-1 text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
            {pt ? 'A IA (ilustrações, explicações, conversas) já vem inclusa no seu plano. Não é preciso conectar nenhuma chave.' : 'AI (illustrations, explanations, conversations) is included in your plan. No API key needed.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/assinatura" className="h-9 px-3 rounded-lg inline-flex items-center text-[13.5px] border" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Minha assinatura' : 'My subscription'}</Link>
          {ent?.plan !== 'pro' && <Link to="/planos" className="h-9 px-3 rounded-lg inline-flex items-center text-[13.5px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Ver planos' : 'See plans'}</Link>}
        </div>
      </div>
      <UsageMeters />
      <label className="flex items-center justify-between gap-3 pt-2 border-t text-[14px]" style={{ borderColor: 'var(--theme-border)' }}>
        <span>
          <span className="block font-medium">{pt ? 'Tutor de leitura no leitor' : 'Reading tutor in the reader'}</span>
          <span className="block text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Botão flutuante para conversar por voz sobre o livro.' : 'Floating button to talk about the book by voice.'}</span>
        </span>
        <input type="checkbox" checked={tutorOn} onChange={e => { setTutorHidden(!e.target.checked); setTutorOn(e.target.checked) }} className="w-5 h-5 accent-[var(--theme-text)]" />
      </label>
    </section>
  )
}
