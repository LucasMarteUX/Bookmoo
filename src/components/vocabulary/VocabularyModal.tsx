import { useState, useEffect, useRef } from 'react'
import { Sparkles, Trash2, Volume2, Play, MousePointer2, BookOpenText, WandSparkles } from 'lucide-react'
import { useVocabularyStore, VocabStatus, VocabType, GrammarExample } from '@/store/useVocabularyStore'
import { useBookStore } from '@/store/useBookStore'
import { generateExplanation, generateAudio, generateVariantStory, API_KEY_REQUIRED_MESSAGE } from '@/lib/ai'
import { useEffectiveGeminiKey } from '@/hooks/useEffectiveGeminiKey'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { upsertVocabulary, deleteVocabularyRemote } from '@/lib/supabaseSync'
import { playBase64Audio } from '@/lib/audio'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

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
  const effectiveGeminiKey = useEffectiveGeminiKey()
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
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  
  const audioRef = useRef<{ stop: () => void; whenEnded?: Promise<void> } | null>(null)

  useEffect(() => {
    if (isOpen) {
      setIsAudioPlaying(false)
      if (audioRef.current) {
        audioRef.current.stop()
        audioRef.current = null
      }
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
      const result = await generateExplanation(text, 'B1', effectiveGeminiKey, bookLanguageCode)
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
      const result = await generateVariantStory(text, bookLanguageCode, effectiveGeminiKey)
      if (result) setVariantStory(result)
      else alert(API_KEY_REQUIRED_MESSAGE)
    } catch (error) {
      console.error(error)
    } finally {
      setIsGeneratingStory(false)
    }
  }

  const handleGenerateAudio = async () => {
    setIsGeneratingAudio(true)
    try {
      const base64Audio = await generateAudio(text, effectiveGeminiKey, bookLanguageCode)
      if (base64Audio) {
        setAudioData(base64Audio)
        playAudio(base64Audio)
      } else {
        alert(API_KEY_REQUIRED_MESSAGE)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsGeneratingAudio(false)
    }
  }

  const playAudio = async (base64: string) => {
    if (audioRef.current) {
      audioRef.current.stop()
      setIsAudioPlaying(false)
    }
    const result = await playBase64Audio(base64)
    audioRef.current = result ?? null
    if (result) {
      setIsAudioPlaying(true)
      result.whenEnded?.then(() => setIsAudioPlaying(false))
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
          <DialogTitle className="text-xl">{vocabId ? 'Editar vocabulário' : 'Adicionar vocabulário'}</DialogTitle>
          <DialogDescription>
            Estude o termo com exemplos reais, áudio e uma pequena história paralela.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 pt-2 md:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.7fr)] lg:gap-8">
          <div className="min-w-0 space-y-5">
            <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="shrink-0">Texto Selecionado</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs hover:bg-[var(--theme-accent)]/10 shrink-0"
                style={{ color: 'var(--theme-accent)' }}
                onClick={() => audioData ? playAudio(audioData) : handleGenerateAudio()}
                disabled={isGeneratingAudio || !text.trim()}
              >
                {isGeneratingAudio ? (
                  'Gerando...'
                ) : audioData ? (
                  isAudioPlaying ? (
                    <><MousePointer2 className="w-3 h-3 mr-1" /> Ouvir Áudio</>
                  ) : (
                    <><Play className="w-3 h-3 mr-1" /> Ouvir Áudio</>
                  )
                ) : (
                  <><Volume2 className="w-3 h-3 mr-1" /> Gerar Áudio</>
                )}
              </Button>
            </div>
            <Input value={text} onChange={e => setText(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2 min-w-0">
              <Label>Tipo</Label>
              <div className="flex p-0.5 rounded-lg border transition-colors min-w-0" style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-subtle)' }}>
                {(['word', 'phrase'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className="flex-1 min-w-0 px-2 py-1.5 text-xs font-medium rounded-md transition-all truncate"
                    style={{
                      backgroundColor: type === t ? 'var(--theme-bg)' : 'transparent',
                      color: type === t ? 'var(--theme-text)' : 'var(--theme-text-secondary)',
                      boxShadow: type === t ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                    }}
                  >
                    {t === 'word' ? 'Palavra' : 'Frase'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 min-w-0">
              <Label>Status</Label>
              <div className="flex p-0.5 rounded-lg border transition-colors min-w-0" style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-subtle)' }}>
                {(['learned', 'review', 'important'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className="flex-1 min-w-0 px-2 py-1.5 text-xs font-medium rounded-md transition-all truncate"
                    style={{
                      backgroundColor: status === s ? 'var(--theme-bg)' : 'transparent',
                      color: status === s ? 'var(--theme-text)' : 'var(--theme-text-secondary)',
                      boxShadow: status === s ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                    }}
                  >
                    {s === 'learned' ? 'Aprendido' : s === 'review' ? 'Revisar' : 'Importante'}
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
                <Label>Explicação</Label>
                <p className="mt-1 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>Definição, pronúncia e formas de uso</p>
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
                {isGeneratingExplanation ? 'Gerando...' : 'Explicar com IA'}
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
              placeholder="Adicione sua própria explicação ou use a IA..."
              className="min-h-[100px]"
            />
            </div>

            {grammarExamples.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <BookOpenText className="h-4 w-4" style={{ color: 'var(--theme-accent)' }} />
                  <Label>Aplicações práticas</Label>
                </div>
                <div className="grid gap-3">
                  {grammarExamples.map((example) => (
                    <div key={example.form} className="rounded-2xl p-3" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--theme-accent)' }}>
                          {example.form === 'affirmative' ? 'Afirmativa' : example.form === 'negative' ? 'Negativa' : 'Interrogativa'}
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>{example.context}</span>
                      </div>
                      <p className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{example.english}</p>
                      <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>{example.portuguese}</p>
                    </div>
                  ))}
                </div>
                {usageNote && (
                  <p className="rounded-xl border-l-2 px-3 py-2 text-xs leading-relaxed" style={{ borderColor: 'var(--theme-accent)', color: 'var(--theme-text-secondary)' }}>
                    <strong style={{ color: 'var(--theme-text)' }}>Nota de uso: </strong>{usageNote}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label className="flex items-center gap-2"><WandSparkles className="h-4 w-4" style={{ color: 'var(--theme-accent)' }} /> Variante de história</Label>
                  <p className="mt-1 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>Uma situação nova para fixar o termo</p>
                </div>
                <Button variant="ghost" size="sm" className="h-8 text-xs" style={{ color: 'var(--theme-accent)' }} onClick={handleGenerateVariantStory} disabled={isGeneratingStory || !text.trim()}>
                  <Sparkles className="mr-1 h-3 w-3" />{isGeneratingStory ? 'Criando...' : 'Criar história'}
                </Button>
              </div>
              <Textarea value={variantStory} onChange={e => setVariantStory(e.target.value)} placeholder="Crie uma história curta com novos exemplos..." className="mt-3 min-h-[120px]" />
            </div>

            <div className="space-y-2">
              <Label>Exemplos editáveis</Label>
              <Textarea
                value={examples.join('\n')}
                onChange={e => setExamples(e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
                placeholder="Adicione exemplos (um por linha)..."
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
            Cancelar
          </Button>
          <Button 
            className="flex-2 rounded-2xl py-4 px-8 shadow-xl transition-colors"
            style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
            onClick={handleSave}
            disabled={!text.trim()}
          >
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
