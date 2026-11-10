import { Link, useLocation } from 'react-router-dom'
import { AudioLines, BookMarked, ChartNoAxesColumn, House, PenLine, Shield } from 'lucide-react'
import { useLanguage } from '@/store/useLanguage'
import { useTranslations } from '@/lib/i18n'
import { useAuth } from '@/contexts/AuthContext'

/** Barra inferior do celular: as cinco áreas principais, com ícone e rótulo. */
export function BottomNav() {
  const location = useLocation()
  const { locale } = useLanguage()
  const { t } = useTranslations(locale)
  const pt = locale === 'pt-BR'
  const { isAdmin } = useAuth()
  const items = [
    { to: '/', icon: House, label: pt ? 'Início' : 'Home', active: location.pathname === '/' },
    { to: '/vocabulary', icon: BookMarked, label: pt ? 'Palavras' : 'Words', active: location.pathname.startsWith('/vocabulary') },
    { to: '/practice/speak', icon: AudioLines, label: pt ? 'Falar' : 'Speak', active: location.pathname.startsWith('/practice/speak') },
    { to: '/practice/write', icon: PenLine, label: pt ? 'Ditado' : 'Dictation', active: location.pathname.startsWith('/practice/write') },
    { to: '/stats', icon: ChartNoAxesColumn, label: t('stats'), active: location.pathname.startsWith('/stats') },
    ...(isAdmin ? [{ to: '/admin', icon: Shield, label: pt ? 'Admin' : 'Admin', active: location.pathname.startsWith('/admin') }] : []),
  ]

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      style={{ backgroundColor: 'color-mix(in srgb, var(--theme-nav-bg) 90%, transparent)', borderColor: 'var(--theme-border)' }}>
      <div className={`mx-auto max-w-md grid h-16 ${items.length > 5 ? 'grid-cols-6' : 'grid-cols-5'}`}>
        {items.map(({ to, icon: Icon, label, active }) => (
          <Link key={to} to={to} aria-current={active ? 'page' : undefined}
            className="flex flex-col items-center justify-center gap-1 text-[10.5px] font-medium transition-colors"
            style={{ color: active ? 'var(--theme-nav-text)' : 'var(--theme-nav-text-muted)' }}>
            <span className="grid place-items-center w-10 h-7 rounded-full transition-colors" style={{ backgroundColor: active ? 'var(--theme-nav-active)' : 'transparent' }}>
              <Icon className="w-[18px] h-[18px]" strokeWidth={active ? 2.2 : 1.8} />
            </span>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
