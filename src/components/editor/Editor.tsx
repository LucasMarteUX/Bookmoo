import { useState, useEffect, useRef } from 'react'
import { Book } from '@/store/useBookStore'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ChevronLeft, ChevronRight, Plus, Trash2, Camera, ImagePlus, Loader2, RotateCcw, X } from 'lucide-react'
import { preparePageImage, transcribePageImage } from '@/lib/pageTranscription'

interface EditorProps {
  book: Book
  onSave: (pages: string[], currentPage: number) => void
  onCancel: () => void
}

export function Editor({ book, onSave, onCancel }: EditorProps) {
  const [pages, setPages] = useState<string[]>(book.pages?.length ? book.pages : [''])
  const [currentPage, setCurrentPage] = useState(book.currentPage || 0)
  const [content, setContent] = useState(pages[currentPage] || '')
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false)

  useEffect(() => {
    setContent(pages[currentPage] || '')
  }, [currentPage, pages])

  const handleContentChange = (val: string) => {
    setContent(val)
    const newPages = [...pages]
    newPages[currentPage] = val
    setPages(newPages)
  }

  const handleAddPage = () => {
    const newPages = [...pages, '']
    setPages(newPages)
    setCurrentPage(newPages.length - 1)
  }

  const handleDeletePage = () => {
    if (pages.length <= 1) return
    const newPages = pages.filter((_, i) => i !== currentPage)
    const newCurrentPage = currentPage >= newPages.length ? Math.max(0, newPages.length - 1) : currentPage
    setPages(newPages)
    setCurrentPage(newCurrentPage)
    setContent(newPages[newCurrentPage] || '')
  }

  const handleSave = () => {
    const newPages = [...pages]
    newPages[currentPage] = content
    onSave(newPages, currentPage)
  }

  return (
    <div className="max-w-[720px] mx-auto flex flex-col h-[calc(100vh-200px)]">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium transition-colors" style={{ color: 'var(--theme-nav-text-muted)' }}>
            Página {currentPage + 1} de {pages.length}
          </span>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))}
            disabled={currentPage === pages.length - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleAddPage} className="gap-2">
            <Plus className="w-4 h-4" />
            Adicionar Página
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsImageDialogOpen(true)} className="gap-2">
            <Camera className="w-4 h-4" />
            Adicionar página por imagem
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeletePage}
            disabled={pages.length <= 1}
            className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <Trash2 className="w-4 h-4" />
            Excluir Página
          </Button>
        </div>
      </div>

      <div className="flex-1 mb-4">
        <Textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          className="w-full h-full min-h-[400px] resize-none font-mono text-sm leading-relaxed p-6 rounded-2xl transition-colors"
          style={{ borderColor: 'var(--theme-border-subtle)' }}
          placeholder="Comece a digitar seu texto aqui..."
        />
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSave}>Salvar Alterações</Button>
      </div>
      <PageImageDialog
        open={isImageDialogOpen}
        languageCode={book.languageCode}
        onClose={() => setIsImageDialogOpen(false)}
        onTranscribed={(transcribedText) => {
          const newPages = [...pages, transcribedText]
          setPages(newPages)
          setCurrentPage(newPages.length - 1)
          setContent(transcribedText)
          setIsImageDialogOpen(false)
        }}
      />
    </div>
  )
}

function PageImageDialog({
  open,
  languageCode,
  onClose,
  onTranscribed
}: {
  open: boolean
  languageCode?: string
  onClose: () => void
  onTranscribed: (text: string) => void
}) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const handleFile = async (file?: File) => {
    if (!file) return
    setError('')
    try {
      setPreview(await preparePageImage(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir essa imagem.')
    }
  }

  const handleTranscribe = async () => {
    if (!preview || isProcessing) return
    setIsProcessing(true)
    setError('')
    try {
      const text = await transcribePageImage(preview, languageCode)
      if (!text) throw new Error('Nenhum texto legível foi encontrado.')
      onTranscribed(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ler a página.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-lg rounded-3xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--theme-card-bg)', color: 'var(--theme-text)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Adicionar página</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--theme-text-secondary)' }}>Fotografe ou escolha uma imagem para transcrever.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isProcessing} aria-label="Fechar" className="rounded-full p-2 hover:bg-[var(--theme-nav-hover)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { void handleFile(event.target.files?.[0]); event.currentTarget.value = '' }} />
        <input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" onChange={(event) => { void handleFile(event.target.files?.[0]); event.currentTarget.value = '' }} />

        {!preview ? (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button type="button" className="h-24 flex-col gap-2 rounded-2xl" onClick={() => cameraInputRef.current?.click()}>
              <Camera className="h-6 w-6" />
              Tirar foto
            </Button>
            <Button type="button" variant="outline" className="h-24 flex-col gap-2 rounded-2xl" onClick={() => galleryInputRef.current?.click()}>
              <ImagePlus className="h-6 w-6" />
              Escolher imagem
            </Button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <img src={preview} alt="Pré-visualização da página" className="max-h-[45vh] w-full rounded-2xl border object-contain" style={{ borderColor: 'var(--theme-border)' }} />
            {isProcessing && <p className="flex items-center justify-center gap-2 text-sm" style={{ color: 'var(--theme-text-secondary)' }}><Loader2 className="h-4 w-4 animate-spin" />Lendo página...</p>}
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setPreview(null)} disabled={isProcessing}><RotateCcw className="mr-2 h-4 w-4" />Refazer</Button>
              <Button type="button" onClick={() => void handleTranscribe()} disabled={isProcessing}><ImagePlus className="mr-2 h-4 w-4" />Usar esta imagem</Button>
            </div>
          </div>
        )}
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200">{error}</p>}
      </div>
    </div>
  )
}
