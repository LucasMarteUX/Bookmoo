import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, Clock, BookMarked, Trash2, Pencil, ImagePlus, BookUp, FileText, Library, AudioLines, Flame, Star, ArrowRight, Search } from 'lucide-react'
import { useUiStore } from '@/store/useUiStore'
import { useXpStore, xpSummary } from '@/store/useXpStore'
import { useEntitlements } from '@/store/useEntitlements'
import { openPaywall } from '@/components/billing/Paywall'
import { PlanBanner } from '@/components/billing/PlanBanner'
import { useBookStore } from '@/store/useBookStore'
import { useStudyStore } from '@/store/useStudyStore'
import { useVocabularyStore } from '@/store/useVocabularyStore'
import { useLanguage } from '@/store/useLanguage'
import { useTranslations } from '@/lib/i18n'
import { BOOK_LANGUAGES, getBookLanguageName } from '@/lib/languages'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { upsertBook, updateBookFields, deleteBookRemote, fetchBooks } from '@/lib/supabaseSync'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FilterSearch, FilterSelect, SegmentedTabs } from '@/components/ui/filter-controls'
import { BookCardSkeleton } from '@/components/BookCardSkeleton'
import { GalleryBanner } from '@/components/GalleryBanner'
import { XpBadge } from '@/components/stats/XpBadge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { countWords, readingProgress, splitContentIntoPages } from '@/lib/utils'
import type { EpubBook } from '@/lib/epub'

type LibraryFilter = 'all' | 'reading' | 'new' | 'done'
type LibrarySort = 'recent' | 'title' | 'progress'

const coverActionClass = 'size-8 rounded-md bg-[var(--theme-bg)]/90 backdrop-blur text-[var(--theme-text)] shadow-sm hover:bg-[var(--theme-bg)]'


function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function firstLine(str: string | undefined): string {
  if (!str || !str.trim()) return ''
  return str.trim().split(/\n/)[0] || ''
}

