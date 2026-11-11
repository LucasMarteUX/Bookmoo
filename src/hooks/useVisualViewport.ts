import { useEffect } from 'react'

/**
 * Publica no <html> a área realmente visível (o teclado virtual do iOS não muda o layout viewport):
 * - `--vvh`: altura visível em px
 * - `--kb-h`: quanto o teclado (ou a barra do Safari) está cobrindo embaixo
 * Barras fixas usam `bottom: var(--kb-h)` para subir junto com o teclado.
 */
export function useVisualViewport() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
        // Abaixo de ~80px é só a barra do navegador variando, não teclado.
        root.style.setProperty('--kb-h', `${covered > 80 ? Math.round(covered) : 0}px`)
        root.style.setProperty('--vvh', `${Math.round(vv.height)}px`)
        root.classList.toggle('keyboard-open', covered > 80)
      })
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      cancelAnimationFrame(frame)
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
}
