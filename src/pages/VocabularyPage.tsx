import { useState, useMemo } from 'react'
import { Check, Pencil, RotateCcw, Search, Star, Trash2, Volume2, Layers, X } from 'lucide-react'
import { useVocabularyStore, type Vocabulary, type VocabStatus } from '@/store/useVocabularyStore'
import { useBookStore } from '@/store/useBookStore'
import { useLanguage } from '@/store/useLanguage'
import { useTranslations } from '@/lib/i18n'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { upsertVocabulary } from '@/lib/supabaseSync'
import { VocabularyModal } from '@/components/vocabulary/VocabularyModal'
import { Button } from '@/components/ui/button'
import { speak, stopSpeaking } from '@/lib/tts'

const STATUS_STYLE: Record<VocabStatus, { bg: string; fg: string; icon: typeof Check }> = {
  learned: { bg: 'var(--color-vocab-learned-bg)', fg: 'var(--color-vocab-learned-text)', icon: Check },
  review: { bg: 'var(--color-vocab-review-bg)', fg: 'var(--color-vocab-review-text)', icon: RotateCcw },
  important: { bg: 'var(--color-vocab-important-bg)', fg: 'var(--color-vocab-important-text)', icon: Star },
}

/** Primeira linha útil da explicação (sem a pronúncia). */
const summary = (explanation?: string) => (explanation ?? '').replace(/\n*\s*(Pronunciation|Pronúncia):.*$/is, '').trim()
const ipaOf = (explanation?: string) => (explanation ?? '').match(/(?:Pronunciation|Pronúncia):\s*(.+)\s*$/i)?.[1]?.trim() ?? ''
const say = (text: string) => { stopSpeaking(); void speak(text, { language: 'en', context: text.trim().split(/\s+/).length <= 3 ? 'word' : 'phrase', rate: 0.9 }) }

