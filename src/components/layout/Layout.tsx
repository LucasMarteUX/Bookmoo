import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { MobileHeader } from './MobileHeader'
import { useReaderSettings } from '@/store/useReaderSettings'
import { useHydrateOnLogin } from '@/hooks/useHydrateOnLogin'

export function Layout() {
  const { theme } = useReaderSettings()
  const location = useLocation()
  useHydrateOnLogin()

  const isBookPage = /^\/book\/[^/]+$/.test(location.pathname)

  return (
    <div className={`min-h-screen flex flex-col theme-${theme}`}>
      {/* Mobile: top navbar with logo + menu (desktop has no navbar) */}
      <div className="md:hidden">
        <MobileHeader />
      </div>

      <div className="flex flex-1 relative">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        
        <main className={`flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto ${isBookPage ? 'pt-14 md:pt-0 pb-28 md:pb-8' : 'pb-24 md:pb-8'}`}>
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
