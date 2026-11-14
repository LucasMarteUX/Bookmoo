import { FilterClear, FilterSearch, FilterSelect } from '@/components/ui/filter-controls'
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { askConfirm } from '@/components/ui/confirm'
import { toast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/store/useLanguage'
import { CEFR, type CefrId } from '@/lib/cefr'
import { adminOverview, BOOK_CATEGORIES, deleteCatalogBook, listCatalog, updateCatalogMeta, type BookCategory, type CatalogBook } from '@/lib/catalog'
import { AdminGalleryForm } from './Gallery'
import { AdminReports } from '@/components/community/AdminReports'
import { StyleBankAdmin } from '@/components/book/StyleBankAdmin'

export function AdminPage() {
  const { isAdmin, loading } = useAuth()
  const { locale } = useLanguage()
  const pt = locale === 'pt-BR'
  const [stats, setStats] = useState<{ users: number; readers_today: number; books: number; catalog: number } | null>(null)
  const [books, setBooks] = useState<CatalogBook[]>([])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!isAdmin) return
    void adminOverview().then(setStats)
    void listCatalog().then(setBooks).catch(() => setBooks([]))
  }, [isAdmin, tick])

  if (loading) return null
  if (!isAdmin) return <Navigate to="/" replace />

  const cards = [
    { label: pt ? 'Pessoas' : 'People', value: stats?.users },
    { label: pt ? 'Leram hoje' : 'Read today', value: stats?.readers_today },
    { label: pt ? 'Livros nas estantes' : 'Books on shelves', value: stats?.books },
    { label: pt ? 'Na galeria' : 'In the gallery', value: stats?.catalog },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header>
        <h1 className="font-display text-[34px] leading-none">{pt ? 'Área admin' : 'Admin'}</h1>
        <Link to="/admin/financeiro" className="mt-3 inline-flex h-9 px-3 rounded-lg items-center text-[13.5px] font-medium border" style={{ borderColor: 'var(--theme-border)' }}>{pt ? 'Financeiro: receita × custo de IA' : 'Finance: revenue × AI cost'}</Link>
        <p className="mt-2 text-[14.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? 'Quem está lendo e os livros gratuitos da galeria.' : 'Who is reading, and the free books in the gallery.'}
        </p>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map(card => (
          <div key={card.label} className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)', color: 'var(--theme-text)' }}>
            <p className="text-[12px]" style={{ color: 'var(--theme-text-secondary)' }}>{card.label}</p>
            <p className="mt-1 font-display text-[28px] leading-none">{card.value ?? '–'}</p>
          </div>
        ))}
      </div>
      <AdminReports pt={pt} />
      <StyleBankAdmin pt={pt} />
      <PublishedBooks pt={pt} books={books} onChange={() => setTick(n => n + 1)} />
      <AdminGalleryForm pt={pt} onPublished={() => setTick(n => n + 1)} />
    </div>
  )
}

const PAGE_SIZE = 10