export function VocabularyPage() {
  const { locale } = useLanguage()
  const { t } = useTranslations(locale)
  const pt = locale === 'pt-BR'
  const { vocabularies, deleteVocabulary, updateVocabulary } = useVocabularyStore()
  const { books } = useBookStore()
  const { session, hasSupabase } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingVocabId, setEditingVocabId] = useState<string | null>(null)
  const [editingBookId, setEditingBookId] = useState<string>('')
  const [filterBookId, setFilterBookId] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<VocabStatus | ''>('')
  const [query, setQuery] = useState('')
  const [reviewing, setReviewing] = useState<string[] | null>(null)

  const statusLabel: Record<VocabStatus, string> = { learned: t('learned'), review: t('review'), important: t('important') }
  const counts = useMemo(() => ({
    learned: vocabularies.filter(v => v.status === 'learned').length,
    review: vocabularies.filter(v => v.status === 'review').length,
    important: vocabularies.filter(v => v.status === 'important').length,
  }), [vocabularies])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...vocabularies]
      .filter(v => (!filterBookId || v.bookId === filterBookId) && (!filterStatus || v.status === filterStatus))
      .filter(v => !q || `${v.text} ${v.explanation ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => +new Date(b.createdAt ?? 0) - +new Date(a.createdAt ?? 0))
  }, [vocabularies, filterBookId, filterStatus, query])

  const getBookTitle = (bookId: string) => books.find(b => b.id === bookId)?.title ?? t('bookRemoved')
  const handleEdit = (v: Vocabulary) => { setEditingVocabId(v.id); setEditingBookId(v.bookId); setModalOpen(true) }
  const handleCloseModal = () => { setModalOpen(false); setEditingVocabId(null); setEditingBookId('') }
  const setStatus = (id: string, status: VocabStatus) => {
    updateVocabulary(id, { status })
    const userId = session?.user?.id
    if (hasSupabase && supabase && userId) {
      const v = useVocabularyStore.getState().vocabularies.find(x => x.id === id)
      if (v) upsertVocabulary(supabase, userId, v).catch(e => console.error('Sync vocab status', e))
    }
  }
  const reviewQueue = vocabularies.filter(v => v.status !== 'learned').map(v => v.id)

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] md:text-[40px] leading-[1.05]" style={{ color: 'var(--theme-text)' }}>{t('vocabularyPageTitle')}</h1>
          <p className="mt-2 text-[14.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{t('vocabularyPageDesc')}</p>
        </div>
        <Button onClick={() => setReviewing(reviewQueue)} disabled={!reviewQueue.length}>
          <Layers className="w-4 h-4" />{pt ? `Revisar agora · ${reviewQueue.length}` : `Review now · ${reviewQueue.length}`}
        </Button>
      </header>

      <div className="grid grid-cols-3 gap-3">
        {(['review', 'important', 'learned'] as VocabStatus[]).map(s => {
          const { bg, fg, icon: Icon } = STATUS_STYLE[s]
          const on = filterStatus === s
          return (
            <button key={s} type="button" onClick={() => setFilterStatus(on ? '' : s)} aria-pressed={on}
              className="rounded-2xl p-4 text-left transition-[transform,box-shadow] hover:-translate-y-0.5"
              style={{ backgroundColor: bg, color: fg, boxShadow: on ? `inset 0 0 0 1.5px ${fg}` : undefined }}>
              <span className="flex items-center gap-1.5 text-[13px] font-medium"><Icon className="w-3.5 h-3.5" />{statusLabel[s]}</span>
              <span className="mt-1 block text-[26px] font-semibold tabular-nums leading-tight">{counts[s]}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--theme-text-secondary)' }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={pt ? 'Buscar palavra ou significado' : 'Search word or meaning'}
            className="w-full h-9 rounded-lg border pl-9 pr-3 text-[14px] outline-none transition-colors focus:border-[var(--theme-text-secondary)]"
            style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }} />
        </label>
        <select value={filterBookId} onChange={e => setFilterBookId(e.target.value)} aria-label={t('book')}
          className="h-9 max-w-[220px] rounded-lg border px-2.5 text-[13.5px] outline-none cursor-pointer"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
          <option value="">{pt ? 'Todos os livros' : 'All books'}</option>
          {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
        </select>
        {(filterStatus || filterBookId || query) && (
          <button type="button" onClick={() => { setFilterStatus(''); setFilterBookId(''); setQuery('') }}
            className="h-9 px-2.5 inline-flex items-center gap-1 rounded-lg text-[13px] hover:bg-[var(--theme-nav-hover)]" style={{ color: 'var(--theme-text-secondary)' }}>
            <X className="w-3.5 h-3.5" />{pt ? 'Limpar' : 'Clear'}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-6 py-12 flex flex-col items-center text-center" style={{ borderColor: 'var(--theme-border)' }}>
          <img src="/illustrations/reading.svg" alt="" className="illo w-36 mb-4" />
          <p className="text-[16px] font-medium" style={{ color: 'var(--theme-text)' }}>{t('noTermsSaved')}</p>
          <p className="mt-1 text-[14px] max-w-sm" style={{ color: 'var(--theme-text-secondary)' }}>{vocabularies.length === 0 ? t('noTermsPrompt') : t('noTermsFilter')}</p>
        </div>
      ) : (
        <ul className="rounded-2xl border divide-y overflow-hidden" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
          {filtered.map(v => {
            const { bg, fg, icon: Icon } = STATUS_STYLE[v.status]
            const ipa = ipaOf(v.explanation)
            return (
              <li key={v.id} className="group flex items-start gap-4 px-4 sm:px-5 py-4 transition-colors hover:bg-[var(--theme-nav-hover)]" style={{ borderColor: 'var(--theme-border)' }}>
                <button type="button" onClick={() => handleEdit(v)} className="flex-1 min-w-0 text-left">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="font-display text-[20px] leading-tight" style={{ color: 'var(--theme-text)' }}>{v.text}</span>
                    {ipa && <span className="text-[12.5px] font-mono" style={{ color: 'var(--theme-text-secondary)' }}>{ipa}</span>}
                    <span className="h-5 px-2 rounded-full inline-flex items-center gap-1 text-[11.5px] font-medium self-center" style={{ backgroundColor: bg, color: fg }}>
                      <Icon className="w-3 h-3" />{statusLabel[v.status]}
                    </span>
                  </div>
                  {summary(v.explanation) && (
                    <p className="mt-1 text-[14px] leading-relaxed line-clamp-2" style={{ color: 'var(--theme-text-secondary)', display: '-webkit-box', WebkitBoxOrient: 'vertical' }}>{summary(v.explanation)}</p>
                  )}
                  <p className="mt-1.5 text-[12px] truncate" style={{ color: 'var(--theme-text-secondary)', opacity: 0.8 }}>{getBookTitle(v.bookId)}</p>
                </button>
                <div className="flex items-center gap-0.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => say(v.text)} title={t('listenAudio')} aria-label={t('listenAudio')}>
                    <Volume2 className="w-4 h-4" style={{ color: 'var(--theme-text-secondary)' }} />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => handleEdit(v)} title={t('edit')} aria-label={t('edit')}>
                    <Pencil className="w-4 h-4" style={{ color: 'var(--theme-text-secondary)' }} />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => deleteVocabulary(v.id)} title={t('delete')} aria-label={t('delete')}>
                    <Trash2 className="w-4 h-4" style={{ color: 'var(--pastel-rose-fg)' }} />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {reviewing && (
        <ReviewSession ids={reviewing} pt={pt} onClose={() => setReviewing(null)} onStatus={setStatus} />
      )}

      <VocabularyModal isOpen={modalOpen} onClose={handleCloseModal} initialText="" bookId={editingBookId} vocabId={editingVocabId} />
    </div>
  )
}

/** Revisão rápida com cartões: vê a palavra, tenta lembrar, revela o significado e marca. */
function ReviewSession({ ids, pt, onClose, onStatus }: { ids: string[]; pt: boolean; onClose: () => void; onStatus: (id: string, s: VocabStatus) => void }) {
  const vocabularies = useVocabularyStore(s => s.vocabularies)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [learnedCount, setLearnedCount] = useState(0)
  const current = vocabularies.find(v => v.id === ids[index])
  const done = index >= ids.length || !current
  const next = (learned: boolean) => {
    if (current && learned) { onStatus(current.id, 'learned'); setLearnedCount(c => c + 1) }
    setRevealed(false)
    setIndex(i => i + 1)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] dialog-fade" onClick={onClose} />
      <div className="elevated dialog-pop relative w-full max-w-lg rounded-2xl p-6 sm:p-8" role="dialog" aria-modal="true" aria-label={pt ? 'Revisão' : 'Review'}>
        <button type="button" onClick={onClose} aria-label={pt ? 'Fechar' : 'Close'} className="absolute right-3 top-3 w-8 h-8 grid place-items-center rounded-md hover:bg-[var(--theme-nav-hover)]" style={{ color: 'var(--theme-text-secondary)' }}>
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 pr-8">
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(Math.min(index, ids.length) / ids.length) * 100}%`, backgroundColor: 'var(--theme-text)' }} />
          </div>
          <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{Math.min(index + 1, ids.length)}/{ids.length}</span>
        </div>

        {done ? (
          <div className="py-8 text-center">
            <img src="/illustrations/high-five.svg" alt="" className="illo w-36 mx-auto mb-4" />
            <p className="font-display text-[28px]">{pt ? 'Revisão concluída' : 'Review complete'}</p>
            <p className="mt-1 text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>
              {pt ? `${learnedCount} de ${ids.length} marcadas como aprendidas.` : `${learnedCount} of ${ids.length} marked as learned.`}
            </p>
            <Button className="mt-6" onClick={onClose}>{pt ? 'Concluir' : 'Done'}</Button>
          </div>
        ) : (
          <>
            <div className="py-10 text-center">
              <p className="font-display text-[44px] leading-tight">{current.text}</p>
              {ipaOf(current.explanation) && <p className="mt-1 text-[14px] font-mono" style={{ color: 'var(--theme-text-secondary)' }}>{ipaOf(current.explanation)}</p>}
              <button type="button" onClick={() => say(current.text)} className="mt-3 h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border text-[13px] hover:bg-[var(--theme-nav-hover)]" style={{ borderColor: 'var(--theme-border)' }}>
                <Volume2 className="w-3.5 h-3.5" />{pt ? 'Ouvir' : 'Listen'}
              </button>
              {revealed ? (
                <p className="mt-6 font-serif text-[16px] leading-relaxed text-left whitespace-pre-wrap" style={{ color: 'var(--theme-text)' }}>
                  {summary(current.explanation) || (pt ? 'Sem explicação salva ainda.' : 'No explanation saved yet.')}
                </p>
              ) : (
                <p className="mt-6 text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Lembra o que significa?' : 'Do you remember what it means?'}</p>
              )}
            </div>
            {revealed ? (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => next(false)} className="btn-3d btn-3d--review h-11"><RotateCcw className="w-4 h-4" />{pt ? 'Ainda não' : 'Not yet'}</button>
                <button type="button" onClick={() => next(true)} className="btn-3d btn-3d--learned h-11"><Check className="w-4 h-4" />{pt ? 'Aprendi' : 'Got it'}</button>
              </div>
            ) : (
              <Button size="lg" className="w-full" onClick={() => setRevealed(true)}>{pt ? 'Mostrar significado' : 'Show meaning'}</Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
