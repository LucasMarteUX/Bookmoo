// Galeria: destaque editorial, prateleiras por tema e todos os livros com filtros na URL.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, BookOpen, Search, Sparkles, X } from 'lucide-react'
import { BookCard, BookCover } from '@/components/book/BookCard'
import { BookCardSkeleton } from '@/components/BookCardSkeleton'
import { AvatarStack } from '@/components/community/AvatarStack'
import { EmptyState } from '@/components/ui/empty-state'
import { LevelBadge } from '@/components/ui/level-badge'
import { useLanguage } from '@/store/useLanguage'
import { CEFR, type CefrId } from '@/lib/cefr'
import { BOOK_CATEGORIES, categoryName, listCatalog, type BookCategory, type CatalogBook } from '@/lib/catalog'
import { loadCatalogSocial, type CatalogSocial } from '@/lib/social'

const muted = { color: 'var(--theme-text-secondary)' }
/** Com poucos livros, as prateleiras só repetiriam os mesmos títulos. */
const SHELVES_FROM = 6

/** Filtros guardados na URL. A busca tem estado próprio: um input preso à URL perde caracteres ao digitar. */
function useGalleryFilters() {
  const [params, setParams] = useSearchParams()
  const rawLevel = params.get('level')
  const rawCategory = params.get('cat')
  const urlQuery = params.get('q') ?? ''
  const [query, setQuery] = useState(urlQuery)
  const writtenQuery = useRef(urlQuery)

  // Lê a URL atual, não a do render: a busca escreve com atraso e não pode desfazer outro filtro.
  const setFilter = (key: 'level' | 'cat' | 'author' | 'q', value: string) => {
    const next = new URLSearchParams(window.location.search)
    if (value && value !== 'all') next.set(key, value)
    else next.delete(key)
    if (next.toString() !== window.location.search.replace(/^\?/, '')) setParams(next, { replace: true })
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      writtenQuery.current = query.trim()
      setFilter('q', query.trim())
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query])

  // Só a URL mudada por fora (voltar, menu lateral) reescreve o que está no campo.
  useEffect(() => {
    if (urlQuery === writtenQuery.current) return
    writtenQuery.current = urlQuery
    setQuery(urlQuery)
  }, [urlQuery])

  return {
    level: (CEFR.some(band => band.id === rawLevel) ? rawLevel : 'all') as CefrId | 'all',
    category: (BOOK_CATEGORIES.some(item => item.id === rawCategory) ? rawCategory : 'all') as BookCategory | 'all',
    author: params.get('author') ?? 'all',
    query,
    search: params.toString(),
    setQuery,
    setFilter,
    clear: () => {
      writtenQuery.current = ''
      setQuery('')
      setParams({}, { replace: true })
    },
  }
}

