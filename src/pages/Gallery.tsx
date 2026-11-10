import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useBookStore } from '@/store/useBookStore'
import { useLanguage } from '@/store/useLanguage'
import { parseEpub } from '@/lib/epub'
import { upsertBook } from '@/lib/supabaseSync'
import { supabase } from '@/lib/supabase'
import {
  addCatalogBook, addFeedback, getCatalogBook, listCatalog, listFeedback, listVersions, rateVersion, saveBookLink,
  type BookFeedback, type CatalogBook, type CatalogVersion,
} from '@/lib/catalog'

export function Gallery() {
  const { id } = useParams()
  return id ? <GalleryBook id={id} /> : <GalleryList />
}

function GalleryList() {
  const { locale } = useLanguage()
  const pt = locale === 'pt-BR'
  const [books, setBooks] = useState<CatalogBook[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    listCatalog().then(setBooks).catch(() => setError(pt ? 'A galeria ainda não está disponível.' : 'The gallery is not available yet.'))
  }, [pt])
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="font-display text-[34px] leading-none">{pt ? 'Galeria' : 'Gallery'}</h1>
      <p className="mt-2 max-w-xl text-[14.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
        {pt
          ? 'Livros gratuitos para praticar a leitura. A imagem de uma página, quando alguém cria, fica para todo mundo. O livro que você mesmo envia não aparece aqui.'
          : 'Free books to practice reading. A page image, once someone creates it, is there for everyone. A book you upload yourself never shows up here.'}
      </p>
      {error && <p className="mt-6 text-sm">{error}</p>}
      {books && books.length === 0 && (
        <p className="mt-8 rounded-2xl border border-dashed p-8 text-center text-[14px]" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}>
          {pt ? 'Ainda não há livros. Eles entram pela área admin.' : 'No books yet. They are added from the admin area.'}
        </p>
      )}
      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(books ?? []).map(book => (
          <Link key={book.id} to={`/gallery/${book.id}`} className="rounded-2xl border p-4 hover:bg-[var(--theme-nav-hover)]" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
            <div className="aspect-[3/4] rounded-xl mb-3 overflow-hidden" style={{ backgroundColor: 'var(--theme-pastel-1)' }}>
              {book.coverData && <img src={book.coverData} alt="" className="w-full h-full object-cover" />}
            </div>
            <p className="font-medium leading-snug">{book.title}</p>
            {book.author && <p className="mt-1 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{book.author}</p>}
          </Link>
        ))}
      </div>
    </div>
  )
}

