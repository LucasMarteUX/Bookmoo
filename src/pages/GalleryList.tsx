// Galeria: destaque editorial, prateleiras por tema e todos os livros com filtros na URL.
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { canOpenCatalog, useEntitlements } from '@/store/useEntitlements'
import { Gift, SlidersHorizontal } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Image as ImageIcon, Search, Sparkles, Star, X } from 'lucide-react'
import { BookCard, BookCover } from '@/components/book/BookCard'
import { BookCardSkeleton } from '@/components/BookCardSkeleton'
import { AvatarStack } from '@/components/community/AvatarStack'
import { EmptyState } from '@/components/ui/empty-state'
import { LevelBadge } from '@/components/ui/level-badge'
import { useLanguage } from '@/store/useLanguage'
import { CEFR, type CefrId } from '@/lib/cefr'
import { BOOK_CATEGORIES, bookCategories, cachedThumbs, categoryName, listCatalogLite, loadCoverThumbs, type BookCategory, type CatalogBook } from '@/lib/catalog'
import { CollectionCard, CollectionCardSkeleton } from '@/components/book/CollectionCard'
import { FilterChip, FilterClear, FilterSelect, SegmentedTabs } from '@/components/ui/filter-controls'
import { CategoryTile } from '@/components/book/CategoryTiles'
import { COLLECTION_RAIL_ITEM, useFeaturedCollections } from '@/components/book/FeaturedCollections'
import { loadCatalogSocial, type CatalogSocial } from '@/lib/social'

const muted = { color: 'var(--theme-text-secondary)' }
/** Média ponderada (nota média 4 com peso de 3 avaliações) para ordenar por avaliação. */
function bayes(row?: { rating: number | null; ratings: number }) {
  if (!row?.rating || !row.ratings) return 0
  return (row.rating * row.ratings + 4 * 3) / (row.ratings + 3)
}
/** Com poucos livros, as prateleiras só repetiriam os mesmos títulos. */
const SHELVES_FROM = 6

type SortId = 'featured' | 'popular' | 'trending' | 'rating' | 'new' | 'az'
const SORTS: { id: SortId; pt: string; en: string }[] = [
  { id: 'featured', pt: 'Em destaque', en: 'Featured' },
  { id: 'popular', pt: 'Mais lidos', en: 'Most read' },
  { id: 'trending', pt: 'Em alta (30 dias)', en: 'Trending (30 days)' },
  { id: 'rating', pt: 'Mais bem avaliados', en: 'Top rated' },
  { id: 'new', pt: 'Mais recentes', en: 'Newest' },
  { id: 'az', pt: 'Título (A–Z)', en: 'Title (A–Z)' },
]

