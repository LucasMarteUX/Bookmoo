import { Link, useLocation } from 'react-router-dom'
import { Home, Settings, BarChart2, BookMarked } from 'lucide-react'
import { useLanguage } from '@/store/useLanguage'
import { useTranslations } from '@/lib/i18n'

export function BottomNav() {
  const location = useLocation()
  const { locale } = useLanguage()
  const { t } = useTranslations(locale)

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1rem)] max-w-[400px]">
      <div 
        className="rounded-[24px] px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between transition-colors duration-300 min-h-[56px] sm:min-h-[72px] gap-2"
        style={{ backgroundColor: 'var(--theme-nav-bg)', border: '1px solid var(--theme-border)' }}
      >
        <Link to="/" className="flex flex-col items-center min-w-[44px] min-h-[44px] justify-center gap-0.5">
          <div 
            className="p-2 rounded-full transition-colors"
            style={{
              backgroundColor: location.pathname === '/' ? 'var(--theme-nav-active)' : 'transparent',
              color: location.pathname === '/' ? 'var(--theme-nav-text)' : 'var(--theme-nav-text-muted)'
            }}
          >
            <Home className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-medium uppercase tracking-tighter" style={{ color: location.pathname === '/' ? 'var(--theme-nav-text)' : 'var(--theme-nav-text-muted)' }}>{t('home')}</span>
        </Link>
        
        <Link to="/vocabulary" className="flex flex-col items-center min-w-[44px] min-h-[44px] justify-center gap-0.5">
          <div 
            className="p-2 rounded-full transition-colors"
            style={{
              backgroundColor: location.pathname === '/vocabulary' ? 'var(--theme-nav-active)' : 'transparent',
              color: location.pathname === '/vocabulary' ? 'var(--theme-nav-text)' : 'var(--theme-nav-text-muted)'
            }}
          >
            <BookMarked className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-medium uppercase tracking-tighter" style={{ color: location.pathname === '/vocabulary' ? 'var(--theme-nav-text)' : 'var(--theme-nav-text-muted)' }}>{t('vocabulary')}</span>
        </Link>

        <Link to="/stats" className="flex flex-col items-center min-w-[44px] min-h-[44px] justify-center gap-0.5">
          <div 
            className="p-2 rounded-full transition-colors"
            style={{
              backgroundColor: location.pathname === '/stats' ? 'var(--theme-nav-active)' : 'transparent',
              color: location.pathname === '/stats' ? 'var(--theme-nav-text)' : 'var(--theme-nav-text-muted)'
            }}
          >
            <BarChart2 className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-medium uppercase tracking-tighter" style={{ color: location.pathname === '/stats' ? 'var(--theme-nav-text)' : 'var(--theme-nav-text-muted)' }}>{t('stats')}</span>
        </Link>

        <Link to="/settings" className="flex flex-col items-center min-w-[44px] min-h-[44px] justify-center gap-0.5">
          <div 
            className="p-2 rounded-full transition-colors"
            style={{
              backgroundColor: location.pathname === '/settings' ? 'var(--theme-nav-active)' : 'transparent',
              color: location.pathname === '/settings' ? 'var(--theme-nav-text)' : 'var(--theme-nav-text-muted)'
            }}
          >
            <Settings className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-medium uppercase tracking-tighter" style={{ color: location.pathname === '/settings' ? 'var(--theme-nav-text)' : 'var(--theme-nav-text-muted)' }}>{t('settings')}</span>
        </Link>
      </div>
    </div>
  )
}
