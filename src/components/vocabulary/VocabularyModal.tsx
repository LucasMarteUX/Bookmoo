import { useState, useEffect } from 'react'
import { Sparkles, Trash2, Volume2, BookOpenText, WandSparkles, Eye, EyeOff } from 'lucide-react'
import { useVocabularyStore, VocabStatus, VocabType, GrammarExample } from '@/store/useVocabularyStore'
import { useBookStore } from '@/store/useBookStore'
import { generateExplanation, generateVariantStory, API_KEY_REQUIRED_MESSAGE, aiErrorMessage } from '@/lib/ai'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { speak, stopSpeaking } from '@/lib/tts'
import { upsertVocabulary, deleteVocabularyRemote } from '@/lib/supabaseSync'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/store/useLanguage'

const TEXTS = {
  'pt-BR': {
    edit: 'Editar vocabulário', add: 'Adicionar vocabulário', subtitle: 'Estude o termo com exemplos reais, áudio e uma pequena história paralela.',
    selected: 'Texto selecionado', listen: 'Ouvir', status: 'Status', learned: 'Aprendido', review: 'Revisão', important: 'Importante',
    explanation: 'Explicação', explanationHint: 'Definição, pronúncia e formas de uso', generating: 'Gerando...', explainAi: 'Explicar com IA',
    explanationPh: 'Adicione sua própria explicação ou use a IA...', practical: 'Aplicações práticas',
    affirmative: 'Afirmativa', negative: 'Negativa', interrogative: 'Interrogativa', usage: 'Nota de uso: ',
    showTranslation: 'Mostrar tradução', hideTranslation: 'Esconder tradução',
    story: 'Variante de história', storyHint: 'Uma situação nova para fixar o termo', creating: 'Criando...', createStory: 'Criar história',
    storyPh: 'Crie uma história curta com novos exemplos...', examples: 'Exemplos editáveis', examplesPh: 'Adicione exemplos (um por linha)...',
    cancel: 'Cancelar', save: 'Salvar',
  },
  en: {
    edit: 'Edit vocabulary', add: 'Add vocabulary', subtitle: 'Study the term with real examples, audio and a short parallel story.',
    selected: 'Selected text', listen: 'Listen', status: 'Status', learned: 'Learned', review: 'Review', important: 'Important',
    explanation: 'Explanation', explanationHint: 'Definition, pronunciation and usage', generating: 'Generating...', explainAi: 'Explain with AI',
    explanationPh: 'Write your own explanation or use AI...', practical: 'Practical usage',
    affirmative: 'Affirmative', negative: 'Negative', interrogative: 'Interrogative', usage: 'Usage note: ',
    showTranslation: 'Show translation', hideTranslation: 'Hide translation',
    story: 'Story variant', storyHint: 'A new situation to remember the term', creating: 'Creating...', createStory: 'Create story',
    storyPh: 'Create a short story with new examples...', examples: 'Editable examples', examplesPh: 'Add examples (one per line)...',
    cancel: 'Cancel', save: 'Save',
  },
} as const

interface VocabularyModalProps {
  isOpen: boolean
  onClose: () => void
  initialText: string
  bookId: string
  vocabId: string | null
}

