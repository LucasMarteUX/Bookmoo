import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/store/useLanguage'
import { useTranslations } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function Login() {
  const { signIn, session, loading: authLoading } = useAuth()
  const { locale } = useLanguage()
  const { t } = useTranslations(locale)
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!authLoading && session) navigate('/', { replace: true })
  }, [authLoading, session, navigate])

  const getLoginErrorMessage = (err: Error): string => {
    const msg = (err?.message ?? '').toLowerCase()
    const code = (err as { code?: string })?.code
    if (code === 'invalid_credentials' || msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) return t('loginErrorInvalidCredentials')
    if (code === 'email_not_confirmed' || msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) return t('loginErrorEmailNotConfirmed')
    return err?.message || t('loginErrorGeneric')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const normalizedEmail = email.trim().toLowerCase()
    const { error } = await signIn(normalizedEmail, password)
    setLoading(false)
    if (error) {
      setError(getLoginErrorMessage(error))
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--theme-bg)' }}>
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--theme-text)' }}>Bookmoo</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{t('loginTagline')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="rounded-xl pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-offset-0"
                style={{ color: 'var(--theme-text-secondary)' }}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <Button
            type="submit"
            className="w-full rounded-xl h-12"
            style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
        <p className="text-center text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
          Não tem conta?{' '}
          <Link to="/signup" className="font-medium underline" style={{ color: 'var(--theme-primary)' }}>
            Cadastrar
          </Link>
        </p>
      </div>
    </div>
  )
}
