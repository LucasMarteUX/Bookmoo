import { useState } from 'react'
import { cn } from '@/lib/utils'

/** Foto da pessoa. Sem foto, ou se ela não carregar, mostra a inicial do nome. */
export function Avatar({ src, name, size = 40, className }: { src?: string; name: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  const showPhoto = !!src && failed !== src
  return (
    <span className={cn('grid place-items-center shrink-0 rounded-full overflow-hidden font-semibold', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), backgroundColor: 'var(--pastel-sand-bg)', color: 'var(--pastel-sand-fg)' }}>
      {showPhoto
        ? <img src={src} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" onError={() => setFailed(src)} />
        : (name.trim().charAt(0) || 'B').toUpperCase()}
    </span>
  )
}
