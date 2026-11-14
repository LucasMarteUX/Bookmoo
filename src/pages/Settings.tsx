import { useState, useEffect, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useLanguage, type Locale } from '@/store/useLanguage'
import { useReaderSettings, type Theme } from '@/store/useReaderSettings'
import { useUiStore } from '@/store/useUiStore'
import { useTranslations } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Camera, Coffee, KeyRound, Lock, Moon, Palette, Sparkles, Sun, User, Volume2 } from 'lucide-react'
import { VoiceSettings } from '@/components/settings/VoiceSettings'
import { AiConnections } from '@/components/settings/AiConnections'
import { ProfileSection } from '@/components/settings/ProfileSection'
import { restartTour } from '@/components/onboarding/GuidedTour'
import { BirthDateField } from '@/components/settings/BirthDate'

/** Seção de configurações: título com ícone e um cartão com as linhas. */
function Section({ id, icon, title, description, children }: { id: string; icon: ReactNode; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8">
      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: 'var(--theme-text)' }}>{icon}{title}</h2>
        {description && <p className="mt-1 text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{description}</p>}
      </div>
      <div className="rounded-2xl border divide-y" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>{children}</div>
    </section>
  )
}

/** Linha: rótulo e explicação à esquerda, controle à direita (empilha no celular). */
function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-6 px-5 py-4" style={{ borderColor: 'var(--theme-border)' }}>
      <div className="sm:w-[42%] shrink-0">
        <p className="text-[14px] font-medium" style={{ color: 'var(--theme-text)' }}>{label}</p>
        {hint && <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: 'var(--theme-text-secondary)' }}>{hint}</p>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function Feedback({ state, ok, error }: { state: 'success' | 'error' | null; ok: string; error: string }) {
  if (!state) return null
  return <p className="mt-2 text-[12.5px]" style={{ color: state === 'success' ? 'var(--pastel-green-fg)' : 'var(--pastel-rose-fg)' }}>{state === 'success' ? ok : error}</p>
}

