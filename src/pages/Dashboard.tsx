import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, Clock, BookMarked, Trash2, Pencil, ImagePlus } from 'lucide-react'
import { useBookStore } from '@/store/useBookStore'
import { useStudyStore } from '@/store/useStudyStore'
import { useVocabularyStore } from '@/store/useVocabularyStore'
import { useLanguage } from '@/store/useLanguage'
import { useTranslations } from '@/lib/i18n'
import { BOOK_LANGUAGES, getBookLanguageName } from '@/lib/languages'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { upsertBook, deleteBookRemote, fetchBooks } from '@/lib/supabaseSync'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

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
 
  const handleAddBook = () => {
    if (!newTitle.trim()) return
    const totalPagesNum = newTotalPages.trim() ? parseInt(newTotalPages, 10) : undefined
    const validTotal = totalPagesNum != null && !Number.isNaN(totalPagesNum) && totalPagesNum > 0 ? totalPagesNum : undefined
    const newBook = addBook(newTitle, newContent, {
      languageCode: newBookLanguage,
      coverData: newCoverData ?? undefined,
      description: newDescription.trim() || undefined,
      totalPages: validTotal,
      author: newAuthor.trim() || undefined
    })
    if (hasSupabase && supabase && userId) {
      upsertBook(supabase, userId, newBook).catch((e) => console.error('Sync book insert', e))
    }
    setIsAddModalOpen(false)
    setNewTitle('')
    setNewContent('')
    setNewBookLanguage('en')
    setNewCoverData(null)
    setNewDescription('')
    setNewTotalPages('')
    setNewAuthor('')
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
      upsertBook(supabase, userId, { ...book, ...updates }).catch((e) => console.error('Sync book update', e))
    }
    setEditBookId(null)
  }
 
  const hour = new Date().getHours()
  const greetingKey: 'goodMorning' | 'goodAfternoon' | 'goodEvening' = hour >= 5 && hour < 12 ? 'goodMorning' : hour >= 12 && hour < 18 ? 'goodAfternoon' : 'goodEvening'

  console.log('[Dashboard] books length', books.length, books)

  // Fallback: garantir que livros sejam carregados direto na Dashboard,
  // mesmo que algo impeça o hook de hidratação de rodar corretamente.
  useEffect(() => {
    const userId = session?.user?.id
    if (!hasSupabase || !supabase || !userId) return
    if (books.length > 0) return

    ;(async () => {
      try {
        const remoteBooks = await fetchBooks(supabase, userId)
        console.log('[Dashboard] fetched books directly', remoteBooks)
        setBooks(remoteBooks)
      } catch (e) {
        console.error('[Dashboard] error fetching books directly', e)
      }
    })()
  }, [hasSupabase, session?.user?.id, books.length, setBooks])

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight" style={{ color: 'var(--theme-text)' }}>{t(greetingKey)}</h1>
        <Button onClick={() => setIsAddModalOpen(true)} className="rounded-full px-6 h-12 transition-colors w-full sm:w-auto min-h-[44px]" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
          <Plus className="mr-2 w-5 h-5" />
          {t('addBook')}
        </Button>
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
        
        {books.length === 0 ? (
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {books.map((book) => {
              const langName = getBookLanguageName(book.languageCode ?? 'en', locale)
              const langFlag = BOOK_LANGUAGES.find(l => l.code === (book.languageCode ?? 'en'))?.flag ?? '📖'
              return (
                <Card 
                  key={book.id} 
                  role="button"
                  tabIndex={0}
                  className="p-0 rounded-[16px] border transition-all group relative overflow-hidden cursor-pointer hover:opacity-95"
                  style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}
                  onClick={() => handleOpenBook(book.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenBook(book.id) } }}
                >
                  {book.coverData && (
                    <div className="w-full aspect-[3/4] overflow-hidden rounded-t-[16px] bg-[var(--theme-bg-secondary)]">
                      <img src={book.coverData} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-4 md:p-5 flex flex-col">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-2xl rounded-full shrink-0" title={langName}>{langFlag}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold line-clamp-2 pr-16" style={{ color: 'var(--theme-text)' }} title={book.title}>{book.title}</h3>
                        {book.author && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-secondary)' }}>{book.author}</p>
                        )}
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--theme-text-secondary)' }}>{langName}</p>
                      </div>
                    </div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" style={{ color: 'var(--theme-text)' }} onClick={(e) => openEditBook(book, e)} title={t('editBook')}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" style={{ color: 'var(--theme-text)' }} onClick={(e) => { e.stopPropagation(); deleteBook(book.id); hasSupabase && supabase && userId && deleteBookRemote(supabase, userId, book.id).catch(() => {}) }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {(book.description && book.description.trim()) ? (
                      <p className="text-sm mb-2 opacity-80 line-clamp-2" style={{ color: 'var(--theme-text-secondary)' }}>{book.description}</p>
                    ) : (book.context && book.context.trim()) ? (
                      <p className="text-sm mb-2 opacity-80 line-clamp-2" style={{ color: 'var(--theme-text-secondary)' }}>{firstLine(book.context)}</p>
                    ) : null}
                    <p className="text-sm font-medium mb-4 opacity-70" style={{ color: 'var(--theme-text-secondary)' }}>
                      {book.wordCount.toLocaleString()} {t('words')} • {t('readOn')} {new Date(book.lastRead).toLocaleDateString()}
                    </p>
                    <div className="mt-auto space-y-2 pt-3 border-t" style={{ borderColor: 'var(--theme-border-subtle)' }}>
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase font-bold tracking-wider opacity-70" style={{ color: 'var(--theme-text-secondary)' }}>{t('progress')}</span>
                        <span className="text-sm font-bold" style={{ color: 'var(--theme-text)' }}>{book.totalPages ? Math.min(100, Math.round((book.pages.length / book.totalPages) * 100)) : book.progress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-border-subtle)' }}>
                        <div className="h-full transition-all duration-300 rounded-full" style={{ width: `${book.totalPages ? Math.min(100, (book.pages.length / book.totalPages) * 100) : book.progress}%`, backgroundColor: 'var(--theme-primary)' }} />
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
 
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
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
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 rounded-xl border" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
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
              <Label htmlFor="content" style={{ color: 'var(--theme-text)' }}>{t('content')}</Label>
              <Textarea
                id="content"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
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
            <Button className="flex-2 rounded-full h-12 px-8 font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }} onClick={handleAddBook} disabled={!newTitle.trim()}>
              {t('saveBook')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editBookId} onOpenChange={(open) => !open && setEditBookId(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--theme-card-bg)', color: 'var(--theme-text)', borderColor: 'var(--theme-border)' }}>
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
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 rounded-xl border" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
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
