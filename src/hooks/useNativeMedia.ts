import { useEffect, useRef } from 'react'

/**
 * Mantém a tela acesa enquanto `active` (leitura). O iOS solta o lock quando o app vai para o fundo,
 * então pedimos de novo ao voltar.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
    if (!active || !wl) return
    let sentinel: { release: () => Promise<void> } | null = null
    let cancelled = false
    const acquire = () => {
      if (document.visibilityState !== 'visible') return
      wl.request('screen').then(s => { if (cancelled) void s.release(); else sentinel = s }).catch(() => {})
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', acquire)
      void sentinel?.release().catch(() => {})
    }
  }, [active])
}

/**
 * Controles da tela de bloqueio / Central de Controle / fones (Media Session).
 * Mostra capa e título do livro e liga play/pause/próxima/anterior às ações do leitor.
 */
export function useMediaSession(opts: {
  enabled: boolean
  title: string
  artist?: string
  artwork?: string
  playing: boolean
  onToggle: () => void
  onNext?: () => void
  onPrev?: () => void
}) {
  const handlers = useRef(opts)
  handlers.current = opts
  const { enabled, title, artist, artwork, playing } = opts

  useEffect(() => {
    if (!enabled || !('mediaSession' in navigator)) return
    const ms = navigator.mediaSession
    try {
      ms.metadata = new MediaMetadata({
        title, artist: artist ?? 'Bookmoo', album: 'Bookmoo',
        artwork: artwork ? [{ src: artwork, sizes: '512x512' }] : [{ src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' }],
      })
    } catch { /* artwork inválido (data URL enorme etc.) */ }
    const set = (a: MediaSessionAction, fn: (() => void) | null) => { try { ms.setActionHandler(a, fn) } catch { /* ação não suportada */ } }
    set('play', () => handlers.current.onToggle())
    set('pause', () => handlers.current.onToggle())
    set('nexttrack', handlers.current.onNext ? () => handlers.current.onNext?.() : null)
    set('previoustrack', handlers.current.onPrev ? () => handlers.current.onPrev?.() : null)
    return () => {
      ;(['play', 'pause', 'nexttrack', 'previoustrack'] as MediaSessionAction[]).forEach(a => set(a, null))
      ms.metadata = null
      ms.playbackState = 'none'
    }
  }, [enabled, title, artist, artwork])

  useEffect(() => {
    if (!enabled || !('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  }, [enabled, playing])
}
