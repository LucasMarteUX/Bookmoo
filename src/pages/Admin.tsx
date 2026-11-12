import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/store/useLanguage'
import { CEFR, type CefrId } from '@/lib/cefr'
import { adminOverview, BOOK_CATEGORIES, listCatalog, updateCatalogMeta, type BookCategory, type CatalogBook } from '@/lib/catalog'
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

function PublishedBooks({ pt, books, onChange }: { pt: boolean; books: CatalogBook[]; onChange: () => void }) {
  return (
    <section>
      <h2 className="text-[15px] font-semibold">{pt ? 'Livros publicados' : 'Published books'}</h2>
      <p className="mt-1 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>
        {pt ? 'Troque a capa, o nível ou a categoria e salve. Nada muda antes do botão.' : 'Change the cover, level or category, then save. Nothing updates before the button.'}
      </p>
      {books.length === 0 && (
        <p className="mt-4 text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? 'Nenhum livro na galeria ainda.' : 'No books in the gallery yet.'}
        </p>
      )}
      <ul className="mt-4 space-y-3">
        {books.map(book => <PublishedBook key={book.id} book={book} pt={pt} onSaved={onChange} />)}
      </ul>
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

  const save = async () => {
    setSaving(true)
    setNote('')
    try {
      await updateCatalogMeta(book.id, {
        level: (level || null) as CefrId | null,
        category: (category || null) as BookCategory | null,
        coverData: cover || null,
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
