import { useState, useEffect, useRef, type CSSProperties } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBookStore } from '@/store/useBookStore'
import { useBookSync } from '@/hooks/useBookSync'
import { useLanguage } from '@/store/useLanguage'
import { useTranslations } from '@/lib/i18n'
import { ComicBookSettings } from '@/components/settings/ComicBookSettings'
import { Reader } from '@/components/reader/Reader'
import { SpeakPractice } from '@/components/speak/SpeakPractice'
import { DictationPractice } from '@/components/write/DictationPractice'
import { Editor } from '@/components/editor/Editor'
import { PageSizeDialog } from '@/components/book/PageSizeDialog'
import { remapComics } from '@/lib/comicPersistence'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BookOpen, CheckCircle2, FilePen, Keyboard, Headphones, Mic, Palette, PenLine, Rows3, XCircle } from 'lucide-react'
import { ToolButton, ToolGroup } from '@/components/ui/toolbar'
import { useAuth } from '@/contexts/AuthContext'

export function BookPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { locale } = useLanguage()
  const { t } = useTranslations(locale)
  const { books, setCurrentBook } = useBookStore()
  const { updateBookAndSync, updateBookAndSyncAsync } = useBookSync()
  const { hasSupabase, session } = useAuth()
  const [mode, setMode] = useState<'read' | 'edit' | 'listen' | 'speak'>('read')
  const [saveFeedback, setSaveFeedback] = useState<'success' | 'error' | null>(null)
  const [saveError, setSaveError] = useState('')
  const [artOpen, setArtOpen] = useState(false)
  const [pageSizeOpen, setPageSizeOpen] = useState(false)
  const [writeMode, setWriteMode] = useState<'dictation' | 'edit'>('dictation')
  // Altura do topo fixo: o painel de ferramentas da HQ gruda logo abaixo dele.
  const [headerH, setHeaderH] = useState(64)
  const headerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeaderH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  })

  const book = books.find(b => b.id === id)

  useEffect(() => {
    if (id) {
      setCurrentBook(id)
    }
  }, [id, setCurrentBook])

  useEffect(() => {
    if (book) {
      updateBookAndSync(book.id, { lastRead: Date.now() })
    }
  }, [book?.id, updateBookAndSync])

  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <h2 className="text-2xl font-bold text-zinc-800">Livro não encontrado</h2>
        <Button onClick={() => navigate('/')}>Voltar ao Início</Button>
      </div>
    )
  }

  const handleSaveContent = async (pages: string[], currentPage: number) => {
    try {
      const updates: Partial<typeof book> = { pages, currentPage, content: pages[currentPage] || '' }
      // Imagens da HQ seguem o texto da página (excluir/adicionar páginas não pode desalinhar).
      if (Object.keys(book.comicPages ?? {}).length) {
        const moved = remapComics(book.pages, pages, book.comicPages, book.comicLayouts)
        updates.comicPages = moved.comicPages
        updates.comicLayouts = moved.comicLayouts
      }
      await updateBookAndSyncAsync(book.id, updates)
      setSaveError('')
      setSaveFeedback('success')
      setMode('read')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o conteúdo no banco de dados.'
      setSaveError(message)
      setSaveFeedback('error')
      throw error
    }
  }

  return (
    <div className="relative min-h-full flex flex-col" style={{ '--reader-sticky-top': `${headerH}px` } as CSSProperties}>
      <div ref={headerRef} className="flex justify-between items-center gap-3 flex-wrap mb-6 sticky top-0 z-40 py-3 transition-colors" style={{ backgroundColor: 'var(--theme-bg)' }}>
        <ToolGroup label={locale === 'pt-BR' ? 'Atividade' : 'Activity'}>
          {([
            ['read', t('readTab'), <BookOpen key="i" className="w-4 h-4" />],
            ['edit', t('writeTab'), <PenLine key="i" className="w-4 h-4" />],
            ['listen', t('listenTab'), <Headphones key="i" className="w-4 h-4" />],
            ['speak', t('speakTab'), <Mic key="i" className="w-4 h-4" />],
          ] as const).map(([m, label, icon]) => (
            <ToolButton key={m} icon={icon} label={label} compact active={mode === m} onClick={() => setMode(m)} />
          ))}
        </ToolGroup>

        <div className="flex items-center gap-3">
          <ToolGroup label={locale === 'pt-BR' ? 'Configurar livro' : 'Book setup'}>
            <ToolButton icon={<Rows3 className="w-4 h-4" />} compact
              label={locale === 'pt-BR' ? 'Tamanho da página' : 'Page length'}
              hint={locale === 'pt-BR' ? 'Escolha quanto texto vai em cada página (curta é melhor para HQ)' : 'Choose how much text goes on each page (short works best for comics)'}
              onClick={() => setPageSizeOpen(true)} />
            <ToolButton icon={<Palette className="w-4 h-4" />} compact
              label={locale === 'pt-BR' ? 'Arte da HQ' : 'Comic art'}
              hint={locale === 'pt-BR' ? 'Estilo de desenho, referências visuais e personagens da HQ' : 'Drawing style, visual references and characters for the comic'}
              onClick={() => setArtOpen(true)} />
          </ToolGroup>
          <div className="hidden lg:block text-xs font-medium tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>
            {book.wordCount.toLocaleString(locale)} {t('words')}
          </div>
        </div>
      </div>

      <div className="flex-1">
        {mode === 'edit' ? (
          <div className="space-y-6">
            <div className="flex justify-center">
              <ToolGroup label={locale === 'pt-BR' ? 'Escrever' : 'Write'}>
                <ToolButton icon={<Keyboard className="w-4 h-4" />} active={writeMode === 'dictation'} onClick={() => setWriteMode('dictation')}
                  label={locale === 'pt-BR' ? 'Treino de ditado' : 'Dictation practice'}
                  hint={locale === 'pt-BR' ? 'Ouça cada palavra da página e digite' : 'Hear each word of the page and type it'} />
                <ToolButton icon={<FilePen className="w-4 h-4" />} active={writeMode === 'edit'} onClick={() => setWriteMode('edit')}
                  label={locale === 'pt-BR' ? 'Editar texto' : 'Edit text'}
                  hint={locale === 'pt-BR' ? 'Digite, cole ou corrija as páginas do livro' : 'Type, paste or fix the book pages'} />
              </ToolGroup>
            </div>
            {writeMode === 'dictation'
              ? <DictationPractice book={book} />
              : <Editor book={book} onSave={handleSaveContent} onCancel={() => setMode('read')} />}
          </div>
        ) : mode === 'speak' ? (
          <SpeakPractice book={book} />
        ) : (
          <Reader book={book} autoPlay={mode === 'listen'} />
        )}
      </div>

      <PageSizeDialog
        book={book}
        open={pageSizeOpen}
        pt={locale === 'pt-BR'}
        onOpenChange={setPageSizeOpen}
        onApply={(updates) => updateBookAndSyncAsync(book.id, updates)}
      />
      <Dialog open={artOpen} onOpenChange={setArtOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{locale === 'pt-BR' ? 'Direção de arte do livro' : 'Book art direction'}</DialogTitle>
          </DialogHeader>
          <ComicBookSettings key={book.id} book={book} userId={session?.user.id} pt={locale === 'pt-BR'} />
        </DialogContent>
      </Dialog>
      <Dialog open={saveFeedback !== null} onOpenChange={(open) => !open && setSaveFeedback(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {saveFeedback === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              {saveFeedback === 'success' ? 'Conteúdo salvo' : 'Falha ao salvar'}
            </DialogTitle>
            <DialogDescription>
              {saveFeedback === 'success'
                ? hasSupabase && session
                  ? 'As páginas foram salvas no banco de dados do Supabase.'
                  : 'As páginas foram salvas localmente. Faça login para sincronizar com o Supabase.'
                : saveError || 'Não foi possível salvar as páginas no banco de dados.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button onClick={() => setSaveFeedback(null)}>Entendi</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