function PublishedBooks({ pt, books, onChange }: { pt: boolean; books: CatalogBook[]; onChange: () => void }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<BookCategory | 'none' | ''>('')
  const [level, setLevel] = useState<CefrId | 'none' | ''>('')
  const [page, setPage] = useState(1)
  const field = 'h-9 rounded-lg border px-2 text-[13px] outline-none'
  const style = { borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }

  const needle = query.trim().toLowerCase()
  const filtered = books.filter(book => {
    if (needle && !`${book.title} ${book.author ?? ''}`.toLowerCase().includes(needle)) return false
    if (category && (category === 'none' ? book.category : book.category !== category)) return false
    if (level && (level === 'none' ? book.level : book.level !== level)) return false
    return true
  })
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const filtering = !!(needle || category || level)
  const pageBtn = 'h-8 px-3 rounded-lg border text-[13px] font-medium disabled:opacity-40'

  return (
    <section>
      <h2 className="text-[15px] font-semibold">{pt ? 'Livros publicados' : 'Published books'}</h2>
      <p className="mt-1 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>
        {pt ? 'Troque a capa, o nível ou a categoria e salve. Nada muda antes do botão.' : 'Change the cover, level or category, then save. Nothing updates before the button.'}
      </p>
      {books.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <FilterSearch grow value={query} onChange={v => { setQuery(v); setPage(1) }} placeholder={pt ? 'Pesquisar por título ou autor' : 'Search by title or author'} label={pt ? 'Pesquisar livros' : 'Search books'} />
          <FilterSelect value={category} onChange={v => { setCategory(v as BookCategory | 'none' | ''); setPage(1) }} label={pt ? 'Filtrar por categoria' : 'Filter by category'}
            options={[{ value: '', label: pt ? 'Todas as categorias' : 'All categories' }, ...BOOK_CATEGORIES.map(item => ({ value: item.id, label: pt ? item.pt : item.en })), { value: 'none', label: pt ? 'Sem categoria' : 'No category' }]} />
          <FilterSelect value={level} onChange={v => { setLevel(v as CefrId | 'none' | ''); setPage(1) }} label={pt ? 'Filtrar por nível' : 'Filter by level'}
            options={[{ value: '', label: pt ? 'Todos os níveis' : 'All levels' }, ...CEFR.map(band => ({ value: band.id, label: band.id })), { value: 'none', label: pt ? 'Sem nível' : 'No level' }]} />
          {filtering && (
            <FilterClear onClick={() => { setQuery(''); setCategory(''); setLevel(''); setPage(1) }}>{pt ? 'Limpar' : 'Clear'}</FilterClear>
          )}
        </div>
      )}
      {books.length > 0 && (
        <p className="mt-3 text-[12.5px]" role="status" style={{ color: 'var(--theme-text-secondary)' }}>
          {filtering
            ? (pt ? `${filtered.length} de ${books.length} livros` : `${filtered.length} of ${books.length} books`)
            : (pt ? `${books.length} livros` : `${books.length} books`)}
        </p>
      )}
      {books.length === 0 && (
        <p className="mt-4 text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? 'Nenhum livro na galeria ainda.' : 'No books in the gallery yet.'}
        </p>
      )}
      {books.length > 0 && filtered.length === 0 && (
        <p className="mt-4 text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? 'Nenhum livro com esses filtros.' : 'No books match these filters.'}
        </p>
      )}
      <ul className="mt-3 space-y-3">
        {visible.map(book => <PublishedBook key={book.id} book={book} pt={pt} onSaved={onChange} />)}
      </ul>
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-3" aria-label={pt ? 'Páginas' : 'Pages'}>
          <button type="button" className={pageBtn} style={style} disabled={current <= 1} onClick={() => setPage(current - 1)}>{pt ? 'Anterior' : 'Previous'}</button>
          <span className="text-[13px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? `Página ${current} de ${pages}` : `Page ${current} of ${pages}`}</span>
          <button type="button" className={pageBtn} style={style} disabled={current >= pages} onClick={() => setPage(current + 1)}>{pt ? 'Próxima' : 'Next'}</button>
        </nav>
      )}
    </section>
  )
}

