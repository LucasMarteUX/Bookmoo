import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

/**
 * Haptics em um lugar só.
 * - App nativo (Capacitor): Taptic Engine.
 * - Web: navigator.vibrate quando existe (Android); no Safari é no-op silencioso.
 * Respeita "Reduzir movimento" do sistema.
 */
type Impact = 'light' | 'medium' | 'heavy'
type Notice = 'success' | 'warning' | 'error'

const native = () => Capacitor.isNativePlatform()

function reduced() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function vibrate(pattern: number | number[]) {
  if (reduced()) return
  try { navigator.vibrate?.(pattern) } catch { /* sem suporte */ }
}

export const haptics = {
  /** Troca de aba, seleção em segmented control, scrubber. */
  selection() {
    if (native()) { void Haptics.selectionStart().then(() => Haptics.selectionChanged()).then(() => Haptics.selectionEnd()).catch(() => {}); return }
    vibrate(8)
  },
  impact(style: Impact = 'light') {
    if (native()) { void Haptics.impact({ style: style === 'heavy' ? ImpactStyle.Heavy : style === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {}); return }
    vibrate(style === 'heavy' ? 30 : style === 'medium' ? 18 : 10)
  },
  notify(type: Notice = 'success') {
    if (native()) {
      void Haptics.notification({ type: type === 'error' ? NotificationType.Error : type === 'warning' ? NotificationType.Warning : NotificationType.Success }).catch(() => {})
      return
    }
    vibrate(type === 'error' ? [20, 60, 20, 60, 30] : type === 'warning' ? [20, 80, 20] : [12, 50, 18])
  },
}
