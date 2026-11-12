import { ConfirmHost } from '@/components/ui/confirm'
import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { VoiceRequiredDialog } from '@/components/reader/VoiceRequiredDialog'
import { markVoicePromptSeen, subscribeVoicePrompt } from '@/lib/voiceGate'
import { useLanguage } from '@/store/useLanguage'
import { Sidebar } from './Sidebar'
import { CommandPalette } from './CommandPalette'
import { useReaderSettings } from '@/store/useReaderSettings'
import { useHydrateOnLogin } from '@/hooks/useHydrateOnLogin'
import { useGamification } from '@/hooks/useGamification'
import { useIsMobile } from '@/hooks/useIsMobile'
import { SIDEBAR_WIDTH, useUiStore } from '@/store/useUiStore'
import { TabBar } from '@/components/mobile/TabBar'
import { NavBar } from '@/components/mobile/NavBar'
import { InstallPrompt } from '@/components/mobile/InstallPrompt'
import { OfflineBanner } from '@/components/mobile/OfflineBanner'
import { useEdgeSwipeBack, useScreenTransitions } from '@/components/mobile/useScreenTransitions'
import { Toaster } from '@/components/ui/toast'
import { TooltipLayer } from '@/components/ui/tooltip'
import type { CSSProperties } from 'react'

export function Layout() {
  const { theme } = useReaderSettings()
  const { locale } = useLanguage()
  const pt = locale === 'pt-BR'
  const [voicePrompt, setVoicePrompt] = useState(false)
  const location = useLocation()
  const isMobile = useIsMobile()
  const screenRef = useRef<HTMLDivElement>(null)
  useEffect(() => subscribeVoicePrompt(() => setVoicePrompt(true)), [])
  useHydrateOnLogin()
  useGamification()
  const collapsed = useUiStore(state => state.sidebarCollapsed)

  const isBookPage = /^\/book\/[^/]+$/.test(location.pathname)
  useScreenTransitions(screenRef)
  // No leitor o gesto de borda compete com virar página/arrastar balões.
  useEdgeSwipeBack(screenRef, isMobile && !isBookPage)

  return (
    <div className={`min-h-dvh flex flex-col theme-${theme}`}
      style={{ '--sidebar-w': collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded } as CSSProperties}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg"
        style={{ backgroundColor: 'var(--theme-card-bg)', color: 'var(--theme-text)' }}>
        {pt ? 'Ir para o conteúdo' : 'Skip to content'}
      </a>
      {isMobile ? <NavBar /> : null}

      <div className="flex flex-1 relative">
        {isMobile ? null : <Sidebar />}

        <main id="main" tabIndex={-1}
          className={`flex-1 min-w-0 overflow-x-clip md:ml-[var(--sidebar-w)] transition-[margin] duration-300 md:px-10 outline-none ${isBookPage ? 'md:pt-0 md:pb-8' : 'md:pt-8 md:pb-12'}`}
          style={isMobile ? {
            paddingTop: 'calc(var(--safe-t) + var(--navbar-h) + 0.75rem)',
            // No leitor a barra de ferramentas própria fica embaixo; nas outras telas, a tab bar.
            paddingBottom: isBookPage ? 'calc(var(--safe-b) + 6.5rem)' : 'calc(var(--safe-b) + var(--tabbar-h) + 1.5rem)',
            paddingLeft: 'calc(1rem + var(--safe-l))',
            paddingRight: 'calc(1rem + var(--safe-r))',
          } : undefined}>
          {/* Sem transform permanente aqui: ele viraria o "containing block" dos elementos fixed das páginas. */}
          <div ref={screenRef}>
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette />
      <Toaster />
      <ConfirmHost />
      <TooltipLayer />
      <OfflineBanner />
      <VoiceRequiredDialog open={voicePrompt} pt={pt} onOpenChange={(open) => { if (!open) markVoicePromptSeen(); setVoicePrompt(open) }} />
      {isMobile && !isBookPage ? <TabBar /> : null}
      {isMobile ? <InstallPrompt /> : null}
    </div>
  )
}
