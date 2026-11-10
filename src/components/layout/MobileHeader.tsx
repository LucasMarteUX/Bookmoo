import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, Search, X } from 'lucide-react'
import { useUiStore } from '@/store/useUiStore'
import { useLanguage } from '@/store/useLanguage'
import { Sidebar } from './Sidebar'

export function MobileHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const setCommandOpen = useUiStore(s => s.setCommandOpen)
  const pt = useLanguage().locale === 'pt-BR'
  const iconBtn = 'w-9 h-9 rounded-lg grid place-items-center transition-colors hover:bg-[var(--theme-nav-hover)]'

  return (
    <>
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-3 h-14 backdrop-blur-md transition-colors duration-300"
        style={{ backgroundColor: 'color-mix(in srgb, var(--theme-nav-bg) 88%, transparent)', borderBottom: '1px solid var(--theme-border)' }}>
        <button type="button" className={iconBtn} style={{ color: 'var(--theme-nav-text)' }} onClick={() => setMenuOpen(true)} aria-label={pt ? 'Abrir menu' : 'Open menu'}>
          <Menu className="w-5 h-5" />
        </button>
        <Link to="/" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
          <span className="grid place-items-center w-6 h-6 rounded-md text-[13px] font-semibold font-display" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>B</span>
          <span className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--theme-nav-text)' }}>Bookmoo</span>
        </Link>
        <button type="button" className={iconBtn} style={{ color: 'var(--theme-nav-text)' }} onClick={() => setCommandOpen(true)} aria-label={pt ? 'Buscar' : 'Search'}>
          <Search className="w-5 h-5" />
        </button>
      </header>

      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] dialog-fade" onClick={() => setMenuOpen(false)} />
          <div className="drawer-in absolute left-0 top-0 bottom-0 w-[18rem] max-w-[85vw] flex flex-col overflow-hidden border-r"
            style={{ backgroundColor: 'var(--theme-nav-bg)', borderColor: 'var(--theme-border)' }}>
            <div className="flex items-center justify-between px-4 h-14 border-b" style={{ borderColor: 'var(--theme-border)' }}>
              <span className="flex items-center gap-2">
                <span className="grid place-items-center w-6 h-6 rounded-md text-[13px] font-semibold font-display" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>B</span>
                <span className="text-[15px] font-semibold" style={{ color: 'var(--theme-nav-text)' }}>Bookmoo</span>
              </span>
              <button type="button" className={iconBtn} style={{ color: 'var(--theme-nav-text)' }} onClick={() => setMenuOpen(false)} aria-label={pt ? 'Fechar menu' : 'Close menu'}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Sidebar isMobileDrawer onClose={() => setMenuOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