/** Filtros guardados na URL. A busca tem estado próprio: um input preso à URL perde caracteres ao digitar. */
function useGalleryFilters() {
  const [params, setParams] = useSearchParams()
  const rawLevel = params.get('level')
  const rawCategory = params.get('cat')
  const urlQuery = params.get('q') ?? ''
  const [query, setQuery] = useState(urlQuery)
  const writtenQuery = useRef(urlQuery)

  // Lê a URL atual, não a do render: a busca escreve com atraso e não pode desfazer outro filtro.
  const setFilter = (key: 'level' | 'cat' | 'author' | 'q' | 'sort' | 'stars' | 'art', value: string) => {
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
    sort: (SORTS.some(item => item.id === params.get('sort')) ? params.get('sort') : 'featured') as SortId,
    minStars: params.get('stars') === '4' ? 4 : 0,
    withArt: params.get('art') === '1',
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
  const ent = useEntitlements(s => s.data)
  const giftMode = new URLSearchParams(useLocation().search).get('presente') === '1'
  const { locale } = useLanguage()
  const pt = locale === 'pt-BR'
  const [books, setBooks] = useState<CatalogBook[] | null>(null)
  const [social, setSocial] = useState<CatalogSocial>({})
  const [error, setError] = useState('')
  // Capas por dobra: só pede as miniaturas do que está perto da tela, em lotes que se juntam num único pedido.
  const [socialReady, setSocialReady] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [thumbs, setThumbs] = useState<Record<string, string>>(() => cachedThumbs())
  const queue = useRef(new Set<string>())
  const timer = useRef<number>(0)
  const want = (ids: string[]) => {
    ids.forEach(id => { if (!thumbs[id]) queue.current.add(id) })
    if (!queue.current.size || timer.current) return
    timer.current = window.setTimeout(() => {
      timer.current = 0
      const batch = [...queue.current]; queue.current.clear()
      void loadCoverThumbs(batch).then(found => setThumbs(prev => ({ ...prev, ...found })))
    }, 40)
  }
  const { level, category, author: urlAuthor, sort, minStars, withArt, query, search, setQuery, setFilter, clear } = useGalleryFilters()
  useEffect(() => {
    // Lista e avaliações vão na frente; coleções e capas só depois, sem disputar a conexão.
    void loadCatalogSocial().then(v => { setSocial(v); setSocialReady(true) }) // pequeno; vai junto com a lista porque define o destaque
    listCatalogLite().then(setBooks)
      .catch(() => setError(pt ? 'A galeria ainda não está disponível.' : 'The gallery is not available yet.'))
  }, [pt])

  const authors = useMemo(() => {
    const names = new Set((books ?? []).map(book => book.author?.trim()).filter((name): name is string => !!name))
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [books])
  // Link antigo pode citar um autor que saiu da galeria.
  const author = books && !authors.includes(urlAuthor) ? 'all' : urlAuthor
  const activeFilters = [level !== 'all', category !== 'all', author !== 'all', sort !== 'featured', minStars > 0, withArt].filter(Boolean).length
  const filtered = level !== 'all' || category !== 'all' || author !== 'all' || !!query.trim() || sort !== 'featured' || minStars > 0 || withArt

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (books ?? []).filter(book => {
      if (level !== 'all' && book.level !== level) return false
      if (category !== 'all' && !bookCategories(book).includes(category as BookCategory)) return false
      if (author !== 'all' && book.author !== author) return false
      if (q && !`${book.title} ${book.author ?? ''} ${book.description ?? ''}`.toLowerCase().includes(q)) return false
      if (minStars && (social[book.id]?.rating ?? 0) < minStars) return false
      if (withArt && !(social[book.id]?.illustrated ?? 0)) return false
      return true
    })
    const s = (book: CatalogBook) => social[book.id]
    const newer = (a: CatalogBook, b: CatalogBook) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    const by: Record<SortId, (a: CatalogBook, b: CatalogBook) => number> = {
      featured: (a, b) => (s(b)?.readers ?? 0) - (s(a)?.readers ?? 0) || newer(a, b),
      popular: (a, b) => (s(b)?.readers ?? 0) - (s(a)?.readers ?? 0) || newer(a, b),
      trending: (a, b) => (s(b)?.recent ?? 0) - (s(a)?.recent ?? 0) || (s(b)?.readers ?? 0) - (s(a)?.readers ?? 0),
      // Média com peso: 1 avaliação 5★ não passa na frente de 20 avaliações 4,8★.
      rating: (a, b) => bayes(s(b)) - bayes(s(a)) || (s(b)?.ratings ?? 0) - (s(a)?.ratings ?? 0),
      new: newer,
      az: (a, b) => a.title.localeCompare(b.title, pt ? 'pt-BR' : 'en'),
    }
    return list.sort(by[sort])
  }, [books, level, category, author, query, sort, minStars, withArt, social, pt])

  const readers = (book: CatalogBook) => social[book.id]?.readers ?? 0
  const featured = useMemo(() => {
    return [...(books ?? [])].sort((a, b) => readers(b) - readers(a) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0]
  }, [books, social])
  const categories = useMemo(() => BOOK_CATEGORIES
    .map(item => ({ ...item, count: (books ?? []).filter(book => bookCategories(book).includes(item.id)).length }))
    .filter(item => item.count > 0), [books])

  const shelves = useMemo(() => {
    const list = books ?? []
    if (list.length < SHELVES_FROM) return []
    const rows: { id: string; title: string; hint: string; books: CatalogBook[]; onAll?: () => void }[] = []
    const popular = list.filter(book => readers(book) > 0).sort((a, b) => readers(b) - readers(a)).slice(0, 12)
    if (popular.length >= 3) rows.push({ id: 'popular', title: pt ? 'Mais lidos' : 'Most read', hint: pt ? 'O que mais gente tem na estante' : 'On the most shelves', books: popular, onAll: () => setFilter('sort', 'popular') })
    const top = list.filter(book => (social[book.id]?.ratings ?? 0) > 0).sort((a, b) => bayes(social[b.id]) - bayes(social[a.id])).slice(0, 12)
    if (top.length >= 3) rows.push({ id: 'top', title: pt ? 'Mais bem avaliados' : 'Top rated', hint: pt ? 'O que os leitores mais gostaram' : 'What readers liked most', books: top, onAll: () => setFilter('sort', 'rating') })
    const art = list.filter(book => (social[book.id]?.illustrated ?? 0) > 0).sort((a, b) => (social[b.id]?.illustrated ?? 0) - (social[a.id]?.illustrated ?? 0)).slice(0, 12)
    if (art.length >= 3) rows.push({ id: 'art', title: pt ? 'Já ilustrados' : 'Already illustrated', hint: pt ? 'Leia com as imagens prontas' : 'Read with ready-made art', books: art, onAll: () => setFilter('art', '1') })
    const easy = list.filter(book => book.level === 'A1' || book.level === 'A2')
    if (easy.length >= 3) rows.push({ id: 'easy', title: pt ? 'Para começar' : 'To get started', hint: pt ? 'Textos A1 e A2' : 'A1 and A2 texts', books: easy, onAll: () => setFilter('level', 'A1') })
    const fresh = [...list].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, 12)
    rows.push({ id: 'new', title: pt ? 'Chegaram agora' : 'Just added', hint: pt ? 'Os mais novos da galeria' : 'Newest in the gallery', books: fresh })
    for (const item of categories) {
      if (item.count < 3) continue
      rows.push({ id: item.id, title: pt ? item.pt : item.en, hint: `${item.count} ${pt ? 'livros' : 'books'}`, books: list.filter(book => bookCategories(book).includes(item.id)), onAll: () => setFilter('cat', item.id) })
    }
    return rows
  }, [books, social, categories, pt])

  // Capas em sequência, sem depender do scroll: destaque, depois cada prateleira na ordem da tela, depois o resto.
  const prefetching = useRef(false)
  useEffect(() => {
    if (!books || !socialReady || prefetching.current) return
    prefetching.current = true
    const order = [...new Set([...(featured ? [featured.id] : []), ...shelves.flatMap(shelf => shelf.books.map(b => b.id)), ...books.map(b => b.id)])]
    void (async () => {
      for (let i = 0; i < order.length; i += 12) {
        const found = await loadCoverThumbs(order.slice(i, i + 12)).catch(() => ({}))
        setThumbs(prev => ({ ...prev, ...found }))
      }
    })()
  }, [books, socialReady, featured?.id, shelves])
  const collections = useFeaturedCollections(books !== null)
  const collectionsRail = collections && collections.length === 0 ? null : (
    <section key="collections" aria-label={pt ? 'Coleções' : 'Collections'}>
      <div className="mb-2 md:mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[24px] leading-tight">{pt ? 'Coleções' : 'Collections'}</h2>
          <p className="text-[13px]" style={muted}>{pt ? 'Histórias completas, personagens lendários e aventuras inesquecíveis.' : 'Explore complete stories, legendary characters, and unforgettable adventures.'}</p>
        </div>
        <Link to="/collections" className="shrink-0 inline-flex items-center gap-1 text-[13px] font-medium">{pt ? 'Ver todas' : 'See all'}<ArrowRight className="w-3.5 h-3.5" /></Link>
      </div>
      <ScrollRail className="gap-4 md:gap-5 pt-1 pb-2 md:pb-6 snap-x" label={pt ? 'Coleções' : 'Collections'} arrowsTop="40%" top>
        {collections === null
          ? <CollectionCardSkeleton className={COLLECTION_RAIL_ITEM} />
          : collections.map(c => <CollectionCard key={c.id} collection={c} pt={pt} className={COLLECTION_RAIL_ITEM} />)}
      </ScrollRail>
    </section>
  )

  const card = (book: CatalogBook, className?: string) => (
    <BookCard key={book.id} to={`/gallery/${book.id}${giftMode ? '?presente=1' : ''}`} premium={!canOpenCatalog(ent, book.id)} title={book.title} subtitle={book.author || categoryName(book.category, pt)} coverData={thumbs[book.id]} coverPending={!thumbs[book.id]} ageMin={book.ageMin} ageInfo={book.ageInfo} level={book.level} pt={pt}
      linkState={{ gallerySearch: search }} readers={readers(book)} faces={social[book.id]?.faces} rating={social[book.id]?.rating} ratings={social[book.id]?.ratings} illustrated={social[book.id]?.illustrated} className={className} />
  )

  return (
    <div className="max-w-6xl mx-auto space-y-5 md:space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] md:text-[44px] leading-[1.02]">{pt ? 'Galeria' : 'Gallery'}</h1>
          <p className="mt-1 text-[14px] md:text-[14.5px]" style={muted}>
            {pt ? 'Clássicos escolhidos pelo nível, para ler e estudar no Bookmoo.' : 'Classics picked by level, to read and study on Bookmoo.'}
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

      {giftMode && ent && !ent.gift && (
        <div className="rounded-2xl p-4 sm:p-5 flex items-center gap-4" style={{ background: 'linear-gradient(120deg, color-mix(in srgb, var(--theme-accent) 20%, transparent), transparent)', border: '1px solid var(--theme-border)' }}>
          <span className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ backgroundColor: 'var(--theme-card-bg)', color: 'var(--theme-accent)' }} aria-hidden><Gift className="w-5 h-5" strokeWidth={1.8} /></span>
          <div className="min-w-0">
            <p className="text-[16px] font-semibold">{pt ? 'Escolha seu livro-presente' : 'Choose your gift book'}</p>
            <p className="text-[13.5px]" style={muted}>{pt ? 'Abra qualquer livro e toque em “Escolher como meu presente”. Ele fica com você para sempre.' : 'Open any book and tap “Choose as my gift”. It is yours forever.'}</p>
          </div>
        </div>
      )}
      {books === null && !error && <HeroSkeleton />}
      {!filtered && featured && <Featured book={{ ...featured, coverData: thumbs[featured.id] }} social={social} pt={pt} />}
      {categories.length > 0 && (
        <section aria-label={pt ? 'Categorias' : 'Categories'}>
          <ScrollRail className="gap-3 pt-1 pb-1 md:pb-3 snap-x" label={pt ? 'Categorias' : 'Categories'} arrowsTop="45%" top>
            {categories.map(item => (
              <CategoryTile key={item.id} id={item.id} label={pt ? item.pt : item.en} count={item.count} active={category === item.id}
                onClick={() => setFilter('cat', category === item.id ? 'all' : item.id)} className="w-[7.25rem] sm:w-36 shrink-0 snap-start" />
            ))}
          </ScrollRail>
        </section>
      )}

      {/* Celular: um botão abre o menu de filtros. Telas maiores: filtros na própria linha. */}
      <div className="sm:hidden">
        <button type="button" onClick={() => setFiltersOpen(true)} className="h-10 w-full inline-flex items-center justify-between gap-2 rounded-xl border px-3.5 text-[14px] font-medium" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
          <span className="inline-flex items-center gap-2"><SlidersHorizontal className="w-4 h-4" />{pt ? 'Filtros' : 'Filters'}</span>
          <span className="inline-flex items-center gap-2 text-[12.5px]" style={muted}>
            {activeFilters > 0 ? `${activeFilters} ${pt ? (activeFilters === 1 ? 'ativo' : 'ativos') : 'active'}` : (pt ? 'Nenhum' : 'None')}
            <ChevronRight className="w-4 h-4" />
          </span>
        </button>
      </div>
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="sm:hidden">
          <DialogHeader>
            <DialogTitle>{pt ? 'Filtros' : 'Filters'}</DialogTitle>
            <DialogDescription>{pt ? 'Escolha o nível, a categoria e a ordem.' : 'Choose level, category and sort order.'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 [&_select]:h-11 [&_select]:max-w-none [&_select]:w-full [&_select]:flex-none [&_select]:text-[14px] [&_button]:h-11">
            
        <SegmentedTabs className="w-full sm:w-fit" stretch label={pt ? 'Nível' : 'Level'} value={level} onChange={v => setFilter('level', v)}
          options={(['all', ...CEFR.map(band => band.id)] as (CefrId | 'all')[]).map(id => ({ id, label: id === 'all' ? (pt ? 'Todos' : 'All') : id }))} />
        <span className="mx-1.5 h-4 w-px shrink-0 hidden sm:block" style={{ backgroundColor: 'var(--theme-border)' }} aria-hidden />
        {categories.length > 0 && (
          <FilterSelect value={category} onChange={v => setFilter('cat', v)} label={pt ? 'Categoria' : 'Category'}
            active={category !== 'all'}
            options={[{ value: 'all', label: pt ? 'Categoria' : 'Category' }, ...categories.map(item => ({ value: item.id, label: `${pt ? item.pt : item.en} (${item.count})` }))]} />
        )}
        <FilterSelect value={sort} onChange={v => setFilter('sort', v === 'featured' ? 'all' : v)} label={pt ? 'Ordenar por' : 'Sort by'}
          active={sort !== 'featured'}
          options={SORTS.map(item => ({ value: item.id, label: pt ? item.pt : item.en }))} />
        {authors.length > 1 && (
          <FilterSelect value={author} onChange={v => setFilter('author', v)} label={pt ? 'Autor' : 'Author'}
            active={author !== 'all'}
            options={[{ value: 'all', label: pt ? 'Autor' : 'Author' }, ...authors.map(name => ({ value: name, label: name }))]} />
        )}
        <FilterChip on={minStars === 4} onClick={() => setFilter('stars', minStars === 4 ? 'all' : '4')}>
          <Star className="w-3.5 h-3.5" style={{ color: minStars === 4 ? undefined : '#E8A93B', fill: minStars === 4 ? 'currentColor' : '#E8A93B' }} />4+
        </FilterChip>
        <FilterChip on={withArt} onClick={() => setFilter('art', withArt ? 'all' : '1')}>
          <ImageIcon className="w-3.5 h-3.5" />{pt ? 'Ilustrados' : 'Illustrated'}
        </FilterChip>
        {filtered && (
          <FilterClear onClick={clear}>{pt ? 'Limpar' : 'Clear'}</FilterClear>
        )}
          </div>
          <button type="button" onClick={() => setFiltersOpen(false)} className="h-11 rounded-full text-[14px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            {pt ? `Ver ${shown.length} livros` : `Show ${shown.length} books`}
          </button>
        </DialogContent>
      </Dialog>
      <div role="group" aria-label={pt ? 'Filtros' : 'Filters'} className="hidden sm:flex flex-wrap items-center gap-2">

        <SegmentedTabs className="w-full sm:w-fit" stretch label={pt ? 'Nível' : 'Level'} value={level} onChange={v => setFilter('level', v)}
          options={(['all', ...CEFR.map(band => band.id)] as (CefrId | 'all')[]).map(id => ({ id, label: id === 'all' ? (pt ? 'Todos' : 'All') : id }))} />
        <span className="mx-1.5 h-4 w-px shrink-0 hidden sm:block" style={{ backgroundColor: 'var(--theme-border)' }} aria-hidden />
        {categories.length > 0 && (
          <FilterSelect value={category} onChange={v => setFilter('cat', v)} label={pt ? 'Categoria' : 'Category'}
            active={category !== 'all'}
            options={[{ value: 'all', label: pt ? 'Categoria' : 'Category' }, ...categories.map(item => ({ value: item.id, label: `${pt ? item.pt : item.en} (${item.count})` }))]} />
        )}
        <FilterSelect value={sort} onChange={v => setFilter('sort', v === 'featured' ? 'all' : v)} label={pt ? 'Ordenar por' : 'Sort by'}
          active={sort !== 'featured'}
          options={SORTS.map(item => ({ value: item.id, label: pt ? item.pt : item.en }))} />
        {authors.length > 1 && (
          <FilterSelect value={author} onChange={v => setFilter('author', v)} label={pt ? 'Autor' : 'Author'}
            active={author !== 'all'}
            options={[{ value: 'all', label: pt ? 'Autor' : 'Author' }, ...authors.map(name => ({ value: name, label: name }))]} />
        )}
        <FilterChip on={minStars === 4} onClick={() => setFilter('stars', minStars === 4 ? 'all' : '4')}>
          <Star className="w-3.5 h-3.5" style={{ color: minStars === 4 ? undefined : '#E8A93B', fill: minStars === 4 ? 'currentColor' : '#E8A93B' }} />4+
        </FilterChip>
        <FilterChip on={withArt} onClick={() => setFilter('art', withArt ? 'all' : '1')}>
          <ImageIcon className="w-3.5 h-3.5" />{pt ? 'Ilustrados' : 'Illustrated'}
        </FilterChip>
        {filtered && (
          <FilterClear onClick={clear}>{pt ? 'Limpar' : 'Clear'}</FilterClear>
        )}
      </div>

      {error && <p className="text-sm">{error}</p>}

      {books === null && !error && <ShelvesSkeleton />}

      {!filtered && shelves.length === 0 && collectionsRail}
      {!filtered && shelves.map((shelf, shelfIndex) => (
        <Fragment key={shelf.id}>
        <Seen as="section" onSeen={() => want(shelf.books.map(b => b.id))}>
          <div className="mb-2 md:mb-3 flex items-end justify-between gap-3">
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
          <ScrollRail className="gap-4 md:gap-5 pt-1 pb-2 md:pb-6 snap-x" label={shelf.title} arrowsTop="38%" top>
            {shelf.books.map(book => card(book, 'w-36 sm:w-40 shrink-0 snap-start'))}
          </ScrollRail>
        </Seen>
        {shelfIndex === Math.max(0, shelves.findIndex(x => x.id === 'popular')) && collectionsRail}
        </Fragment>
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
              {filtered ? (sort !== 'featured' && level === 'all' && category === 'all' && author === 'all' && !query.trim() && !minStars && !withArt ? (pt ? SORTS.find(x => x.id === sort)!.pt : SORTS.find(x => x.id === sort)!.en) : (pt ? 'Resultados' : 'Results')) : (pt ? 'Todos os livros' : 'All books')}
            </h2>
            <span className="text-[13px] tabular-nums" style={muted}>{shown.length} {pt ? (shown.length === 1 ? 'livro' : 'livros') : (shown.length === 1 ? 'book' : 'books')}</span>
          </div>
          <div className="grid gap-x-5 gap-y-9 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {shown.map(book => <Seen key={book.id} onSeen={() => want([book.id])}>{card(book)}</Seen>)}
          </div>
        </section>
      )}
    </div>
  )
}

