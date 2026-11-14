import { FilterClear, FilterSearch, FilterSelect } from '@/components/ui/filter-controls'
import { useEffect, useState, useMemo } from 'react'
import { Check, Pencil, RotateCcw, Search, Sparkles, SkipForward, Star, Trash2, Volume2, Layers, X } from 'lucide-react'
import { useVocabularyStore, type Vocabulary, type VocabStatus } from '@/store/useVocabularyStore'
import { useBookStore } from '@/store/useBookStore'
import { useLanguage } from '@/store/useLanguage'
import { useTranslations } from '@/lib/i18n'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { upsertVocabulary, deleteVocabularyRemote } from '@/lib/supabaseSync'
import { toast } from '@/components/ui/toast'
import { mainText } from '@/lib/vocabText'
import { InfoHint } from '@/components/ui/info-hint'
import { VocabularyModal } from '@/components/vocabulary/VocabularyModal'
import { Button } from '@/components/ui/button'
import { speak, stopSpeaking } from '@/lib/tts'
import { generateExplanation, aiErrorMessage } from '@/lib/ai'

const STATUS_STYLE: Record<VocabStatus, { bg: string; fg: string; icon: typeof Check }> = {
  learned: { bg: 'var(--color-vocab-learned-bg)', fg: 'var(--color-vocab-learned-text)', icon: Check },
  review: { bg: 'var(--color-vocab-review-bg)', fg: 'var(--color-vocab-review-text)', icon: RotateCcw },
  important: { bg: 'var(--color-vocab-important-bg)', fg: 'var(--color-vocab-important-text)', icon: Star },
}

/** Primeira linha útil da explicação (sem a pronúncia). */
const summary = mainText
const ipaOf = (explanation?: string) => (explanation ?? '').match(/(?:Pronunciation|Pronúncia):\s*(.+)\s*$/i)?.[1]?.trim() ?? ''
const say = (text: string) => { stopSpeaking(); void speak(text, { language: 'en', context: text.trim().split(/\s+/).length <= 3 ? 'word' : 'phrase', rate: 0.9 }) }

