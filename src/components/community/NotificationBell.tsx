import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { unreadNotifications } from '@/lib/social'
import { cn } from '@/lib/utils'

/** Não lidas: busca ao abrir, a cada minuto, ao voltar para a aba e quando uma tela avisa (evento). */
export function useUnreadNotifications() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!user) return
    let alive = true
    const refresh = () => { void unreadNotifications(user.id).then(next => { if (alive) setCount(next) }) }
    refresh()
    const timer = window.setInterval(refresh, 60_000)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('bookmoo:notifications', refresh)
    return () => {
      alive = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('bookmoo:notifications', refresh)
    }
  }, [user, pathname === '/notifications'])
  return count
}

export function NotificationBell({ pt, className, onNavigate, label = false }: { pt: boolean; className?: string; onNavigate?: () => void; label?: boolean }) {
  const count = useUnreadNotifications()
  const text = pt ? 'Notificações' : 'Notifications'
  return (
    <Link to="/notifications" onClick={onNavigate} aria-label={count ? `${text}, ${count} ${pt ? 'novas' : 'new'}` : text} title={text}
      className={cn('relative inline-flex items-center gap-2.5', className)}>
      <span className="relative inline-grid place-items-center">
        <Bell className="w-[18px] h-[18px]" aria-hidden />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 grid place-items-center rounded-full text-[10px] font-semibold tabular-nums"
            style={{ backgroundColor: 'var(--color-destructive)', color: '#fff' }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </span>
      {label && <span>{text}</span>}
    </Link>
  )
}
