import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, Search } from 'lucide-react'
import { useLanguage } from '@/store/useLanguage'
import { useUiStore } from '@/store/useUiStore'
import { haptics } from '@/lib/haptics'
import { isTabRoot, parentOf, screenTitle } from './routes'

export function goBack(navigate: ReturnType<typeof useNavigate>, path: string) {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
  if (idx > 0) navigate(-1)
  else navigate(parentOf(path), { replace: true })
}

/**
 * Barra superior do iOS. Nas telas-raiz o título grande é o <h1> da própria página;
 * a barra só mostra o título pequeno depois que ele sai da tela (efeito "large title").
 * Nas telas empilhadas mostra "‹ Voltar" e o título sempre.
 */
export function NavBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const pt = useLanguage().locale === 'pt-BR'
  const setCommandOpen = useUiStore(s => s.setCommandOpen)
  const root = isTabRoot(pathname)
  const title = screenTitle(pathname, pt)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 44)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [pathname])

  const showTitle = !root || scrolled
  const btn = 'pressable min-w-[var(--hit)] h-[var(--hit)] grid place-items-center rounded-full'

  return (
    <header className="ios-bar fixed top-0 inset-x-0 z-40 transition-[border-color] duration-200"
      style={{ paddingTop: 'var(--safe-t)', paddingLeft: 'var(--safe-l)', paddingRight: 'var(--safe-r)', borderBottom: `1px solid ${scrolled || !root ? 'var(--theme-border)' : 'transparent'}` }}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-1.5" style={{ height: 'var(--navbar-h)' }}>
        <div className="flex items-center">
          {root ? null : (
            <button type="button" onClick={() => { haptics.selection(); goBack(navigate, pathname) }}
              className="pressable h-[var(--hit)] flex items-center pr-2 text-[17px]" style={{ color: 'var(--theme-accent, var(--theme-text))' }}
              aria-label={pt ? 'Voltar' : 'Back'}>
              <ChevronLeft className="w-7 h-7 -mr-0.5" strokeWidth={2.2} aria-hidden />
              <span className="max-[359px]:sr-only">{pt ? 'Voltar' : 'Back'}</span>
            </button>
          )}
        </div>
        <h2 className="text-[17px] font-semibold tracking-tight truncate max-w-[56vw] transition-opacity duration-200"
          style={{ color: 'var(--theme-text)', opacity: showTitle ? 1 : 0 }} aria-hidden={!showTitle}>
          {title}
        </h2>
        <div className="flex items-center justify-end">
          <button type="button" className={btn} style={{ color: 'var(--theme-text)' }} onClick={() => setCommandOpen(true)} aria-label={pt ? 'Buscar' : 'Search'}>
            <Search className="w-[22px] h-[22px]" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  )
}
