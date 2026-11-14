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
import { VoiceCastDialog } from '@/components/book/VoiceCastDialog'
import { remapComics } from '@/lib/comicPersistence'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BookOpen, Users, CheckCircle2, FilePen, Keyboard, Headphones, Mic, Palette, PenLine, Rows3, XCircle, Settings2, ChevronDown } from 'lucide-react'
import { MenuItem, ToolButton, ToolGroup } from '@/components/ui/toolbar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { StylePickerDialog, useApplyBookStyle, useStyleBank } from '@/components/book/StylePicker'
import { stylePreview } from '@/lib/comicStyles'
import { VoiceAvatar } from '@/components/settings/VoiceAvatar'
import { getKokoroVoice } from '@/lib/kokoro/voices'
import { activeKokoroVoice } from '@/lib/kokoro/engine'
import { useAuth } from '@/contexts/AuthContext'
import { canOpenCatalog, useEntitlements } from '@/store/useEntitlements'
import { openPaywall } from '@/components/billing/Paywall'
import { ReaderTutor } from '@/components/reader/ReaderTutor'

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
  const [styleOpen, setStyleOpen] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null)
  const [pageSizeOpen, setPageSizeOpen] = useState(false)
  const [castOpen, setCastOpen] = useState(false)
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
  const ent = useEntitlements(st => st.data)
  const pt = locale === 'pt-BR'
  const bank = useStyleBank(pt)
  const placeholder = { id: '', comicPages: {} } as unknown as NonNullable<typeof book>
  const narratorVoice = getKokoroVoice((book?.comicStyleDoc as { narratorVoice?: string } | undefined)?.narratorVoice ?? activeKokoroVoice())
  const styleChange = useApplyBookStyle(book ?? placeholder, session?.user.id, pt, bank)

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

  // Livro da galeria sem acesso (voltou ao Grátis): progresso guardado, leitura só com assinatura.
  if (!canOpenCatalog(ent, book.catalogId)) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4">
        <div className="text-[48px]" aria-hidden>📚</div>
        <h1 className="mt-4 font-display text-[28px] leading-tight">{pt ? `“${book.title}” é Premium` : `“${book.title}” is Premium`}</h1>
        <p className="mt-3 text-[15px]" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? `Seu progresso (página ${book.currentPage + 1}), notas e vocabulário estão guardados. Assine para continuar de onde parou.` : `Your progress (page ${book.currentPage + 1}), notes and vocabulary are saved. Subscribe to continue where you left off.`}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => openPaywall('book')}>{pt ? 'Ver planos' : 'See plans'}</Button>
          <Button variant="outline" onClick={() => navigate('/')}>{pt ? 'Voltar ao início' : 'Back home'}</Button>
        </div>
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
      {/* Topo fixo numa faixa só, como um editor: atividades, ferramentas da atividade e ajustes.
          O título do livro fica no conteúdo, sem disputar espaço com as barras. */}
      <div ref={headerRef} className="sticky top-[calc(var(--safe-t,0px)+var(--navbar-h,0px))] md:top-0 z-40 -mx-4 md:-mx-10 mb-4 md:mb-6"
        style={{ backgroundColor: 'var(--theme-bg)' }}>
        <div className="h-12 px-2 md:px-6 flex items-stretch gap-1 border-b" style={{ borderColor: 'var(--theme-border)' }}>
          <nav role="tablist" aria-label={pt ? 'Atividade' : 'Activity'} className="flex items-stretch gap-0.5 min-w-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {([
              ['read', t('readTab'), <BookOpen key="i" className="w-4 h-4" />],
              ['edit', t('writeTab'), <PenLine key="i" className="w-4 h-4" />],
              ['listen', t('listenTab'), <Headphones key="i" className="w-4 h-4" />],
              ['speak', t('speakTab'), <Mic key="i" className="w-4 h-4" />],
            ] as const).map(([m, label, icon]) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                className="relative px-3 inline-flex items-center gap-2 text-[13.5px] font-medium whitespace-nowrap transition-colors hover:text-[var(--theme-text)]"
                style={{ color: mode === m ? 'var(--theme-text)' : 'var(--theme-text-secondary)' }}>
                {icon}<span className="hidden sm:inline">{label}</span>
                {mode === m && <span aria-hidden className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full" style={{ backgroundColor: 'var(--theme-text)' }} />}
              </button>
            ))}
          </nav>
          {/* Ferramentas na mesma faixa: as do leitor (Texto | Ilustrado…) vêm do Reader; na escrita, os modos de escrita. */}
          <div className="book-toolrow flex items-center gap-2 min-w-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span aria-hidden className="book-tooldivider mx-1 h-5 w-px shrink-0" style={{ backgroundColor: 'var(--theme-border)' }} />
            {mode === 'edit' && (
              <div className="flex items-center gap-0.5">
                <ToolButton icon={<Keyboard className="w-4 h-4" />} active={writeMode === 'dictation'} onClick={() => setWriteMode('dictation')}
                  compact label={pt ? 'Treino de ditado' : 'Dictation practice'}
                  hint={pt ? 'Ouça cada palavra da página e digite' : 'Hear each word of the page and type it'} />
                <ToolButton icon={<FilePen className="w-4 h-4" />} active={writeMode === 'edit'} onClick={() => setWriteMode('edit')}
                  compact label={pt ? 'Editar texto' : 'Edit text'}
                  hint={pt ? 'Digite, cole ou corrija as páginas do livro' : 'Type, paste or fix the book pages'} />
              </div>
            )}
            <div ref={setHeaderSlot} className="book-toolslot flex items-center min-w-0" />
          </div>
          {/* Ajustes do livro direto no topo: miniatura do estilo, voz do narrador e tamanho da página. */}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => setStyleOpen(true)} title={pt ? 'Estilo de arte das ilustrações' : 'Illustration art style'}
              className="h-9 pl-1 pr-2.5 inline-flex items-center gap-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-[var(--ui-hover)]" style={{ color: 'var(--theme-text-secondary)' }}>
              {book.comicStyleDoc?.styleId
                ? <img src={stylePreview(book.comicStyleDoc.styleId)} alt="" className="w-7 h-7 rounded-md object-cover" />
                : <span className="w-7 h-7 grid place-items-center"><Palette className="w-4 h-4" /></span>}
              <span className="hidden xl:inline max-w-[140px] truncate">{bank?.find(st => st.id === book.comicStyleDoc?.styleId)?.name ?? (pt ? 'Estilo de arte' : 'Art style')}</span>
            </button>
            <button type="button" onClick={() => setCastOpen(true)} title={pt ? 'Vozes da leitura' : 'Reading voices'}
              className="h-9 w-9 grid place-items-center rounded-lg transition-colors hover:bg-[var(--ui-hover)]">
              {narratorVoice ? <VoiceAvatar voice={narratorVoice} size={26} /> : <Users className="w-4 h-4" />}
            </button>
            <button type="button" onClick={() => setPageSizeOpen(true)} title={pt ? 'Tamanho da página' : 'Page length'} aria-label={pt ? 'Tamanho da página' : 'Page length'}
              className="h-9 w-9 grid place-items-center rounded-lg transition-colors hover:bg-[var(--ui-hover)]" style={{ color: 'var(--theme-text-secondary)' }}>
              <Rows3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1">
        {mode === 'edit' ? (
          <div className="space-y-6">
            {writeMode === 'dictation'
              ? <DictationPractice book={book} />
              : <Editor book={book} onSave={handleSaveContent} onCancel={() => setMode('read')} />}
          </div>
        ) : mode === 'speak' ? (
          <SpeakPractice book={book} />
        ) : (
          <>
            <Reader book={book} autoPlay={mode === 'listen'} headerSlot={headerSlot} />
            <ReaderTutor book={book} />
          </>
        )}
      </div>

      <VoiceCastDialog book={book} open={castOpen} pt={locale === 'pt-BR'} onOpenChange={setCastOpen}
        onSave={(doc) => updateBookAndSync(book.id, { comicStyleDoc: doc })} />
      <PageSizeDialog
        book={book}
        open={pageSizeOpen}
        pt={locale === 'pt-BR'}
        onOpenChange={setPageSizeOpen}
        onApply={(updates) => updateBookAndSyncAsync(book.id, updates)}
      />
      <StylePickerDialog open={styleOpen} onOpenChange={setStyleOpen} value={book.comicStyleDoc?.styleId} pt={pt} busy={styleChange.busy} warn={styleChange.warn}
        description={Object.keys(book.comicPages ?? {}).length
          ? (pt ? `Este livro tem ${Object.keys(book.comicPages ?? {}).length} páginas desenhadas. Trocar o estilo apaga essas imagens e recomeça do zero.` : `This book has ${Object.keys(book.comicPages ?? {}).length} drawn pages. Changing the style deletes them and starts over.`)
          : (pt ? 'Escolha como as páginas deste livro vão ser desenhadas.' : 'Choose how this book’s pages will be drawn.')}
        secondary={{ label: pt ? 'Direção de arte avançada (referências e personagens)' : 'Advanced art direction (references and characters)', onClick: () => { setStyleOpen(false); setArtOpen(true) } }}
        onPick={styleId => { void styleChange.apply(styleId).then(ok => { if (ok) setStyleOpen(false) }) }} />
      <Dialog open={artOpen} onOpenChange={setArtOpen}>
        <DialogContent className="max-w-3xl sm:max-w-3xl max-h-[85vh] overflow-y-auto">
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
                <XCircle className="h-5 w-5 text-[var(--pastel-rose-fg)]" />
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
