// Dither animado e discreto por cima das pinturas grandes (shader do Paper). Pontinhos claros que se movem devagar,
// só nos cantos e na faixa de baixo (máscara), para a pintura continuar protagonista. Só monta quando a imagem
// está perto da tela, para não manter vários contextos WebGL abertos.
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Dithering } from '@paper-design/shaders-react'

type Corner = 'bl' | 'br' | 'tl' | 'tr'

const SPOT: Record<Corner, string> = {
  bl: 'radial-gradient(ellipse 30% 38% at 0% 100%, rgba(0,0,0,.9) 0%, transparent 100%)',
  br: 'radial-gradient(ellipse 30% 38% at 100% 100%, rgba(0,0,0,.9) 0%, transparent 100%)',
  tl: 'radial-gradient(ellipse 22% 28% at 0% 0%, rgba(0,0,0,.7) 0%, transparent 100%)',
  tr: 'radial-gradient(ellipse 22% 28% at 100% 0%, rgba(0,0,0,.7) 0%, transparent 100%)',
}

export function ImageDither({ corners = ['bl', 'tr'], bottom = true, tone = 'light', strength = 0.5, z }: {
  z?: number
  corners?: Corner[]
  bottom?: boolean
  tone?: 'light' | 'dark'
  strength?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: '200px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const mask = [...corners.map(c => SPOT[c]), ...(bottom ? ['linear-gradient(to top, rgba(0,0,0,.6) 0%, rgba(0,0,0,.2) 9%, transparent 20%)'] : [])].join(', ')
  return (
    <div ref={ref} aria-hidden className="image-dither"
      style={{ WebkitMaskImage: mask, maskImage: mask, opacity: strength, mixBlendMode: 'soft-light', zIndex: z }}>
      {near && (
        <Dithering style={{ width: '100%', height: '100%' }}
          colorBack="rgba(0, 0, 0, 0)"
          colorFront={tone === 'light' ? 'rgba(255, 246, 226, 1)' : 'rgba(40, 46, 36, 1)'}
          shape="simplex" type="4x4" pxSize={2} scale={0.8} speed={reduce ? 0 : 0.25} />
      )}
    </div>
  )
}