function PublishedBook({ book, pt, onSaved }: { book: CatalogBook; pt: boolean; onSaved: () => void }) {
  const [level, setLevel] = useState(book.level ?? '')
  const [category, setCategory] = useState<BookCategory | ''>(book.category ?? '')
  const [cover, setCover] = useState(book.coverData ?? '')
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const field = 'h-8 rounded-lg border px-2 text-[13px] outline-none cursor-pointer'
  const style = { borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }
  const dirty = level !== (book.level ?? '') || category !== (book.category ?? '') || cover !== (book.coverData ?? '')

  useEffect(() => {
    setLevel(book.level ?? '')
    setCategory(book.category ?? '')
    setCover(book.coverData ?? '')
  }, [book.level, book.category, book.coverData])

  const pickCover = async (file: File) => {
    setNote('')
    try {
      setCover(await coverDataUrl(file))
    } catch {
      setNote(pt ? 'Não consegui ler essa imagem.' : 'Could not read that image.')
    }
  }

  const remove = async () => {
    const ok = await askConfirm(pt ? `Remover “${book.title}” da galeria?` : `Remove “${book.title}” from the gallery?`, {
      detail: pt
        ? 'Some para todos: avaliações, imagens compartilhadas, versões e comentários deste livro são apagados. Quem já tem o livro na estante continua com a própria cópia. Não dá para desfazer.'
        : 'It disappears for everyone: reviews, shared images, versions and comments are deleted. Readers keep their own copy. This cannot be undone.',
      confirmLabel: pt ? 'Remover da galeria' : 'Remove from gallery',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteCatalogBook(book.id)
      toast(pt ? `“${book.title}” saiu da galeria` : `“${book.title}” removed from the gallery`)
      onSaved()
    } catch {
      toast(pt ? 'Não foi possível remover' : 'Could not remove', { tone: 'error', detail: pt ? 'Confira se esta é a conta de admin e tente de novo.' : 'Check this is the admin account and try again.' })
    }
  }

  const save = async () => {
    setSaving(true)
    setNote('')
    try {
      await updateCatalogMeta(book.id, {
        level: (level || null) as CefrId | null,
        category: (category || null) as BookCategory | null,
        // A lista traz só a miniatura: a capa só é enviada quando a pessoa escolheu uma nova.
        ...(cover !== (book.coverData ?? '') ? { coverData: cover || null } : {}),
      })
      setNote(pt ? 'Salvo.' : 'Saved.')
      onSaved()
    } catch {
      setNote(pt ? 'Não salvou.' : 'It did not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="flex gap-3 rounded-2xl border p-3" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
      <label className="book-cover relative w-16 shrink-0 aspect-[2/3] rounded-md overflow-hidden cursor-pointer" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} title={pt ? 'Trocar capa' : 'Change cover'}>
        {cover && <img src={cover} alt="" className="w-full h-full object-cover" />}
        <span className="absolute inset-x-0 bottom-0 py-1 text-center text-[10px] font-medium" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-card-bg) 88%, transparent)', color: 'var(--theme-text)' }}>
          {pt ? 'Capa' : 'Cover'}
        </span>
        <input type="file" accept="image/*" className="sr-only" onChange={e => { const file = e.target.files?.[0]; e.currentTarget.value = ''; if (file) void pickCover(file) }} />
      </label>
      <div className="min-w-0 flex-1">
        <Link to={`/gallery/${book.id}`} className="block text-[14px] font-medium leading-snug truncate">{book.title}</Link>
        {book.author && <p className="text-[12.5px] truncate" style={{ color: 'var(--theme-text-secondary)' }}>{book.author}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select aria-label={pt ? 'Nível' : 'Level'} className={field} style={style} value={level} onChange={e => setLevel(e.target.value as CefrId | '')}>
            <option value="">{pt ? 'Sem nível' : 'No level'}</option>
            {CEFR.map(band => <option key={band.id} value={band.id}>{band.id} · {pt ? band.pt : band.en}</option>)}
          </select>
          <select aria-label={pt ? 'Categoria' : 'Category'} className={field} style={style} value={category} onChange={e => setCategory(e.target.value as BookCategory | '')}>
            <option value="">{pt ? 'Sem categoria' : 'No category'}</option>
            {BOOK_CATEGORIES.map(item => <option key={item.id} value={item.id}>{pt ? item.pt : item.en}</option>)}
          </select>
          <button type="button" disabled={!dirty || saving} onClick={() => { void save() }}
            className="h-8 px-3 rounded-lg text-[13px] font-medium disabled:opacity-40"
            style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            {saving ? (pt ? 'Salvando…' : 'Saving…') : (pt ? 'Salvar' : 'Save')}
          </button>
          {note && <span className="text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{note}</span>}
          <Link to={`/admin/books/${book.id}`} aria-label={pt ? `Editar texto de ${book.title}` : `Edit text of ${book.title}`}
            className="ui-hover ml-auto h-8 px-3 rounded-lg border text-[13px] font-medium inline-flex items-center gap-1.5" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}>
            <Pencil className="w-3.5 h-3.5" />{pt ? 'Editar' : 'Edit'}
          </Link>
          <button type="button" onClick={() => { void remove() }} aria-label={pt ? `Remover ${book.title} da galeria` : `Remove ${book.title} from the gallery`}
            className="ui-hover h-8 px-3 rounded-lg border text-[13px] font-medium inline-flex items-center gap-1.5"
            style={{ borderColor: 'color-mix(in srgb, var(--color-destructive) 45%, transparent)', color: 'var(--color-destructive)' }}>
            <Trash2 className="w-3.5 h-3.5" />{pt ? 'Remover' : 'Remove'}
          </button>
        </div>
      </div>
    </li>
  )
}

function coverDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const max = 900
        const scale = Math.min(1, max / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('canvas')); return }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.86))
      }
      image.onerror = () => reject(new Error('image'))
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
