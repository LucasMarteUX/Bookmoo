import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBookStore } from '@/store/useBookStore'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useLanguage, type Locale } from '@/store/useLanguage'
import { useReaderSettings, type Theme } from '@/store/useReaderSettings'
import { useUiStore } from '@/store/useUiStore'
import { useTranslations } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { BookOpen, CircleHelp, Coffee, KeyRound, Moon, Palette, Sparkles, Sun, UserRound, Users, Volume2, type LucideIcon } from 'lucide-react'
import { VoiceSettings } from '@/components/settings/VoiceSettings'
import { PlanCreditsCard } from '@/components/billing/PlanCreditsCard'
import { ProfileSection } from '@/components/settings/ProfileSection'
import { restartTour } from '@/components/onboarding/GuidedTour'
import { restartBookTour } from '@/components/onboarding/BookTour'
import { BirthDateField } from '@/components/settings/BirthDate'
import { isTutorHidden, setTutorHidden } from '@/components/reader/ReaderTutor'
import { SettingsNote, SettingsRow, SettingsSection, SettingsToggle } from '@/components/settings/SettingsUI'
import { cn } from '@/lib/utils'

type NavItem = { id: string; label: string; icon: LucideIcon; account?: boolean }

export function Settings() {
  const navigate = useNavigate()
  const { locale, setLocale } = useLanguage()
  const { t } = useTranslations(locale)
  const pt = locale === 'pt-BR'
  const { theme, setTheme, grammarHelp, setGrammarHelp } = useReaderSettings()
  const { dailyGoalMinutes, setDailyGoalMinutes } = useUiStore()
  const { hasSupabase, user, loading } = useAuth()
  const signedIn = !loading && hasSupabase && !!user
  const [tutorOn, setTutorOn] = useState(!isTutorHidden())
  const [active, setActive] = useState('account')

  useEffect(() => {
    const sync = () => setTutorOn(!isTutorHidden())
    window.addEventListener('bookmoo-tutor-visibility', sync)
    return () => window.removeEventListener('bookmoo-tutor-visibility', sync)
  }, [])

  const nav: NavItem[] = [
    { id: 'account', label: t('account'), icon: UserRound, account: true },
    { id: 'profile', label: pt ? 'Perfil público' : 'Public profile', icon: Users, account: true },
    { id: 'appearance', label: pt ? 'Aparência' : 'Appearance', icon: Palette },
    { id: 'reading', label: pt ? 'Leitura' : 'Reading', icon: BookOpen },
    { id: 'voices', label: pt ? 'Voz de leitura' : 'Reading voice', icon: Volume2 },
    { id: 'plan', label: pt ? 'Plano e créditos' : 'Plan and credits', icon: Sparkles, account: true },
    { id: 'security', label: pt ? 'Segurança' : 'Security', icon: KeyRound, account: true },
    { id: 'help', label: pt ? 'Ajuda' : 'Help', icon: CircleHelp },
  ].filter(item => signedIn || !item.account)

  // Destaca no menu a seção que está na tela.
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-settings-section]'))
    if (!sections.length) return
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (visible) setActive(visible.target.id)
    }, { rootMargin: '-20% 0px -65% 0px' })
    sections.forEach(section => observer.observe(section))
    return () => observer.disconnect()
  }, [signedIn])

  const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: t('day'), icon: Sun }, { value: 'sepia', label: t('afternoon'), icon: Coffee }, { value: 'dark', label: t('night'), icon: Moon },
  ]

  const openBookTour = () => {
    const books = useBookStore.getState().books
    const last = [...books].sort((a, b) => +new Date(b.lastRead) - +new Date(a.lastRead))[0]
    if (!last) return
    navigate(`/book/${last.id}`)
    window.setTimeout(restartBookTour, 900)
  }
  const hasBooks = useBookStore(s => s.books.length > 0)

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <header className="mb-8 md:mb-10">
        <h1 className="font-display text-[34px] md:text-[40px] leading-[1.05]" style={{ color: 'var(--theme-text)' }}>{t('settingsTitle')}</h1>
        <p className="mt-2 text-[14.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Conta, perfil, aparência, leitura e voz.' : 'Account, profile, appearance, reading and voice.'}</p>
      </header>

      <div className="grid md:grid-cols-[200px_minmax(0,1fr)] gap-8 lg:gap-12">
        <nav className="hidden md:flex flex-col gap-0.5 sticky top-6 self-start" aria-label={t('settingsTitle')}>
          {nav.map(({ id, label, icon: Icon }) => {
            const on = active === id
            return (
              <a key={id} href={`#${id}`} aria-current={on ? 'true' : undefined}
                className={cn('relative flex items-center gap-2.5 h-9 px-3 rounded-lg text-[13.5px] transition-colors', !on && 'hover:bg-[var(--ui-hover)]')}
                style={{ color: on ? 'var(--theme-text)' : 'var(--theme-text-secondary)', backgroundColor: on ? 'var(--theme-nav-active)' : undefined, fontWeight: on ? 600 : 400 }}
                onClick={e => { e.preventDefault(); setActive(id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>
                <Icon className="w-4 h-4" />{label}
              </a>
            )
          })}
        </nav>

        <div className="space-y-12 min-w-0">
          {loading && <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{t('loading')}</p>}
          {!loading && !hasSupabase && (
            <p className="rounded-2xl border p-5 text-sm" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}>{t('supabaseRequired')}</p>
          )}
          {!loading && hasSupabase && !user && (
            <p className="rounded-2xl border p-5 text-sm" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}>{t('signInToManageAccount')}</p>
          )}

          {signedIn && <AccountSection pt={pt} />}
          {signedIn && <ProfileSection pt={pt} />}

          <SettingsSection id="appearance" icon={Palette} title={pt ? 'Aparência' : 'Appearance'} description={pt ? 'Tema, idioma da interface e sua meta de estudo.' : 'Theme, interface language and your study goal.'}>
            <SettingsRow label={pt ? 'Tema' : 'Theme'} hint={pt ? 'Vale para o app e para a leitura.' : 'Applies to the app and the reader.'}>
              <div role="radiogroup" aria-label={pt ? 'Tema' : 'Theme'} className="flex w-full sm:w-auto sm:inline-flex p-0.5 rounded-[10px] gap-0.5" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                {themes.map(({ value, label, icon: Icon }) => {
                  const on = theme === value
                  return (
                    <button key={value} type="button" role="radio" aria-checked={on} onClick={() => setTheme(value)}
                      className="flex-1 min-h-[2.25rem] px-3.5 rounded-[8px] inline-flex items-center justify-center gap-1.5 text-[13px] font-medium whitespace-nowrap transition-all"
                      style={{ backgroundColor: on ? 'var(--theme-card-bg)' : 'transparent', color: on ? 'var(--theme-text)' : 'var(--theme-text-secondary)', boxShadow: on ? '0 1px 3px rgba(0,0,0,0.10), 0 1px 1px rgba(0,0,0,0.04)' : 'none' }}>
                      <Icon className="w-3.5 h-3.5" />{label}
                    </button>
                  )
                })}
              </div>
            </SettingsRow>
            <SettingsRow label={t('language')} hint={pt ? 'Idioma da interface e das explicações.' : 'Interface and explanation language.'}>
              <SegmentedControl<Locale> className="w-full sm:w-auto" value={locale} onChange={setLocale} label={t('language')}
                options={[{ value: 'pt-BR', label: 'Português' }, { value: 'en', label: 'English' }]} />
            </SettingsRow>
            <SettingsRow label={pt ? 'Meta diária' : 'Daily goal'} hint={pt ? 'Minutos de estudo por dia, mostrados na página inicial.' : 'Study minutes per day, shown on the home page.'}>
              <SegmentedControl<string> className="w-full sm:w-auto" value={String(dailyGoalMinutes)} onChange={v => setDailyGoalMinutes(Number(v))} label={pt ? 'Meta diária' : 'Daily goal'}
                options={[10, 15, 30, 60].map(m => ({ value: String(m), label: `${m} min` }))} />
            </SettingsRow>
          </SettingsSection>

          <SettingsSection id="reading" icon={BookOpen} title={pt ? 'Leitura' : 'Reading'} description={pt ? 'Ajudas que aparecem dentro do livro.' : 'Helpers shown inside the book.'}>
            <SettingsToggle checked={grammarHelp} onChange={setGrammarHelp}
              label={pt ? 'Estudar a página e Desafio' : 'Study the page and Challenge'}
              hint={pt ? 'Botões no leitor com a gramática da página e um quiz. A partir do nível B1 você pode desligar.' : 'Reader buttons with the page grammar and a quiz. From B1 you can turn them off.'} />
            <SettingsToggle checked={tutorOn} onChange={on => { setTutorHidden(!on); setTutorOn(on) }}
              label={pt ? 'Tutora de leitura' : 'Reading tutor'}
              hint={pt ? 'Botão flutuante no leitor para conversar por voz sobre o livro.' : 'Floating button in the reader to talk about the book by voice.'} />
          </SettingsSection>

          <VoiceSettings />

          {signedIn && <PlanCreditsCard pt={pt} />}
          {signedIn && <SecuritySection pt={pt} />}

          <SettingsSection id="help" icon={CircleHelp} title={pt ? 'Ajuda' : 'Help'} description={pt ? 'Reveja os passeios guiados quando quiser.' : 'Replay the guided tours whenever you want.'}>
            <SettingsRow inline label={pt ? 'Tutorial do app' : 'App tutorial'} hint={pt ? 'Um passeio rápido pelas principais funções do Bookmoo.' : 'A quick tour of Bookmoo’s main features.'}>
              <Button variant="outline" onClick={restartTour}>{pt ? 'Começar' : 'Start'}</Button>
            </SettingsRow>
            <SettingsRow inline label={pt ? 'Tutorial do livro' : 'Book tutorial'} hint={hasBooks ? (pt ? 'Como estudar dentro de um livro. Abre no seu último livro.' : 'How to study inside a book. Opens your latest book.') : (pt ? 'Adicione um livro para ver este tutorial.' : 'Add a book to see this tutorial.')}>
              <Button variant="outline" onClick={openBookTour} disabled={!hasBooks}>{pt ? 'Começar' : 'Start'}</Button>
            </SettingsRow>
          </SettingsSection>
        </div>
      </div>
    </div>
  )
}

