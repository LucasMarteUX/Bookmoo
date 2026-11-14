// Página de uma coleção (/collections/:slug) e lista de coleções (/collections).
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BookCard } from '@/components/book/BookCard'
import { BookCardSkeleton } from '@/components/BookCardSkeleton'
import { CollectionCard, CollectionCardSkeleton } from '@/components/book/CollectionCard'
import { EmptyState } from '@/components/ui/empty-state'
import { useLanguage } from '@/store/useLanguage'
import { categoryName } from '@/lib/catalog'
import { getCollection, listCollections, type Collection, type CollectionWithBooks } from '@/lib/collections'

const muted = { color: 'var(--theme-text-secondary)' }

export function CollectionsPage() {
  const { slug } = useParams()
  return slug ? <CollectionDetail slug={slug} /> : <CollectionsIndex />
}

function CollectionsIndex() {
  const pt = useLanguage(s => s.locale) === 'pt-BR'
  const [items, setItems] = useState<Collection[] | null | 'error'>(null)
  useEffect(() => { listCollections().then(setItems).catch(() => setItems('error')) }, [])
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header>
        <Link to="/gallery" className="text-[13px]" style={muted}>{pt ? '← Galeria' : '← Gallery'}</Link>
        <h1 className="mt-2 font-display text-[34px] md:text-[44px] leading-[1.02]">{pt ? 'Coleções' : 'Collections'}</h1>
      </header>
      {items === 'error' ? <EmptyState illustration="reading" title={pt ? 'Não foi possível carregar as coleções.' : 'Could not load collections.'} />
        : items && items.length === 0 ? <EmptyState illustration="reading" title={pt ? 'Ainda não há coleções.' : 'No collections yet.'} />
        : items === null ? <div className="grid gap-5 grid-cols-1 sm:grid-cols-2">{[0, 1].map(i => <CollectionCardSkeleton key={i} />)}</div>
        : <div className="grid gap-5 grid-cols-1 sm:grid-cols-2">{(items ?? []).map(c => <CollectionCard key={c.id} collection={c} pt={pt} />)}</div>}
    </div>
  )
}

function CollectionDetail({ slug }: { slug: string }) {
  const pt = useLanguage(s => s.locale) === 'pt-BR'
  const [data, setData] = useState<CollectionWithBooks | null | undefined | 'error'>(undefined)
  useEffect(() => {
    setData(undefined)
    getCollection(slug).then(setData).catch(() => setData('error'))
  }, [slug])

  if (data === 'error') return <EmptyState illustration="reading" title={pt ? 'Não foi possível carregar esta coleção.' : 'Could not load this collection.'} />
  if (data === null) return <EmptyState illustration="reading" title={pt ? 'Esta coleção não existe ou não está publicada.' : 'This collection does not exist or is not published.'}
    action={<Link to="/gallery" className="h-9 px-4 rounded-full border text-[13px] inline-flex items-center" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Voltar à galeria' : 'Back to the gallery'}</Link>} />
  const loaded = data ?? undefined

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <Link to="/gallery" className="text-[13px]" style={muted}>{pt ? '← Galeria' : '← Gallery'}</Link>
        <header className="mt-3 grid gap-5 md:grid-cols-5 md:items-center">
          <div className="md:col-span-3 aspect-[12/5] overflow-hidden rounded-xl" style={{ backgroundColor: '#0d1018' }}>
            {loaded?.bannerData && <img src={loaded.bannerData} alt="" className="h-full w-full object-cover object-right" />}
          </div>
          <div className="md:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={muted}>{pt ? 'Coleção' : 'Collection'}</p>
            <h1 className="mt-1 font-display text-[30px] md:text-[38px] leading-[1.04] [text-wrap:balance]">{loaded?.title ?? '…'}</h1>
            {loaded?.authorName && <p className="mt-2 text-[15px]" style={muted}>{loaded.authorName}</p>}
            {loaded && (
              <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[13px]" style={muted}>
                <span>{loaded.bookCount} {pt ? 'livros' : 'books'}</span>
                {loaded.category && <span>· {categoryName(loaded.category, pt)}</span>}
                <span>· {loaded.languageCode === 'en' ? (pt ? 'Inglês' : 'English') : loaded.languageCode}</span>
              </p>
            )}
          </div>
        </header>
        {loaded?.description && <p className="mt-5 max-w-3xl text-[14.5px] leading-relaxed" style={muted}>{loaded.description}</p>}
      </div>

      {loaded && loaded.books.length === 0 && <EmptyState illustration="reading" title={pt ? 'Esta coleção ainda não tem livros.' : 'This collection has no books yet.'} />}
      <div className="grid gap-x-5 gap-y-9 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {!loaded && Array.from({ length: 5 }).map((_, i) => <BookCardSkeleton key={i} />)}
        {loaded?.books.map((book, i) => (
          <div key={book.id}>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] tabular-nums" style={muted}>{pt ? 'Livro' : 'Book'} {String(i + 1).padStart(2, '0')}</p>
            <BookCard to={`/gallery/${book.id}`} title={book.title} subtitle={book.author || categoryName(book.category, pt)} coverData={book.coverData} level={book.level} pt={pt} />
          </div>
        ))}
      </div>
    </div>
  )
}
