import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, Clock, BookMarked, Trash2, Pencil, ImagePlus, X, BookUp } from 'lucide-react'
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
import { BookCardSkeleton } from '@/components/BookCardSkeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { countWords, readingProgress, splitContentIntoPages } from '@/lib/utils'
import type { EpubBook } from '@/lib/epub'

const coverActionClass = 'size-10 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card-bg)] text-[var(--theme-text)] shadow-sm hover:bg-[var(--theme-bg-secondary)]'


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
  const { totalStudyTime } = useStudyStore()
  const { vocabularies } = useVocabularyStore()
  const userId = session?.user?.id
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [importedEpub, setImportedEpub] = useState<EpubBook | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null)
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
 
  const handleAddBook = async () => {
    if (!newTitle.trim() || savingBook) return
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
    try {
      if (hasSupabase && supabase && userId) await upsertBook(supabase, userId, newBook)
    } catch {
      deleteBook(newBook.id)
      setCurrentBook(previousBookId)
      setBookError(locale === 'pt-BR' ? 'Não foi possível salvar o livro. Tente novamente.' : 'Could not save the book. Try again.')
      return
    } finally {
      setSavingBook(false)
    }
    setImportedEpub(null)
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
  const [epubStatus, setEpubStatus] = useState<{ busy: boolean; msg: string | null }>({ busy: false, msg: null })
  const handleEpubChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setEpubStatus({ busy: true, msg: null })
    try {
      const { parseEpub } = await import('@/lib/epub')
      const book = await parseEpub(file)
      setNewTitle(book.title)
      setNewAuthor(book.author ?? '')
      setNewBookLanguage(book.language && BOOK_LANGUAGES.some(l => l.code === book.language) ? book.language : 'en')
      setNewCoverData(book.coverDataUrl ?? null)
      setNewContent(book.text)
      setImportedEpub(book)
      setNewTotalPages(String(book.pages.length))
      const words = countWords(book.text)
      const pagination = book.pagination === 'embedded'
        ? (locale === 'pt-BR' ? 'páginas marcadas no EPUB' : 'pages marked in the EPUB')
        : (locale === 'pt-BR' ? 'páginas de leitura' : 'reading pages')
      setIsAddModalOpen(true)
      setEpubStatus({ busy: false, msg: locale === 'pt-BR' ? `EPUB importado: ${book.pages.length} ${pagination}, ${words.toLocaleString()} palavras.` : `EPUB imported: ${book.pages.length} ${pagination}, ${words.toLocaleString()} words.` })
    } catch (err) {
      setIsAddModalOpen(true)
      setEpubStatus({ busy: false, msg: (err as Error).message || (locale === 'pt-BR' ? 'Não foi possível ler este EPUB.' : 'Could not read this EPUB.') })
    }
  }

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

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight" style={{ color: 'var(--theme-text)' }}>{t(greetingKey)}</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <input ref={epubInputRef} type="file" accept=".epub,application/epub+zip" className="hidden" onChange={handleEpubChange} />
        <Button
          variant="outline"
          onClick={() => epubInputRef.current?.click()}
          disabled={epubStatus.busy}
          className="rounded-full px-6 h-12 w-full sm:w-auto min-h-[44px] gap-2"
          style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
        >
          <BookUp className="w-5 h-5" />
          {epubStatus.busy ? (locale === 'pt-BR' ? 'Lendo EPUB…' : 'Reading EPUB…') : (locale === 'pt-BR' ? 'Importar EPUB' : 'Import EPUB')}
        </Button>
        <Button onClick={() => setIsAddModalOpen(true)} className="rounded-full px-6 h-12 transition-colors w-full sm:w-auto min-h-[44px]" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
          <Plus className="mr-2 w-5 h-5" />
          {t('addBook')}
        </Button>
        </div>
      </div>
 
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className="p-6 rounded-[16px] border relative overflow-hidden"
          style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}
        >
          <div className="absolute -right-4 -top-4 opacity-25">
            <BookOpen className="w-32 h-32" style={{ color: 'var(--theme-primary)' }} />
          </div>
          <div className="relative z-10" style={{ color: 'var(--theme-text)' }}>
            <div className="text-sm font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--theme-text-secondary)' }}>
              {t('totalBooks')}
            </div>
            <div className="text-4xl font-bold mb-4" style={{ color: 'var(--theme-primary)' }}>
              {books.length}
            </div>
            <div className="text-xs font-medium opacity-80" style={{ color: 'var(--theme-text-secondary)' }}>
              {t('readyToRead')}
            </div>
          </div>
        </Card>
        
        <Card
          className="p-6 rounded-[16px] border relative overflow-hidden"
          style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}
        >
          <div className="absolute -right-4 -top-4 opacity-25">
            <Clock className="w-32 h-32" style={{ color: 'var(--theme-primary)' }} />
          </div>
          <div className="relative z-10" style={{ color: 'var(--theme-text)' }}>
            <div className="text-sm font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--theme-text-secondary)' }}>
              {t('studyTime')}
            </div>
            <div className="text-4xl font-bold mb-4" style={{ color: 'var(--theme-primary)' }}>
              {formatTime(totalStudyTime)}
            </div>
            <div className="text-xs font-medium opacity-80" style={{ color: 'var(--theme-text-secondary)' }}>
              {t('totalTimeSpent')}
            </div>
          </div>
        </Card>
 
        <Card
          className="p-6 rounded-[16px] border relative overflow-hidden"
          style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}
        >
          <div className="absolute -right-4 -top-4 opacity-25">
            <BookMarked className="w-32 h-32" style={{ color: 'var(--theme-primary)' }} />
          </div>
          <div className="relative z-10" style={{ color: 'var(--theme-text)' }}>
            <div className="text-sm font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--theme-text-secondary)' }}>
              {t('vocabulary')}
            </div>
            <div className="text-4xl font-bold mb-4" style={{ color: 'var(--theme-primary)' }}>
              {vocabularies.length}
            </div>
            <div className="text-xs font-medium opacity-80" style={{ color: 'var(--theme-text-secondary)' }}>
              —
            </div>
          </div>
        </Card>
      </div>
 
      <div className="space-y-6 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--theme-text)' }}>{t('yourLibrary')}</h2>
        </div>
        
        {isLoadingBooks && books.length === 0 ? (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <BookCardSkeleton key={i} />
            ))}
          </div>
        ) : books.length === 0 ? (
          <Card className="p-12 text-center rounded-[16px] border" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
            <div className="flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: 'var(--theme-bg)' }}>
                <BookOpen className="w-10 h-10" style={{ color: 'var(--theme-nav-text-muted)' }} />
              </div>
              <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--theme-text)' }}>{t('noBooksYet')}</h3>
              <p className="text-base mb-8 max-w-md" style={{ color: 'var(--theme-nav-text-muted)' }}>{t('addFirstBookPrompt')}</p>
              <Button onClick={() => setIsAddModalOpen(true)} className="rounded-full px-8 h-12 transition-colors" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
                <Plus className="mr-2 w-5 h-5" />
                {t('addFirstBook')}
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {books.map((book) => {
              const langName = getBookLanguageName(book.languageCode ?? 'en', locale)
              const progress = readingProgress(book.currentPage, book.pages.length, book.totalPages)
              const langFlag = BOOK_LANGUAGES.find(l => l.code === (book.languageCode ?? 'en'))?.flag ?? '📖'
              return (
                <Card 
                  key={book.id} 
                  className="p-0 rounded-[16px] border transition-all group relative overflow-hidden cursor-pointer hover:opacity-95"
                  style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}
                >
                  <button type="button" className="absolute inset-0 z-10 rounded-[16px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--theme-primary)]"
                    aria-label={locale === 'pt-BR' ? `Abrir ${book.title}` : `Open ${book.title}`}
                    onClick={() => handleOpenBook(book.id)} />
                  {book.coverData && (
                    <div className="w-full aspect-[4/3] overflow-hidden rounded-t-[16px] bg-[var(--theme-bg-secondary)]">
                      <img src={book.coverData} alt="" className="w-full h-full object-cover object-top" />
                    </div>
                  )}
                  <div className="p-3 flex flex-col">
                    <div className="flex items-start gap-1.5 mb-1.5">
                      <span className="text-lg leading-tight rounded-full shrink-0" title={langName}>{langFlag}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className={`text-sm md:text-[15px] font-bold leading-snug line-clamp-2 ${book.coverData ? '' : 'pr-16'}`} style={{ color: 'var(--theme-text)' }} title={book.title}>{book.title}</h3>
                        {book.author && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--theme-text-secondary)' }}>{book.author}</p>
                        )}
                                              </div>
                    </div>
                    <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5">
                      <Button variant="ghost" size="icon" className={coverActionClass} onClick={e => openEditBook(book, e)}
                        title={t('editBook')} aria-label={t('editBook')}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className={coverActionClass} aria-label={t('delete')}
                        title={t('delete')} onClick={e => { e.stopPropagation(); setBookError(''); setPendingDelete(book) }}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    {(book.description && book.description.trim()) ? (
                      <p className="text-xs mb-1.5 opacity-80 line-clamp-2" style={{ color: 'var(--theme-text-secondary)', display: '-webkit-box', WebkitBoxOrient: 'vertical' }}>{book.description}</p>
                    ) : (book.context && book.context.trim()) ? (
                      <p className="text-xs mb-1.5 opacity-80 line-clamp-2" style={{ color: 'var(--theme-text-secondary)', display: '-webkit-box', WebkitBoxOrient: 'vertical' }}>{firstLine(book.context)}</p>
                    ) : null}
                    <p className="text-[11px] font-medium mb-2 opacity-70 truncate" style={{ color: 'var(--theme-text-secondary)' }}>
                      {book.wordCount.toLocaleString()} {t('words')} • {new Date(book.lastRead).toLocaleDateString()}
                    </p>
                    <div className="mt-auto space-y-1.5 pt-2 border-t" style={{ borderColor: 'var(--theme-border-subtle)' }}>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-70" style={{ color: 'var(--theme-text-secondary)' }}>{t('progress')}</span>
                        <span className="text-xs font-bold" style={{ color: 'var(--theme-text)' }}>{progress}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-border-subtle)' }}>
                        <div className="h-full transition-all duration-300 rounded-full" style={{ width: `${progress}%`, backgroundColor: 'var(--theme-primary)' }} />
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
 
      <Dialog open={!!pendingDelete} onOpenChange={open => { if (!open && !savingBook) setPendingDelete(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{locale === 'pt-BR' ? 'Excluir livro' : 'Delete book'}</DialogTitle>
            <DialogDescription>{pendingDelete?.title}</DialogDescription>
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
        <DialogContent className="relative sm:max-w-lg rounded-[2rem] border pt-8" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(false)}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-bg)]"
            aria-label={t('cancel')}
          >
            <X className="h-4 w-4" />
          </button>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--theme-text)' }}>{t('addNewBook')}</DialogTitle>
            <DialogDescription style={{ color: 'var(--theme-text-secondary)' }}>{t('addNewBookDescription')}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label htmlFor="title" style={{ color: 'var(--theme-text)' }}>{t('title')}</Label>
              <Input id="title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t('titlePlaceholder')} className="rounded-2xl h-12 px-4" style={{ borderColor: 'var(--theme-border)' }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author" style={{ color: 'var(--theme-text)' }}>{t('author')}</Label>
              <Input id="author" value={newAuthor} onChange={(e) => setNewAuthor(e.target.value)} placeholder={t('authorPlaceholder')} className="rounded-2xl h-12 px-4" style={{ borderColor: 'var(--theme-border)' }} />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--theme-text)' }}>{t('bookLanguage')}</Label>
              <div className="flex flex-wrap gap-2 p-2 rounded-xl border" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
                {BOOK_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setNewBookLanguage(lang.code)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all border ${
                      newBookLanguage === lang.code ? 'ring-2' : ''
                    }`}
                    style={{
                      borderColor: newBookLanguage === lang.code ? 'var(--theme-primary)' : 'var(--theme-border)',
                      backgroundColor: newBookLanguage === lang.code ? 'var(--theme-primary)' : 'transparent',
                      color: newBookLanguage === lang.code ? 'var(--theme-primary-text)' : 'var(--theme-text)'
                    }}
                    title={locale === 'pt-BR' ? lang.namePt : lang.nameEn}
                  >
                    <span className="text-lg">{lang.flag}</span>
                    <span>{locale === 'pt-BR' ? lang.namePt : lang.nameEn}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--theme-text)' }}>{t('bookDescription')}</Label>
              <Input id="new-desc" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder={t('bookDescriptionPlaceholder')} className="rounded-xl" style={{ borderColor: 'var(--theme-border)' }} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label htmlFor="content" style={{ color: 'var(--theme-text)' }}>{t('content')}</Label>
                <Button type="button" variant="outline" size="sm" className="rounded-xl gap-2" style={{ borderColor: 'var(--theme-border)' }} disabled={epubStatus.busy} onClick={() => epubInputRef.current?.click()}>
                  <BookUp className="w-4 h-4" />
                  {epubStatus.busy ? (locale === 'pt-BR' ? 'Lendo EPUB…' : 'Reading EPUB…') : (locale === 'pt-BR' ? 'Importar EPUB' : 'Import EPUB')}
                </Button>
              </div>
              {bookError && <p role="alert" className="text-sm">{bookError}</p>}
              {epubStatus.msg && <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>{epubStatus.msg}</p>}
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
                className="min-h-[200px] rounded-2xl p-4 resize-none"
                style={{ borderColor: 'var(--theme-border)' }}
              />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--theme-text)' }}>{t('totalPages')}</Label>
              <Input type="number" min={1} value={newTotalPages} onChange={(e) => setNewTotalPages(e.target.value)} placeholder={t('totalPagesPlaceholder')} className="rounded-xl" style={{ borderColor: 'var(--theme-border)' }} />
            </div>
            <div className="space-y-2">
              <Label style={{ color: 'var(--theme-text)' }}>{t('coverImage')}</Label>
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" className="rounded-xl gap-2" style={{ borderColor: 'var(--theme-border)' }} onClick={() => coverInputRef.current?.click()}>
                  <ImagePlus className="w-4 h-4" />
                  {t('uploadCover')}
                </Button>
                {newCoverData && <img src={newCoverData} alt="" className="w-16 h-16 rounded-lg object-cover border" style={{ borderColor: 'var(--theme-border)' }} />}
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 pt-6">
            <Button variant="outline" className="flex-1 rounded-full h-12 font-semibold" style={{ borderColor: 'var(--theme-border)' }} onClick={() => setIsAddModalOpen(false)}>{t('cancel')}</Button>
            <Button className="flex-2 rounded-full h-12 px-8 font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }} onClick={handleAddBook} disabled={!newTitle.trim() || savingBook || epubStatus.busy}>
              {t('saveBook')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editBookId} onOpenChange={(open) => !open && setEditBookId(null)}>
        <DialogContent className="relative sm:max-w-lg rounded-[2rem] border pt-8" style={{ backgroundColor: 'var(--theme-card-bg)', color: 'var(--theme-text)', borderColor: 'var(--theme-border)' }}>
          <button
            type="button"
            onClick={() => setEditBookId(null)}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-bg)]"
            aria-label={t('cancel')}
          >
            <X className="h-4 w-4" />
          </button>
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
              <Label style={{ color: 'var(--theme-text)' }}>{t('bookLanguage')}</Label>
              <div className="flex flex-wrap gap-2 p-2 rounded-xl border" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
                {BOOK_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setEditLanguage(lang.code)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all border ${editLanguage === lang.code ? 'ring-2' : ''}`}
                    style={{
                      borderColor: editLanguage === lang.code ? 'var(--theme-primary)' : 'var(--theme-border)',
                      backgroundColor: editLanguage === lang.code ? 'var(--theme-primary)' : 'transparent',
                      color: editLanguage === lang.code ? 'var(--theme-primary-text)' : 'var(--theme-text)'
                    }}
                    title={locale === 'pt-BR' ? lang.namePt : lang.nameEn}
                  >
                    <span className="text-lg">{lang.flag}</span>
                    <span>{locale === 'pt-BR' ? lang.namePt : lang.nameEn}</span>
                  </button>
                ))}
              </div>
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