export function VocabularyModal({ isOpen, onClose, initialText, bookId, vocabId }: VocabularyModalProps) {
  const { vocabularies, addVocabulary, updateVocabulary, deleteVocabulary } = useVocabularyStore()
  const bookLanguageCode = useBookStore((s) => s.books.find((b) => b.id === bookId)?.languageCode)
  const { session, hasSupabase } = useAuth()
  const userId = session?.user?.id
  
  const [text, setText] = useState(initialText)
  const [type, setType] = useState<VocabType>('word')
  const [status, setStatus] = useState<VocabStatus>('review')
  const [explanation, setExplanation] = useState('')
  const [examples, setExamples] = useState<string[]>([])
  const [grammarExamples, setGrammarExamples] = useState<GrammarExample[]>([])
  const [usageNote, setUsageNote] = useState('')
  const [variantStory, setVariantStory] = useState('')
  const [audioData, setAudioData] = useState<string | null>(null)
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false)
  const [isGeneratingStory, setIsGeneratingStory] = useState(false)
  const { locale } = useLanguage()
  const L = TEXTS[locale === 'pt-BR' ? 'pt-BR' : 'en']
  // Explicações no idioma do app (português ou inglês).
  const explainLang = locale === 'pt-BR' ? 'pt' : 'en'
  const [shownTranslations, setShownTranslations] = useState<Set<string>>(new Set())
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)

  useEffect(() => {
    if (isOpen) {
      stopSpeaking()
      setIsAudioPlaying(false)
      if (vocabId) {
        const vocab = vocabularies.find(v => v.id === vocabId)
        if (vocab) {
          setText(vocab.text || '')
          setType(vocab.type || 'word')
          setStatus(vocab.status || 'review')
          setExplanation(vocab.explanation || '')
          setExamples(vocab.examples || [])
          setGrammarExamples(vocab.grammarExamples || [])
          setUsageNote(vocab.usageNote || '')
          setVariantStory(vocab.variantStory || '')
          setAudioData(vocab.audioData || null)
        }
      } else {
        setText(initialText)
        setType(initialText.includes(' ') ? 'phrase' : 'word')
        setStatus('review')
        setExplanation('')
        setExamples([])
        setGrammarExamples([])
        setUsageNote('')
        setVariantStory('')
        setAudioData(null)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, vocabId, initialText])

  const handleExplainWithAI = async () => {
    setIsGeneratingExplanation(true)
    try {
      const result = await generateExplanation(text, 'B1', explainLang)
      setExplanation(`${result.definition}\n\nPronunciation: ${result.ipa}`)
      setExamples(result.examples)
      setGrammarExamples(result.grammarExamples)
      setUsageNote(result.usageNote)
    } catch (error) {
      console.error(error)
    } finally {
      setIsGeneratingExplanation(false)
    }
  }

  const handleGenerateVariantStory = async () => {
    setIsGeneratingStory(true)
    try {
      const result = await generateVariantStory(text, explainLang)
      if (result) setVariantStory(result)
    } catch (error) {
      console.error(error)
      alert(aiErrorMessage(error))
    } finally {
      setIsGeneratingStory(false)
    }
  }

  const speakText = async () => {
    const trimmed = text.trim()
    if (!trimmed) return
    const lang = (bookLanguageCode || 'en').slice(0, 2).toLowerCase()
    setIsAudioPlaying(true)
    try {
      const h = await speak(trimmed, {
        language: lang,
        context: trimmed.split(/\s+/).length <= 3 ? 'word' : 'phrase',
        rate: 0.9,
      })
      await h.done
    } finally {
      setIsAudioPlaying(false)
    }
  }

  const handleSave = () => {
    if (!text.trim()) return

    if (vocabId) {
      updateVocabulary(vocabId, {
        text,
        type,
        status,
        explanation,
        examples,
        grammarExamples,
        usageNote,
        variantStory,
        audioData: audioData || undefined
      })
      if (hasSupabase && supabase && userId) {
        const v = useVocabularyStore.getState().vocabularies.find((x) => x.id === vocabId)
        if (v) upsertVocabulary(supabase, userId, v).catch((e) => console.error('Sync vocab update', e))
      }
    } else {
      const newVocab = addVocabulary({
        bookId,
        text,
        type,
        status,
        explanation,
        examples,
        grammarExamples,
        usageNote,
        variantStory,
        audioData: audioData || undefined
      })
      if (hasSupabase && supabase && userId) {
        upsertVocabulary(supabase, userId, newVocab).catch((e) => console.error('Sync vocab insert', e))
      }
    }
    onClose()
  }

  const handleDelete = () => {
    if (vocabId) {
      deleteVocabulary(vocabId)
      if (hasSupabase && supabase && userId) {
        deleteVocabularyRemote(supabase, userId, vocabId).catch((e) => console.error('Sync vocab delete', e))
      }
    }
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-h-[92dvh] overflow-y-auto rounded-[2rem] p-4 sm:p-6 lg:p-8"
        style={{
          cursor: isAudioPlaying ? 'pointer' : undefined,
          width: 'calc(100vw - 2rem)',
          maxWidth: '64rem'
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">{vocabId ? L.edit : L.add}</DialogTitle>
          <DialogDescription>
            {L.subtitle}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 pt-2 md:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.7fr)] lg:gap-8">
          <div className="min-w-0 space-y-5">
            <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="shrink-0">{L.selected}</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs hover:bg-[var(--theme-accent)]/10 shrink-0"
                style={{ color: 'var(--theme-accent)' }}
                onClick={speakText}
                disabled={!text.trim()}
              >
                <Volume2 className={`w-3 h-3 mr-1 ${isAudioPlaying ? 'animate-pulse' : ''}`} /> {L.listen}
              </Button>
            </div>
            <Input value={text} onChange={e => setText(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2 min-w-0">
              <Label>{L.status}</Label>
              <div className="flex gap-2 pb-1 min-w-0">
                {(['learned', 'review', 'important'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    aria-pressed={status === s}
                    className={`btn-3d btn-3d--${s} flex-1 min-w-0 text-xs truncate`}
                  >
                    {L[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          </div>

          <div className="min-w-0 space-y-4">
            <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Label>{L.explanation}</Label>
                <p className="mt-1 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>{L.explanationHint}</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs hover:bg-[var(--theme-accent)]/10"
                style={{ color: 'var(--theme-accent)' }}
                onClick={handleExplainWithAI}
                disabled={isGeneratingExplanation || !text.trim()}
              >
                <Sparkles className="w-3 h-3 mr-1" />
                {isGeneratingExplanation ? L.generating : L.explainAi}
              </Button>
            </div>
            {explanation.startsWith(API_KEY_REQUIRED_MESSAGE) && (
              <p className="text-xs rounded-lg p-2 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                {API_KEY_REQUIRED_MESSAGE}
              </p>
            )}
            <Textarea 
              value={explanation} 
              onChange={e => setExplanation(e.target.value)}
              placeholder={L.explanationPh}
              className="min-h-[100px]"
            />
            </div>

            {grammarExamples.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <BookOpenText className="h-4 w-4" style={{ color: 'var(--theme-accent)' }} />
                  <Label>{L.practical}</Label>
                </div>
                <div className="grid gap-3">
                  {grammarExamples.map((example) => (
                    <div key={example.form} className="rounded-2xl p-3" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--theme-accent)' }}>
                          {L[example.form]}
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>{example.context}</span>
                      </div>
                      <p className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{example.english}</p>
                      {example.portuguese && (
                        <div className="mt-1.5 flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => setShownTranslations((prev) => { const n = new Set(prev); if (n.has(example.form)) n.delete(example.form); else n.add(example.form); return n })}
                            className="shrink-0 p-1 -m-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
                            style={{ color: 'var(--theme-text-secondary)' }}
                            aria-label={shownTranslations.has(example.form) ? L.hideTranslation : L.showTranslation}
                            title={shownTranslations.has(example.form) ? L.hideTranslation : L.showTranslation}
                          >
                            {shownTranslations.has(example.form) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          {shownTranslations.has(example.form)
                            ? <p className="text-xs leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>{example.portuguese}</p>
                            : <p className="text-xs italic select-none" style={{ color: 'var(--theme-text-secondary)', opacity: 0.6 }}>{L.showTranslation}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {usageNote && (
                  <p className="rounded-xl border-l-2 px-3 py-2 text-xs leading-relaxed" style={{ borderColor: 'var(--theme-accent)', color: 'var(--theme-text-secondary)' }}>
                    <strong style={{ color: 'var(--theme-text)' }}>{L.usage}</strong>{usageNote}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label className="flex items-center gap-2"><WandSparkles className="h-4 w-4" style={{ color: 'var(--theme-accent)' }} /> {L.story}</Label>
                  <p className="mt-1 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>{L.storyHint}</p>
                </div>
                <Button variant="ghost" size="sm" className="h-8 text-xs" style={{ color: 'var(--theme-accent)' }} onClick={handleGenerateVariantStory} disabled={isGeneratingStory || !text.trim()}>
                  <Sparkles className="mr-1 h-3 w-3" />{isGeneratingStory ? L.creating : L.createStory}
                </Button>
              </div>
              <Textarea value={variantStory} onChange={e => setVariantStory(e.target.value)} placeholder={L.storyPh} className="mt-3 min-h-[120px]" />
            </div>

            <div className="space-y-2">
              <Label>{L.examples}</Label>
              <Textarea
                value={examples.join('\n')}
                onChange={e => setExamples(e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
                placeholder={L.examplesPh}
                className="min-h-[80px]"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          {vocabId && (
            <Button variant="outline" className="px-4 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          <Button variant="outline" className="flex-1 rounded-2xl py-4" onClick={onClose}>
            {L.cancel}
          </Button>
          <Button 
            className="flex-2 rounded-2xl py-4 px-8 shadow-xl transition-colors"
            style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
            onClick={handleSave}
            disabled={!text.trim()}
          >
            {L.save}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
