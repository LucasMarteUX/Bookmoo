import { ConfirmHost } from '@/components/ui/confirm'
import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { VoiceRequiredDialog } from '@/components/reader/VoiceRequiredDialog'
import { markVoicePromptSeen, subscribeVoicePrompt } from '@/lib/voiceGate'
import { useLanguage } from '@/store/useLanguage'
import { Sidebar } from './Sidebar'
import { GuidedTour } from '@/components/onboarding/GuidedTour'
import { CommandPalette } from './CommandPalette'
import { useReaderSettings } from '@/store/useReaderSettings'
import { useHydrateOnLogin } from '@/hooks/useHydrateOnLogin'
import { useGamification } from '@/hooks/useGamification'
import { useCatalogCoverSync } from '@/hooks/useCatalogCoverSync'
import { useAutoInstallVoices } from '@/hooks/useAutoInstallVoices'
import { MobileVoicePackPrompt } from '@/components/voice/MobileVoicePackPrompt'
import { useIsMobile } from '@/hooks/useIsMobile'
import { SIDEBAR_WIDTH, useUiStore } from '@/store/useUiStore'
import { useReaderChrome } from '@/store/useReaderChrome'
import { TabBar } from '@/components/mobile/TabBar'
import { NavBar } from '@/components/mobile/NavBar'
import { InstallPrompt } from '@/components/mobile/InstallPrompt'
import { OfflineBanner } from '@/components/mobile/OfflineBanner'
import { useEdgeSwipeBack, useScreenTransitions } from '@/components/mobile/useScreenTransitions'
import { Toaster } from '@/components/ui/toast'
import { TooltipLayer } from '@/components/ui/tooltip'
import { TutorDock } from '@/components/reader/ReaderTutor'
import { useTutorDock } from '@/store/useTutorDock'
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
  useCatalogCoverSync()
  useAutoInstallVoices(true)
  const collapsed = useUiStore(state => state.sidebarCollapsed)
  const immersive = useReaderChrome(state => state.immersive)

  const isBookPage = /^\/book\/[^/]+$/.test(location.pathname)
  // Chat com tutor aberto no celular: sem a tab bar (o campo de mensagem fica no rodapé).
  const tutorChatOpen = useTutorDock(s => s.chatOpen)
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
      <MobileVoicePackPrompt pt={pt} />

      <div className="flex flex-1 relative">
        {isMobile ? null : <Sidebar />}

        <main id="main" tabIndex={-1}
          className={`flex-1 min-w-0 overflow-x-clip md:ml-[var(--sidebar-w)] transition-[margin] duration-300 md:px-10 outline-none ${isBookPage ? 'md:pt-0 md:pb-8' : 'md:pt-8 md:pb-12'}`}
          style={isMobile ? {
            // Leitura imersiva: as barras flutuam por cima; o texto começa logo abaixo da área segura.
            paddingTop: immersive ? 'calc(var(--safe-t) + 0.75rem)' : 'calc(var(--safe-t) + var(--navbar-h) + 0.75rem)',
            // No leitor a barra de ferramentas própria fica embaixo; nas outras telas, a tab bar.
            paddingBottom: immersive ? 'calc(var(--safe-b) + 3.5rem)' : isBookPage ? 'calc(var(--safe-b) + 6.5rem)' : tutorChatOpen ? 'calc(var(--safe-b) + 1.5rem)' : 'calc(var(--safe-b) + var(--tabbar-h) + 1.5rem)',
            paddingLeft: 'calc(1rem + var(--safe-l))',
            paddingRight: 'calc(1rem + var(--safe-r))',
          } : undefined}>
          {/* Sem transform permanente aqui: ele viraria o "containing block" dos elementos fixed das páginas. */}
          <div ref={screenRef}>
            <Outlet />
          </div>
        </main>
      </div>

      <GuidedTour />
      <CommandPalette />
      <Toaster />
      <ConfirmHost />
      <TooltipLayer />
      {/* Tutor flutuante: em todas as telas do app (some sozinho na conversa e no teste de nível). */}
      <TutorDock />
      <OfflineBanner />
      <VoiceRequiredDialog open={voicePrompt} pt={pt} onOpenChange={(open) => { if (!open) markVoicePromptSeen(); setVoicePrompt(open) }} />
      {isMobile && !isBookPage && !tutorChatOpen ? <TabBar /> : null}
      {isMobile ? <InstallPrompt /> : null}
    </div>
  )
}
