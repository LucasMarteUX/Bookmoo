import { useEffect, useRef } from 'react'
import { haptics } from '@/lib/haptics'

/**
 * Gestos da leitura no celular, no estilo dos leitores do iOS:
 * - toque: mostra ou esconde os controles (nas bordas, vira a página);
 * - segurar numa palavra: abre as opções da palavra;
 * - segurar e arrastar: seleciona a frase e mostra as ações;
 * - deslizar para os lados: vira a página;
 * - pinça: muda o tamanho da letra (o texto se reorganiza, sem zoom de imagem).
 * A rolagem vertical continua nativa: nada é bloqueado até o gesto ficar claro.
 */
export type TapZone = 'left' | 'center' | 'right'
export interface TextGestureHandlers {
  onTap: (zone: TapZone) => void
  onLongPress: (wordIndex: number) => void
  onSelect: (start: number, end: number) => void
  onSelectEnd: (start: number, end: number, dragged: boolean) => void
  onSwipe: (direction: 1 | -1) => void
  onPinch: (scale: number, done: boolean) => void
  /** Dedo na tela / fora dela. Enquanto durar, o texto não deve ser redesenhado:
   *  o iOS continua mandando o gesto para o elemento tocado, e um elemento trocado perde o dedo. */
  onGestureStart?: () => void
  onGestureEnd?: () => void
}

const LONG_PRESS_MS = 380
const MOVE_TOLERANCE = 10
const SWIPE_MIN = 56
const EDGE = 0.22

function wordAt(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null
  const raw = el?.closest?.('span[data-word-index]')?.getAttribute('data-word-index')
  return raw == null ? null : Number(raw)
}

export function useTextGestures(el: HTMLElement | null, enabled: boolean, handlers: TextGestureHandlers) {
  const h = useRef(handlers)
  h.current = handlers

  useEffect(() => {
    if (!el || !enabled) return
    let start: { x: number; y: number; t: number } | null = null
    let moved = false
    let timer = 0
    let anchor: number | null = null
    let last: number | null = null
    let selecting = false
    let pinch: { d: number } | null = null

    let active = false
    const reset = () => {
      window.clearTimeout(timer); start = null; moved = false; anchor = null; last = null; selecting = false
      if (active) { active = false; h.current.onGestureEnd?.() }
    }
    const ignore = (target: EventTarget | null) =>
      !!(target as HTMLElement | null)?.closest?.('button, a, input, textarea, select, [role="dialog"], [data-no-gesture]')

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        reset()
        const [a, b] = [e.touches[0], e.touches[1]]
        pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) }
        return
      }
      if (e.touches.length !== 1 || ignore(e.target)) { reset(); return }
      const t = e.touches[0]
      start = { x: t.clientX, y: t.clientY, t: Date.now() }
      moved = false
      if (!active) { active = true; h.current.onGestureStart?.() }
      const idx = wordAt(t.clientX, t.clientY)
      window.clearTimeout(timer)
      if (idx == null) return
      timer = window.setTimeout(() => {
        if (!start || moved) return
        selecting = true
        anchor = idx
        last = idx
        haptics.selection()
        h.current.onLongPress(idx)
      }, LONG_PRESS_MS)
    }

    const onMove = (e: TouchEvent) => {
      if (pinch && e.touches.length === 2) {
        e.preventDefault()
        const [a, b] = [e.touches[0], e.touches[1]]
        h.current.onPinch(Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.d, false)
        return
      }
      if (!start) return
      const t = e.touches[0]
      if (selecting && anchor != null) {
        // Selecionando: o dedo arrasta a seleção, a tela não rola.
        e.preventDefault()
        const idx = wordAt(t.clientX, t.clientY)
        if (idx != null && idx !== last) {
          last = idx
          moved = true
          h.current.onSelect(Math.min(anchor, idx), Math.max(anchor, idx))
        }
        return
      }
      if (Math.abs(t.clientX - start.x) > MOVE_TOLERANCE || Math.abs(t.clientY - start.y) > MOVE_TOLERANCE) {
        moved = true
        window.clearTimeout(timer)
      }
    }

    const onEnd = (e: TouchEvent) => {
      if (pinch) {
        if (e.touches.length < 2) {
          h.current.onPinch(1, true)
          pinch = null
        }
        return
      }
      window.clearTimeout(timer)
      const s = start
      if (!s) { reset(); return }
      const t = e.changedTouches[0]
      if (selecting && anchor != null) {
        // Termina o gesto aqui: sem clique sintético depois.
        e.preventDefault()
        const end = last ?? anchor
        h.current.onSelectEnd(Math.min(anchor, end), Math.max(anchor, end), moved)
        reset()
        return
      }
      const dx = t.clientX - s.x
      const dy = t.clientY - s.y
      const dt = Date.now() - s.t
      if (moved) {
        if (dt < 700 && Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.4) h.current.onSwipe(dx < 0 ? 1 : -1)
        reset()
        return
      }
      if (dt < 450) {
        e.preventDefault()
        const ratio = t.clientX / window.innerWidth
        h.current.onTap(ratio < EDGE ? 'left' : ratio > 1 - EDGE ? 'right' : 'center')
      }
      reset()
    }

    // iOS: impede o zoom da página inteira durante a pinça no texto (a pinça muda a letra).
    const onGesture = (e: Event) => e.preventDefault()

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: false })
    el.addEventListener('touchcancel', reset)
    el.addEventListener('gesturestart', onGesture)
    el.addEventListener('contextmenu', onGesture)
    return () => {
      window.clearTimeout(timer)
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', reset)
      el.removeEventListener('gesturestart', onGesture)
      el.removeEventListener('contextmenu', onGesture)
    }
  }, [el, enabled])
}
