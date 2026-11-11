import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { animate } from 'motion'
import { activeTab, isStandalone } from './routes'
import { goBack } from './NavBar'
import { haptics } from '@/lib/haptics'

const scrollByKey = new Map<string, number>()

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Transições estilo UINavigationController, sem desmontar a tela (estado de filtros etc. é preservado):
 * - PUSH: entra da direita · POP: entra da esquerda · troca de aba: fade curto.
 * Também restaura a rolagem ao voltar e rola ao topo ao avançar.
 */
export function useScreenTransitions(ref: RefObject<HTMLElement | null>) {
  const location = useLocation()
  const navType = useNavigationType()
  const prev = useRef(location)

  // Guarda a rolagem da tela que está saindo.
  useEffect(() => {
    const save = () => scrollByKey.set(location.key, window.scrollY)
    window.addEventListener('scroll', save, { passive: true })
    return () => { save(); window.removeEventListener('scroll', save) }
  }, [location.key])

  useLayoutEffect(() => {
    const from = prev.current
    prev.current = location
    if (from.pathname === location.pathname) return
    const el = ref.current
    // Rolagem
    if (navType === 'POP') {
      const y = scrollByKey.get(location.key) ?? 0
      requestAnimationFrame(() => window.scrollTo(0, y))
    } else {
      window.scrollTo(0, 0)
    }
    if (!el || reducedMotion()) return
    const sameTab = activeTab(from.pathname).id === activeTab(location.pathname).id
    // Ao terminar, remove o transform: senão os elementos `fixed` da página passam a se posicionar dentro dele.
    const clear = () => { el.style.transform = ''; el.style.opacity = '' }
    if (!sameTab) {
      animate(el, { opacity: [0.4, 1] }, { duration: 0.18 }).then(clear)
    } else if (navType === 'POP') {
      animate(el, { x: ['-28%', '0%'], opacity: [0.6, 1] }, { type: 'spring', stiffness: 380, damping: 38, restDelta: 0.5 }).then(clear)
    } else {
      animate(el, { x: ['42%', '0%'], opacity: [0.5, 1] }, { type: 'spring', stiffness: 380, damping: 38, restDelta: 0.5 }).then(clear)
    }
  }, [location, navType, ref])
}

/**
 * Deslizar da borda esquerda para voltar. Só no app instalado — no Safari o próprio navegador já faz isso
 * e os dois gestos juntos voltariam duas telas.
 */
export function useEdgeSwipeBack(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    if (!enabled || !isStandalone()) return
    let startX = 0, startY = 0, dx = 0, tracking = false, decided = false, startT = 0
    const el = () => ref.current

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (e.touches.length !== 1 || t.clientX > 24) return
      if ((e.target as HTMLElement).closest('[data-no-swipe-back]')) return
      tracking = true; decided = false; startX = t.clientX; startY = t.clientY; dx = 0; startT = performance.now()
    }
    const onMove = (e: TouchEvent) => {
      if (!tracking) return
      const t = e.touches[0]
      dx = Math.max(0, t.clientX - startX)
      const dy = Math.abs(t.clientY - startY)
      if (!decided) {
        if (dx < 8 && dy < 8) return
        decided = true
        if (dy > dx) { tracking = false; return }
      }
      e.preventDefault()
      const node = el()
      if (node) { node.style.transform = `translateX(${dx}px)`; node.style.boxShadow = '-12px 0 30px rgba(0,0,0,.12)' }
    }
    const onEnd = () => {
      if (!tracking) return
      tracking = false
      const node = el()
      const velocity = dx / Math.max(1, performance.now() - startT)
      const commit = dx > window.innerWidth * 0.33 || velocity > 0.5
      if (!node) return
      if (commit) {
        haptics.impact('light')
        animate(node, { x: [dx, window.innerWidth] }, { duration: 0.18, ease: 'easeOut' }).then(() => {
          node.style.transform = ''; node.style.boxShadow = ''
          goBack(navigate, pathname)
        })
      } else {
        animate(node, { x: [dx, 0] }, { type: 'spring', stiffness: 500, damping: 40 }).then(() => {
          node.style.transform = ''; node.style.boxShadow = ''
        })
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [enabled, navigate, pathname, ref])
}