export function Settings() {
  const { locale, setLocale } = useLanguage()
  const { t } = useTranslations(locale)
  const pt = locale === 'pt-BR'
  const { theme, setTheme } = useReaderSettings()
  const { dailyGoalMinutes, setDailyGoalMinutes } = useUiStore()
  const { hasSupabase, user, loading } = useAuth()
  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '')
  const [displayNameSaving, setDisplayNameSaving] = useState(false)
  const [displayNameMessage, setDisplayNameMessage] = useState<'success' | 'error' | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<'success' | 'error' | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.user_metadata?.avatar_url ?? null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [confirmNewEmail, setConfirmNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMessage, setEmailMessage] = useState<'success' | 'error' | null>(null)

  useEffect(() => {
    const name = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? ''
    setDisplayName(name)
    setAvatarUrl(user?.user_metadata?.avatar_url ?? null)
  }, [user])

  const userEmail = user?.email ?? ''
  const canChangeEmail = newEmail.trim() && confirmNewEmail.trim() && newEmail === confirmNewEmail && newEmail !== userEmail

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !supabase || !user) return
    setAvatarUploading(true)
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${user.id}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) { setAvatarUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } })
    setAvatarUploading(false)
    if (!updateError) setAvatarUrl(publicUrl)
  }

  const nav = [
    { id: 'appearance', label: pt ? 'Aparência' : 'Appearance', icon: Palette },
    { id: 'profile', label: pt ? 'Perfil' : 'Profile', icon: User },
    { id: 'account', label: t('account'), icon: User },
    { id: 'security', label: pt ? 'Segurança' : 'Security', icon: Lock },
    { id: 'ai', label: pt ? 'Conexões de IA' : 'AI connections', icon: Sparkles },
    { id: 'voices', label: pt ? 'Vozes' : 'Voices', icon: Volume2 },
  ]
  const themes: { id: Theme; label: string; icon: typeof Sun }[] = [
    { id: 'light', label: t('day'), icon: Sun }, { id: 'sepia', label: t('afternoon'), icon: Coffee }, { id: 'dark', label: t('night'), icon: Moon },
  ]
  const segmented = (on: boolean) => ({
    backgroundColor: on ? 'var(--theme-card-bg)' : 'transparent',
    color: on ? 'var(--theme-text)' : 'var(--theme-text-secondary)',
    boxShadow: on ? '0 1px 2px rgba(0,0,0,0.1)' : undefined,
  })

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="font-display text-[34px] md:text-[40px] leading-[1.05]" style={{ color: 'var(--theme-text)' }}>{t('settingsTitle')}</h1>
        <p className="mt-2 text-[14.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{t('settingsAccountSubtitle')}</p>
      </header>

      <div className="grid md:grid-cols-[190px_minmax(0,1fr)] gap-8">
        <nav className="hidden md:flex flex-col gap-0.5 sticky top-8 self-start" aria-label={t('settingsTitle')}>
          {nav.map(({ id, label, icon: Icon }) => (
            <a key={id} href={`#${id}`} className="flex items-center gap-2.5 h-8 px-2 rounded-md text-[13.5px] transition-colors hover:bg-[var(--ui-hover)]"
              style={{ color: 'var(--theme-text-secondary)' }}
              onClick={e => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }}>
              <Icon className="w-4 h-4" />{label}
            </a>
          ))}
        </nav>

        <div className="space-y-10 min-w-0">
          <Section id="age" icon={<User className="w-4 h-4" />} title={pt ? 'Idade' : 'Age'}>
            <Row label={pt ? 'Data de nascimento' : 'Date of birth'} hint={pt ? 'Privada. Serve só para indicar livros acima da sua idade.' : 'Private. Used only to flag books above your age.'}>
              <BirthDateField pt={pt} />
            </Row>
          </Section>

          <Section id="tutorial" icon={<Sparkles className="w-4 h-4" />} title={pt ? 'Tutorial' : 'Tutorial'}>
            <Row label={pt ? 'Rever o tutorial' : 'Replay the tutorial'} hint={pt ? 'Um passeio rápido pelas principais funções do Bookmoo.' : 'A quick tour of Bookmoo’s main features.'}>
              <button type="button" onClick={restartTour} className="h-9 px-4 rounded-full border text-[13px]" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Começar tutorial' : 'Start tutorial'}</button>
            </Row>
          </Section>

          <Section id="appearance" icon={<Palette className="w-4 h-4" />} title={pt ? 'Aparência' : 'Appearance'}>
            <Row label={pt ? 'Tema' : 'Theme'} hint={pt ? 'Vale para o app e para a leitura.' : 'Applies to the app and the reader.'}>
              <div className="inline-grid grid-cols-3 gap-1 p-0.5 rounded-lg" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                {themes.map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" onClick={() => setTheme(id)} aria-pressed={theme === id}
                    className="h-8 px-3 rounded-md inline-flex items-center justify-center gap-1.5 text-[13px] font-medium transition-colors" style={segmented(theme === id)}>
                    <Icon className="w-3.5 h-3.5" />{label}
                  </button>
                ))}
              </div>
            </Row>
            <Row label={t('language')} hint={pt ? 'Idioma da interface e das explicações.' : 'Interface and explanation language.'}>
              <div className="inline-grid grid-cols-2 gap-1 p-0.5 rounded-lg" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                {([['en', 'English'], ['pt-BR', 'Português']] as [Locale, string][]).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setLocale(id)} aria-pressed={locale === id}
                    className="h-8 px-3 rounded-md text-[13px] font-medium transition-colors" style={segmented(locale === id)}>{label}</button>
                ))}
              </div>
            </Row>
            <Row label={pt ? 'Meta diária' : 'Daily goal'} hint={pt ? 'Minutos de estudo por dia, mostrados na página inicial.' : 'Study minutes per day, shown on the home page.'}>
              <div className="inline-grid grid-cols-4 gap-1 p-0.5 rounded-lg" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                {[10, 15, 30, 60].map(m => (
                  <button key={m} type="button" onClick={() => setDailyGoalMinutes(m)} aria-pressed={dailyGoalMinutes === m}
                    className="h-8 px-3 rounded-md text-[13px] font-medium tabular-nums transition-colors" style={segmented(dailyGoalMinutes === m)}>{m} min</button>
                ))}
              </div>
            </Row>
          </Section>

          {loading && <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{t('loading')}</p>}
          {!loading && !hasSupabase && (
            <p className="rounded-2xl border p-5 text-sm" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}>{t('supabaseRequired')}</p>
          )}
          {!loading && hasSupabase && !user && (
            <p className="rounded-2xl border p-5 text-sm" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}>{t('signInToManageAccount')}</p>
          )}

          {!loading && hasSupabase && user && (
            <>
              <ProfileSection pt={pt} />
              <Section id="account" icon={<User className="w-4 h-4" />} title={t('account')}>
                <Row label={t('profilePhoto')}>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full border flex items-center justify-center overflow-hidden" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
                      {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                        : <span className="text-[18px] font-semibold" style={{ color: 'var(--theme-text)' }}>{(userEmail || 'B').charAt(0).toUpperCase()}</span>}
                    </div>
                    <label className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg border text-[13.5px] font-medium cursor-pointer transition-colors hover:bg-[var(--ui-hover)]"
                      style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}>
                      <Camera className="w-4 h-4" />
                      {avatarUploading ? t('saving') : t('uploadPhoto')}
                      <input type="file" accept="image/*" className="sr-only" onChange={handleAvatarChange} disabled={avatarUploading} />
                    </label>
                  </div>
                </Row>
                <Row label={t('yourName')}>
                  <div className="flex gap-2">
                    <Input value={displayName} onChange={(e) => { setDisplayName(e.target.value); setDisplayNameMessage(null) }} placeholder={t('yourName')} />
                    <Button variant="outline" className="h-10 shrink-0" disabled={displayNameSaving}
                      onClick={async () => {
                        if (!supabase) return
                        setDisplayNameSaving(true); setDisplayNameMessage(null)
                        const { error } = await supabase.auth.updateUser({ data: { full_name: displayName } })
                        setDisplayNameSaving(false)
                        setDisplayNameMessage(error ? 'error' : 'success')
                      }}>
                      {displayNameSaving ? t('saving') : (pt ? 'Salvar' : 'Save')}
                    </Button>
                  </div>
                  <Feedback state={displayNameMessage} ok={t('nameUpdated')} error={t('nameError')} />
                </Row>
                <Row label={t('email')} hint={userEmail || '—'}>
                  <div className="space-y-2">
                    <Input type="email" value={newEmail} onChange={(e) => { setNewEmail(e.target.value); setEmailMessage(null) }} placeholder={t('newEmail')} />
                    <Input type="email" value={confirmNewEmail} onChange={(e) => { setConfirmNewEmail(e.target.value); setEmailMessage(null) }} placeholder={t('confirmEmail')} />
                    <Button variant="outline" disabled={!canChangeEmail || emailSaving}
                      onClick={async () => {
                        if (!supabase || !canChangeEmail) return
                        setEmailSaving(true); setEmailMessage(null)
                        const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
                        setEmailSaving(false)
                        setEmailMessage(error ? 'error' : 'success')
                        if (!error) { setNewEmail(''); setConfirmNewEmail('') }
                      }}>
                      {emailSaving ? t('saving') : t('changeEmailButton')}
                    </Button>
                    <Feedback state={emailMessage} ok={t('emailUpdated')} error={t('emailUpdateError')} />
                  </div>
                </Row>
              </Section>

              <Section id="security" icon={<KeyRound className="w-4 h-4" />} title={pt ? 'Segurança' : 'Security'}>
                <Row label={t('changePassword')} hint={pt ? 'Use pelo menos 6 caracteres.' : 'Use at least 6 characters.'}>
                  <div className="space-y-2">
                    <Input type="password" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setPasswordMessage(null) }} placeholder={t('newPassword')} autoComplete="new-password" />
                    <Input type="password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setPasswordMessage(null) }} placeholder={t('confirmPassword')} autoComplete="new-password" />
                    <Button variant="outline" disabled={passwordSaving || !newPassword.trim() || newPassword !== confirmPassword}
                      onClick={async () => {
                        if (!supabase || newPassword !== confirmPassword) return
                        setPasswordSaving(true); setPasswordMessage(null)
                        const { error } = await supabase.auth.updateUser({ password: newPassword })
                        setPasswordSaving(false)
                        setPasswordMessage(error ? 'error' : 'success')
                        if (!error) { setNewPassword(''); setConfirmPassword('') }
                      }}>
                      {passwordSaving ? t('saving') : t('changePasswordButton')}
                    </Button>
                    <Feedback state={passwordMessage} ok={t('passwordChanged')} error={t('passwordError')} />
                  </div>
                </Row>
              </Section>

              <div id="ai" className="scroll-mt-8"><AiConnections /></div>
              <div id="voices" className="scroll-mt-8"><VoiceSettings /></div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