/** Conta: nome, e-mail (com troca) e data de nascimento. A foto fica no perfil público. */
function AccountSection({ pt }: { pt: boolean }) {
  const { locale } = useLanguage()
  const { t } = useTranslations(locale)
  const { user } = useAuth()
  const [name, setName] = useState(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '')
  const [nameState, setNameState] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [emailOpen, setEmailOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [emailState, setEmailState] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const savedName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? ''
  const email = user?.email ?? ''
  const canEmail = !!newEmail.trim() && newEmail === confirmEmail && newEmail !== email

  useEffect(() => { setName(savedName) }, [savedName])

  const saveName = async () => {
    if (!supabase) return
    setNameState('saving')
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } })
    setNameState(error ? 'error' : 'ok')
  }
  const saveEmail = async () => {
    if (!supabase || !canEmail) return
    setEmailState('saving')
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    setEmailState(error ? 'error' : 'ok')
    if (!error) { setNewEmail(''); setConfirmEmail(''); setEmailOpen(false) }
  }

  return (
    <SettingsSection id="account" icon={UserRound} title={t('account')} description={pt ? 'Seus dados de acesso. Nada disso aparece para outras pessoas.' : 'Your sign-in details. None of this is shown to others.'}>
      <SettingsRow label={t('yourName')} hint={pt ? 'Usado nas saudações do app.' : 'Used in the app greetings.'}
        below={nameState === 'ok' ? <SettingsNote tone="ok">{t('nameUpdated')}</SettingsNote> : nameState === 'error' ? <SettingsNote tone="error">{t('nameError')}</SettingsNote> : null}>
        <form className="flex gap-2 sm:w-[320px]" onSubmit={e => { e.preventDefault(); void saveName() }}>
          <Input value={name} onChange={e => { setName(e.target.value); setNameState('idle') }} placeholder={t('yourName')} aria-label={t('yourName')} />
          <Button type="submit" variant="outline" className="h-10 shrink-0" disabled={nameState === 'saving' || name.trim() === savedName}>
            {nameState === 'saving' ? t('saving') : (pt ? 'Salvar' : 'Save')}
          </Button>
        </form>
      </SettingsRow>
      <SettingsRow inline label={t('email')} hint={email || '–'}
        below={<>
          {emailOpen && (
            <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={e => { e.preventDefault(); void saveEmail() }}>
              <Input type="email" value={newEmail} onChange={e => { setNewEmail(e.target.value); setEmailState('idle') }} placeholder={t('newEmail')} autoFocus />
              <Input type="email" value={confirmEmail} onChange={e => { setConfirmEmail(e.target.value); setEmailState('idle') }} placeholder={t('confirmEmail')} />
              <Button type="submit" className="h-10" disabled={!canEmail || emailState === 'saving'}>{emailState === 'saving' ? t('saving') : (pt ? 'Confirmar' : 'Confirm')}</Button>
            </form>
          )}
          {emailOpen && newEmail && confirmEmail && newEmail !== confirmEmail && <SettingsNote tone="error">{pt ? 'Os dois e-mails precisam ser iguais.' : 'Both emails must match.'}</SettingsNote>}
          {emailState === 'ok' && <SettingsNote tone="ok">{t('emailUpdated')}</SettingsNote>}
          {emailState === 'error' && <SettingsNote tone="error">{t('emailUpdateError')}</SettingsNote>}
        </>}>
        <Button variant="outline" onClick={() => { setEmailOpen(v => !v); setEmailState('idle') }} aria-expanded={emailOpen}>
          {emailOpen ? (pt ? 'Cancelar' : 'Cancel') : (pt ? 'Alterar' : 'Change')}
        </Button>
      </SettingsRow>
      <SettingsRow label={pt ? 'Data de nascimento' : 'Date of birth'} hint={pt ? 'Privada. Indica quais livros combinam com a sua idade.' : 'Private. Shows which books suit your age.'}>
        <BirthDateField pt={pt} />
      </SettingsRow>
    </SettingsSection>
  )
}

