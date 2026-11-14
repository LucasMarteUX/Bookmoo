import { useEffect, useState } from 'react'
import { ageFrom } from '@/lib/catalog'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Eye, EyeOff, Moon, Sun } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/store/useLanguage'
import { useTranslations } from '@/lib/i18n'
import { useReaderSettings } from '@/store/useReaderSettings'

type Mode = 'login' | 'signup'

/** Guarda o aceite dos termos até o perfil existir (o perfil grava a data no primeiro login). */
export const TERMS_KEY = 'bookmoo-terms-accepted-at'
function rememberTermsAccepted() {
  try { localStorage.setItem(TERMS_KEY, new Date().toISOString()) } catch { /* modo privado: segue sem guardar */ }
}

// Painel da esquerda: ilustrações em preto e branco que trocam devagar, como um onboarding.
const SLIDES = [
  { src: '/illustrations/reading.svg', pt: ['Leia o que você ama', 'Aprenda um idioma com livros de verdade, palavra por palavra.'], en: ['Read what you love', 'Learn a language with real books, one word at a time.'] },
  { src: '/illustrations/chatting.svg', pt: ['Fale sem medo', 'Treine a pronúncia e ouça cada frase no seu ritmo.'], en: ['Speak with confidence', 'Practice pronunciation and hear every sentence at your pace.'] },
  { src: '/illustrations/meditation.svg', pt: ['Um pouco por dia', 'Sequências, revisões e o seu progresso num só lugar.'], en: ['A little every day', 'Streaks, reviews and your progress in one place.'] },
]

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.46a5.53 5.53 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.73Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.1-6.71-4.94H1.28v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.31a7.2 7.2 0 0 1 0-4.62v-3.1H1.28a12 12 0 0 0 0 10.82l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.28 6.59l4.01 3.1C6.23 6.85 8.88 4.75 12 4.75Z" />
    </svg>
  )
}

