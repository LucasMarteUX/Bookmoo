import { useEffect } from 'react'
import { isMobileDevice } from '@/lib/deviceVoice'
import { KOKORO_INSTALL_FAILED, downloadKokoroVoice, getKokoroState, isKokoroSupported } from '@/lib/kokoro/engine'

/** Uma voz feminina e uma masculina já vêm instaladas: baixam sozinhas em segundo plano, sem clique. */
export const DEFAULT_VOICES = ['af_heart', 'am_michael']

export function useAutoInstallVoices(enabled: boolean) {
  useEffect(() => {
    // Celular: nada baixa sozinho; o aviso do pacote de voz (MobileVoicePackPrompt) pergunta antes.
    if (!enabled || !isKokoroSupported() || isMobileDevice()) return
    const nav = navigator as Navigator & { connection?: { saveData?: boolean; type?: string; effectiveType?: string } }
    // Respeita economia de dados e redes muito lentas; em dados móveis, baixa mesmo assim só a leve (decisão do motor).
    if (nav.connection?.saveData || /(^|-)2g$/.test(nav.connection?.effectiveType ?? '')) return
    let cancelled = false
    const run = async () => {
      for (const id of DEFAULT_VOICES) {
        if (cancelled) return
        const st = getKokoroState()
        if (st.modelReady && st.voices.includes(id)) continue
        try { await downloadKokoroVoice(id) } catch { window.dispatchEvent(new Event(KOKORO_INSTALL_FAILED)); return /* tenta de novo na próxima visita */ }
      }
    }
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    const t = idle ? idle(() => { void run() }, { timeout: 8000 }) : window.setTimeout(() => { void run() }, 4000)
    return () => { cancelled = true; if (!idle) window.clearTimeout(t) }
  }, [enabled])
}