function GalleryBook({ id }: { id: string }) {
  const { locale } = useLanguage()
  const pt = locale === 'pt-BR'
  const navigate = useNavigate()
  const { user, session, hasSupabase } = useAuth()
  const addBook = useBookStore(s => s.addBook)
  const books = useBookStore(s => s.books)
  const [book, setBook] = useState<CatalogBook | null>(null)
  const [versions, setVersions] = useState<CatalogVersion[]>([])
  const [feedback, setFeedback] = useState<BookFeedback[]>([])
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const reload = () => {
    void getCatalogBook(id).then(setBook)
    void listVersions(id, user?.id).then(setVersions)
    void listFeedback(id).then(setFeedback)
  }
  useEffect(() => { reload() }, [id, user?.id])

  const owned = books.find(item => item.catalogId === id)

  const pull = async () => {
    if (!book || !user) return
    setBusy(true)
    const created = addBook(book.title, book.pages.join('\n\n'), {
      author: book.author, description: book.description, languageCode: book.languageCode, coverData: book.coverData, pages: book.pages,
    })
    useBookStore.getState().updateBook(created.id, { catalogId: id, imageMode: 'shared' })
    if (hasSupabase && supabase && session?.user) {
      await upsertBook(supabase, session.user.id, useBookStore.getState().books.find(item => item.id === created.id)!).catch(() => {})
      await saveBookLink({ bookId: created.id, catalogId: id, imageMode: 'shared' }, user.id)
    }
    setBusy(false)
    navigate(`/book/${created.id}`)
  }

  const adopt = async (version: CatalogVersion) => {
    if (!owned || !user) { setNotice(pt ? 'Leve o livro para a sua estante antes.' : 'Add the book to your shelf first.'); return }
    const images: Record<number, string> = {}
    for (const [page, url] of Object.entries(version.images)) images[Number(page)] = url
    useBookStore.getState().updateBook(owned.id, { imageMode: 'personal', comicPages: images })
    await saveBookLink({ bookId: owned.id, catalogId: id, imageMode: 'personal' }, user.id)
    if (hasSupabase && supabase) {
      const latest = useBookStore.getState().books.find(item => item.id === owned.id)
      if (latest) await upsertBook(supabase, user.id, latest).catch(() => {})
    }
    setNotice(pt ? 'Esta versão ficou só na sua estante. A galeria continua igual para os outros.' : 'This version is only on your shelf. The gallery stays the same for everyone.')
  }

  if (!book) return <p className="max-w-3xl mx-auto text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Carregando…' : 'Loading…'}</p>

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/gallery" className="text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? '← Galeria' : '← Gallery'}</Link>
      <div className="mt-4 flex gap-5">
        <div className="w-28 shrink-0 aspect-[3/4] rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--theme-pastel-1)' }}>
          {book.coverData && <img src={book.coverData} alt="" className="w-full h-full object-cover" />}
        </div>
        <div>
          <h1 className="font-display text-[32px] leading-none">{book.title}</h1>
          {book.author && <p className="mt-2 text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>{book.author}</p>}
          {book.description && <p className="mt-3 text-[14.5px] leading-relaxed">{book.description}</p>}
          <button type="button" disabled={busy || !!owned} onClick={pull}
            className="mt-4 h-10 px-4 rounded-lg text-[14px] font-medium disabled:opacity-60"
            style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            {owned ? (pt ? 'Já está na sua estante' : 'Already on your shelf') : (pt ? 'Levar para a minha estante' : 'Add to my shelf')}
          </button>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-[15px] font-semibold">{pt ? 'Versões da comunidade' : 'Community versions'}</h2>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt
            ? 'A imagem padrão é a da galeria. Abaixo ficam versões que outras pessoas desenharam só para elas e decidiram mostrar. As estrelas ordenam a lista.'
            : 'The default art is the gallery’s. Below are versions people drew for themselves and chose to show. Stars sort the list.'}
        </p>
        {versions.length === 0 && <p className="mt-3 text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Nenhuma versão publicada ainda.' : 'No published version yet.'}</p>}
        <ul className="mt-3 divide-y rounded-2xl border" style={{ borderColor: 'var(--theme-border)' }}>
          {versions.map(version => (
            <li key={version.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium truncate">{version.authorName || (pt ? 'Leitor' : 'Reader')}</p>
                <p className="text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
                  {version.stars ? version.stars.toFixed(1) : '–'} ★ · {version.votes} {pt ? 'votos' : 'votes'} · {Object.keys(version.images).length} {pt ? 'páginas' : 'pages'}
                </p>
              </div>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} type="button" aria-label={`${star}`} className="text-[16px]" style={{ color: (version.mine ?? 0) >= star ? 'var(--theme-text)' : 'var(--theme-border)' }}
                    onClick={() => { if (!user) return; void rateVersion(version.id, user.id, star).then(reload) }}>★</button>
                ))}
              </div>
              <button type="button" className="h-8 px-3 rounded-lg border text-[12.5px]" style={{ borderColor: 'var(--theme-border)' }} onClick={() => { void adopt(version) }}>
                {pt ? 'Usar só para mim' : 'Use just for me'}
              </button>
            </li>
          ))}
        </ul>
        {notice && <p className="mt-2 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{notice}</p>}
      </section>

      <section className="mt-10">
        <h2 className="text-[15px] font-semibold">{pt ? 'Comentários' : 'Comments'}</h2>
        <div className="mt-3 flex gap-2">
          <input value={comment} onChange={e => setComment(e.target.value)} placeholder={pt ? 'O que achou deste livro?' : 'What did you think of this book?'}
            className="flex-1 h-10 rounded-lg border px-3 text-[14px] bg-transparent outline-none" style={{ borderColor: 'var(--theme-border)' }} />
          <button type="button" disabled={!comment.trim() || !user} className="h-10 px-3 rounded-lg text-[13.5px] font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--theme-pastel-2)', color: 'var(--theme-pastel-text)' }}
            onClick={() => {
              if (!user) return
              void addFeedback(id, user.id, user.user_metadata?.full_name || user.email?.split('@')[0] || '', comment.trim()).then(() => { setComment(''); reload() })
            }}>{pt ? 'Enviar' : 'Send'}</button>
        </div>
        <ul className="mt-4 space-y-3">
          {feedback.map(item => (
            <li key={item.id} className="rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
              <p className="text-[12.5px] font-medium" style={{ color: 'var(--theme-text-secondary)' }}>{item.authorName}</p>
              <p className="text-[14px]">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export function AdminGalleryForm({ pt }: { pt: boolean }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [description, setDescription] = useState('')
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<Awaited<ReturnType<typeof parseEpub>> | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const field = 'w-full h-10 rounded-lg border px-3 text-[14px] bg-transparent outline-none'
  const border = { borderColor: 'var(--theme-border)' }

  return (
    <form className="rounded-2xl border p-5 space-y-3" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}
      onSubmit={async event => {
        event.preventDefault()
        if (!user || !parsed) return
        setBusy(true)
        setMessage('')
        try {
          await addCatalogBook({
            title: title.trim() || parsed.title,
            author: author.trim() || parsed.author,
            description: description.trim(),
            languageCode: parsed.language || 'en',
            coverData: parsed.coverDataUrl,
            pages: parsed.pages,
          }, user.id)
          setTitle(''); setAuthor(''); setDescription(''); setParsed(null); setFileName('')
          setMessage(pt ? 'Livro na galeria. Quem já tem conta pode levar para a estante.' : 'Book is in the gallery.')
        } catch {
          setMessage(pt ? 'Não entrou. Confira se você está na conta de admin.' : 'It did not save. Check that this is the admin account.')
        } finally {
          setBusy(false)
        }
      }}>
      <h2 className="text-[15px] font-semibold">{pt ? 'Novo livro gratuito' : 'New free book'}</h2>
      <p className="text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>
        {pt ? 'Só livros que você pode compartilhar. O EPUB de um aluno não usa este caminho.' : 'Only books you are allowed to share. A student’s EPUB does not use this path.'}
      </p>
      <input className={field} style={border} placeholder={pt ? 'Título' : 'Title'} value={title} onChange={e => setTitle(e.target.value)} />
      <input className={field} style={border} placeholder={pt ? 'Autor' : 'Author'} value={author} onChange={e => setAuthor(e.target.value)} />
      <textarea className="w-full rounded-lg border px-3 py-2 text-[14px] bg-transparent outline-none" style={border} rows={3} placeholder={pt ? 'Descrição curta' : 'Short description'} value={description} onChange={e => setDescription(e.target.value)} />
      <label className="h-10 px-3 inline-flex items-center rounded-lg border text-[13.5px] cursor-pointer" style={border}>
        {fileName || (pt ? 'Escolher EPUB' : 'Choose EPUB')}
        <input type="file" accept=".epub,application/epub+zip" className="sr-only" onChange={async e => {
          const file = e.target.files?.[0]
          e.currentTarget.value = ''
          if (!file) return
          setFileName(file.name)
          setParsed(await parseEpub(file))
        }} />
      </label>
      {parsed && <p className="text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{parsed.pages.length} {pt ? 'páginas' : 'pages'} · {parsed.title}</p>}
      <button type="submit" disabled={busy || !parsed} className="h-10 px-4 rounded-lg text-[14px] font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
        {busy ? (pt ? 'Publicando…' : 'Publishing…') : (pt ? 'Publicar na galeria' : 'Publish to the gallery')}
      </button>
      {message && <p className="text-[13px]">{message}</p>}
    </form>
  )
}