export function Login({ mode = 'login' }: { mode?: Mode }) {
  const { signIn, signUp, signInWithGoogle, session, loading: authLoading } = useAuth()
  const { locale } = useLanguage()
  const { t } = useTranslations(locale)
  const pt = locale === 'pt-BR'
  const { theme, setTheme } = useReaderSettings()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [guardianOk, setGuardianOk] = useState(false)
  const signupAge = ageFrom(birthDate)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  const [loading, setLoading] = useState<'email' | 'google' | null>(null)
  const [slide, setSlide] = useState(0)
  const signup = mode === 'signup'

  useEffect(() => {
    // Em desenvolvimento, ?preview mostra a tela mesmo logado (para revisar o visual).
    const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('preview')
    if (!authLoading && session && !preview) navigate('/', { replace: true })
  }, [authLoading, session, navigate])

  useEffect(() => { setError(''); setMessage('') }, [mode])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => setSlide(s => (s + 1) % SLIDES.length), 6000)
    return () => window.clearInterval(id)
  }, [])

  const errorMessage = (err: Error): string => {
    const msg = (err?.message ?? '').toLowerCase()
    const code = (err as { code?: string })?.code
    if (msg.includes('failed to fetch') || msg.includes('network')) return pt ? 'Sem conexão com o servidor. Tente de novo em instantes.' : 'Could not reach the server. Try again shortly.'
    if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) return t('loginErrorInvalidCredentials')
    if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) return t('loginErrorEmailNotConfirmed')
    if (msg.includes('provider is not enabled') || msg.includes('unsupported provider')) return pt ? 'O login com Google ainda não está ativado.' : 'Google sign-in is not enabled yet.'
    if (msg.includes('already registered')) return pt ? 'Este e-mail já tem conta. Entre com ele.' : 'This email already has an account. Sign in instead.'
    if (msg.includes('password should be')) return pt ? 'A senha precisa ter pelo menos 6 caracteres.' : 'Password must be at least 6 characters.'
    return err?.message || t('loginErrorGeneric')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setMessage('')
    if (signup && password !== confirm) { setError(pt ? 'As senhas não são iguais.' : 'Passwords do not match.'); return }
    if (signup && !name.trim()) { setError(pt ? 'Informe seu nome.' : 'Enter your name.'); return }
    if (signup && signupAge === null) { setError(pt ? 'Informe uma data de nascimento válida.' : 'Enter a valid date of birth.'); return }
    if (signup && signupAge !== null && signupAge < 12 && !guardianOk) { setError(pt ? 'Para menores de 12 anos, um responsável precisa autorizar o cadastro.' : 'Under 12, a guardian must authorize the sign-up.'); return }
    if (signup && !accepted) { setError(pt ? 'Para criar a conta, aceite os Termos e a Política de Privacidade.' : 'To create an account, accept the Terms and Privacy Policy.'); return }
    if (signup) rememberTermsAccepted()
    setLoading('email')
    const normalized = email.trim().toLowerCase()
    const result: { error: Error | null; needsConfirmation?: boolean } = signup ? await signUp(normalized, password, { full_name: name.trim(), birth_date: birthDate, ...(signupAge !== null && signupAge < 12 ? { guardian_consent_at: new Date().toISOString() } : {}) }) : await signIn(normalized, password)
    setLoading(null)
    const { error, needsConfirmation } = result
    if (error) { setError(errorMessage(error)); return }
    // Cadastro: o aviso aparece aqui, na hora, e não só na tela de login.
    if (signup && needsConfirmation) setSentTo(normalized)
    else if (signup) setMessage(pt ? 'Conta criada! Entrando…' : 'Account created! Signing you in…')
  }

  const google = async () => {
    setError(''); setMessage('')
    if (signup && !accepted) { setError(pt ? 'Para criar a conta, aceite os Termos e a Política de Privacidade.' : 'To create an account, accept the Terms and Privacy Policy.'); return }
    // Entrar com Google também é aceite (o aviso aparece abaixo do botão).
    rememberTermsAccepted()
    setLoading('google')
    const { error } = await signInWithGoogle()
    if (error) { setLoading(null); setError(errorMessage(error)) }
  }

  const current = SLIDES[slide]
  const [title, subtitle] = pt ? current.pt : current.en
  const field = 'w-full h-11 rounded-lg border px-3 text-[15px] outline-none transition-colors bg-[var(--theme-bg)] border-[var(--theme-border)] text-[var(--theme-text)] placeholder:text-[var(--theme-text-secondary)]/70 focus:border-[var(--theme-text)]'

  return (
    <div className="min-h-dvh flex gap-4 lg:gap-6 p-4 lg:p-6" style={{ backgroundColor: 'var(--theme-bg)' }}>
      {/* 70%: ilustração */}
      <aside className="hidden lg:flex basis-[70%] shrink-0 flex-col rounded-[28px] p-10 relative overflow-hidden"
        style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
        <div className="flex items-center gap-2">
          <span className="grid place-items-center w-8 h-8 rounded-lg text-sm font-bold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>B</span>
          <span className="text-lg font-semibold tracking-tight" style={{ color: 'var(--theme-text)' }}>Bookmoo</span>
        </div>
        <div className="flex-1 grid place-items-center py-8">
          <AnimatePresence mode="wait">
            <motion.img key={current.src} src={current.src} alt="" className="illo w-full max-w-[520px] max-h-[52vh] object-contain"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.45 }} />
          </AnimatePresence>
        </div>
        <div className="flex items-end justify-between gap-8">
          <AnimatePresence mode="wait">
            <motion.div key={slide} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="max-w-md">
              <h2 className="text-[34px] leading-[1.1] font-semibold tracking-tight" style={{ color: 'var(--theme-text)' }}>{title}</h2>
              <p className="mt-3 text-base" style={{ color: 'var(--theme-text-secondary)' }}>{subtitle}</p>
            </motion.div>
          </AnimatePresence>
          <div className="flex gap-1.5 pb-2" role="tablist" aria-label={pt ? 'Destaques' : 'Highlights'}>
            {SLIDES.map((s, i) => (
              <button key={s.src} type="button" role="tab" aria-selected={i === slide} aria-label={`${i + 1}`} onClick={() => setSlide(i)}
                className="h-1.5 rounded-full transition-all"
                style={{ width: i === slide ? 22 : 6, backgroundColor: i === slide ? 'var(--theme-text)' : 'var(--theme-border)' }} />
            ))}
          </div>
        </div>
      </aside>

      {/* 30%: entrar / criar conta */}
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="flex justify-between items-center lg:justify-end">
          <span className="lg:hidden flex items-center gap-2">
            <span className="grid place-items-center w-7 h-7 rounded-lg text-xs font-bold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>B</span>
            <span className="font-semibold" style={{ color: 'var(--theme-text)' }}>Bookmoo</span>
          </span>
          <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-9 h-9 rounded-lg grid place-items-center transition-colors hover:bg-[var(--ui-hover)]"
            style={{ color: 'var(--theme-text-secondary)' }}
            aria-label={theme === 'dark' ? (pt ? 'Modo claro' : 'Light mode') : (pt ? 'Modo escuro' : 'Dark mode')}>
            {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
        </div>

        <div className="flex-1 grid place-items-center py-8">
          <div className="w-full max-w-[360px]">
            <img src="/illustrations/reading.svg" alt="" className="illo lg:hidden w-44 mx-auto mb-6" />
            <h1 className="text-[28px] font-semibold tracking-tight" style={{ color: 'var(--theme-text)' }}>
              {signup ? (pt ? 'Crie sua conta' : 'Create your account') : (pt ? 'Bem-vindo de volta' : 'Welcome back')}
            </h1>
            <p className="mt-1.5 text-[15px]" style={{ color: 'var(--theme-text-secondary)' }}>
              {signup ? (pt ? 'Comece a aprender lendo seus livros.' : 'Start learning by reading your books.') : t('loginTagline')}
            </p>

            <button type="button" onClick={google} disabled={loading !== null}
              className="mt-7 w-full h-11 rounded-lg border flex items-center justify-center gap-2.5 text-[15px] font-medium transition-colors hover:bg-[var(--ui-hover)] disabled:opacity-60"
              style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text)', backgroundColor: 'var(--theme-bg)' }}>
              <GoogleIcon />
              {loading === 'google' ? (pt ? 'Abrindo o Google…' : 'Opening Google…') : (pt ? 'Continuar com Google' : 'Continue with Google')}
            </button>

            <div className="my-6 flex items-center gap-3 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
              <span className="h-px flex-1" style={{ backgroundColor: 'var(--theme-border)' }} />
              {pt ? 'ou com e-mail' : 'or with email'}
              <span className="h-px flex-1" style={{ backgroundColor: 'var(--theme-border)' }} />
            </div>

            {sentTo ? (
              <div role="status" className="rounded-2xl border p-6 text-center space-y-3" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
                <span className="mx-auto grid size-12 place-items-center rounded-full text-[22px]" style={{ backgroundColor: 'var(--pastel-green-bg)', color: 'var(--pastel-green-fg)' }}>✉</span>
                <h2 className="font-display text-[26px] leading-tight">{pt ? 'Confirme seu e-mail' : 'Confirm your email'}</h2>
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
                  {pt ? <>Conta criada! Enviamos um link de confirmação para <strong style={{ color: 'var(--theme-text)' }}>{sentTo}</strong>. Abra o e-mail, toque em confirmar e volte para entrar.</> : <>Account created! We sent a confirmation link to <strong style={{ color: 'var(--theme-text)' }}>{sentTo}</strong>. Open the email, tap confirm, then come back to sign in.</>}
                </p>
                <p className="text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Não achou? Veja a caixa de spam.' : 'Can’t find it? Check your spam folder.'}</p>
                <div className="flex flex-col gap-2 pt-2">
                  <Link to="/login" className="h-11 grid place-items-center rounded-lg text-[15px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{pt ? 'Ir para o login' : 'Go to sign in'}</Link>
                  <button type="button" disabled={resent} onClick={async () => { const { supabase } = await import('@/lib/supabase'); await supabase?.auth.resend({ type: 'signup', email: sentTo, options: { emailRedirectTo: window.location.origin } }); setResent(true) }}
                    className="h-10 rounded-lg border text-[13.5px] disabled:opacity-60" style={{ borderColor: 'var(--theme-border)' }}>{resent ? (pt ? 'E-mail reenviado' : 'Email sent again') : (pt ? 'Reenviar e-mail' : 'Resend email')}</button>
                </div>
              </div>
            ) : (
            <form onSubmit={submit} className="space-y-3">
              <label className="block">
                <span className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--theme-text)' }}>E-mail</span>
                <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder={pt ? 'voce@email.com' : 'you@email.com'} className={field} />
              </label>
              <label className="block">
                <span className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--theme-text)' }}>{pt ? 'Senha' : 'Password'}</span>
                <span className="relative block">
                  <input type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} required minLength={6}
                    value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className={`${field} pr-10`} />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center rounded-md hover:bg-[var(--ui-hover)]"
                    style={{ color: 'var(--theme-text-secondary)' }} aria-label={showPassword ? (pt ? 'Ocultar senha' : 'Hide password') : (pt ? 'Mostrar senha' : 'Show password')}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </span>
                {!signup && (
                  <Link to="/esqueci-senha" className="mt-1.5 inline-block text-[12.5px] underline underline-offset-2" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Esqueci minha senha' : 'Forgot my password'}</Link>
                )}
              </label>
              {signup && (
                <label className="block">
                  <span className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--theme-text)' }}>{pt ? 'Confirmar senha' : 'Confirm password'}</span>
                  <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={6}
                    value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" className={field} />
                </label>
              )}

              {signup && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--theme-text)' }}>{pt ? 'Seu nome' : 'Your name'}</span>
                    <input type="text" autoComplete="given-name" required value={name} onChange={e => setName(e.target.value)} placeholder={pt ? 'Como quer ser chamado' : 'What we should call you'} className={field} />
                  </label>
                  <label className="block">
                    <span className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--theme-text)' }}>{pt ? 'Data de nascimento' : 'Date of birth'}</span>
                    <input type="date" autoComplete="bday" required value={birthDate} max={new Date().toISOString().slice(0, 10)} onChange={e => setBirthDate(e.target.value)} className={field} />
                  </label>
                  <p className="sm:col-span-2 -mt-1 text-[12px] leading-snug" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Usamos a data só para indicar quais livros são adequados à sua idade. Ela não aparece no seu perfil.' : 'We use the date only to show which books suit your age. It never appears on your profile.'}</p>
                </div>
              )}
              {signup && signupAge !== null && signupAge < 12 && (
                <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>
                  <input type="checkbox" checked={guardianOk} onChange={e => setGuardianOk(e.target.checked)} className="mt-0.5 size-4 shrink-0" />
                  <span>{pt ? 'Sou o responsável legal por esta criança e autorizo o cadastro e o tratamento dos dados conforme a Política de Privacidade.' : 'I am this child’s legal guardian and authorize the sign-up and data processing under the Privacy Policy.'}</span>
                </label>
              )}

              {signup && (
                <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                  <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 shrink-0 accent-[var(--theme-text)]" />
                  <span className="text-[13px] leading-snug" style={{ color: 'var(--theme-text-secondary)' }}>
                    {pt ? 'Li e aceito os ' : 'I have read and accept the '}
                    <Link to="/terms?back=/signup&tab=1" target="_blank" className="underline underline-offset-2" style={{ color: 'var(--theme-text)' }}>{pt ? 'Termos de uso' : 'Terms of use'}</Link>
                    {pt ? ', a ' : ', the '}
                    <Link to="/privacy?back=/signup&tab=1" target="_blank" className="underline underline-offset-2" style={{ color: 'var(--theme-text)' }}>{pt ? 'Política de privacidade' : 'Privacy policy'}</Link>
                    {pt ? ' e o ' : ' and the '}
                    <Link to="/faq?back=/signup&tab=1" target="_blank" className="underline underline-offset-2" style={{ color: 'var(--theme-text)' }}>FAQ</Link>.
                  </span>
                </label>
              )}
              {error && <p role="alert" className="rounded-lg border px-3 py-2.5 text-[13.5px] font-medium" style={{ backgroundColor: 'var(--pastel-rose-bg)', borderColor: 'var(--pastel-rose-bd)', color: 'var(--pastel-rose-fg)' }}>{error}</p>}
              {message && <p role="status" className="rounded-lg border px-3 py-2.5 text-[13.5px]" style={{ backgroundColor: 'var(--pastel-green-bg)', borderColor: 'var(--pastel-green-bd)', color: 'var(--pastel-green-fg)' }}>{message}</p>}

              <button type="submit" disabled={loading !== null}
                className="!mt-5 w-full h-11 rounded-lg text-[15px] font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
                {loading === 'email'
                  ? (signup ? (pt ? 'Criando conta…' : 'Creating account…') : (pt ? 'Entrando…' : 'Signing in…'))
                  : (signup ? (pt ? 'Criar conta' : 'Create account') : (pt ? 'Entrar' : 'Sign in'))}
              </button>
            </form>
            )}

            <p className="mt-6 text-center text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
              {signup ? (pt ? 'Já tem conta?' : 'Already have an account?') : (pt ? 'Ainda não tem conta?' : 'No account yet?')}{' '}
              <Link to={signup ? '/login' : '/signup'} className="font-medium underline underline-offset-4" style={{ color: 'var(--theme-text)' }}>
                {signup ? (pt ? 'Entrar' : 'Sign in') : (pt ? 'Criar conta' : 'Create account')}
              </Link>
            </p>
            {!signup && (
              <p className="mt-3 text-center text-[12px] leading-snug" style={{ color: 'var(--theme-text-secondary)' }}>
                {pt ? 'Ao continuar, você concorda com os ' : 'By continuing, you agree to the '}
                <Link to={`/terms?back=${signup ? '/signup' : '/login'}`} className="underline underline-offset-2">{pt ? 'Termos' : 'Terms'}</Link>
                {pt ? ' e a ' : ' and the '}
                <Link to={`/privacy?back=${signup ? '/signup' : '/login'}`} className="underline underline-offset-2">{pt ? 'Privacidade' : 'Privacy policy'}</Link>.
              </p>
            )}
            <nav className="mt-8 flex justify-center gap-4 text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
              <Link to={`/faq?back=${signup ? '/signup' : '/login'}`} className="hover:underline">FAQ</Link>
              <Link to={`/terms?back=${signup ? '/signup' : '/login'}`} className="hover:underline">{pt ? 'Termos' : 'Terms'}</Link>
              <Link to={`/privacy?back=${signup ? '/signup' : '/login'}`} className="hover:underline">{pt ? 'Privacidade' : 'Privacy'}</Link>
            </nav>
          </div>
        </div>
      </main>
    </div>
  )
}
