import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { Collection } from '@/lib/collections'

/**
 * Banner horizontal (2,4:1) de uma coleção. Dentro do grid da galeria ocupa três colunas de capas
 * (col-span-3), duas no celular; fora do grid, use `className` para a largura.
 */
export function CollectionCard({ collection, pt, className }: { collection: Collection; pt: boolean; className?: string }) {
  const count = collection.bookCount
  return (
    <Link to={`/collections/${collection.slug}`} aria-label={`${collection.title} — ${count} ${pt ? 'livros' : 'books'}`}
      className={cn('group relative block aspect-[12/5] overflow-hidden rounded-xl isolate outline-none transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer', className)}
      style={{ backgroundColor: '#0d1018', boxShadow: '0 1px 2px rgba(0,0,0,.18)', containerType: 'inline-size' }}>
      {collection.bannerData && (
        <img src={collection.bannerData} alt="" decoding="async" className="absolute inset-0 -z-10 h-full w-full object-cover object-right transition-transform duration-500 group-hover:scale-[1.03]" />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/70 via-black/25 to-transparent" aria-hidden />
      {/* Tipografia em cqw: o texto acompanha a largura do card (2 por linha no celular, 3 em telas grandes ou 3 capas no carrossel). */}
      <div className="flex h-full max-w-[68%] flex-col justify-center text-white" style={{ padding: 'clamp(14px, 5.5cqw, 30px)', gap: 'clamp(2px, 0.9cqw, 6px)' }}>
        <span className="font-semibold uppercase" style={{ color: '#d9b86c', fontSize: 'clamp(7px, 2cqw, 10.5px)', letterSpacing: '0.18em' }}>{pt ? 'Coleção' : 'Collection'}</span>
        <h3 className="font-display leading-[1.05] [text-wrap:balance]" style={{ fontSize: 'clamp(11px, 5.2cqw, 24px)' }}>{collection.title}</h3>
        <p className="opacity-85" style={{ fontSize: 'clamp(8px, 2.4cqw, 12.5px)' }}>{collection.authorName}</p>
        <p className="font-medium opacity-90" style={{ fontSize: 'clamp(8px, 2.3cqw, 12px)' }}>{count} {pt ? 'livros' : 'books'}</p>
      </div>
    </Link>
  )
}

export function CollectionCardSkeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('aspect-[12/5] rounded-xl animate-pulse', className)} style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />
}