export function GalleryList() {
  const { locale } = useLanguage()
  const pt = locale === 'pt-BR'
  const [books, setBooks] = useState<CatalogBook[] | null>(null)
  const [social, setSocial] = useState<CatalogSocial>({})
  const [error, setError] = useState('')
  const { level, category, author: urlAuthor, query, search, setQuery, setFilter, clear } = useGalleryFilters()
  useEffect(() => {
    listCatalog().then(setBooks).catch(() => setError(pt ? 'A galeria ainda não está disponível.' : 'The gallery is not available yet.'))
    void loadCatalogSocial().then(setSocial)
  }, [pt])

  const authors = useMemo(() => {
    const names = new Set((books ?? []).map(book => book.author?.trim()).filter((name): name is string => !!name))
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [books])
  // Link antigo pode citar um autor que saiu da galeria.
  const author = books && !authors.includes(urlAuthor) ? 'all' : urlAuthor
  const filtered = level !== 'all' || category !== 'all' || author !== 'all' || !!query.trim()

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (books ?? []).filter(book => {
      if (level !== 'all' && book.level !== level) return false
      if (category !== 'all' && book.category !== category) return false
      if (author !== 'all' && book.author !== author) return false
      if (q && !`${book.title} ${book.author ?? ''} ${book.description ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [books, level, category, author, query])

  const readers = (book: CatalogBook) => social[book.id]?.readers ?? 0
  const featured = useMemo(() => {
    const withCover = (books ?? []).filter(book => book.coverData)
    return [...withCover].sort((a, b) => readers(b) - readers(a) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0]
  }, [books, social])
  const categories = useMemo(() => BOOK_CATEGORIES
    .map(item => ({ ...item, count: (books ?? []).filter(book => book.category === item.id).length }))
    .filter(item => item.count > 0), [books])

  const shelves = useMemo(() => {
    const list = books ?? []
    if (list.length < SHELVES_FROM) return []
    const rows: { id: string; title: string; hint: string; books: CatalogBook[]; onAll?: () => void }[] = []
    const popular = list.filter(book => readers(book) > 0).sort((a, b) => readers(b) - readers(a)).slice(0, 12)
    if (popular.length >= 3) rows.push({ id: 'popular', title: pt ? 'Em alta na comunidade' : 'Trending in the community', hint: pt ? 'O que mais gente tem na estante' : 'On the most shelves', books: popular })
    const easy = list.filter(book => book.level === 'A1' || book.level === 'A2')
    if (easy.length >= 3) rows.push({ id: 'easy', title: pt ? 'Para começar' : 'To get started', hint: pt ? 'Textos A1 e A2' : 'A1 and A2 texts', books: easy, onAll: () => setFilter('level', 'A1') })
    const fresh = [...list].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, 12)
    rows.push({ id: 'new', title: pt ? 'Chegaram agora' : 'Just added', hint: pt ? 'Os mais novos da galeria' : 'Newest in the gallery', books: fresh })
    for (const item of categories) {
      if (item.count < 3) continue
      rows.push({ id: item.id, title: pt ? item.pt : item.en, hint: `${item.count} ${pt ? 'livros' : 'books'}`, books: list.filter(book => book.category === item.id), onAll: () => setFilter('cat', item.id) })
    }
    return rows
  }, [books, social, categories, pt])

  const card = (book: CatalogBook, className?: string) => (
    <BookCard key={book.id} to={`/gallery/${book.id}`} title={book.title} subtitle={book.author || categoryName(book.category, pt)} coverData={book.coverData} level={book.level} pt={pt}
      linkState={{ gallerySearch: search }} readers={readers(book)} faces={social[book.id]?.faces} className={className} />
  )

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] md:text-[44px] leading-[1.02]">{pt ? 'Galeria' : 'Gallery'}</h1>
          <p className="mt-1.5 text-[14.5px]" style={muted}>
            {pt ? 'Livros gratuitos, escolhidos pelo nível, para ler e estudar no Bookmoo.' : 'Free books, picked by level, to read and study on Bookmoo.'}
          </p>
        </div>
        <label className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={muted} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={pt ? 'Buscar título, autor ou tema' : 'Search title, author or theme'}
            className="w-full h-11 rounded-full border pl-10 pr-9 text-[14px] outline-none" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }} />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label={pt ? 'Limpar busca' : 'Clear search'} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full" style={muted}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </label>
      </header>

      {!filtered && featured && <Featured book={featured} social={social} pt={pt} />}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex p-1 rounded-full overflow-x-auto" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} role="tablist" aria-label={pt ? 'Nível' : 'Level'}>
            {(['all', ...CEFR.map(band => band.id)] as (CefrId | 'all')[]).map(id => {
              const on = level === id
              return (
                <button key={id} type="button" role="tab" aria-selected={on} onClick={() => setFilter('level', id)}
                  className="h-8 px-3 rounded-full text-[12.5px] font-medium whitespace-nowrap"
                  style={{ backgroundColor: on ? 'var(--theme-card-bg)' : 'transparent', color: on ? 'var(--theme-text)' : 'var(--theme-text-secondary)', boxShadow: on ? '0 1px 3px rgba(0,0,0,0.08)' : undefined }}>
                  {id === 'all' ? (pt ? 'Todos os níveis' : 'All levels') : id}
                </button>
              )
            })}
          </div>
          {authors.length > 1 && (
            <select value={author} onChange={e => setFilter('author', e.target.value)} aria-label={pt ? 'Autor' : 'Author'}
              className="h-10 rounded-full border px-3.5 text-[13px] outline-none cursor-pointer" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)', color: 'var(--theme-text)' }}>
              <option value="all">{pt ? 'Todos os autores' : 'All authors'}</option>
              {authors.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          )}
          {filtered && (
            <button type="button" onClick={clear} className="h-10 px-3.5 inline-flex items-center gap-1 rounded-full text-[13px]" style={muted}>
              <X className="w-3.5 h-3.5" />{pt ? 'Limpar filtros' : 'Clear filters'}
            </button>
          )}
        </div>
        {categories.length > 0 && (
          <div className="-mx-1 px-1 flex gap-2 overflow-x-auto pb-1">
            <Chip on={category === 'all'} onClick={() => setFilter('cat', 'all')}>{pt ? 'Tudo' : 'Everything'}</Chip>
            {categories.map(item => (
              <Chip key={item.id} on={category === item.id} onClick={() => setFilter('cat', category === item.id ? 'all' : item.id)}>
                {pt ? item.pt : item.en} <span className="tabular-nums" style={{ opacity: 0.55 }}>{item.count}</span>
              </Chip>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm">{error}</p>}

      {books === null && !error && (
        <div className="grid gap-x-5 gap-y-8 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => <BookCardSkeleton key={i} />)}
        </div>
      )}

      {!filtered && shelves.map(shelf => (
        <section key={shelf.id}>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-[24px] leading-tight">{shelf.title}</h2>
              <p className="text-[13px]" style={muted}>{shelf.hint}</p>
            </div>
            {shelf.onAll && (
              <button type="button" onClick={shelf.onAll} className="shrink-0 inline-flex items-center gap-1 text-[13px] font-medium">
                {pt ? 'Ver todos' : 'See all'}<ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="-mx-1 px-1 pt-1 pb-6 flex gap-5 overflow-x-auto snap-x">
            {shelf.books.map(book => card(book, 'w-36 sm:w-40 shrink-0 snap-start'))}
          </div>
        </section>
      ))}

      {books && books.length === 0 && (
        <EmptyState illustration="reading" title={pt ? 'Ainda não há livros. Eles entram pela área admin.' : 'No books yet. They are added from the admin area.'} />
      )}
      {books && books.length > 0 && shown.length === 0 && (
        <EmptyState illustration="reading" title={pt ? 'Nenhum livro com esses filtros.' : 'No books match these filters.'}
          action={<button type="button" onClick={clear} className="h-9 px-4 rounded-full border text-[13px]" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Limpar filtros' : 'Clear filters'}</button>} />
      )}

      {books && shown.length > 0 && (
        <section id="all">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="font-display text-[24px] leading-tight">
              {filtered ? (pt ? 'Resultados' : 'Results') : (pt ? 'Todos os livros' : 'All books')}
            </h2>
            <span className="text-[13px] tabular-nums" style={muted}>{shown.length} {pt ? (shown.length === 1 ? 'livro' : 'livros') : (shown.length === 1 ? 'book' : 'books')}</span>
          </div>
          <div className="grid gap-x-5 gap-y-9 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {shown.map(book => card(book))}
          </div>
        </section>
      )}
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className="h-9 px-4 shrink-0 inline-flex items-center gap-1.5 rounded-full border text-[13px] whitespace-nowrap transition-colors"
      style={{
        borderColor: on ? 'var(--theme-text)' : 'var(--theme-border)',
        backgroundColor: on ? 'var(--theme-text)' : 'var(--theme-card-bg)',
        color: on ? 'var(--theme-bg)' : 'var(--theme-text)',
      }}>
      {children}
    </button>
  )
}

/** Destaque: capa grande sobre o próprio desfoque, texto editorial e quem está lendo. */
function Featured({ book, social, pt }: { book: CatalogBook; social: CatalogSocial; pt: boolean }) {
  const data = social[book.id]
  return (
    <section className="relative overflow-hidden rounded-[28px] border" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
      {book.coverData && <img src={book.coverData} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-40" />}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, var(--theme-card-bg) 30%, color-mix(in srgb, var(--theme-card-bg) 55%, transparent) 75%, color-mix(in srgb, var(--theme-card-bg) 20%, transparent))' }} />
      <div className="relative grid md:grid-cols-[minmax(0,1fr)_auto] gap-8 md:gap-12 items-center p-6 sm:p-10">
        <div className="min-w-0 order-2 md:order-1">
          <p className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.12em]" style={muted}>
            <Sparkles className="w-3.5 h-3.5" />{pt ? 'Destaque da galeria' : 'Gallery pick'}
          </p>
          <h2 className="mt-3 font-display text-[36px] sm:text-[52px] leading-[0.98] break-words">{book.title}</h2>
          {book.author && <p className="mt-2 text-[16px]" style={muted}>{book.author}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {book.level && <LevelBadge id={book.level} pt={pt} />}
            {book.category && <span className="rounded-full px-2.5 py-1 text-[12px] font-medium" style={{ backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-secondary)' }}>{categoryName(book.category, pt)}</span>}
            {data && data.readers > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[12.5px]" style={muted}>
                <AvatarStack people={data.faces} size={20} />
                {data.readers} {pt ? (data.readers === 1 ? 'pessoa lendo' : 'pessoas lendo') : (data.readers === 1 ? 'reader' : 'readers')}
              </span>
            )}
          </div>
          {book.description && <p className="mt-5 max-w-xl text-[15px] leading-relaxed line-clamp-3">{book.description}</p>}
          <Link to={`/gallery/${book.id}`} className="mt-6 h-11 px-5 inline-flex items-center gap-2 rounded-full text-[14px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            <BookOpen className="w-4 h-4" />{pt ? 'Conhecer o livro' : 'See the book'}
          </Link>
        </div>
        <Link to={`/gallery/${book.id}`} className="group order-1 md:order-2 justify-self-center w-40 sm:w-52 md:w-60 rotate-[2.5deg] hover:rotate-0 transition-transform duration-500">
          <BookCover title={book.title} coverData={book.coverData} className="rounded-xl" />
        </Link>
      </div>
    </section>
  )
}
