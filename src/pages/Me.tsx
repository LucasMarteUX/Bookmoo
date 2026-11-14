import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ChartNoAxesColumn, ChevronRight, Coffee, FileText, Flame, HelpCircle, LogOut, Moon, Settings2, Shield, ShieldCheck, Star, Sun, Users,
  Download, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/store/useLanguage'
import { useReaderSettings, type Theme } from '@/store/useReaderSettings'
import { useVocabularyStore } from '@/store/useVocabularyStore'
import { useXpStore, xpSummary } from '@/store/useXpStore'
import { studyLevel } from '@/lib/cefr'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { ActionSheet } from '@/components/ui/action-sheet'
import { VoiceSelect } from '@/components/layout/VoiceSelect'
import { StudyTimer } from '@/components/timer/StudyTimer'
import { isStandalone } from '@/components/mobile/routes'
import { openInstallPrompt } from '@/components/mobile/InstallPrompt'
import { Avatar } from '@/components/ui/avatar'
import { useMyAvatar } from '@/hooks/useMyAvatar'
import { UsageMeters } from '@/components/billing/UsageMeters'

function Section({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      {label ? <h2 className="ios-section-label">{label}</h2> : null}
      <div className="ios-section">{children}</div>
    </section>
  )
}

function Row({ to, onClick, icon: Icon, tint, label, detail, destructive }: {
  to?: string; onClick?: () => void; icon: LucideIcon; tint: string; label: string; detail?: string; destructive?: boolean
}) {
  const inner = (
    <>
      <span className="ios-row-icon" style={{ backgroundColor: `var(--pastel-${tint}-bg)`, color: `var(--pastel-${tint}-fg)` }} aria-hidden>
        <Icon className="w-[18px] h-[18px]" />
      </span>
      <span className="flex-1 min-w-0 truncate" style={destructive ? { color: 'var(--color-destructive)' } : undefined}>{label}</span>
      {detail ? <span className="text-[15px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{detail}</span> : null}
      {to ? <ChevronRight className="w-[18px] h-[18px] shrink-0" style={{ color: 'var(--theme-text-secondary)' }} aria-hidden /> : null}
    </>
  )
  return to
    ? <Link to={to} className="ios-row">{inner}</Link>
    : <button type="button" onClick={onClick} className="ios-row">{inner}</button>
}

/** Aba "Você": conta, progresso, aparência e tudo que não cabe nas 5 abas. Lista agrupada como os Ajustes do iOS. */
export function MePage() {
  const myAvatar = useMyAvatar()
  const { user, isAdmin, signOut } = useAuth()
  const { locale, setLocale } = useLanguage()
  const pt = locale === 'pt-BR'
  const { theme, setTheme } = useReaderSettings()
  const vocab = useVocabularyStore(s => s.vocabularies)
  const events = useXpStore(s => s.events)
  const { total, streak, studiedToday } = useMemo(() => xpSummary(events), [events])
  const saved = useMemo(() => new Set(vocab.map(v => v.text.trim().toLowerCase()).filter(Boolean)).size, [vocab])
  const level = useMemo(() => studyLevel(saved, total), [saved, total])
  const fmt = new Intl.NumberFormat(pt ? 'pt-BR' : 'en-US')
  const [confirmOut, setConfirmOut] = useState(false)
  const name = user?.email?.split('@')[0] ?? 'Bookmoo'

  const themes: { value: Theme; label: string; icon: LucideIcon }[] = [
    { value: 'light', label: pt ? 'Dia' : 'Day', icon: Sun },
    { value: 'sepia', label: pt ? 'Tarde' : 'Afternoon', icon: Coffee },
    { value: 'dark', label: pt ? 'Noite' : 'Night', icon: Moon },
  ]

  return (
    <div className="max-w-xl mx-auto space-y-7">
      <header className="flex items-center gap-4 pt-1">
        <Avatar src={myAvatar} name={name} size={64} />
        <div className="min-w-0">
          <h1 className="font-display text-[28px] md:text-[34px] leading-[1.05] truncate" style={{ color: 'var(--theme-text)' }}>{name}</h1>
          <p className="text-[15px] mt-1" style={{ color: 'var(--theme-text-secondary)' }}>
            {pt ? `Nível ${level.id} · ${level.pt}` : `Level ${level.id} · ${level.en}`}
          </p>
        </div>
      </header>
      <section className="rounded-2xl border p-4" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
        <UsageMeters />
        <div className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
          <Link to="/assinatura" className="h-10 rounded-xl grid place-items-center border" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Assinatura' : 'Subscription'}</Link>
          <Link to="/conversar" className="h-10 rounded-xl grid place-items-center border" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Conversar' : 'Talk'}</Link>
          <Link to="/raio-x" className="h-10 rounded-xl grid place-items-center border" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Raio-X' : 'Report'}</Link>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2" role="list" aria-label={pt ? 'Resumo' : 'Summary'}>
        {[
          { icon: Flame, value: String(streak), label: pt ? (streak === 1 ? 'dia seguido' : 'dias seguidos') : 'day streak', tint: 'amber', on: studiedToday },
          { icon: Star, value: fmt.format(total), label: pt ? 'pontos' : 'points', tint: 'lavender', on: true },
          { icon: ChartNoAxesColumn, value: String(saved), label: pt ? 'palavras' : 'words', tint: 'green', on: true },
        ].map(({ icon: Icon, value, label, tint, on }) => (
          <div key={label} role="listitem" className="rounded-2xl p-3" style={{ backgroundColor: `var(--pastel-${tint}-bg)`, color: `var(--pastel-${tint}-fg)` }}>
            <Icon className="w-5 h-5" fill={on && tint === 'amber' ? 'currentColor' : 'none'} aria-hidden />
            <p className="mt-2 text-[22px] font-semibold tabular-nums leading-none">{value}</p>
            <p className="mt-1 text-[13px]">{label}</p>
          </div>
        ))}
      </div>

      <StudyTimer />

      <Section label={pt ? 'Progresso e pessoas' : 'Progress & people'}>
        <Row to="/stats" icon={ChartNoAxesColumn} tint="blue" label={pt ? 'Estatísticas' : 'Statistics'} />
        <Row to="/community" icon={Users} tint="rose" label={pt ? 'Comunidade' : 'Community'} />
      </Section>

      <Section label={pt ? 'Aparência' : 'Appearance'}>
        <div className="p-3 space-y-3">
          <SegmentedControl label={pt ? 'Tema' : 'Theme'} className="w-full" value={theme} onChange={setTheme}
            options={themes.map(t => ({ value: t.value, label: t.label }))} />
          <SegmentedControl label={pt ? 'Idioma' : 'Language'} className="w-full" value={locale} onChange={setLocale}
            options={[{ value: 'pt-BR', label: 'Português' }, { value: 'en', label: 'English' }]} />
        </div>
      </Section>

      <Section label={pt ? 'Voz de leitura' : 'Reading voice'}>
        <div className="p-3"><VoiceSelect hideLabel /></div>
      </Section>

      <Section label={pt ? 'Conta' : 'Account'}>
        <Row to="/settings" icon={Settings2} tint="sand" label={pt ? 'Ajustes' : 'Settings'} />
        {isAdmin ? <Row to="/admin" icon={Shield} tint="lavender" label={pt ? 'Área admin' : 'Admin'} /> : null}
        {!isStandalone() ? <Row onClick={openInstallPrompt} icon={Download} tint="green" label={pt ? 'Instalar o app' : 'Install the app'} /> : null}
      </Section>

      <Section label={pt ? 'Sobre' : 'About'}>
        <Row to="/faq" icon={HelpCircle} tint="blue" label={pt ? 'Perguntas frequentes' : 'FAQ'} />
        <Row to="/terms" icon={FileText} tint="sand" label={pt ? 'Termos de uso' : 'Terms of use'} />
        <Row to="/privacy" icon={ShieldCheck} tint="green" label={pt ? 'Privacidade' : 'Privacy'} />
      </Section>

      <Section>
        <Row onClick={() => setConfirmOut(true)} icon={LogOut} tint="rose" label={pt ? 'Sair' : 'Sign out'} destructive />
      </Section>

      <p className="text-center text-[13px] pb-2" style={{ color: 'var(--theme-text-secondary)' }}>{user?.email}</p>

      <ActionSheet open={confirmOut} onOpenChange={setConfirmOut}
        title={pt ? 'Sair da sua conta?' : 'Sign out?'}
        message={pt ? 'Seus livros e palavras ficam salvos na nuvem.' : 'Your books and words stay saved in the cloud.'}
        actions={[{ label: pt ? 'Sair' : 'Sign out', destructive: true, icon: LogOut, onSelect: () => { void signOut() } }]} />
    </div>
  )
}
