import { Link, useLocation } from 'react-router-dom'
import { Home, BarChart2, BookMarked, LogOut, Sun, Moon, Coffee, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useReaderSettings, Theme } from '@/store/useReaderSettings'
import { useLanguage, Locale } from '@/store/useLanguage'
import { useTranslations } from '@/lib/i18n'
import { StudyTimer } from '@/components/timer/StudyTimer'
import { useAuth } from '@/contexts/AuthContext'

interface SidebarProps {
  isMobileDrawer?: boolean
  onClose?: () => void
}

export function Sidebar({ isMobileDrawer, onClose }: SidebarProps) {
  const location = useLocation()
  const { theme, setTheme } = useReaderSettings()
  const { locale, setLocale } = useLanguage()
  const { t } = useTranslations(locale)
  const { hasSupabase, user, signOut } = useAuth()

  const themes: { id: Theme; icon: any; label: string }[] = [
    { id: 'light', icon: Sun, label: t('day') },
    { id: 'sepia', icon: Coffee, label: t('afternoon') },
    { id: 'dark', icon: Moon, label: t('night') }
  ]

  const locales: { id: Locale; label: string }[] = [
    { id: 'en', label: 'EN' },
    { id: 'pt-BR', label: 'PT-BR' }
  ]

  const linkProps = (to: string) => ({
    to,
    onClick: onClose
  })

  const Wrapper = isMobileDrawer ? 'div' : 'aside'
  const wrapperClassName = isMobileDrawer
    ? 'w-full flex flex-col py-6 px-4 gap-6'
    : 'w-64 flex flex-col py-8 px-4 gap-8 z-20 fixed left-0 top-0 bottom-0 rounded-r-[24px] transition-colors duration-300'
  const wrapperStyle = { backgroundColor: 'var(--theme-nav-bg)', color: 'var(--theme-nav-text)', borderRight: isMobileDrawer ? undefined : '1px solid var(--theme-border)' }

  return (
    <Wrapper className={wrapperClassName} style={wrapperStyle}>
      {!isMobileDrawer && (
        <div className="px-4 mb-4 flex flex-col gap-6">
          <Link to="/" className="flex items-center gap-2 group">
            <h1 className="text-2xl font-bold tracking-tight">Bookmoo</h1>
          </Link>
        </div>
      )}

      <div className="flex-1 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
        <div>
          <nav className="flex flex-col gap-1">
            <Link {...linkProps('/')}>
              <Button 
                variant="ghost" 
                className="w-full justify-start rounded-[12px] px-4 py-5 transition-all"
                style={{
                  backgroundColor: location.pathname === '/' ? 'var(--theme-nav-active)' : 'transparent',
                  color: location.pathname === '/' ? 'var(--theme-nav-text)' : 'var(--theme-nav-text-muted)'
                }}
              >
                <Home className="w-5 h-5 mr-3" />
                {t('home')}
              </Button>
            </Link>
            <Link {...linkProps('/vocabulary')}>
              <Button 
                variant="ghost" 
                className="w-full justify-start rounded-[12px] px-4 py-5 transition-all"
                style={{
                  backgroundColor: location.pathname === '/vocabulary' ? 'var(--theme-nav-active)' : 'transparent',
                  color: location.pathname === '/vocabulary' ? 'var(--theme-nav-text)' : 'var(--theme-nav-text-muted)'
                }}
              >
                <BookMarked className="w-5 h-5 mr-3" />
                {t('vocabulary')}
              </Button>
            </Link>
            <Link {...linkProps('/stats')}>
              <Button 
                variant="ghost" 
                className="w-full justify-start rounded-[12px] px-4 py-5 transition-all"
                style={{
                  backgroundColor: location.pathname === '/stats' ? 'var(--theme-nav-active)' : 'transparent',
                  color: location.pathname === '/stats' ? 'var(--theme-nav-text)' : 'var(--theme-nav-text-muted)'
                }}
              >
                <BarChart2 className="w-5 h-5 mr-3" />
                {t('stats')}
              </Button>
            </Link>
          </nav>
        </div>

        <div className="px-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--theme-nav-text-muted)' }}>{t('appearance')}</p>
          <div className="flex p-1 rounded-[12px] transition-colors" style={{ backgroundColor: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)' }}>
            {themes.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`flex-1 flex items-center justify-center py-2 rounded-lg transition-all ${
                    theme === t.id ? '' : 'opacity-50 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: theme === t.id ? 'var(--theme-bg)' : 'transparent',
                    color: theme === t.id ? 'var(--theme-accent)' : 'var(--theme-text-secondary)'
                  }}
                  title={t.label}
                >
                  <Icon className="w-4 h-4" />
                </button>
              )
            })}
          </div>
        </div>

        <div className="px-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--theme-nav-text-muted)' }}>{t('language')}</p>
          <div className="flex p-1 rounded-[12px] transition-colors" style={{ backgroundColor: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)' }}>
            {locales.map((loc) => (
              <button
                key={loc.id}
                onClick={() => setLocale(loc.id)}
                className={`flex-1 flex items-center justify-center py-2 rounded-lg transition-all text-sm font-medium ${
                  locale === loc.id ? '' : 'opacity-50 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: locale === loc.id ? 'var(--theme-bg)' : 'transparent',
                  color: locale === loc.id ? 'var(--theme-accent)' : 'var(--theme-text-secondary)'
                }}
                title={loc.id === 'en' ? 'English' : 'Português (Brasil)'}
              >
                {loc.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4">
          <StudyTimer />
        </div>
      </div>

      <div className="mt-auto pt-4 border-t" style={{ borderColor: 'var(--theme-border)' }}>
        {hasSupabase && user && (
          <p className="px-4 py-2 text-xs truncate" style={{ color: 'var(--theme-nav-text-muted)' }} title={user.email ?? ''}>
            {user.email}
          </p>
        )}
        <nav className="flex flex-col gap-1">
          <Link {...linkProps('/settings')}>
            <Button 
              variant="ghost" 
              className="w-full justify-start rounded-[12px] px-4 py-5 transition-all hover:bg-[var(--theme-nav-hover)] hover:text-[var(--theme-nav-text)]"
              style={{ 
                color: 'var(--theme-nav-text-muted)',
                backgroundColor: location.pathname === '/settings' ? 'var(--theme-nav-active)' : 'transparent'
              }}
            >
              <Settings className="w-5 h-5 mr-3" />
              {t('settings')}
            </Button>
          </Link>
          <Button 
            variant="ghost" 
            className="w-full justify-start rounded-[12px] px-4 py-5 transition-all hover:bg-[var(--theme-nav-hover)] hover:text-[var(--theme-nav-text)]"
            style={{ color: 'var(--theme-nav-text-muted)' }}
            onClick={() => { onClose?.(); signOut() }}
          >
            <LogOut className="w-5 h-5 mr-3" />
            {t('logout')}
          </Button>
        </nav>
      </div>
    </Wrapper>
  )
}