/** Faixa de rolagem horizontal sem barra: setas discretas nas pontas aparecem só quando há mais para ver. */
function ScrollRail({ children, className = '', label, arrowsTop = '50%', top = false }: { children: ReactNode; className?: string; label: string; arrowsTop?: string; top?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ left: false, right: false })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
    update()
    el.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => { el.removeEventListener('scroll', update); observer.disconnect() }
  }, [children])
  const go = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * Math.max(240, (ref.current?.clientWidth ?? 600) * 0.7), behavior: 'smooth' })
  const arrow = 'absolute z-10 hidden md:flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm transition-opacity'
  const style = { top: arrowsTop, borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)', color: 'var(--theme-text)' }
  return (
    <div className="relative" role="group" aria-label={label}>
      <div ref={ref} className={`flex ${top ? 'items-start' : 'items-center'} overflow-x-auto no-scrollbar ${className}`}>{children}</div>
      {edge.left && <button type="button" aria-label="←" onClick={() => go(-1)} className={`${arrow} left-0`} style={style}><ChevronLeft className="w-4 h-4" /></button>}
      {edge.right && <button type="button" aria-label="→" onClick={() => go(1)} className={`${arrow} right-0`} style={style}><ChevronRight className="w-4 h-4" /></button>}
    </div>
  )
}