function SecuritySection({ pt }: { pt: boolean }) {
  const { locale } = useLanguage()
  const { t } = useTranslations(locale)
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const valid = password.length >= 6 && password === confirm

  const save = async () => {
    if (!supabase || !valid) return
    setState('saving')
    const { error } = await supabase.auth.updateUser({ password })
    setState(error ? 'error' : 'ok')
    if (!error) { setPassword(''); setConfirm(''); setOpen(false) }
  }

  return (
    <SettingsSection id="security" icon={KeyRound} title={pt ? 'Segurança' : 'Security'} description={pt ? 'Senha de acesso à sua conta.' : 'Your account password.'}>
      <SettingsRow inline label={t('changePassword')} hint={pt ? 'Use pelo menos 6 caracteres.' : 'Use at least 6 characters.'}
        below={<>
          {open && (
            <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={e => { e.preventDefault(); void save() }}>
              <Input type="password" value={password} onChange={e => { setPassword(e.target.value); setState('idle') }} placeholder={t('newPassword')} autoComplete="new-password" autoFocus />
              <Input type="password" value={confirm} onChange={e => { setConfirm(e.target.value); setState('idle') }} placeholder={t('confirmPassword')} autoComplete="new-password" />
              <Button type="submit" className="h-10" disabled={!valid || state === 'saving'}>{state === 'saving' ? t('saving') : (pt ? 'Salvar senha' : 'Save password')}</Button>
            </form>
          )}
          {open && confirm && password !== confirm && <SettingsNote tone="error">{pt ? 'As senhas precisam ser iguais.' : 'Passwords must match.'}</SettingsNote>}
          {state === 'ok' && <SettingsNote tone="ok">{t('passwordChanged')}</SettingsNote>}
          {state === 'error' && <SettingsNote tone="error">{t('passwordError')}</SettingsNote>}
        </>}>
        <Button variant="outline" onClick={() => { setOpen(v => !v); setState('idle') }} aria-expanded={open}>
          {open ? (pt ? 'Cancelar' : 'Cancel') : (pt ? 'Alterar' : 'Change')}
        </Button>
      </SettingsRow>
    </SettingsSection>
  )
}
