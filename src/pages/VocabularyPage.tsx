import { useState, useMemo } from 'react'
import { useVocabularyStore, Vocabulary, VocabStatus } from '@/store/useVocabularyStore'
import { useBookStore } from '@/store/useBookStore'
import { useLanguage } from '@/store/useLanguage'
import { useTranslations } from '@/lib/i18n'
import { VocabularyModal } from '@/components/vocabulary/VocabularyModal'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Play, Pencil, Trash2, BookOpen } from 'lucide-react'
import { playBase64Audio } from '@/lib/audio'

export function VocabularyPage() {
  const { locale } = useLanguage()
  const { t } = useTranslations(locale)
  const { vocabularies, deleteVocabulary } = useVocabularyStore()
  const { books } = useBookStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingVocabId, setEditingVocabId] = useState<string | null>(null)
  const [editingBookId, setEditingBookId] = useState<string>('')
  const [filterBookId, setFilterBookId] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<VocabStatus | ''>('')

  const statusLabel: Record<VocabStatus, string> = {
    learned: t('learned'),
    review: t('review'),
    important: t('important')
  }

  const filtered = useMemo(() => {
    return vocabularies.filter(v => {
      if (filterBookId && v.bookId !== filterBookId) return false
      if (filterStatus && v.status !== filterStatus) return false
      return true
    })
  }, [vocabularies, filterBookId, filterStatus])

  const getBookTitle = (bookId: string) => books.find(b => b.id === bookId)?.title ?? t('bookRemoved')

  const handleEdit = (v: Vocabulary) => {
    setEditingVocabId(v.id)
    setEditingBookId(v.bookId)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingVocabId(null)
    setEditingBookId('')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: 'var(--theme-text)' }}>
          {t('vocabularyPageTitle')}
        </h1>
        <p style={{ color: 'var(--theme-text-secondary)' }}>
          {t('vocabularyPageDesc')}
        </p>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: 'var(--theme-text-secondary)' }}>{t('book')}</label>
          <select
            value={filterBookId}
            onChange={e => setFilterBookId(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm transition-colors"
            style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-subtle)', color: 'var(--theme-text)' }}
          >
            <option value="">{t('all')}</option>
            {books.map(b => (
              <option key={b.id} value={b.id}>{b.title}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: 'var(--theme-text-secondary)' }}>{t('status')}</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as VocabStatus | '')}
            className="rounded-xl border px-3 py-2 text-sm transition-colors"
            style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-subtle)', color: 'var(--theme-text)' }}
          >
            <option value="">{t('all')}</option>
            {(Object.keys(statusLabel) as VocabStatus[]).map(s => (
              <option key={s} value={s}>{statusLabel[s]}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center rounded-[2rem] border" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-40" style={{ color: 'var(--theme-nav-text-muted)' }} />
          <p className="text-lg font-medium mb-2" style={{ color: 'var(--theme-text)' }}>{t('noTermsSaved')}</p>
          <p style={{ color: 'var(--theme-text-secondary)' }}>
            {vocabularies.length === 0 ? t('noTermsPrompt') : t('noTermsFilter')}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map(v => (
            <Card
              key={v.id}
              className="p-5 rounded-2xl border transition-colors"
              style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-bold text-lg" style={{ color: 'var(--theme-text)' }}>{v.text}</span>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                      style={{
                        backgroundColor: v.status === 'learned' ? 'rgba(34,197,94,0.2)' : v.status === 'review' ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)',
                        color: v.status === 'learned' ? '#166534' : v.status === 'review' ? '#854d0e' : '#991b1b'
                      }}
                    >
                      {statusLabel[v.status]}
                    </span>
                  </div>
                  <p className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: 'var(--theme-nav-text-muted)' }}>
                    <BookOpen className="w-3.5 h-3.5" />
                    {getBookTitle(v.bookId)}
                  </p>
                  {v.explanation && (
                    <p className="text-sm whitespace-pre-wrap line-clamp-3" style={{ color: 'var(--theme-text-secondary)' }}>
                      {v.explanation}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {v.audioData && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full"
                      onClick={() => playBase64Audio(v.audioData!)}
                      title={t('listenAudio')}
                    >
                      <Play className="w-4 h-4" style={{ color: 'var(--theme-text-secondary)' }} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => handleEdit(v)}
                    title={t('edit')}
                  >
                    <Pencil className="w-4 h-4" style={{ color: 'var(--theme-text-secondary)' }} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={() => deleteVocabulary(v.id)}
                    title={t('delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <VocabularyModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        initialText=""
        bookId={editingBookId}
        vocabId={editingVocabId}
      />
    </div>
  )
}