/** Destaque: capa grande, texto editorial e quem está lendo, sobre fundo liso (o app é flat). */
function Featured({ book, social, pt }: { book: CatalogBook; social: CatalogSocial; pt: boolean }) {
  const data = social[book.id]
  return (
    <section className="relative overflow-hidden rounded-[28px] border" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-4 md:gap-12 items-center p-4 sm:p-10">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.12em]" style={muted}>
            <Sparkles className="w-3.5 h-3.5" />{pt ? 'Destaque da galeria' : 'Gallery pick'}
          </p>
          <h2 className="mt-2 sm:mt-3 font-display text-[24px] sm:text-[52px] leading-[1] break-words">{book.title}</h2>
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
          {book.description && <p className="mt-5 max-w-xl text-[15px] leading-relaxed line-clamp-3 hidden sm:block">{book.description}</p>}
          <Link to={`/gallery/${book.id}`} className="mt-4 sm:mt-6 h-10 sm:h-11 px-4 sm:px-5 inline-flex items-center gap-2 rounded-full text-[13.5px] sm:text-[14px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            <BookOpen className="w-4 h-4" />{pt ? 'Conhecer o livro' : 'See the book'}
          </Link>
        </div>
        <Link to={`/gallery/${book.id}`} className="group justify-self-end md:mr-10 lg:mr-20 w-[88px] sm:w-52 md:w-56 transition-transform duration-500 hover:-translate-y-1">
          <BookCover title={book.title} coverData={book.coverData} className="rounded-xl" />
        </Link>
      </div>
    </section>
  )
}

