import { useState, useEffect } from 'react'
import { Book } from '@/store/useBookStore'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'

interface EditorProps {
  book: Book
  onSave: (pages: string[], currentPage: number) => void
  onCancel: () => void
}

export function Editor({ book, onSave, onCancel }: EditorProps) {
  const [pages, setPages] = useState<string[]>(book.pages || [book.content])
  const [currentPage, setCurrentPage] = useState(book.currentPage || 0)
  const [content, setContent] = useState(pages[currentPage] || '')

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
    </div>
  )
}
