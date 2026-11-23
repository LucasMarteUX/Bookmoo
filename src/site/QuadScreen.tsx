// Encaixa uma interface (w × h) dentro de uma tela pintada em perspectiva: os 4 cantos em % da imagem
// viram um matrix3d (homografia do retângulo para o quadrilátero).
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

type Pt = [number, number]

function homography(w: number, h: number, q: [Pt, Pt, Pt, Pt]): string {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q // TL, TR, BR, BL
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3
  const det = dx1 * dy2 - dx2 * dy1
  const g = (dx3 * dy2 - dx2 * dy3) / det
  const hh = (dx1 * dy3 - dx3 * dy1) / det
  const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, c = x0
  const d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3, f = y0
  // Mapa do quadrado unitário → quad; antes, escala o conteúdo (w × h) para o unitário.
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, c, f, 0, 1]
  return `matrix3d(${m.map(v => +v.toFixed(10)).join(',')})`
}

export function QuadScreen({ quad, w, h, children }: { quad: [Pt, Pt, Pt, Pt]; w: number; h: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<[number, number] | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const m = () => setSize([el.clientWidth, el.clientHeight])
    m()
    const o = new ResizeObserver(m)
    o.observe(el)
    return () => o.disconnect()
  }, [])
  const px = size ? quad.map(([x, y]) => [x / 100 * size[0], y / 100 * size[1]] as Pt) as [Pt, Pt, Pt, Pt] : null
  return (
    <div ref={ref} aria-hidden className="quad-screen" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
      {px && <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, transformOrigin: '0 0', transform: homography(w, h, px), overflow: 'hidden' }}>{children}</div>}
    </div>
  )
}