export function VocabularyPage() {
  const { locale } = useLanguage()
  const { t } = useTranslations(locale)
  const pt = locale === 'pt-BR'
  const { vocabularies, deleteVocabulary, updateVocabulary } = useVocabularyStore()
  // Excluir: some na hora (com animação), apaga no banco e oferece "Desfazer" no aviso.
  const removeWord = (v: Vocabulary) => {
    const userId = session?.user?.id
    deleteVocabulary(v.id)
    if (hasSupabase && supabase && userId) deleteVocabularyRemote(supabase, userId, v.id).catch(e => console.error('Sync vocab delete', e))
    toast(pt ? `“${v.text}” excluída` : `“${v.text}” deleted`, {
      tone: 'info',
      action: { label: pt ? 'Desfazer' : 'Undo', onClick: () => {
        useVocabularyStore.setState(st => ({ vocabularies: [...st.vocabularies, v] }))
        if (hasSupabase && supabase && userId) upsertVocabulary(supabase, userId, v).catch(e => console.error('Sync vocab restore', e))
      } },
    })
  }
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
          <h1 className="font-display text-[30px] md:text-[40px] leading-[1.05] inline-flex items-center gap-2" style={{ color: 'var(--theme-text)' }}>{t('vocabularyPageTitle')}
            <InfoHint title={pt ? 'Seu vocabulário' : 'Your vocabulary'} faq="nivel">
              {pt ? 'Todas as palavras que você salvou lendo. Use os status para organizar a revisão; quanto mais palavras e pontos, mais o seu nível sobe.' : 'Every word you saved while reading. Use statuses to organize review; more words and points raise your level.'}
            </InfoHint></h1>
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
        <FilterSearch grow value={query} onChange={setQuery} placeholder={pt ? 'Buscar palavra ou significado' : 'Search word or meaning'} />
        <FilterSelect value={filterBookId} onChange={setFilterBookId} label={t('book')}
          options={[{ value: '', label: pt ? 'Todos os livros' : 'All books' }, ...books.map(b => ({ value: b.id, label: b.title }))]} />
        {(filterStatus || filterBookId || query) && (
          <FilterClear onClick={() => { setFilterStatus(''); setFilterBookId(''); setQuery('') }}>{pt ? 'Limpar' : 'Clear'}</FilterClear>
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
              <li key={v.id} className="group flex items-start gap-4 px-4 sm:px-5 py-4 transition-colors hover:bg-[var(--ui-hover)]" style={{ borderColor: 'var(--theme-border)' }}>
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
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => removeWord(v)} title={t('delete')} aria-label={t('delete')}>
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

/** Revisão rápida com cartões: vê a palavra, tenta lembrar, revela o significado e marca. Dá para passar e pedir ajuda à IA. */
function ReviewSession({ ids, pt, onClose, onStatus }: { ids: string[]; pt: boolean; onClose: () => void; onStatus: (id: string, s: VocabStatus) => void }) {
  const vocabularies = useVocabularyStore(s => s.vocabularies)
  const updateVocabulary = useVocabularyStore(s => s.updateVocabulary)
  const { user } = useAuth()
  const [queue, setQueue] = useState(ids)
  const [answered, setAnswered] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [learnedCount, setLearnedCount] = useState(0)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')
  const total = ids.length
  const current = vocabularies.find(v => v.id === queue[0])
  const done = !current
  const next = (learned: boolean) => {
    if (current && learned) { onStatus(current.id, 'learned'); setLearnedCount(c => c + 1) }
    setRevealed(false); setAiError('')
    setAnswered(a => a + 1)
    setQueue(q => q.slice(1))
  }
  // Passar: a palavra vai para o fim da fila, sem marcar nada.
  const skip = () => { setRevealed(false); setAiError(''); setQueue(q => (q.length > 1 ? [...q.slice(1), q[0]] : q)) }
  // Ajuda da IA: explica a palavra (reaproveita explicações já geradas por outras pessoas) e guarda no vocabulário.
  const help = async () => {
    if (!current || aiBusy) return
    setAiBusy(true); setAiError('')
    try {
      const r = await generateExplanation(current.text, 'B1', 'en', pt ? 'pt' : undefined)
      const patch: Partial<Vocabulary> = {
        explanation: [r.definition, pt && r.definitionTranslation ? r.definitionTranslation : ''].filter(Boolean).join('\n'),
        examples: r.examples, usageNote: r.usageNote || current.usageNote,
      }
      updateVocabulary(current.id, patch)
      if (supabase && user?.id) void upsertVocabulary(supabase, user.id, { ...current, ...patch }).catch(() => {})
      setRevealed(true)
    } catch (e) { setAiError(aiErrorMessage(e)) }
    finally { setAiBusy(false) }
  }

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (done) return
      if (e.key === 'Escape') onClose()
      else if (e.key === ' ' && !revealed) { e.preventDefault(); setRevealed(true) }
      else if (e.key === 'ArrowRight' && revealed) next(true)
      else if (e.key === 'ArrowLeft' && revealed) next(false)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] dialog-fade" onClick={onClose} />
      <div className="elevated dialog-pop relative w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl p-5 sm:p-8" role="dialog" aria-modal="true" aria-label={pt ? 'Revisão' : 'Review'}>
        <button type="button" onClick={onClose} aria-label={pt ? 'Fechar' : 'Close'} className="absolute right-3 top-3 w-9 h-9 grid place-items-center rounded-md hover:bg-[var(--ui-hover)]" style={{ color: 'var(--theme-text-secondary)' }}>
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 pr-9">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(Math.min(answered, total) / total) * 100}%`, backgroundColor: 'var(--theme-text)' }} />
          </div>
          <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{Math.min(answered + 1, total)}/{total}</span>
        </div>

        {done ? (
          <div className="py-8 text-center">
            <img src="/illustrations/high-five.svg" alt="" className="illo w-36 mx-auto mb-4" />
            <p className="font-display text-[28px]">{pt ? 'Revisão concluída' : 'Review complete'}</p>
            <p className="mt-1 text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>
              {pt ? `${learnedCount} de ${total} marcadas como aprendidas.` : `${learnedCount} of ${total} marked as learned.`}
            </p>
            <Button className="mt-6" onClick={onClose}>{pt ? 'Concluir' : 'Done'}</Button>
          </div>
        ) : (
          <>
            <div className="pt-8 pb-5 text-center">
              <p className="font-display text-[38px] sm:text-[44px] leading-tight break-words">{current.text}</p>
              {ipaOf(current.explanation) && <p className="mt-1 text-[14px] font-mono" style={{ color: 'var(--theme-text-secondary)' }}>{ipaOf(current.explanation)}</p>}
              <button type="button" onClick={() => say(current.text)} className="mt-3 h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border text-[13px] hover:bg-[var(--ui-hover)]" style={{ borderColor: 'var(--theme-border)' }}>
                <Volume2 className="w-3.5 h-3.5" />{pt ? 'Ouvir' : 'Listen'}
              </button>
              {revealed ? (
                <div className="mt-6 space-y-3 text-left">
                  <p className="font-serif text-[16px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--theme-text)' }}>
                    {summary(current.explanation) || (pt ? 'Sem explicação salva ainda. Peça ajuda à IA.' : 'No explanation saved yet. Ask the AI for help.')}
                  </p>
                  {current.examples?.slice(0, 2).map((ex, i) => <p key={i} className="text-[13.5px] italic leading-snug" style={{ color: 'var(--theme-text-secondary)' }}>“{ex}”</p>)}
                </div>
              ) : (
                <p className="mt-6 text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Lembra o que significa?' : 'Do you remember what it means?'}</p>
              )}
              {aiError && <p role="alert" className="mt-3 text-[13px]" style={{ color: 'var(--color-destructive)' }}>{aiError}</p>}
            </div>
            {revealed ? (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => next(false)} className="btn-3d btn-3d--review h-11"><RotateCcw className="w-4 h-4" />{pt ? 'Ainda não' : 'Not yet'}</button>
                <button type="button" onClick={() => next(true)} className="btn-3d btn-3d--learned h-11"><Check className="w-4 h-4" />{pt ? 'Aprendi' : 'Got it'}</button>
              </div>
            ) : (
              <Button size="lg" className="w-full" onClick={() => setRevealed(true)}>{pt ? 'Mostrar significado' : 'Show meaning'}</Button>
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
              <button type="button" onClick={() => { void help() }} disabled={aiBusy} className="h-10 px-3 inline-flex items-center gap-1.5 rounded-lg text-[13px] hover:bg-[var(--ui-hover)] disabled:opacity-60" style={{ color: 'var(--theme-text-secondary)' }}>
                <Sparkles className="w-4 h-4" />{aiBusy ? (pt ? 'Pensando…' : 'Thinking…') : (pt ? 'Pedir ajuda à IA' : 'Ask AI for help')}
              </button>
              <button type="button" onClick={skip} disabled={queue.length < 2} className="h-10 px-3 inline-flex items-center gap-1.5 rounded-lg text-[13px] hover:bg-[var(--ui-hover)] disabled:opacity-40" style={{ color: 'var(--theme-text-secondary)' }}>
                <SkipForward className="w-4 h-4" />{pt ? 'Passar' : 'Skip'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
