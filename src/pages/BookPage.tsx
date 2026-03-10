import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBookStore } from '@/store/useBookStore'
import { useBookSync } from '@/hooks/useBookSync'
import { useLanguage } from '@/store/useLanguage'
import { useTranslations } from '@/lib/i18n'
import { Reader } from '@/components/reader/Reader'
import { Editor } from '@/components/editor/Editor'
import { Button } from '@/components/ui/button'

export function BookPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { locale } = useLanguage()
  const { t } = useTranslations(locale)
  const { books, setCurrentBook } = useBookStore()
  const { updateBookAndSync, updateBookAndSyncAsync } = useBookSync()
  const [mode, setMode] = useState<'read' | 'edit'>('read')

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
    await updateBookAndSyncAsync(book.id, { pages, currentPage, content: pages[currentPage] || '' })
    setMode('read')
  }

  return (
    <div className="relative min-h-full flex flex-col">
      <div className="flex justify-between items-center mb-8 sticky top-0 z-10 py-4 transition-colors" style={{ backgroundColor: 'var(--theme-bg)' }}>
        <div className="flex p-1 rounded-xl border transition-colors" style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-subtle)' }}>
          <button
            onClick={() => setMode('read')}
            className={`px-6 py-3 md:py-2 text-sm font-semibold rounded-lg transition-all min-h-[44px] md:min-h-0 flex items-center justify-center ${
              mode === 'read'
                ? 'shadow-sm'
                : 'opacity-50 hover:opacity-100'
            }`}
            style={{ 
              backgroundColor: mode === 'read' ? 'var(--theme-bg)' : 'transparent',
              color: 'var(--theme-text)'
            }}
          >
            {t('readTab')}
          </button>
          <button
            onClick={() => setMode('edit')}
            className={`px-6 py-3 md:py-2 text-sm font-semibold rounded-lg transition-all min-h-[44px] md:min-h-0 flex items-center justify-center ${
              mode === 'edit'
                ? 'shadow-sm'
                : 'opacity-50 hover:opacity-100'
            }`}
            style={{ 
              backgroundColor: mode === 'edit' ? 'var(--theme-bg)' : 'transparent',
              color: 'var(--theme-text)'
            }}
          >
            {t('writeTab')}
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
            {book.wordCount.toLocaleString()} palavras
          </div>
        </div>
      </div>

      <div className="flex-1">
        {mode === 'read' ? (
          <Reader book={book} />
        ) : (
          <Editor book={book} onSave={handleSaveContent} onCancel={() => setMode('read')} />
        )}
      </div>

    </div>
  )
}