export function Dashboard() {
  const navigate = useNavigate()
  const { locale } = useLanguage()
  const { t } = useTranslations(locale)
  const { session, hasSupabase } = useAuth()
  const { books, addBook, updateBook, deleteBook, setCurrentBook, setBooks } = useBookStore()
  const { totalStudyTime, dailyStudyTime } = useStudyStore()
  const { vocabularies } = useVocabularyStore()
  const userId = session?.user?.id
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [importedEpub, setImportedEpub] = useState<EpubBook | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string; catalogId?: string | null } | null>(null)
  const [savingBook, setSavingBook] = useState(false)
  const [bookError, setBookError] = useState('')
  const [newAuthor, setNewAuthor] = useState('')
  const [newBookLanguage, setNewBookLanguage] = useState('en')
  const [newCoverData, setNewCoverData] = useState<string | null>(null)
  const [newDescription, setNewDescription] = useState('')
  const [newTotalPages, setNewTotalPages] = useState<string>('')
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [editBookId, setEditBookId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editAuthor, setEditAuthor] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editLanguage, setEditLanguage] = useState('en')
  const [editCoverData, setEditCoverData] = useState<string | null>(null)
  const [editTotalPages, setEditTotalPages] = useState<string>('')
  const [editContext, setEditContext] = useState('')
  const editCoverInputRef = useRef<HTMLInputElement>(null)
  const [isLoadingBooks, setIsLoadingBooks] = useState(false)
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('all')
  const [librarySort, setLibrarySort] = useState<LibrarySort>('recent')
  const [libraryQuery, setLibraryQuery] = useState('')
  const { dailyGoalMinutes, setDailyGoalMinutes, addBookRequest } = useUiStore()
  const xpEvents = useXpStore(s => s.events)
  const xp = useMemo(() => xpSummary(xpEvents), [xpEvents])
  // Pedido vindo da sidebar ou da paleta (⌘K): abre o "Adicionar livro".
  useEffect(() => { if (addBookRequest) setIsAddModalOpen(true) }, [addBookRequest])
  useEffect(() => { if (isAddModalOpen) setRightsOk(false) }, [isAddModalOpen])
 
  const handleAddBook = async () => {
    if (!newTitle.trim() || savingBook || !rightsOk) return
    setSavingBook(true)
    setBookError('')
    const totalPagesNum = newTotalPages.trim() ? parseInt(newTotalPages, 10) : undefined
    const validTotal = totalPagesNum != null && !Number.isNaN(totalPagesNum) && totalPagesNum > 0 ? totalPagesNum : undefined
    const pages = importedEpub ? (importedEpub.text === newContent ? importedEpub.pages : splitContentIntoPages(newContent)) : undefined
    const previousBookId = useBookStore.getState().currentBookId
    const newBook = addBook(newTitle, newContent, {
      languageCode: newBookLanguage,
      coverData: newCoverData ?? undefined,
      description: newDescription.trim() || undefined,
      totalPages: validTotal,
      pages,
      author: newAuthor.trim() || undefined
    })
    const source = importedEpub ? (epubStatus.kind === 'PDF' ? 'pdf' as const : 'epub' as const) : 'text' as const
    useBookStore.getState().updateBook(newBook.id, { source })
    try {
      if (hasSupabase && supabase && userId) await upsertBook(supabase, userId, { ...newBook, source })
    } catch (err) {
      deleteBook(newBook.id)
      setCurrentBook(previousBookId)
      if (/plan_required/.test(String((err as { message?: string })?.message ?? ''))) {
        setIsAddModalOpen(false)
        openPaywall('import')
        return
      }
      setBookError(locale === 'pt-BR' ? 'Não foi possível salvar o livro. Tente novamente.' : 'Could not save the book. Try again.')
      return
    } finally {
      setSavingBook(false)
    }
    setImportedEpub(null)
    clearConverted()
    setImportNotes([])
    setIsAddModalOpen(false)
    setNewTitle('')
    setNewContent('')
    setNewBookLanguage('en')
    setNewCoverData(null)
    setNewDescription('')
    setNewTotalPages('')
    setNewAuthor('')
  }

  // Importar EPUB: extrai título, autor, idioma, capa e o texto do livro inteiro (no navegador).
  const epubInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const [epubStatus, setEpubStatus] = useState<{ busy: boolean; msg: string | null; kind?: 'EPUB' | 'PDF' }>({ busy: false, msg: null })
  const [importProgress, setImportProgress] = useState(0)
  const [importStep, setImportStep] = useState('')
  const [rightsOk, setRightsOk] = useState(false)
  useEffect(() => { if (isAddModalOpen) setRightsOk(false) }, [isAddModalOpen])
  const [importNotes, setImportNotes] = useState<string[]>([])
  const [convertedEpub, setConvertedEpub] = useState<{ url: string; name: string } | null>(null)
  const clearConverted = () => setConvertedEpub(prev => { if (prev) URL.revokeObjectURL(prev.url); return null })
  const runImport = async (file: File | undefined, kind: 'EPUB' | 'PDF') => {
    if (!file) return
    setEpubStatus({ busy: true, msg: null, kind })
    setImportProgress(0)
    setImportStep(kind === 'PDF' ? (pt ? 'Abrindo o PDF…' : 'Opening the PDF…') : (pt ? 'Lendo o EPUB…' : 'Reading the EPUB…'))
    setImportNotes([])
    clearConverted()
    try {
      const pdfStatus = (message: string, ratio: number) => { setImportStep(message); setImportProgress(ratio) }
      const imported = kind === 'EPUB' ? await (await import('@/lib/epub')).parseEpub(file, setImportProgress) : await (await import('@/lib/pdf')).parsePdf(file, pdfStatus)
      const book: EpubBook = imported
      if ('epub' in imported) {
        const pdf = imported as import('@/lib/pdf').PdfImport
        setConvertedEpub({ url: URL.createObjectURL(pdf.epub), name: pdf.epubName })
        setImportNotes(pdf.notes)
      }
      setNewTitle(book.title)
      setNewAuthor(book.author ?? '')
      setNewDescription(book.description ?? '')
      setNewBookLanguage('en')
      setNewCoverData(book.coverDataUrl ?? null)
      setNewContent(book.text)
      setImportedEpub(book)
      setNewTotalPages(String(book.pages.length))
      const words = countWords(book.text)
      const pagination = kind === 'PDF' ? (pt ? 'páginas de leitura' : 'reading pages')
        : book.pagination === 'embedded' ? (pt ? 'páginas marcadas no EPUB' : 'pages marked in the EPUB') : (pt ? 'páginas de leitura' : 'reading pages')
      setIsAddModalOpen(true)
      setEpubStatus({ busy: false, kind, msg: pt ? `${kind} importado: ${book.pages.length} ${pagination}, ${words.toLocaleString()} palavras. Revise o texto abaixo antes de salvar.` : `${kind} imported: ${book.pages.length} ${pagination}, ${words.toLocaleString()} words. Review the text below before saving.` })
    } catch (err) {
      setIsAddModalOpen(true)
      setImportNotes([])
      setEpubStatus({ busy: false, kind, msg: (err as Error).message || (pt ? `Não foi possível ler este ${kind}.` : `Could not read this ${kind}.`) })
    }
  }
  // Importar EPUB/PDF é dos planos pagos: no Grátis abre o convite (o banco também bloqueia).
  const ent = useEntitlements(st => st.data)
  const pickImport = (kind: 'EPUB' | 'PDF') => {
    if (ent && !ent.is_admin && ent.limits.imports === 0) { openPaywall('import'); return }
    ;(kind === 'EPUB' ? epubInputRef : pdfInputRef).current?.click()
  }
  const handleEpubChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; e.target.value = ''; void runImport(file, 'EPUB') }
  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; e.target.value = ''; void runImport(file, 'PDF') }

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => setNewCoverData(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }
 
  const handleOpenBook = (id: string) => {
    setCurrentBook(id)
    navigate(`/book/${id}`)
  }

  const openEditBook = (book: import('@/store/useBookStore').Book, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditBookId(book.id)
    setEditTitle(book.title)
    setEditAuthor(book.author ?? '')
    setEditDescription(book.description ?? '')
    setEditLanguage(book.languageCode ?? 'en')
    setEditCoverData(book.coverData ?? null)
    setEditTotalPages(book.totalPages != null ? String(book.totalPages) : '')
    setEditContext(book.context ?? '')
  }

  const handleEditCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => setEditCoverData(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const saveEditBook = () => {
    if (!editBookId) return
    const totalPagesNum = editTotalPages.trim() ? parseInt(editTotalPages, 10) : undefined
    const validTotal = totalPagesNum != null && !Number.isNaN(totalPagesNum) && totalPagesNum > 0 ? totalPagesNum : undefined
    const book = useBookStore.getState().books.find((b) => b.id === editBookId)
    if (!book) return
    const updates = {
      title: editTitle.trim(),
      author: editAuthor.trim() || undefined,
      description: editDescription.trim() || undefined,
      context: editContext.trim() || undefined,
      languageCode: editLanguage,
      coverData: editCoverData ?? undefined,
      totalPages: validTotal
    }
    updateBook(editBookId, updates)
    if (hasSupabase && supabase && userId) {
      updateBookFields(supabase, userId, { ...book, ...updates }, Object.keys(updates) as (keyof typeof updates)[]).catch((e) => console.error('Sync book update', e))
    }
    setEditBookId(null)
  }
 
  const hour = new Date().getHours()
  // Primeiro nome: do nome cadastrado; sem nome, a parte inicial do e-mail.
  const rawName = String(session?.user?.user_metadata?.full_name ?? session?.user?.user_metadata?.name ?? '').trim() || String(session?.user?.email ?? '').split('@')[0].split(/[._\-+]/)[0]
  const firstName = rawName ? rawName.split(/\s+/)[0].charAt(0).toLocaleUpperCase() + rawName.split(/\s+/)[0].slice(1) : ''
  const greetingKey: 'goodMorning' | 'goodAfternoon' | 'goodEvening' = hour >= 5 && hour < 12 ? 'goodMorning' : hour >= 12 && hour < 18 ? 'goodAfternoon' : 'goodEvening'

  // Fallback: garantir que livros sejam carregados direto na Dashboard,
  // mesmo que algo impeça o hook de hidratação de rodar corretamente.
  useEffect(() => {
    const userId = session?.user?.id
    if (!hasSupabase || !supabase || !userId) return
    if (books.length > 0) return

    setIsLoadingBooks(true)
    ;(async () => {
      try {
        const remoteBooks = await fetchBooks(supabase, userId)
        setBooks(remoteBooks)
      } catch (e) {
        console.error('[Dashboard] error fetching books directly', e)
      } finally {
        setIsLoadingBooks(false)
      }
    })()
  }, [hasSupabase, session?.user?.id, books.length, setBooks])

  const pt = locale === 'pt-BR'
  const fmt = new Intl.NumberFormat(pt ? 'pt-BR' : 'en-US')
  const sortedByRecent = [...books].sort((a, b) => +new Date(b.lastRead) - +new Date(a.lastRead))
  const progressOf = (b: (typeof books)[number]) => readingProgress(b.currentPage, b.pages.length, b.totalPages)
  const hero = sortedByRecent.find(b => progressOf(b) < 100) ?? sortedByRecent[0]
  const today = new Date().toISOString().split('T')[0]
  const minutesToday = Math.floor((dailyStudyTime[today] ?? 0) / 60)
  const goal = dailyGoalMinutes
  const goalPct = Math.min(1, minutesToday / goal)
  const reviewCount = vocabularies.filter(v => v.status === 'review').length
  const filters: { id: LibraryFilter; label: string }[] = [
    { id: 'all', label: pt ? 'Todos' : 'All' },
    { id: 'reading', label: pt ? 'Lendo' : 'Reading' },
    { id: 'new', label: pt ? 'Não iniciados' : 'Not started' },
    { id: 'done', label: pt ? 'Concluídos' : 'Finished' },
  ]
  const q = libraryQuery.trim().toLowerCase()
  const shelf = (librarySort === 'recent' ? sortedByRecent : librarySort === 'title' ? [...books].sort((a, b) => a.title.localeCompare(b.title)) : [...books].sort((a, b) => progressOf(b) - progressOf(a)))
    .filter(b => libraryFilter === 'all' || (libraryFilter === 'reading' ? progressOf(b) > 0 && progressOf(b) < 100 : libraryFilter === 'new' ? progressOf(b) === 0 : progressOf(b) >= 100))
    .filter(b => !q || `${b.title} ${b.author ?? ''}`.toLowerCase().includes(q))

  const renderBook = (book: (typeof books)[number]) => {
    const langName = getBookLanguageName(book.languageCode ?? 'en', locale)
    const progress = progressOf(book)
    const langFlag = BOOK_LANGUAGES.find(l => l.code === (book.languageCode ?? 'en'))?.flag ?? '📖'
    return (
      <article key={book.id} className="group relative">
        <button type="button" className="absolute inset-0 z-10 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--theme-text)]"
          aria-label={pt ? `Abrir ${book.title}` : `Open ${book.title}`}
          onClick={() => handleOpenBook(book.id)} />
        <div className="book-cover relative w-full aspect-[2/3] rounded-lg overflow-hidden grid place-items-center transition-transform duration-300 group-hover:-translate-y-1"
          style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
          {book.coverData
            ? <>
                <img src={book.coverData} alt="" aria-hidden decoding="async" className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-70" />
                <img src={book.coverData} alt="" decoding="async" className="relative w-full h-full object-contain" />
              </>
            : <div className="flex flex-col items-center gap-2 px-4 text-center">
                <span className="font-display text-[17px] leading-snug line-clamp-4" style={{ color: 'var(--theme-text)' }}>{book.title}</span>
                {book.author && <span className="text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>{book.author}</span>}
              </div>}
          {progress > 0 && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/25">
              <div className="h-full bg-white/90" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
        {/* Ações fora da capa: a capa ganha transform no hover e prendia os botões abaixo do link que abre o livro. */}
        <div className="absolute right-1.5 top-1.5 z-20 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-[opacity,transform] duration-300 md:group-hover:-translate-y-1">
          <Button variant="ghost" size="icon" className={coverActionClass} onClick={e => openEditBook(book, e)} title={t('editBook')} aria-label={t('editBook')}>
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className={coverActionClass} aria-label={t('delete')} title={t('delete')}
            onClick={e => { e.preventDefault(); e.stopPropagation(); setBookError(''); setPendingDelete(book) }}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
        <div className="mt-3 space-y-0.5">
          <h3 className="text-[14px] font-medium leading-snug line-clamp-2" style={{ color: 'var(--theme-text)', display: '-webkit-box', WebkitBoxOrient: 'vertical' }} title={book.title}>{book.title}</h3>
          <p className="flex items-center gap-1.5 text-[12.5px] truncate" style={{ color: 'var(--theme-text-secondary)' }}>
            <span title={langName} className="text-[13px] leading-none">{langFlag}</span>
            <span className="truncate">{book.author || langName}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums shrink-0">{progress >= 100 ? (pt ? 'Lido' : 'Done') : `${progress}%`}</span>
          </p>
        </div>
      </article>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[12.5px] sm:text-[13px] capitalize" style={{ color: 'var(--theme-text-secondary)' }}>
            {new Date().toLocaleDateString(pt ? 'pt-BR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="font-display mt-0.5 text-[30px] md:text-[40px] leading-[1.05]" style={{ color: 'var(--theme-text)' }}>{t(greetingKey)}{firstName ? `, ${firstName}` : ''}</h1>
        </div>
        <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
          <input ref={epubInputRef} type="file" accept=".epub,application/epub+zip" className="hidden" onChange={handleEpubChange} />
          <input ref={pdfInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handlePdfChange} />
          {/* No celular só o "Adicionar livro": a janela já tem as opções de EPUB e PDF. */}
          <Button variant="outline" className="hidden sm:inline-flex" onClick={() => pickImport('EPUB')} disabled={epubStatus.busy}>
            <BookUp className="w-4 h-4" />
            {epubStatus.busy && epubStatus.kind === 'EPUB' ? (pt ? 'Lendo EPUB…' : 'Reading EPUB…') : (pt ? 'Importar EPUB' : 'Import EPUB')}
          </Button>
          <Button variant="outline" className="hidden sm:inline-flex" onClick={() => pickImport('PDF')} disabled={epubStatus.busy}>
            <FileText className="w-4 h-4" />
            {epubStatus.busy && epubStatus.kind === 'PDF' ? (pt ? 'Lendo PDF…' : 'Reading PDF…') : (pt ? 'Importar PDF' : 'Import PDF')}
          </Button>
          <Button data-tour="add-book" className="w-full sm:w-auto" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="w-4 h-4" />
            {t('addBook')}
          </Button>
        </div>
      </header>
      <PlanBanner pt={pt} />

      {books.length === 0 && <GalleryBanner />}

      {/* Continuar lendo + hoje */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {hero ? (
          <div className="rounded-2xl border p-4 md:p-6 flex gap-4 md:gap-7 items-start sm:items-center" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
            <button type="button" onClick={() => handleOpenBook(hero.id)} aria-label={pt ? `Abrir ${hero.title}` : `Open ${hero.title}`}
              className="book-cover shrink-0 w-[84px] md:w-[124px] aspect-[2/3] rounded-md overflow-hidden transition-transform hover:-translate-y-1" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
              {hero.coverData ? <img src={hero.coverData} alt="" className="w-full h-full object-cover" /> : <BookOpen className="w-8 h-8 m-auto opacity-40" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium" style={{ color: 'var(--theme-text-secondary)' }}>{progressOf(hero) > 0 ? (pt ? 'Continuar lendo' : 'Continue reading') : (pt ? 'Comece a ler' : 'Start reading')}</p>
              <h2 className="font-display mt-0.5 text-[22px] md:text-[30px] leading-[1.1] line-clamp-2" style={{ color: 'var(--theme-text)' }}>{hero.title}</h2>
              {hero.author && <p className="mt-1 text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>{hero.author}</p>}
              <div className="mt-3 md:mt-4 flex items-center gap-3 max-w-md">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, progressOf(hero))}%`, backgroundColor: 'var(--theme-text)' }} />
                </div>
                <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{progressOf(hero)}%</span>
              </div>
              <div className="mt-4 md:mt-5 flex flex-wrap gap-2">
                <Button className="h-10" onClick={() => handleOpenBook(hero.id)}><BookOpen className="w-4 h-4" />{progressOf(hero) > 0 ? (pt ? 'Continuar' : 'Continue') : (pt ? 'Começar' : 'Start')}</Button>
                <Button variant="outline" className="h-10" onClick={() => navigate('/practice/speak')} aria-label={pt ? 'Praticar fala' : 'Practice speaking'}><AudioLines className="w-4 h-4" /><span className="hidden sm:inline">{pt ? 'Praticar fala' : 'Practice speaking'}</span></Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border p-6 flex items-center gap-6" style={{ borderColor: 'var(--theme-border)' }}>
            <img src="/illustrations/reading.svg" alt="" className="illo w-32 hidden sm:block" />
            <div>
              <h2 className="font-display text-[22px] leading-tight">{pt ? 'Tem um livro seu?' : 'Got a book of your own?'}</h2>
              <p className="mt-1 text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Importe um EPUB ou PDF seu. Ele fica só na sua conta, nunca é compartilhado.' : 'Import your own EPUB or PDF. It stays in your account and is never shared.'}</p>
              <div className="mt-4">
                <Button variant="outline" onClick={() => setIsAddModalOpen(true)}><Plus className="w-4 h-4" />{t('addBook')}</Button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border p-5 flex flex-col gap-4" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 44 44" className="w-[68px] h-[68px] -rotate-90 shrink-0" aria-hidden>
              <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4" style={{ stroke: 'var(--theme-bg-secondary)' }} />
              <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${goalPct * 113.1} 113.1`}
                style={{ stroke: goalPct >= 1 ? 'var(--pastel-green-bd)' : 'var(--theme-text)', transition: 'stroke-dasharray 0.6s ease' }} />
            </svg>
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Meta de hoje' : "Today's goal"}</p>
              <p className="text-[22px] font-semibold tabular-nums leading-tight">{minutesToday}<span className="text-[14px] font-normal" style={{ color: 'var(--theme-text-secondary)' }}> / {goal} min</span></p>
              <div className="mt-1 flex gap-1">
                {[10, 15, 30].map(m => (
                  <button key={m} type="button" onClick={() => setDailyGoalMinutes(m)} aria-pressed={goal === m}
                    className="h-6 px-2 rounded-md text-[11.5px] transition-colors hover:bg-[var(--ui-hover)]"
                    style={{ backgroundColor: goal === m ? 'var(--theme-nav-active)' : undefined, color: goal === m ? 'var(--theme-text)' : 'var(--theme-text-secondary)' }}>{m} min</button>
                ))}
              </div>
            </div>
          </div>
          <div className="h-px" style={{ backgroundColor: 'var(--theme-border)' }} />
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <button type="button" onClick={() => navigate('/stats')} className="text-left rounded-lg p-2 -m-2 hover:bg-[var(--ui-hover)]">
              <p className="flex items-center gap-1.5" style={{ color: 'var(--theme-text-secondary)' }}><Flame className="w-3.5 h-3.5" style={{ color: xp.studiedToday ? 'var(--pastel-amber-fg)' : undefined }} fill={xp.studiedToday ? 'var(--pastel-amber-fg)' : 'none'} />{pt ? 'Sequência' : 'Streak'}</p>
              <p className="mt-0.5 text-[18px] font-semibold tabular-nums">{xp.streak} <span className="text-[12.5px] font-normal" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? (xp.streak === 1 ? 'dia' : 'dias') : (xp.streak === 1 ? 'day' : 'days')}</span></p>
            </button>
            <button type="button" onClick={() => navigate('/stats')} className="text-left rounded-lg p-2 -m-2 hover:bg-[var(--ui-hover)]">
              <p className="flex items-center gap-1.5" style={{ color: 'var(--theme-text-secondary)' }}><Star className="w-3.5 h-3.5" />{pt ? 'Pontos' : 'Points'}</p>
              <p className="mt-0.5 text-[18px] font-semibold tabular-nums">{fmt.format(xp.total)}</p>
            </button>
            <button type="button" onClick={() => navigate('/vocabulary')} className="text-left rounded-lg p-2 -m-2 hover:bg-[var(--ui-hover)]">
              <p className="flex items-center gap-1.5" style={{ color: 'var(--theme-text-secondary)' }}><BookMarked className="w-3.5 h-3.5" />{pt ? 'Palavras' : 'Words'}</p>
              <p className="mt-0.5 text-[18px] font-semibold tabular-nums">{vocabularies.length}</p>
            </button>
            <button type="button" onClick={() => navigate('/stats')} className="text-left rounded-lg p-2 -m-2 hover:bg-[var(--ui-hover)]">
              <p className="flex items-center gap-1.5" style={{ color: 'var(--theme-text-secondary)' }}><Clock className="w-3.5 h-3.5" />{t('studyTime')}</p>
              <p className="mt-0.5 text-[18px] font-semibold tabular-nums">{formatTime(totalStudyTime)}</p>
            </button>
          </div>
        </div>
      </section>

      {/* Praticar */}
      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold" style={{ color: 'var(--theme-text)' }}>{pt ? 'Pratique hoje' : 'Practice today'}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { to: '/vocabulary', illo: '/illustrations/reading.svg', bg: 'var(--pastel-sand-bg)', title: pt ? 'Revisar palavras' : 'Review words', text: reviewCount ? (pt ? `${reviewCount} esperando revisão` : `${reviewCount} waiting for review`) : (pt ? 'Seu vocabulário em dia' : 'Your vocabulary is up to date') },
            { to: '/practice/speak', illo: '/illustrations/chatting.svg', bg: 'var(--pastel-blue-bg)', title: pt ? 'Falar em voz alta' : 'Speak out loud', text: pt ? 'Leia e receba retorno da pronúncia' : 'Read and get pronunciation feedback' },
            { to: '/practice/write', illo: '/illustrations/work.svg', bg: 'var(--pastel-lavender-bg)', title: pt ? 'Ditado' : 'Dictation', text: pt ? 'Ouça e escreva cada palavra' : 'Listen and type every word' },
          ].map(card => (
            <button key={card.to} type="button" onClick={() => navigate(card.to)}
              className="practice-card group relative overflow-hidden rounded-2xl p-5 text-left min-h-[132px] transition-transform hover:-translate-y-0.5"
              style={{ ['--card-bg' as string]: card.bg }}>
              <p className="relative z-10 text-[15px] font-semibold" style={{ color: 'var(--theme-text)' }}>{card.title}</p>
              <p className="relative z-10 mt-1 max-w-[62%] text-[13px] leading-snug" style={{ color: 'var(--theme-text-secondary)' }}>{card.text}</p>
              <span className="relative z-10 mt-4 inline-flex items-center gap-1 text-[12.5px] font-medium" style={{ color: 'var(--theme-text)' }}>
                {pt ? 'Começar' : 'Start'}<ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
              <img src={card.illo} alt="" className="illo absolute -right-3 -bottom-4 w-[46%] max-w-[150px] opacity-90 transition-transform duration-300 group-hover:scale-[1.04]" />
            </button>
          ))}
        </div>
      </section>

      {/* Biblioteca */}
      <section className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--theme-text)' }}>{t('yourLibrary')}</h2>
            <span className="text-[13px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{books.length}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedTabs<LibraryFilter> value={libraryFilter} onChange={setLibraryFilter} options={filters.map(f => ({ id: f.id as LibraryFilter, label: f.label }))} />
            <FilterSearch value={libraryQuery} onChange={setLibraryQuery} placeholder={pt ? 'Filtrar' : 'Filter'} />
            <FilterSelect value={librarySort} onChange={v => setLibrarySort(v as LibrarySort)} label={pt ? 'Ordenar' : 'Sort'}
              options={[{ value: 'recent', label: pt ? 'Recentes' : 'Recent' }, { value: 'title', label: pt ? 'Título' : 'Title' }, { value: 'progress', label: pt ? 'Progresso' : 'Progress' }]} />
          </div>
        </div>

        {isLoadingBooks && books.length === 0 ? (
          <div className="grid gap-x-5 gap-y-8 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => <BookCardSkeleton key={i} />)}
          </div>
        ) : shelf.length === 0 ? (
          <p className="py-10 text-center text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>
            {books.length === 0 ? (pt ? 'Sua estante está vazia. Escolha um livro na galeria para começar.' : 'Your shelf is empty. Pick a book from the gallery to start.') : (pt ? 'Nenhum livro aqui.' : 'No books here.')}
          </p>
        ) : (
          <div className="grid gap-x-5 gap-y-8 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {shelf.map(renderBook)}
          </div>
        )}
      </section>
 
      <Dialog open={!!pendingDelete} onOpenChange={open => { if (!open && !savingBook) setPendingDelete(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{locale === 'pt-BR' ? `Excluir “${pendingDelete?.title ?? ''}”?` : `Delete “${pendingDelete?.title ?? ''}”?`}</DialogTitle>
            <DialogDescription>
              {pendingDelete?.catalogId
                ? (locale === 'pt-BR' ? 'Ele sai da sua biblioteca, com seu progresso e as páginas ilustradas. Você pode baixar de novo pela Galeria quando quiser.' : 'It leaves your library, with your progress and illustrated pages. You can get it again from the Gallery anytime.')
                : (locale === 'pt-BR' ? 'Ele sai da sua biblioteca, com seu progresso e as páginas ilustradas. Para ter de novo, é só enviar o arquivo outra vez.' : 'It leaves your library, with your progress and illustrated pages. To get it back, upload the file again.')}
            </DialogDescription>
          </DialogHeader>
          {bookError && <p role="alert">{bookError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={savingBook} onClick={() => setPendingDelete(null)}>{t('cancel')}</Button>
            <Button variant="destructive" disabled={savingBook} onClick={async () => {
              if (!pendingDelete || savingBook) return
              setSavingBook(true)
              try {
                if (hasSupabase && supabase && userId) await deleteBookRemote(supabase, userId, pendingDelete.id)
                deleteBook(pendingDelete.id)
                setPendingDelete(null)
              } catch {
                setBookError(locale === 'pt-BR' ? 'Não foi possível excluir o livro.' : 'Could not delete the book.')
              } finally { setSavingBook(false) }
            }}>{t('delete')}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isAddModalOpen} onOpenChange={open => { if (!savingBook) setIsAddModalOpen(open) }}>
        <DialogContent className="relative sm:max-w-2xl rounded-[2rem] border !flex !flex-col !gap-0 !p-0 !overflow-hidden" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
          <DialogHeader className="shrink-0 px-5 pt-7 pb-3 sm:px-6 sm:pt-8">
            <DialogTitle style={{ color: 'var(--theme-text)' }}>{t('addNewBook')}</DialogTitle>
            <DialogDescription style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Importe um arquivo ou cole o texto que você quer ler e estudar.' : 'Import a file or paste the text you want to read and study.'}</DialogDescription>
          </DialogHeader>

          <div data-vaul-no-drag className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
            <div className="grid gap-2 sm:grid-cols-2">
              {([['EPUB', BookUp, pt ? 'Livro digital com capítulos, capa e dados' : 'Digital book with chapters, cover and details', epubInputRef], ['PDF', FileText, pt ? 'PDF com texto selecionável, até 20 MB (sem IA)' : 'Text-based PDFs up to 20 MB (no AI)', pdfInputRef]] as const).map(([kind, Icon, hint, ref]) => (
                <button key={kind} type="button" disabled={epubStatus.busy} onClick={() => { if (ref) pickImport(kind) }}
                  className="flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors hover:bg-[var(--ui-hover)] disabled:opacity-60"
                  style={{ borderColor: 'var(--theme-border)' }}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}><Icon className="w-5 h-5" /></span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold">{epubStatus.busy && epubStatus.kind === kind ? (pt ? `Lendo ${kind}…` : `Reading ${kind}…`) : (pt ? `Importar ${kind}` : `Import ${kind}`)}{ent && !ent.is_admin && ent.limits.imports === 0 ? ' 👑' : ''}</span>
                    <span className="block text-[12px] leading-snug" style={{ color: 'var(--theme-text-secondary)' }}>{hint}</span>
                  </span>
                </button>
              ))}
            </div>
            {epubStatus.busy && (
              <div className="space-y-1.5" role="status" aria-live="polite">
                <div className="flex items-center justify-between text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>
                  <span>{importStep}</span><span className="tabular-nums">{Math.round(importProgress * 100)}%</span>
                </div>
                <div role="progressbar" aria-valuenow={Math.round(importProgress * 100)} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                  <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(4, importProgress * 100)}%`, backgroundColor: 'var(--theme-primary)' }} />
                </div>
              </div>
            )}
            {(epubStatus.msg || bookError) && (
              <div role={bookError ? 'alert' : 'status'} className="space-y-1 rounded-xl px-3 py-2.5 text-[13px]" style={{ backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-secondary)' }}>
                <p>{bookError || epubStatus.msg}</p>
                {importNotes.length > 0 && <ul className="list-disc space-y-0.5 pl-4 text-[12.5px]">{importNotes.map(note => <li key={note}>{note}</li>)}</ul>}
                {convertedEpub && <a href={convertedEpub.url} download={convertedEpub.name} className="inline-block text-[12.5px] font-medium underline underline-offset-2" style={{ color: 'var(--theme-text)' }}>{pt ? 'Baixar o EPUB convertido' : 'Download the converted EPUB'}</a>}
              </div>
            )}
            <p className="text-[12px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Livros importados (EPUB ou PDF) ficam só na sua biblioteca; não vão para a galeria nem para outras pessoas.' : 'Imported books (EPUB or PDF) stay in your library only; they are not shared with the gallery or anyone else.'}</p>

            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_9.5rem]">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="title" style={{ color: 'var(--theme-text)' }}>{t('title')}</Label>
                  <Input id="title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t('titlePlaceholder')} className="rounded-xl h-11 px-3.5" style={{ borderColor: 'var(--theme-border)' }} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="author" style={{ color: 'var(--theme-text)' }}>{t('author')}</Label>
                  <Input id="author" value={newAuthor} onChange={(e) => setNewAuthor(e.target.value)} placeholder={t('authorPlaceholder')} className="rounded-xl h-11 px-3.5" style={{ borderColor: 'var(--theme-border)' }} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-desc" style={{ color: 'var(--theme-text)' }}>{t('bookDescription')}</Label>
                  <Input id="new-desc" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder={t('bookDescriptionPlaceholder')} className="rounded-xl h-11 px-3.5" style={{ borderColor: 'var(--theme-border)' }} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label style={{ color: 'var(--theme-text)' }}>{t('coverImage')}</Label>
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
                <button type="button" onClick={() => coverInputRef.current?.click()} aria-label={t('uploadCover')}
                  className="group relative grid aspect-[2/3] w-full max-w-[9.5rem] place-items-center overflow-hidden rounded-xl border border-dashed transition-colors hover:bg-[var(--ui-hover)]"
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
                  {newCoverData
                    ? <img src={newCoverData} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    : <span className="flex flex-col items-center gap-1.5 px-2 text-center text-[12px]" style={{ color: 'var(--theme-text-secondary)' }}><ImagePlus className="w-5 h-5" />{t('uploadCover')}</span>}
                </button>
                {newCoverData && <button type="button" onClick={() => setNewCoverData(null)} className="text-[12px] underline-offset-2 hover:underline" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Remover capa' : 'Remove cover'}</button>}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="content" style={{ color: 'var(--theme-text)' }}>{t('content')}</Label>
                {newContent.trim() && <span className="text-[12px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{countWords(newContent).toLocaleString()} {pt ? 'palavras' : 'words'}</span>}
              </div>
              <Textarea
                id="content"
                value={newContent}
                onChange={e => {
                  const text = e.target.value
                  setNewContent(text)
                  if (importedEpub) {
                    setNewTotalPages(text.trim() ? String(splitContentIntoPages(text).length) : '')
                    setEpubStatus({ busy: false, msg: null })
                  }
                }}
                placeholder={t('contentPlaceholder')}
                className="min-h-[180px] max-h-[40dvh] rounded-xl p-3.5 resize-y"
                style={{ borderColor: 'var(--theme-border)' }}
              />
            </div>
            <div className="space-y-1.5 sm:max-w-[12rem]">
              <Label style={{ color: 'var(--theme-text)' }}>{t('totalPages')}</Label>
              <Input type="number" min={1} value={newTotalPages} onChange={(e) => setNewTotalPages(e.target.value)} placeholder={t('totalPagesPlaceholder')} className="rounded-xl h-11" style={{ borderColor: 'var(--theme-border)' }} />
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-[13px] leading-snug" style={{ borderColor: rightsOk ? 'var(--theme-text)' : 'var(--theme-border)' }}>
              <input type="checkbox" checked={rightsOk} onChange={e => setRightsOk(e.target.checked)} className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--theme-primary)]" />
              <span style={{ color: 'var(--theme-text-secondary)' }}>
                {pt ? 'Declaro que este conteúdo é de minha autoria, está em domínio público ou tenho autorização de quem detém os direitos para usá-lo. Sei que EPUBs e PDFs protegidos por direitos autorais são proibidos, que o livro fica só na minha biblioteca (não é compartilhado) e que respondo por esta declaração. '
                  : 'I declare this content is my own work, in the public domain, or that I have permission from the rightsholder to use it. I understand copyrighted EPUBs and PDFs are forbidden, that the book stays in my library only (not shared) and that I am responsible for this declaration. '}
                <a href="/terms?back=/&tab=1#livros" target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2" style={{ color: 'var(--theme-text)' }} onClick={e => e.stopPropagation()}>{pt ? 'Ver os Termos' : 'See the Terms'}</a>
              </span>
            </label>
          </div>

          {/* Cabeçalho e rodapé fixos; só o formulário rola. */}
          <div className="shrink-0 flex gap-3 border-t px-5 py-4 sm:px-6" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
            <Button variant="outline" className="flex-1 rounded-full h-11 font-semibold" style={{ borderColor: 'var(--theme-border)' }} onClick={() => setIsAddModalOpen(false)}>{t('cancel')}</Button>
            <Button className="flex-[2] rounded-full h-11 px-8 font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }} onClick={handleAddBook} disabled={!newTitle.trim() || !rightsOk || savingBook || epubStatus.busy}>
              {savingBook ? (pt ? 'Salvando…' : 'Saving…') : t('saveBook')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editBookId} onOpenChange={(open) => !open && setEditBookId(null)}>
        <DialogContent className="relative sm:max-w-lg rounded-[2rem] border pt-8" style={{ backgroundColor: 'var(--theme-card-bg)', color: 'var(--theme-text)', borderColor: 'var(--theme-border)' }}>
          <DialogHeader>
            <DialogTitle>{t('editBook')}</DialogTitle>
            <DialogDescription style={{ color: 'var(--theme-text-secondary)' }}>{t('bookDescriptionPlaceholder')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label style={{ color: 'var(--theme-text)' }}>{t('title')}</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder={t('titlePlaceholder')} className="rounded-xl" style={{ borderColor: 'var(--theme-border)' }} />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--theme-text)' }}>{t('author')}</Label>
              <Input value={editAuthor} onChange={(e) => setEditAuthor(e.target.value)} placeholder={t('authorPlaceholder')} className="rounded-xl" style={{ borderColor: 'var(--theme-border)' }} />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--theme-text)' }}>{t('bookDescription')}</Label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder={t('bookDescriptionPlaceholder')} className="rounded-xl" style={{ borderColor: 'var(--theme-border)' }} />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--theme-text)' }}>{t('totalPages')}</Label>
              <Input type="number" min={1} value={editTotalPages} onChange={(e) => setEditTotalPages(e.target.value)} placeholder={t('totalPagesPlaceholder')} className="rounded-xl" style={{ borderColor: 'var(--theme-border)' }} />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--theme-text)' }}>{t('coverImage')}</Label>
              <input ref={editCoverInputRef} type="file" accept="image/*" className="hidden" onChange={handleEditCoverChange} />
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" className="rounded-xl gap-2" style={{ borderColor: 'var(--theme-border)' }} onClick={() => editCoverInputRef.current?.click()}>
                  <ImagePlus className="w-4 h-4" />
                  {t('uploadCover')}
                </Button>
                {editCoverData && <img src={editCoverData} alt="" className="w-16 h-16 rounded-lg object-cover border" style={{ borderColor: 'var(--theme-border)' }} />}
              </div>
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--theme-text)' }}>{t('editBookContext')}</Label>
              <Textarea value={editContext} onChange={(e) => setEditContext(e.target.value)} placeholder={t('contextPlaceholder')} className="min-h-[80px] rounded-xl resize-none" style={{ borderColor: 'var(--theme-border-subtle)' }} />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1 rounded-full" style={{ borderColor: 'var(--theme-border)' }} onClick={() => setEditBookId(null)}>{t('cancel')}</Button>
            <Button className="flex-1 rounded-full" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }} onClick={saveEditBook}>{t('save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
