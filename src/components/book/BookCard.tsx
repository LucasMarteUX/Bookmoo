import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Image as ImageIcon, Star } from 'lucide-react'
import { LevelBadge } from '@/components/ui/level-badge'
import { AvatarStack } from '@/components/community/AvatarStack'
import type { CefrId } from '@/lib/cefr'
import type { Author } from '@/lib/communityProfile'
import { cn } from '@/lib/utils'

/** Capa 2:3. A versão desfocada preenche as sobras de capas com outra proporção. */
export function BookCover({ title, coverData, className, children }: { title: string; coverData?: string; className?: string; children?: ReactNode }) {
  return (
    <div className={cn('book-cover relative w-full aspect-[2/3] rounded-lg overflow-hidden grid place-items-center', className)} style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
      {coverData
        ? <>
            <img src={coverData} alt="" aria-hidden loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-70" />
            <img src={coverData} alt="" loading="lazy" decoding="async" className="relative w-full h-full object-contain" />
          </>
        : <span className="px-3 text-center font-display text-[15px] leading-snug line-clamp-4">{title}</span>}
      {children}
    </div>
  )
}

export function BookCard({ to, title, subtitle, coverData, level, pt, linkState, className, readers = 0, faces = [], rating, ratings = 0, illustrated = 0 }: {
  to: string
  title: string
  subtitle?: string
  coverData?: string
  level?: CefrId
  pt: boolean
  /** Enviado ao destino, para ele saber voltar aos filtros de origem. */
  linkState?: unknown
  className?: string
  /** Quantas pessoas têm o livro na estante, e até 3 rostos de perfis abertos. */
  readers?: number
  faces?: Author[]
  /** Média das avaliações (0,5–5) e quantas. */
  rating?: number | null
  ratings?: number
  /** Páginas já ilustradas na galeria. */
  illustrated?: number
}) {
  return (
    <Link to={to} state={linkState} className={cn('group block', className)}>
      <BookCover title={title} coverData={coverData} className="transition-transform duration-300 group-hover:-translate-y-1">
        {level && <LevelBadge id={level} pt={pt} variant="compact" className="absolute left-1.5 top-1.5" />}
        {illustrated > 0 && (
          <span className="absolute right-1.5 top-1.5 h-5 px-1.5 rounded-full inline-flex items-center gap-1 text-[10.5px] font-semibold backdrop-blur-md"
            style={{ backgroundColor: 'color-mix(in srgb, var(--theme-card-bg) 85%, transparent)', color: 'var(--theme-text)' }}
            title={pt ? `${illustrated} páginas ilustradas` : `${illustrated} illustrated pages`}>
            <ImageIcon className="w-3 h-3" />{illustrated}
          </span>
        )}
      </BookCover>
      <h3 className="mt-3 text-[14px] font-medium leading-snug line-clamp-2" style={{ color: 'var(--theme-text)' }}>{title}</h3>
      {subtitle && <p className="mt-0.5 text-[12.5px] truncate" style={{ color: 'var(--theme-text-secondary)' }}>{subtitle}</p>}
      {!!rating && ratings > 0 && (
        <p className="mt-1 flex items-center gap-1 text-[12px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>
          <Star className="w-3.5 h-3.5" style={{ color: '#E8A93B', fill: '#E8A93B' }} aria-hidden />
          <span style={{ color: 'var(--theme-text)' }} className="font-medium">{rating.toFixed(1).replace('.', pt ? ',' : '.')}</span>
          <span>({ratings})</span>
        </p>
      )}
      {readers > 0 && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--theme-text-secondary)' }}>
          <AvatarStack people={faces} size={18} />
          {readers} {pt ? (readers === 1 ? 'leitor' : 'leitores') : (readers === 1 ? 'reader' : 'readers')}
        </p>
      )}
    </Link>
  )
}
