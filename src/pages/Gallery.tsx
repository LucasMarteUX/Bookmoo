import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { BookCover } from '@/components/book/BookCard'
import { BookReviews } from '@/components/community/BookReviews'
import { StyleCard, StylePickerDialog, useStyleBank } from '@/components/book/StylePicker'
import { bookStyleKey, catalogStyleOptions, LEGACY_STYLE } from '@/lib/comicStyles'
import { GalleryList } from '@/pages/GalleryList'
import { LevelBadge } from '@/components/ui/level-badge'
import { useBookStore } from '@/store/useBookStore'
import { useLanguage } from '@/store/useLanguage'
import { CEFR, type CefrId } from '@/lib/cefr'
import { parseEpub } from '@/lib/epub'
import { countWords } from '@/lib/utils'
import { upsertBook } from '@/lib/supabaseSync'
import { supabase } from '@/lib/supabase'
import {
  addCatalogBook, addFeedback, BOOK_CATEGORIES, categoryName, getCatalogBook, listFeedback, listVersions, rateVersion, saveBookLink, updateCatalogMeta,
  type BookCategory, type BookFeedback, type CatalogBook, type CatalogVersion,
} from '@/lib/catalog'

export function Gallery() {
  const { id } = useParams()
  return id ? <GalleryBook id={id} /> : <GalleryList />
}

