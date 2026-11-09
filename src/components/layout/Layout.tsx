import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { MobileHeader } from './MobileHeader'
import { useReaderSettings } from '@/store/useReaderSettings'
import { useHydrateOnLogin } from '@/hooks/useHydrateOnLogin'
import { useGamification } from '@/hooks/useGamification'
import { SIDEBAR_WIDTH, useUiStore } from '@/store/useUiStore'
import type { CSSProperties } from 'react'

export function Layout() {
  const { theme } = useReaderSettings()
  const location = useLocation()
  useHydrateOnLogin()
  useGamification()
  const collapsed = useUiStore(state => state.sidebarCollapsed)

  const isBookPage = /^\/book\/[^/]+$/.test(location.pathname)

  return (
    <div className={`min-h-screen flex flex-col theme-${theme}`}
      style={{ '--sidebar-w': collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded } as CSSProperties}>
      {/* Mobile: top navbar with logo + menu (desktop has no navbar) */}
      <div className="md:hidden">
        <MobileHeader />
      </div>

      <div className="flex flex-1 relative">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        
        <main className={`flex-1 md:ml-[var(--sidebar-w)] transition-[margin] duration-300 p-4 md:p-8 overflow-y-auto ${isBookPage ? 'pt-14 md:pt-0 pb-28 md:pb-8' : 'pb-24 md:pb-8'}`}>
          <Outlet />
        </main>
      </div>
      
      {/* Mobile Bottom Nav: hide on book page so reading toolbar is the only bottom control */}
      {!isBookPage && (
        <div className="md:hidden">
          <BottomNav />
        </div>
      )}
    </div>
  )
}
