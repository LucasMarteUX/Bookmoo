import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/store/useLanguage'
import { adminOverview } from '@/lib/catalog'
import { AdminGalleryForm } from './Gallery'

export function AdminPage() {
  const { isAdmin, loading } = useAuth()
  const { locale } = useLanguage()
  const pt = locale === 'pt-BR'
  const [stats, setStats] = useState<{ users: number; readers_today: number; books: number; catalog: number } | null>(null)

  useEffect(() => {
    if (isAdmin) void adminOverview().then(setStats)
  }, [isAdmin])

  if (loading) return null
  if (!isAdmin) return <Navigate to="/" replace />

  const cards = [
    { label: pt ? 'Pessoas' : 'People', value: stats?.users },
    { label: pt ? 'Leram hoje' : 'Read today', value: stats?.readers_today },
    { label: pt ? 'Livros nas estantes' : 'Books on shelves', value: stats?.books },
    { label: pt ? 'Na galeria' : 'In the gallery', value: stats?.catalog },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header>
        <h1 className="font-display text-[34px] leading-none">{pt ? 'Área admin' : 'Admin'}</h1>
        <p className="mt-2 text-[14.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? 'Quem está lendo e os livros gratuitos da galeria.' : 'Who is reading, and the free books in the gallery.'}
        </p>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map(card => (
          <div key={card.label} className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-pastel-4)' }}>
            <p className="text-[12px]" style={{ color: 'var(--theme-text-secondary)' }}>{card.label}</p>
            <p className="mt-1 font-display text-[28px] leading-none">{card.value ?? '–'}</p>
          </div>
        ))}
      </div>
      <AdminGalleryForm pt={pt} />
    </div>
  )
}
