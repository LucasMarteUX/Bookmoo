import { Capacitor } from '@capacitor/core'
import { useReaderSettings } from '@/store/useReaderSettings'

export const isNative = () => Capacitor.isNativePlatform()

/**
 * Integra o app empacotado (Capacitor/iOS): barra de status por tema, teclado, splash,
 * deep links (bookmoo://… e Universal Links) e retomada da sessão. No navegador não faz nada.
 */
export async function setupNative() {
  if (!isNative()) return
  document.documentElement.classList.add('native')
  const [{ StatusBar, Style }, { Keyboard, KeyboardResize }, { SplashScreen }, { App }] = await Promise.all([
    import('@capacitor/status-bar'),
    import('@capacitor/keyboard'),
    import('@capacitor/splash-screen'),
    import('@capacitor/app'),
  ])

  const applyTheme = (theme: string) => {
    void StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light }).catch(() => {})
  }
  applyTheme(useReaderSettings.getState().theme)
  useReaderSettings.subscribe(s => applyTheme(s.theme))
  void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})

  // O teclado encolhe o conteúdo (como um app nativo), e a barra "Concluído" aparece só onde ajuda.
  void Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => {})
  void Keyboard.setAccessoryBarVisible({ isVisible: true }).catch(() => {})

  // Deep link: bookmoo://book/123 ou https://bookmoo.app/book/123 → abre a rota.
  void App.addListener('appUrlOpen', ({ url }) => {
    try {
      const u = new URL(url)
      const path = u.protocol === 'bookmoo:' ? `/${u.host}${u.pathname}` : u.pathname
      if (path && path !== window.location.pathname) {
        window.history.pushState({ idx: (window.history.state?.idx ?? 0) + 1 }, '', path + u.search)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }
    } catch { /* URL inválida */ }
  })

  setTimeout(() => { void SplashScreen.hide({ fadeOutDuration: 250 }) }, 150)
}

/** Compartilhar nativo (Capacitor → folha do iOS; web → navigator.share; fallback copia o link). */
export async function shareContent(data: { title?: string; text?: string; url?: string }): Promise<'shared' | 'copied' | 'cancelled'> {
  try {
    if (isNative()) {
      const { Share } = await import('@capacitor/share')
      await Share.share({ ...data, dialogTitle: data.title })
      return 'shared'
    }
    if (navigator.share) { await navigator.share(data); return 'shared' }
    if (data.url) { await navigator.clipboard.writeText(data.url); return 'copied' }
  } catch { return 'cancelled' }
  return 'cancelled'
}
