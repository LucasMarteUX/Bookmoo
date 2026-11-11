import type { ReactNode } from 'react'
import { bannerOf } from '@/lib/banners'
import { cn } from '@/lib/utils'

/** Faixa do topo do perfil: gradiente pastel com textura de pontos e uma ilustração do app. */
export function ProfileBanner({ id, className, compact = false, children }: { id?: string; className?: string; compact?: boolean; children?: ReactNode }) {
  const banner = bannerOf(id)
  return (
    <div className={cn('relative overflow-hidden', className)} style={{ background: banner.background }}>
      <img src={`/illustrations/${banner.illustration}.svg`} alt="" aria-hidden
        // O SVG tem fundo opaco: multiply apaga o branco no claro; no escuro (invertido) quem apaga é o screen.
        className={cn('illo absolute pointer-events-none select-none mix-blend-multiply [.theme-dark_&]:mix-blend-screen', compact ? 'right-2 -bottom-3 h-[120%] opacity-60' : 'right-4 sm:right-10 -bottom-6 h-[125%] opacity-80')} />
      {children}
    </div>
  )
}