function GalleryBook({ id }: { id: string }) {
  const { locale } = useLanguage()
  const pt = locale === 'pt-BR'
  const navigate = useNavigate()
  const gallerySearch = (useLocation().state as { gallerySearch?: string } | null)?.gallerySearch
  const { user, session, hasSupabase, isAdmin } = useAuth()
  const addBook = useBookStore(s => s.addBook)
  const books = useBookStore(s => s.books)
  const [book, setBook] = useState<CatalogBook | null | undefined>(undefined)
  const [versions, setVersions] = useState<CatalogVersion[]>([])
  const [feedback, setFeedback] = useState<BookFeedback[]>([])
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [draftLevel, setDraftLevel] = useState<CefrId | ''>('')
  const [draftCategory, setDraftCategory] = useState<BookCategory | ''>('')
  const [metaNote, setMetaNote] = useState('')
  const [styleOptions, setStyleOptions] = useState<{ styleId: string; pages: number; isDefault: boolean }[]>([])
  const [chosenStyle, setChosenStyle] = useState<string | null>(null)
  const [pickingStyle, setPickingStyle] = useState(false)
  const bank = useStyleBank(pt)

  const reload = () => {
    void getCatalogBook(id).then(setBook)
    void listVersions(id, user?.id).then(setVersions)
    void listFeedback(id).then(setFeedback)
  }
  useEffect(() => { reload() }, [id, user?.id])
  // Estilos que este livro já tem na galeria. O padrão vem marcado.
  useEffect(() => {
    void catalogStyleOptions(id).then(options => {
      setStyleOptions(options)
      setChosenStyle(options.find(option => option.isDefault)?.styleId ?? options[0]?.styleId ?? null)
    })
  }, [id])
  useEffect(() => {
    if (!book) return
    setDraftLevel(book.level ?? '')
    setDraftCategory(book.category ?? '')
  }, [book])

  const owned = books.find(item => item.catalogId === id)

  const pull = async () => {
    if (!book || !user) return
    setBusy(true)
    const created = addBook(book.title, book.pages.join('\n\n'), {
      author: book.author, description: book.description, languageCode: book.languageCode, coverData: book.coverData, pages: book.pages, cefrLevel: book.level,
    })
    // Sem escolha, o estilo sai do tipo do livro na primeira geração.
    useBookStore.getState().updateBook(created.id, { catalogId: id, imageMode: 'shared', ...(chosenStyle ? { comicStyleDoc: { styleId: chosenStyle } } : {}) })
    if (hasSupabase && supabase && session?.user) {
      await upsertBook(supabase, session.user.id, useBookStore.getState().books.find(item => item.id === created.id)!).catch(() => {})
      await saveBookLink({ bookId: created.id, catalogId: id, imageMode: 'shared', styleId: chosenStyle ?? undefined }, user.id)
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

  if (book === undefined) return <p className="max-w-3xl mx-auto text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Carregando…' : 'Loading…'}</p>
  if (!book) return <p className="max-w-3xl mx-auto text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Este livro não está na galeria.' : 'This book is not in the gallery.'}</p>

  const band = CEFR.find(item => item.id === book.level)
  const words = countWords(book.pages.join(' '))
  const excerpt = book.pages.find(page => page.trim().length > 80)?.trim().slice(0, 520)
  const lang = book.languageCode === 'en' ? (pt ? 'Inglês' : 'English') : book.languageCode.toUpperCase()
  const saveMeta = async () => {
    if (!draftLevel || !draftCategory) { setMetaNote(pt ? 'Escolha o nível e a categoria.' : 'Choose a level and a category.'); return }
    setMetaNote('')
    try {
      await updateCatalogMeta(id, { level: draftLevel, category: draftCategory })
      setMetaNote(pt ? 'Nível e categoria salvos.' : 'Level and category saved.')
      reload()
    } catch {
      setMetaNote(pt ? 'Não salvou. Confira se esta é a conta de admin.' : 'It did not save. Check that this is the admin account.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link to={gallerySearch ? `/gallery?${gallerySearch}` : '/gallery'} className="text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? '← Galeria' : '← Gallery'}</Link>
      <div className="mt-5 flex flex-col sm:flex-row gap-6 sm:gap-8">
        <BookCover title={book.title} coverData={book.coverData} className="w-44 sm:w-56 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[40px] leading-[0.95]">{book.title}</h1>
          {book.author && <p className="mt-3 text-[16px]" style={{ color: 'var(--theme-text-secondary)' }}>{book.author}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {book.level && <LevelBadge id={book.level} pt={pt} />}
            {book.category && <Pill>{categoryName(book.category, pt)}</Pill>}
            <Pill>{lang}</Pill>
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-2 max-w-md">
            <Fact label={pt ? 'Páginas' : 'Pages'} value={book.pages.length ? String(book.pages.length) : '–'} />
            <Fact label={pt ? 'Palavras' : 'Words'} value={words ? words.toLocaleString(pt ? 'pt-BR' : 'en-US') : '–'} />
            <Fact label={pt ? 'Idioma' : 'Language'} value={lang} />
          </dl>
          <button type="button" disabled={busy || !!owned} onClick={pull}
            className="mt-6 h-11 px-5 rounded-xl text-[14.5px] font-medium disabled:opacity-60"
            style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            {owned ? (pt ? 'Já está na sua estante' : 'Already on your shelf') : (pt ? 'Levar para a minha estante' : 'Add to my shelf')}
          </button>
        </div>
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">{pt ? 'Estilo das ilustrações' : 'Illustration style'}</h2>
            <p className="mt-1 text-[13px] max-w-xl" style={{ color: 'var(--theme-text-secondary)' }}>
              {owned
                ? (pt ? 'Para trocar o estilo do seu exemplar, abra o livro e vá em direção de arte. Trocar recomeça as imagens do zero.' : 'To change your copy’s style, open the book and go to art direction. Changing restarts the images from scratch.')
                : styleOptions.length
                  ? (pt ? 'A primeira pessoa que gerou este livro definiu o estilo. Escolha um dos que já existem ou comece outro do zero.' : 'The first reader to generate this book set its style. Pick an existing one or start another from scratch.')
                  : (pt ? 'Ninguém gerou imagens deste livro ainda. Sem escolha, o estilo sai do tipo do livro e vale para quem vier depois.' : 'Nobody has generated this book yet. Without a choice, the style follows the book type and applies to everyone after you.')}
            </p>
          </div>
          {!owned && (
            <button type="button" onClick={() => setPickingStyle(true)} className="h-9 px-3.5 rounded-full border text-[13px]" style={{ borderColor: 'var(--theme-border)' }}>
              {styleOptions.length ? (pt ? 'Outro estilo' : 'Another style') : (pt ? 'Escolher estilo' : 'Choose a style')}
            </button>
          )}
        </div>
        {(() => {
          const shown = owned
            ? [bookStyleKey(owned)].filter(styleId => styleId !== LEGACY_STYLE || styleOptions.some(option => option.styleId === LEGACY_STYLE))
            : [...styleOptions.map(option => option.styleId), ...(chosenStyle && !styleOptions.some(option => option.styleId === chosenStyle) ? [chosenStyle] : [])]
          if (!shown.length) return null
          return (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-3xl">
              {shown.map(styleId => {
                const option = styleOptions.find(item => item.styleId === styleId)
                const meta = bank?.find(item => item.id === styleId)
                const note = option
                  ? `${option.isDefault ? (pt ? 'Padrão · ' : 'Default · ') : ''}${option.pages} ${pt ? (option.pages === 1 ? 'página pronta' : 'páginas prontas') : 'pages ready'}`
                  : (pt ? 'Novo: começa do zero' : 'New: starts from scratch')
                if (styleId === LEGACY_STYLE) {
                  return <StyleCard key={styleId} pt={pt} compact note={note} preview={book.coverData}
                    style={{ id: LEGACY_STYLE, name: pt ? 'Estilo original' : 'Original style', look: '', ready: true }}
                    selected={!owned && chosenStyle === styleId} onClick={owned ? undefined : () => setChosenStyle(styleId)} />
                }
                return meta
                  ? <StyleCard key={styleId} style={meta} pt={pt} compact note={note} selected={!owned && chosenStyle === styleId} onClick={owned ? undefined : () => setChosenStyle(styleId)} />
                  : null
              })}
            </div>
          )
        })()}
        <StylePickerDialog open={pickingStyle} onOpenChange={setPickingStyle} value={chosenStyle} pt={pt} confirmLabel={pt ? 'Escolher este estilo' : 'Choose this style'}
          notes={Object.fromEntries(styleOptions.map(option => [option.styleId, `${option.pages} ${pt ? 'páginas prontas' : 'pages ready'}`]))}
          description={pt ? 'Um estilo que já tem páginas usa as imagens prontas. Um estilo novo começa do zero e passa a ser oferecido a quem puxar o livro depois.' : 'A style with pages reuses the ready images. A new style starts from scratch and is offered to readers after you.'}
          onPick={styleId => { setChosenStyle(styleId); setPickingStyle(false) }} />
      </section>

      {book.description && (
        <section className="mt-10 max-w-2xl">
          <h2 className="text-[15px] font-semibold">{pt ? 'Sobre o livro' : 'About the book'}</h2>
          <p className="mt-2 text-[15.5px] leading-relaxed">{book.description}</p>
        </section>
      )}

      {band && (
        <section className="mt-8 max-w-2xl rounded-2xl px-5 py-4" style={{ backgroundColor: 'var(--theme-pastel-4)', color: 'var(--theme-pastel-text)' }}>
          <p className="text-[12.5px] font-medium uppercase tracking-wide" style={{ opacity: 0.7 }}>{pt ? 'Para quem é' : 'Who it is for'}</p>
          <p className="mt-1 text-[16px] font-medium">{band.id} · {pt ? band.pt : band.en}</p>
          <p className="mt-1 text-[14.5px] leading-relaxed">{pt ? band.can.pt : band.can.en}</p>
        </section>
      )}

      {excerpt && (
        <section className="mt-8 max-w-2xl">
          <h2 className="text-[15px] font-semibold">{pt ? 'Começo do livro' : 'Opening lines'}</h2>
          <p className="mt-2 text-[15px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>{excerpt}{excerpt.length >= 520 ? '…' : ''}</p>
        </section>
      )}

      {isAdmin && (
        <section className="mt-10 rounded-2xl border p-5" style={{ borderColor: 'var(--theme-border)' }}>
          <h2 className="text-[15px] font-semibold">{pt ? 'Classificar este livro' : 'Classify this book'}</h2>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>
            {pt ? 'Só a sua conta vê isto. O nível e a categoria passam a aparecer nos filtros.' : 'Only your account sees this. Level and category then show up in the filters.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {CEFR.map(item => (
              <FilterChip key={item.id} on={draftLevel === item.id} onClick={() => setDraftLevel(item.id)}>{item.id} {pt ? item.pt : item.en}</FilterChip>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {BOOK_CATEGORIES.map(item => (
              <FilterChip key={item.id} on={draftCategory === item.id} onClick={() => setDraftCategory(item.id)}>{pt ? item.pt : item.en}</FilterChip>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" onClick={() => { void saveMeta() }} className="h-9 px-4 rounded-lg text-[13.5px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
              {pt ? 'Salvar classificação' : 'Save classification'}
            </button>
            {metaNote && <p className="text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{metaNote}</p>}
          </div>
        </section>
      )}

      <BookReviews catalogId={id} cover={book.coverData} pt={pt} />

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

export function AdminGalleryForm({ pt, onPublished }: { pt: boolean; onPublished?: () => void }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [description, setDescription] = useState('')
  const [level, setLevel] = useState<CefrId>('A1')
  const [category, setCategory] = useState<BookCategory>('classic')
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<Awaited<ReturnType<typeof parseEpub>> | null>(null)
  const [cover, setCover] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [load, setLoad] = useState<{ progress: number; label: string; title?: string; cover?: string } | null>(null)
  const field = 'w-full h-10 rounded-lg border px-3 text-[14px] bg-transparent outline-none'
  const border = { borderColor: 'var(--theme-border)' }

  return (
    <form className="rounded-2xl border p-5 space-y-3" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}
      onSubmit={async event => {
        event.preventDefault()
        if (!user || !parsed) return
        setBusy(true)
        setMessage('')
        const coverData = cover || parsed.coverDataUrl
        setLoad({ progress: 0.92, label: pt ? 'Colocando na galeria…' : 'Adding to the gallery…', title: title.trim() || parsed.title, cover: coverData })
        try {
          await addCatalogBook({
            title: title.trim() || parsed.title,
            author: author.trim() || parsed.author,
            description: description.trim() || parsed.description,
            level,
            category,
            languageCode: parsed.language || 'en',
            coverData,
            pages: parsed.pages,
          }, user.id)
          setLoad({ progress: 1, label: pt ? 'Na galeria.' : 'In the gallery.', title: title.trim() || parsed.title, cover: coverData })
          setTitle(''); setAuthor(''); setDescription(''); setLevel('A1'); setCategory('classic'); setParsed(null); setCover(''); setFileName('')
          onPublished?.()
          window.setTimeout(() => setLoad(null), 700)
        } catch {
          setLoad(null)
          setMessage(pt ? 'Não entrou. Confira se você está na conta de admin.' : 'It did not save. Check that this is the admin account.')
        } finally {
          setBusy(false)
        }
      }}>
      {load && (
        <div className="flex items-center gap-4 rounded-xl px-3 py-3" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
          {load.cover
            ? <img src={load.cover} alt="" className="book-cover w-12 aspect-[2/3] rounded-md object-cover" />
            : <img src="/illustrations/reading.svg" alt="" className="illo w-14 shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium truncate">{load.title}</p>
            <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{load.label}</p>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-border)' }}>
              <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.round(load.progress * 100)}%`, backgroundColor: 'var(--theme-text)' }} />
            </div>
          </div>
          <span className="text-[13px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{Math.round(load.progress * 100)}%</span>
        </div>
      )}
      <h2 className="text-[15px] font-semibold">{pt ? 'Novo livro gratuito' : 'New free book'}</h2>
      <p className="text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>
        {pt ? 'Só livros que você pode compartilhar. O EPUB de um aluno não usa este caminho.' : 'Only books you are allowed to share. A student’s EPUB does not use this path.'}
      </p>
      <input className={field} style={border} placeholder={pt ? 'Título' : 'Title'} value={title} onChange={e => setTitle(e.target.value)} />
      <input className={field} style={border} placeholder={pt ? 'Autor' : 'Author'} value={author} onChange={e => setAuthor(e.target.value)} />
      <textarea className="w-full rounded-lg border px-3 py-2 text-[14px] bg-transparent outline-none" style={border} rows={3} placeholder={pt ? 'Descrição curta' : 'Short description'} value={description} onChange={e => setDescription(e.target.value)} />
      <div>
        <p className="text-[12.5px] mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Nível do livro' : 'Book level'}</p>
        <div className="grid grid-cols-3 gap-2">
          {CEFR.map(band => {
            const on = level === band.id
            return (
              <button key={band.id} type="button" onClick={() => setLevel(band.id)}
                className="rounded-xl border px-3 py-2 text-left"
                style={{ borderColor: 'var(--theme-border)', backgroundColor: on ? 'var(--theme-pastel-2)' : 'transparent', color: on ? 'var(--theme-pastel-text)' : 'var(--theme-text)' }}>
                <span className="block text-[14px] font-semibold">{band.id}</span>
                <span className="block text-[12px]" style={{ color: on ? 'var(--theme-pastel-text)' : 'var(--theme-text-secondary)' }}>{pt ? band.pt : band.en}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <p className="text-[12.5px] mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Categoria' : 'Category'}</p>
        <div className="flex flex-wrap gap-1.5">
          {BOOK_CATEGORIES.map(item => (
            <FilterChip key={item.id} on={category === item.id} onClick={() => setCategory(item.id)}>{pt ? item.pt : item.en}</FilterChip>
          ))}
        </div>
      </div>
      <label className="h-10 px-3 inline-flex items-center rounded-lg border text-[13.5px] cursor-pointer" style={border}>
        {fileName || (pt ? 'Escolher EPUB' : 'Choose EPUB')}
        <input type="file" accept=".epub,application/epub+zip" className="sr-only" onChange={async e => {
          const file = e.target.files?.[0]
          e.currentTarget.value = ''
          if (!file) return
          setFileName(file.name)
          setMessage('')
          setLoad({ progress: 0.04, label: pt ? 'Abrindo o arquivo…' : 'Opening the file…', title: file.name.replace(/\.epub$/i, '') })
          try {
            const book = await parseEpub(file, ratio => {
              setLoad({
                progress: ratio,
                label: ratio < 0.96 ? (pt ? 'Lendo as páginas…' : 'Reading the pages…') : (pt ? 'Capa e descrição prontas.' : 'Cover and description are ready.'),
                title: file.name.replace(/\.epub$/i, ''),
              })
            })
            setParsed(book)
            setTitle(book.title)
            setAuthor(book.author ?? '')
            setDescription(book.description ?? '')
            setCover(book.coverDataUrl ?? '')
            setLoad({ progress: 1, label: pt ? 'Pronto para publicar.' : 'Ready to publish.', title: book.title, cover: book.coverDataUrl })
            window.setTimeout(() => setLoad(null), 600)
          } catch (err) {
            setParsed(null)
            setLoad(null)
            setMessage((err as Error).message || (pt ? 'Não foi possível ler este EPUB.' : 'Could not read this EPUB.'))
          }
        }} />
      </label>
      {parsed && (
        <div className="flex items-center gap-3">
          <label className="relative w-14 h-[4.5rem] rounded-lg overflow-hidden shrink-0 cursor-pointer" style={{ backgroundColor: 'var(--theme-pastel-1)' }} title={pt ? 'Trocar capa' : 'Change cover'}>
            {(cover || parsed.coverDataUrl) && <img src={cover || parsed.coverDataUrl} alt="" className="w-full h-full object-cover" />}
            <span className="absolute inset-x-0 bottom-0 py-0.5 text-center text-[10px] font-medium" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-card-bg) 88%, transparent)' }}>{pt ? 'Capa' : 'Cover'}</span>
            <input type="file" accept="image/*" className="sr-only" onChange={e => {
              const file = e.target.files?.[0]
              e.currentTarget.value = ''
              if (file) void readCover(file).then(setCover).catch(() => setMessage(pt ? 'Não consegui ler essa imagem.' : 'Could not read that image.'))
            }} />
          </label>
          <p className="text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{parsed.pages.length} {pt ? 'páginas' : 'pages'} · {parsed.title}</p>
        </div>
      )}
      <button type="submit" disabled={busy || !parsed} className="h-10 px-4 rounded-lg text-[14px] font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
        {busy ? (pt ? 'Publicando…' : 'Publishing…') : (pt ? 'Publicar na galeria' : 'Publish to the gallery')}
      </button>
      {message && <p className="text-[13px]">{message}</p>}
    </form>
  )
}

function Pill({ children }: { children: string }) {
  return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium" style={{ backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-secondary)' }}>{children}</span>
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
      <dt className="text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>{label}</dt>
      <dd className="text-[14px] font-medium truncate">{value}</dd>
    </div>
  )
}

function readCover(file: File): Promise<string> {
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

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="h-8 px-3 rounded-full border text-[13px] whitespace-nowrap"
      style={{
        borderColor: on ? 'transparent' : 'var(--theme-border)',
        backgroundColor: on ? 'var(--theme-pastel-2)' : 'var(--theme-card-bg)',
        color: on ? 'var(--theme-pastel-text)' : 'var(--theme-text)',
      }}>
      {children}
    </button>
  )
}
