import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/store/useLanguage'
import { useTranslations } from '@/lib/i18n'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { User, Lock, Mail, Camera } from 'lucide-react'

export function Settings() {
  const { locale } = useLanguage()
  const { t } = useTranslations(locale)
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
    if (uploadError) {
      setAvatarUploading(false)
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } })
    setAvatarUploading(false)
    if (!updateError) setAvatarUrl(publicUrl)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-12 py-8 px-0">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: 'var(--theme-text)' }}>
          {t('settingsTitle')}
        </h1>
        <p className="text-base" style={{ color: 'var(--theme-text-secondary)' }}>
          {t('settingsAccountSubtitle')}
        </p>
      </header>

      <div className="space-y-8">
        {loading && (
          <p className="text-sm py-6" style={{ color: 'var(--theme-text-secondary)' }}>{t('loading')}</p>
        )}

        {!loading && !hasSupabase && (
          <div className="p-6 rounded-3xl border" style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-subtle)' }}>
            <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{t('supabaseRequired')}</p>
          </div>
        )}

        {!loading && hasSupabase && !user && (
          <div className="p-6 rounded-3xl border" style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-subtle)' }}>
            <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{t('signInToManageAccount')}</p>
          </div>
        )}

        {!loading && hasSupabase && user && (
          <>
            <section className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'var(--theme-text)' }}>
                <User className="w-5 h-5" />
                {t('account')}
              </h2>
              <div className="p-6 rounded-3xl border transition-colors space-y-6" style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-subtle)' }}>
                {/* Foto de perfil */}
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full border-2 flex items-center justify-center overflow-hidden" style={{ borderColor: 'var(--theme-border-subtle)', backgroundColor: 'var(--theme-bg)' }}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10" style={{ color: 'var(--theme-nav-text-muted)' }} />
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{t('profilePhoto')}</Label>
                    <label className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
                      <Camera className="w-4 h-4" />
                      {avatarUploading ? t('saving') : t('uploadPhoto')}
                      <input type="file" accept="image/*" className="sr-only" onChange={handleAvatarChange} disabled={avatarUploading} />
                    </label>
                  </div>
                </div>

                {/* Nome */}
                <div className="space-y-2">
                  <Label style={{ color: 'var(--theme-text)' }}>{t('yourName')}</Label>
                  <Input
                    value={displayName}
                    onChange={(e) => { setDisplayName(e.target.value); setDisplayNameMessage(null) }}
                    placeholder={t('yourName')}
                    className="rounded-xl"
                  />
                </div>
                {displayNameMessage === 'success' && <p className="text-sm text-green-600">{t('nameUpdated')}</p>}
                {displayNameMessage === 'error' && <p className="text-sm text-red-600">{t('nameError')}</p>}
                <Button
                  className="rounded-xl"
                  style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
                  disabled={displayNameSaving}
                  onClick={async () => {
                    if (!supabase) return
                    setDisplayNameSaving(true)
                    setDisplayNameMessage(null)
                    const { error } = await supabase.auth.updateUser({ data: { full_name: displayName } })
                    setDisplayNameSaving(false)
                    setDisplayNameMessage(error ? 'error' : 'success')
                  }}
                >
                  {displayNameSaving ? t('saving') : t('saveName')}
                </Button>

                {/* Email: exibição + troca */}
                <div className="space-y-4">
                  <Label className="flex items-center gap-2" style={{ color: 'var(--theme-text)' }}>
                    <Mail className="w-4 h-4" />
                    {t('email')}
                  </Label>
                  <p className="text-sm py-1" style={{ color: 'var(--theme-text-secondary)' }}>{userEmail || '—'}</p>
                  <div className="space-y-2">
                    <Label style={{ color: 'var(--theme-text)' }}>{t('newEmail')}</Label>
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => { setNewEmail(e.target.value); setEmailMessage(null) }}
                      placeholder="novo@email.com"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label style={{ color: 'var(--theme-text)' }}>{t('confirmEmail')}</Label>
                    <Input
                      type="email"
                      value={confirmNewEmail}
                      onChange={(e) => { setConfirmNewEmail(e.target.value); setEmailMessage(null) }}
                      placeholder="novo@email.com"
                      className="rounded-xl"
                    />
                  </div>
                  {emailMessage === 'success' && <p className="text-sm text-green-600">{t('emailUpdated')}</p>}
                  {emailMessage === 'error' && <p className="text-sm text-red-600">{t('emailUpdateError')}</p>}
                  <Button
                    className="rounded-xl"
                    style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
                    disabled={!canChangeEmail || emailSaving}
                    onClick={async () => {
                      if (!supabase || !canChangeEmail) return
                      setEmailSaving(true)
                      setEmailMessage(null)
                      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
                      setEmailSaving(false)
                      setEmailMessage(error ? 'error' : 'success')
                      if (!error) {
                        setNewEmail('')
                        setConfirmNewEmail('')
                      }
                    }}
                  >
                    {emailSaving ? t('saving') : t('changeEmailButton')}
                  </Button>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'var(--theme-text)' }}>
                <Lock className="w-5 h-5" />
                {t('changePassword')}
              </h2>
              <div className="p-6 rounded-3xl border transition-colors" style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-subtle)' }}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label style={{ color: 'var(--theme-text)' }}>{t('newPassword')}</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setPasswordMessage(null) }}
                      placeholder="••••••••"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label style={{ color: 'var(--theme-text)' }}>{t('confirmPassword')}</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setPasswordMessage(null) }}
                      placeholder="••••••••"
                      className="rounded-xl"
                    />
                  </div>
                  {passwordMessage === 'success' && <p className="text-sm text-green-600">{t('passwordChanged')}</p>}
                  {passwordMessage === 'error' && <p className="text-sm text-red-600">{t('passwordError')}</p>}
                  <Button
                    className="rounded-xl"
                    style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
                    disabled={passwordSaving || !newPassword.trim() || newPassword !== confirmPassword}
                    onClick={async () => {
                      if (!supabase || newPassword !== confirmPassword) return
                      setPasswordSaving(true)
                      setPasswordMessage(null)
                      const { error } = await supabase.auth.updateUser({ password: newPassword })
                      setPasswordSaving(false)
                      setPasswordMessage(error ? 'error' : 'success')
                      if (!error) {
                        setNewPassword('')
                        setConfirmPassword('')
                      }
                    }}
                  >
                    {passwordSaving ? t('saving') : t('changePasswordButton')}
                  </Button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
