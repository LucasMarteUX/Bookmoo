import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { hasSupabase, session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--theme-bg)' }}>
        <p style={{ color: 'var(--theme-text-secondary)' }}>Carregando...</p>
      </div>
    )
  }

  if (hasSupabase && !session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