const skeletonBlock = { backgroundColor: 'var(--theme-bg-secondary)' }

/** Esqueleto do destaque e dos tiles de categoria: mesma ordem e proporções da galeria carregada. */
function HeroSkeleton() {
  return (
    <div aria-hidden className="space-y-8">
      <div className="h-[34rem] md:h-[23rem] rounded-[28px] animate-pulse" style={skeletonBlock} />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => <div key={i} className="aspect-square w-[7.25rem] sm:w-36 shrink-0 rounded-2xl animate-pulse" style={skeletonBlock} />)}
      </div>
    </div>
  )
}

/** Esqueleto das prateleiras: título, linha de capas, banner de coleção e outra linha. */
function ShelvesSkeleton() {
  const row = (n: number) => (
    <div className="flex gap-5 overflow-hidden pt-1 pb-6">
      {Array.from({ length: n }).map((_, i) => <div key={i} className="w-36 sm:w-40 shrink-0"><BookCardSkeleton /></div>)}
    </div>
  )
  const title = (
    <div className="mb-3 space-y-2"><div className="h-6 w-40 rounded animate-pulse" style={skeletonBlock} /><div className="h-3 w-56 rounded animate-pulse" style={skeletonBlock} /></div>
  )
  return (
    <div aria-hidden className="space-y-8">
      <section>{title}{row(7)}</section>
      <section>{title}
        <div className="flex gap-5 overflow-hidden pt-1 pb-6">
          {[0, 1].map(i => <div key={i} className="aspect-[12/5] w-[min(82vw,29.5rem)] sm:w-[32.5rem] shrink-0 rounded-xl animate-pulse" style={skeletonBlock} />)}
        </div>
      </section>
      <section>{title}{row(7)}</section>
    </div>
  )
}

/** Avisa uma vez quando o bloco chega perto da área visível (400 px antes), para carregar o que ele precisa. */
function Seen({ onSeen, children, as: Tag = 'div' }: { onSeen: () => void; children: ReactNode; as?: 'div' | 'section' }) {
  const ref = useRef<HTMLDivElement>(null)
  const cb = useRef(onSeen); cb.current = onSeen
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { cb.current(); return }
    const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { cb.current(); io.disconnect() } }, { rootMargin: '400px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <Tag ref={ref as never}>{children}</Tag>
}
