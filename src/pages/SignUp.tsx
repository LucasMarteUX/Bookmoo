import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function SignUp() {
  const { signUp, session, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!authLoading && session) navigate('/', { replace: true })
  }, [authLoading, session, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    const normalizedEmail = email.trim().toLowerCase()
    const { error } = await signUp(normalizedEmail, password)
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setMessage('Conta criada. Confirme seu e-mail se necessário e faça login.')
    setTimeout(() => navigate('/login', { replace: true }), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--theme-bg)' }}>
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--theme-text)' }}>Bookmoo</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--theme-text-secondary)' }}>Crie sua conta</p>
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
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="rounded-xl"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-600">{message}</p>}
          <Button
            type="submit"
            className="w-full rounded-xl h-12"
            style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
            disabled={loading}
          >
            {loading ? 'Criando...' : 'Cadastrar'}
          </Button>
        </form>
        <p className="text-center text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
          Já tem conta?{' '}
          <Link to="/login" className="font-medium underline" style={{ color: 'var(--theme-primary)' }}>
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
