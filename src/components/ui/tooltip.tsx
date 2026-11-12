// Tooltip padrão do app. Uma camada só (montada no Layout) cuida de todos:
// - qualquer elemento com `title` ou `data-tip` ganha o tooltip do sistema (o nativo do navegador some);
// - botão só de ícone sem `title` usa o `aria-label`;
// - `data-tip-kbd="Esc"` mostra um atalho ao lado; `data-no-tip` desliga.
// Aparece com o mouse (atraso curto) e com o foco do teclado. No toque não aparece: o rótulo já vai para leitores de tela.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Tip = { text: string; kbd?: string; x: number; y: number; side: 'top' | 'bottom' }

const DELAY = 380        // primeira vez
const WARM = 700         // dentro desse tempo, o próximo aparece na hora (como no macOS)
const SELECTOR = '[data-tip], [title], button[aria-label], [role="button"][aria-label], a[aria-label]'

function labelOf(el: HTMLElement): string {
  // Move o title para data-tip para o navegador não mostrar o dele por cima.
  const title = el.getAttribute('title')
  if (title) { el.setAttribute('data-tip', title); el.removeAttribute('title') }
  const tip = el.getAttribute('data-tip')
  if (tip) return tip
  // aria-label só vira tooltip quando o botão não tem texto visível (só ícone).
  const aria = el.getAttribute('aria-label')
  if (aria && !(el.textContent ?? '').trim()) return aria
  return ''
}

function targetOf(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null
  const el = node.closest<HTMLElement>(SELECTOR)
  if (!el || el.closest('[data-no-tip]')) return null
  return el
}

export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const current = useRef<HTMLElement | null>(null)
  const lastHide = useRef(0)

  useEffect(() => {
    const place = (el: HTMLElement) => {
      const text = labelOf(el)
      if (!text) return
      const r = el.getBoundingClientRect()
      if (!r.width && !r.height) return
      const side: Tip['side'] = r.top < 56 ? 'bottom' : 'top'
      setTip({ text, kbd: el.getAttribute('data-tip-kbd') ?? undefined, x: r.left + r.width / 2, y: side === 'top' ? r.top - 8 : r.bottom + 8, side })
    }
    const show = (el: HTMLElement, instant = false) => {
      if (current.current === el) return
      current.current = el
      window.clearTimeout(timer.current)
      const warm = Date.now() - lastHide.current < WARM
      if (instant || warm) place(el)
      else timer.current = window.setTimeout(() => current.current === el && place(el), DELAY)
    }
    const hide = () => {
      window.clearTimeout(timer.current)
      if (current.current) lastHide.current = Date.now()
      current.current = null
      setTip(null)
    }
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const el = targetOf(e.target)
      if (el) show(el)
      else if (current.current && !current.current.contains(e.target as Node)) hide()
    }
    const onOut = (e: PointerEvent) => {
      if (current.current && !current.current.contains(e.relatedTarget as Node | null)) hide()
    }
    const onFocus = (e: FocusEvent) => {
      const el = targetOf(e.target)
      if (el && el.matches(':focus-visible')) show(el, true)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide() }
    document.addEventListener('pointerover', onOver)
    document.addEventListener('pointerout', onOut)
    document.addEventListener('pointerdown', hide, true)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', hide)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('blur', hide)
    return () => {
      window.clearTimeout(timer.current)
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerout', onOut)
      document.removeEventListener('pointerdown', hide, true)
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('blur', hide)
    }
  }, [])

  // Mantém dentro da tela depois de medir a largura.
  const ref = useRef<HTMLDivElement>(null)
  const [dx, setDx] = useState(0)
  useEffect(() => {
    if (!tip || !ref.current) { setDx(0); return }
    const w = ref.current.offsetWidth
    const left = tip.x - w / 2
    setDx(left < 8 ? 8 - left : left + w > window.innerWidth - 8 ? window.innerWidth - 8 - (left + w) : 0)
  }, [tip])

  if (!tip) return null
  return createPortal(
    <div ref={ref} role="tooltip" className="ui-tooltip" data-side={tip.side}
      style={{ left: tip.x + dx, top: tip.y, translate: tip.side === 'top' ? '-50% -100%' : '-50% 0' }}>
      {tip.text}{tip.kbd && <kbd>{tip.kbd}</kbd>}
    </div>,
    document.body,
  )
}
