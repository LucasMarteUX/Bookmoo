// Completar cadastro (contas do Google não trazem nascimento nem aceite), esqueci a senha e nova senha.
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/store/useLanguage'
import { useEntitlements } from '@/store/useEntitlements'
import { useAuth } from '@/contexts/AuthContext'

const field = 'w-full h-12 rounded-xl border px-3.5 text-[15px] bg-transparent outline-none'

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh grid place-items-center px-5 py-10" style={{ backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
      <div className="w-full max-w-sm">
        <p className="text-[14px] font-semibold">Bookmoo</p>
        <h1 className="mt-6 font-display text-[30px] leading-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px]" style={{ color: 'var(--theme-text-secondary)' }}>{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}

function age(birth: string) {
  const b = new Date(`${birth}T12:00:00`)
  if (Number.isNaN(+b)) return null
  const n = new Date()
  let a = n.getFullYear() - b.getFullYear()
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--
  return a
}

export function CompleteProfilePage() {
  const pt = useLanguage().locale === 'pt-BR'
  const navigate = useNavigate()
  const { user } = useAuth()
  const load = useEntitlements(s => s.load)
  const [birth, setBirth] = useState('')
  const [accept, setAccept] = useState(false)
  const [guardian, setGuardian] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const years = birth ? age(birth) : null
  const save = async () => {
    setError('')
    if (years === null || years < 0 || years > 120) { setError(pt ? 'Informe uma data de nascimento válida.' : 'Enter a valid date of birth.'); return }
    if (!accept) { setError(pt ? 'Para continuar, aceite os Termos e a Política de privacidade.' : 'Accept the Terms and Privacy policy to continue.'); return }
    if (years < 12 && !guardian) { setError(pt ? 'Menores de 12 anos precisam do consentimento de um responsável.' : 'Under-12s need a guardian’s consent.'); return }
    if (!supabase) return
    setBusy(true)
    const { error: e } = await supabase.rpc('complete_profile', { p_birth: birth, p_accept: true })
    if (!e) await supabase.auth.updateUser({ data: { birth_date: birth, ...(years < 12 ? { guardian_consent_at: new Date().toISOString() } : {}) } })
    setBusy(false)
    if (e) { setError(pt ? 'Não foi possível salvar. Tente de novo.' : 'Could not save. Try again.'); return }
    await load()
    navigate('/planos?welcome=1', { replace: true })
  }
  return (
    <Shell title={pt ? `Quase lá${user?.user_metadata?.full_name ? `, ${String(user.user_metadata.full_name).split(' ')[0]}` : ''}!` : 'Almost there!'}
      subtitle={pt ? 'Precisamos da sua data de nascimento para mostrar livros adequados à sua idade.' : 'We need your date of birth to show age-appropriate books.'}>
      <label className="block">
        <span className="block text-[13px] font-medium mb-1.5">{pt ? 'Data de nascimento' : 'Date of birth'}</span>
        <input type="date" value={birth} max={new Date().toISOString().slice(0, 10)} onChange={e => setBirth(e.target.value)} className={field} style={{ borderColor: 'var(--theme-border)' }} />
      </label>
      {years !== null && years < 12 && (
        <label className="mt-4 flex items-start gap-2.5 text-[13.5px]">
          <input type="checkbox" checked={guardian} onChange={e => setGuardian(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[var(--theme-text)]" />
          <span>{pt ? 'Sou o responsável legal e autorizo o uso dos dados (LGPD, art. 14).' : 'I am the legal guardian and consent to data processing.'}</span>
        </label>
      )}
      <label className="mt-4 flex items-start gap-2.5 text-[13.5px]">
        <input type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[var(--theme-text)]" />
        <span>{pt ? 'Li e aceito os ' : 'I accept the '}<Link to="/terms?back=/completar-cadastro" className="underline">{pt ? 'Termos' : 'Terms'}</Link>{pt ? ' e a ' : ' and the '}<Link to="/privacy?back=/completar-cadastro" className="underline">{pt ? 'Política de privacidade' : 'Privacy policy'}</Link>.</span>
      </label>
      {error && <p role="alert" className="mt-4 text-[14px]" style={{ color: '#b42318' }}>{error}</p>}
      <button type="button" disabled={busy} onClick={save} className="mt-6 h-12 w-full rounded-xl text-[15px] font-semibold disabled:opacity-60" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (pt ? 'Continuar' : 'Continue')}
      </button>
    </Shell>
  )
}

export function ForgotPasswordPage() {
  const pt = useLanguage().locale === 'pt-BR'
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  useEffect(() => { if (!cooldown) return; const t = setTimeout(() => setCooldown(c => c - 1), 1000); return () => clearTimeout(t) }, [cooldown])
  const send = async () => {
    if (!supabase || !/.+@.+\..+/.test(email)) return
    setBusy(true)
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/nova-senha` })
    setBusy(false)
    setSent(true)
    setCooldown(60)
  }
  return (
    <Shell title={pt ? 'Esqueceu a senha?' : 'Forgot your password?'} subtitle={sent ? (pt ? `Se existir uma conta com ${email}, enviamos um link para criar uma senha nova. Confira também o spam.` : `If an account exists for ${email}, we sent a reset link. Check spam too.`) : (pt ? 'Enviamos um link para você criar uma senha nova.' : "We'll email you a link to set a new password.")}>
      <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" className={field} style={{ borderColor: 'var(--theme-border)' }} />
      <button type="button" disabled={busy || cooldown > 0} onClick={send} className="mt-4 h-12 w-full rounded-xl text-[15px] font-semibold disabled:opacity-60" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : cooldown > 0 ? (pt ? `Reenviar em ${cooldown}s` : `Resend in ${cooldown}s`) : sent ? (pt ? 'Reenviar link' : 'Resend link') : (pt ? 'Enviar link' : 'Send link')}
      </button>
      <Link to="/login" className="mt-6 block text-center text-[14px] underline underline-offset-4" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Voltar para o login' : 'Back to sign in'}</Link>
    </Shell>
  )
}

export function NewPasswordPage() {
  const pt = useLanguage().locale === 'pt-BR'
  const navigate = useNavigate()
  const { session } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async () => {
    setError('')
    if (password.length < 8) { setError(pt ? 'Use pelo menos 8 caracteres.' : 'Use at least 8 characters.'); return }
    if (password !== confirm) { setError(pt ? 'As senhas não são iguais.' : 'Passwords do not match.'); return }
    if (!supabase) return
    setBusy(true)
    const { error: e } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (e) { setError(pt ? 'O link expirou. Peça um novo.' : 'The link expired. Request a new one.'); return }
    navigate('/', { replace: true })
  }
  if (!session) {
    return (
      <Shell title={pt ? 'Link inválido ou expirado' : 'Invalid or expired link'} subtitle={pt ? 'Peça um novo link para criar sua senha.' : 'Request a new link.'}>
        <Link to="/esqueci-senha" className="h-12 w-full rounded-xl grid place-items-center text-[15px] font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Pedir novo link' : 'Request new link'}</Link>
      </Shell>
    )
  }
  return (
    <Shell title={pt ? 'Crie uma senha nova' : 'Set a new password'}>
      <input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder={pt ? 'Nova senha' : 'New password'} className={field} style={{ borderColor: 'var(--theme-border)' }} />
      <input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={pt ? 'Repita a senha' : 'Repeat password'} className={`${field} mt-3`} style={{ borderColor: 'var(--theme-border)' }} />
      {error && <p role="alert" className="mt-3 text-[14px]" style={{ color: '#b42318' }}>{error}</p>}
      <button type="button" disabled={busy} onClick={save} className="mt-5 h-12 w-full rounded-xl text-[15px] font-semibold disabled:opacity-60" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (pt ? 'Salvar senha' : 'Save password')}
      </button>
    </Shell>
  )
}
