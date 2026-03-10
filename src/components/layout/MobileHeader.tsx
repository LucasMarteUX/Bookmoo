import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sidebar } from './Sidebar'

export function MobileHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <header 
        className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-14 transition-colors duration-300"
        style={{ backgroundColor: 'var(--theme-nav-bg)', borderBottom: '1px solid var(--theme-border)' }}
      >
        <Link to="/" className="flex items-center" onClick={() => setMenuOpen(false)}>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--theme-nav-text)' }}>Bookmoo</h1>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-xl"
          style={{ color: 'var(--theme-nav-text)' }}
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu className="w-6 h-6" />
        </Button>
      </header>

      {/* Overlay + drawer */}
      {menuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40"
          aria-hidden
        >
          <div 
            className="absolute inset-0 bg-black/40 transition-opacity"
            onClick={() => setMenuOpen(false)}
          />
          <div 
            className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] border-r flex flex-col overflow-hidden"
            style={{ backgroundColor: 'var(--theme-nav-bg)' }}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--theme-border)' }}>
              <span className="text-lg font-bold" style={{ color: 'var(--theme-nav-text)' }}>Bookmoo</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl"
                style={{ color: 'var(--theme-nav-text)' }}
                onClick={() => setMenuOpen(false)}
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto py-4">
              <Sidebar isMobileDrawer onClose={() => setMenuOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
