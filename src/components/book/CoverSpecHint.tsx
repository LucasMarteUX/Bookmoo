import { useEffect, useState } from 'react'

/** Tamanho ideal da capa (proporção 2:3, a mesma das capas da biblioteca) e o que a imagem enviada tem. */
export const COVER_IDEAL = { w: 1200, h: 1800 }

export function CoverSpecHint({ src, pt }: { src: string | null; pt: boolean }) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    setDims(null)
    if (!src) return
    const img = new Image()
    img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = src
  }, [src])

  const ratio = dims ? dims.w / dims.h : null
  const offRatio = ratio != null && Math.abs(ratio - 2 / 3) > 0.04
  const small = dims != null && dims.w < 600

  return (
    <div className="space-y-0.5 text-[12px] leading-snug" style={{ color: 'var(--theme-text-secondary)' }}>
      <p>{pt ? `Ideal: ${COVER_IDEAL.w} × ${COVER_IDEAL.h} px (retrato, 2:3). JPG, PNG ou WebP.` : `Best: ${COVER_IDEAL.w} × ${COVER_IDEAL.h} px (portrait, 2:3). JPG, PNG or WebP.`}</p>
      {dims && (
        <p className="tabular-nums">
          {pt ? `Sua imagem: ${dims.w} × ${dims.h} px.` : `Your image: ${dims.w} × ${dims.h} px.`}
          {offRatio && (pt ? ' Outra proporção: as bordas serão cortadas.' : ' Different shape: the edges will be cropped.')}
          {!offRatio && small && (pt ? ' Pequena: pode ficar sem nitidez.' : ' Small: it may look blurry.')}
        </p>
      )}
    </div>
  )
}
