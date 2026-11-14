import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { Collection } from '@/lib/collections'

/** Fundo de cada coleção enquanto ela não tem arte própria (paleta de cada identidade visual). */
const FALLBACK: Record<string, [string, string]> = {
  'sherlock-holmes': ['#0b1020', '#3a3358'], 'classics': ['#2a1410', '#6b3b24'], 'gothic-horror-classics': ['#120608', '#4a1018'],
  'h-g-wells-science-fiction': ['#0e1f2e', '#8a4b22'], 'wonderful-world-of-oz': ['#0b3b2a', '#c9a227'], 'edgar-allan-poe': ['#0a0a0c', '#4a1424'],
  'barsoom': ['#4a1608', '#d9772b'], 'anne-of-green-gables': ['#254a2a', '#a9c98a'], 'pellucidar': ['#0e2a1b', '#b97a1e'],
  'arsene-lupin': ['#0a1330', '#9b7a2b'], 'jules-verne': ['#0b1c33', '#8a5a2b'], 'lovecraft': ['#05120f', '#1f5a4a'],
}
export const collectionFallback = (slug: string) => { const [a, b] = FALLBACK[slug] ?? ['#0d1018', '#2a3040']; return `linear-gradient(135deg, ${a}, ${b})` }

/**
 * Banner horizontal (2,4:1) de uma coleção. Dentro do grid da galeria ocupa três colunas de capas
 * (col-span-3), duas no celular; fora do grid, use `className` para a largura.
 */
export function CollectionCard({ collection, pt, className }: { collection: Collection; pt: boolean; className?: string }) {
  const count = collection.bookCount
  return (
    <Link to={`/collections/${collection.slug}`} aria-label={`${collection.title} — ${count} ${pt ? 'livros' : 'books'}`}
      className={cn('group relative block aspect-[12/5] overflow-hidden rounded-xl isolate outline-none transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer', className)}
      style={{ background: collectionFallback(collection.slug), boxShadow: '0 1px 2px rgba(0,0,0,.18)', containerType: 'inline-size' }}>
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
