// Cartão de estudo de uma palavra/expressão: o termo em destaque com áudio e status, e abas para
// significado, exemplos (com áudio e tradução), uma história curta e exemplos em imagem da comunidade.
import { CommunityMosaic } from './CommunityMosaic'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BookOpenText, Check, Eye, EyeOff, Images, Info, Loader2, MessageSquareQuote, RotateCcw, Sparkles, Star, StickyNote, Trash2, Volume2, WandSparkles } from 'lucide-react'
import { useVocabularyStore, type VocabStatus, type VocabType, type GrammarExample } from '@/store/useVocabularyStore'
import { useBookStore } from '@/store/useBookStore'
import { generateExplanation, generateVariantStory, API_KEY_REQUIRED_MESSAGE, aiErrorMessage } from '@/lib/ai'
import { glossPt } from '@/lib/glossPt'
import { showsGloss, studyLevel } from '@/lib/cefr'
import { useXpStore, xpSummary } from '@/store/useXpStore'
import { NotesEditor } from './NotesEditor'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { speak, stopSpeaking } from '@/lib/tts'
import { upsertVocabulary, deleteVocabularyRemote } from '@/lib/supabaseSync'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { nativeLocale, useLanguage } from '@/store/useLanguage'

const TEXTS = {
  'pt-BR': {
    newTerm: 'Nova palavra', editTerm: 'Sua palavra', listen: 'Ouvir', slow: 'Devagar', word: 'Palavra', phrase: 'Expressão', sentence: 'Frase',
    statusQ: 'Como está essa palavra para você?', learned: 'Aprendi', review: 'Revisar', important: 'Importante',
    tabMeaning: 'Significado', tabExamples: 'Exemplos', tabStory: 'História', tabImages: 'Imagens',
    meaningEmptyTitle: 'Entenda a palavra', meaningEmptyText: 'Definição, pronúncia, exemplos nas três formas e uma nota de uso.',
    explainAi: 'Explicar com IA', explaining: 'Explicando…', writeOwn: 'ou escreva a sua explicação', explanationPh: 'Escreva com suas palavras…', regenerate: 'Gerar de novo',
    usage: 'Dica de uso', affirmative: 'Afirmativa', negative: 'Negativa', interrogative: 'Pergunta',
    showTranslation: 'Ver tradução', hideTranslation: 'Esconder tradução', yourExamples: 'Seus exemplos', examplesPh: 'Um exemplo por linha…',
    examplesEmpty: 'Gere a explicação para ver a palavra em frases afirmativas, negativas e perguntas.',
    storyEmptyTitle: 'Uma história para lembrar', storyEmptyText: 'Uma cena curta e nova usando a palavra — memória por contexto.',
    createStory: 'Criar história', creating: 'Escrevendo…', storyPh: 'Ou escreva sua própria história…',
    cancel: 'Cancelar', save: 'Salvar', delete: 'Excluir', aiKey: 'Conecte sua chave de IA em Configurações para usar a explicação automática.',
    myNotes: 'Suas anotações', myNotesPh: 'Escreva o que quiser sobre esta palavra ou frase…',
    glossEmpty: 'Você não tem pontos para revelar.',
    peek: 'Espiar',
    peekInfo: 'Sobre a espiada',
    peekHelp: 'A espiada só existe no A1. São 3 por dia, e cada uma tira 1 ponto. Quando acabam, siga pelos exemplos e pelas imagens. Ao subir de nível, ela some.',
    peekLimit: 'As 3 espiadas de hoje acabaram. Siga pelos exemplos e pelas imagens.',
  },
  en: {
    newTerm: 'New word', editTerm: 'Your word', listen: 'Listen', slow: 'Slow', word: 'Word', phrase: 'Phrase', sentence: 'Sentence',
    statusQ: 'How well do you know it?', learned: 'Learned', review: 'Review', important: 'Important',
    tabMeaning: 'Meaning', tabExamples: 'Examples', tabStory: 'Story', tabImages: 'Images',
    meaningEmptyTitle: 'Understand the word', meaningEmptyText: 'Definition, pronunciation, examples in three forms and a usage tip.',
    explainAi: 'Explain with AI', explaining: 'Explaining…', writeOwn: 'or write your own explanation', explanationPh: 'Write it in your own words…', regenerate: 'Regenerate',
    usage: 'Usage tip', affirmative: 'Affirmative', negative: 'Negative', interrogative: 'Question',
    showTranslation: 'Show translation', hideTranslation: 'Hide translation', yourExamples: 'Your examples', examplesPh: 'One example per line…',
    examplesEmpty: 'Generate the explanation to see the word in affirmative, negative and question sentences.',
    storyEmptyTitle: 'A story to remember', storyEmptyText: 'A short, new scene using the word — memory through context.',
    createStory: 'Create story', creating: 'Writing…', storyPh: 'Or write your own story…',
    cancel: 'Cancel', save: 'Save', delete: 'Delete', aiKey: 'Connect your AI key in Settings to use automatic explanations.',
    myNotes: 'Your notes', myNotesPh: 'Write whatever you want about this word or phrase…',
    glossEmpty: 'You don’t have points to reveal it.',
    peek: 'Peek',
    peekInfo: 'About the peek',
    peekHelp: 'The peek only exists at A1. You get 3 a day, and each one costs 1 point. When they run out, continue with the examples and the images. It goes away once you level up.',
    peekLimit: 'Today’s 3 peeks are used up. Continue with the examples and the images.',
  },
} as const

const STATUS: { id: VocabStatus; icon: typeof Check }[] = [
  { id: 'learned', icon: Check },
  { id: 'review', icon: RotateCcw },
  { id: 'important', icon: Star },
]

export type VocabTab = 'meaning' | 'examples' | 'story' | 'images' | 'notes'

interface VocabularyModalProps {
  isOpen: boolean
  onClose: () => void
  initialText: string
  bookId: string
  vocabId: string | null
  /** Abre e já pede a explicação da frase inteira. */
  autoExplain?: boolean
  /** Aba aberta junto com o cartão (nota, imagem, significado). */
  initialTab?: VocabTab
}

/**
 * Formato salvo: "definição\n\nTranslation: tradução\n\nPronunciation: /ipa/".
 * A definição fica no idioma do livro; a tradução (idioma da pessoa) é opcional e só aparece no olhinho.
 */
function splitExplanation(explanation: string) {
  const pron = explanation.match(/\n*\s*(?:Pronunciation|Pronúncia):\s*(.+)\s*$/i)
  const ipa = pron ? pron[1].trim() : ''
  const rest = pron ? explanation.slice(0, pron.index).trim() : explanation
  const tr = rest.match(/\n*\s*(?:Translation|Tradução):\s*([\s\S]+)$/i)
  return { definition: (tr ? rest.slice(0, tr.index) : rest).trim(), translation: tr ? tr[1].trim() : '', ipa }
}
function splitNote(note: string) {
  const tr = note.match(/\n*\s*(?:Translation|Tradução):\s*([\s\S]+)$/i)
  return { text: (tr ? note.slice(0, tr.index) : note).trim(), translation: tr ? tr[1].trim() : '' }
}
function composeNote(text: string, translation: string) { return text ? `${text}${translation ? `\n\nTranslation: ${translation}` : ''}` : '' }
function composeExplanation(definition: string, translation: string, ipa: string) {
  return `${definition}${translation ? `\n\nTranslation: ${translation}` : ''}${ipa ? `\n\nPronunciation: ${ipa}` : ''}`
}

function AutoTextarea({ value, onChange, placeholder, className, style, readOnly }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string; style?: React.CSSProperties; readOnly?: boolean }) {
  return (
    <textarea value={value} readOnly={readOnly} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={1}
      ref={el => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` } }}
      onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }}
      className={`w-full resize-none bg-transparent outline-none placeholder:text-[var(--theme-text-secondary)]/70 ${className ?? ''}`}
      style={{ color: 'var(--theme-text)', ...style }} />
  )
}

function EmptyState({ illo, title, text, children }: { illo: string; title: string; text: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed px-6 py-8 flex flex-col items-center text-center" style={{ borderColor: 'var(--theme-border)' }}>
      <img src={illo} alt="" className="illo w-28 mb-4" />
      <p className="text-[15px] font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{text}</p>
      <div className="mt-4 flex flex-col items-center gap-2">{children}</div>
    </div>
  )
}

export function VocabularyModal({ isOpen, onClose, initialText, bookId, vocabId, autoExplain, initialTab = 'meaning' }: VocabularyModalProps) {
  const { vocabularies, addVocabulary, updateVocabulary, deleteVocabulary } = useVocabularyStore()
  const bookLanguageCode = useBookStore((s) => s.books.find((b) => b.id === bookId)?.languageCode)
  const { session, hasSupabase } = useAuth()
  const userId = session?.user?.id

  const [text, setText] = useState(initialText)
  const [type, setType] = useState<VocabType>('word')
  const [status, setStatus] = useState<VocabStatus>('review')
  const [explanation, setExplanation] = useState('')
  const [examplesText, setExamplesText] = useState('')
  const [grammarExamples, setGrammarExamples] = useState<GrammarExample[]>([])
  const [usageNote, setUsageNote] = useState('')
  const [personalNote, setPersonalNote] = useState('')
  const [variantStory, setVariantStory] = useState('')
  const [audioData, setAudioData] = useState<string | null>(null)
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false)
  const [isGeneratingStory, setIsGeneratingStory] = useState(false)
  const [writeOwn, setWriteOwn] = useState(false)
  const [tab, setTab] = useState<VocabTab>('meaning')
  const [imageCount, setImageCount] = useState(0)
  const [error, setError] = useState('')
  const { locale } = useLanguage()
  const pt = locale === 'pt-BR'
  const L = TEXTS[pt ? 'pt-BR' : 'en']
  const N = TEXTS[nativeLocale()]
  const explainLang = pt ? 'pt' : 'en'
  const [shownTranslations, setShownTranslations] = useState<Set<string>>(new Set())
  const [defShown, setDefShown] = useState(false)
  const [storyShown, setStoryShown] = useState(false)
  const [speaking, setSpeaking] = useState<string | null>(null)
  const [glossShown, setGlossShown] = useState(false)
  const [glossEmpty, setGlossEmpty] = useState(false)
  const [peekCapped, setPeekCapped] = useState(false)
  const [glossLoss, setGlossLoss] = useState(0)
  const xpEvents = useXpStore(s => s.events)
  const points = xpSummary(xpEvents).total
  const [savedHint, setSavedHint] = useState(false)
  const savedIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    stopSpeaking()
    setSpeaking(null); setError(''); setWriteOwn(false); setShownTranslations(new Set()); setDefShown(false); setStoryShown(false); setSavedHint(false)
    setGlossShown(false); setGlossEmpty(false); setPeekCapped(false)
    savedIdRef.current = vocabId
    const vocab = vocabId ? vocabularies.find(v => v.id === vocabId) : null
    if (vocab) {
      setText(vocab.text || '')
      setType(vocab.type || 'word')
      setStatus(vocab.status || 'review')
      setExplanation(vocab.explanation || '')
      setExamplesText((vocab.examples || []).join('\n'))
      setGrammarExamples(vocab.grammarExamples || [])
      setUsageNote(vocab.usageNote || '')
      setPersonalNote(vocab.personalNote || '')
      setVariantStory(vocab.variantStory || '')
      setAudioData(vocab.audioData || null)
    } else {
      setText(initialText)
      setType(initialText.trim().includes(' ') ? 'phrase' : 'word')
      setStatus('review')
      setExplanation(''); setExamplesText(''); setGrammarExamples([]); setUsageNote(''); setPersonalNote(''); setVariantStory(''); setAudioData(null)
    }
    setTab(initialTab)
    setGlossLoss(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, vocabId, initialText, initialTab])

  useEffect(() => {
    if (!isOpen || !autoExplain) return
    // Palavra já salva com explicação: não gera de novo (o botão "Gerar de novo" segue disponível).
    const saved = vocabId ? useVocabularyStore.getState().vocabularies.find(v => v.id === vocabId) : null
    if (saved?.explanation?.trim()) return
    if (!saved && !initialText.trim()) return
    const timer = window.setTimeout(() => { void handleExplainWithAI(saved?.text || initialText) }, 40)
    return () => window.clearTimeout(timer)
  // A explicação lê o texto já colocado no efeito acima.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, autoExplain, vocabId, initialText])

  const { definition, translation, ipa } = useMemo(() => splitExplanation(explanation), [explanation])
  const note = useMemo(() => splitNote(usageNote), [usageNote])
  const examples = useMemo(() => examplesText.split('\n').map(s => s.trim()).filter(Boolean), [examplesText])
  const lang = (bookLanguageCode || 'en').slice(0, 2).toLowerCase()
  const localGloss = useMemo(() => glossPt(text), [text])
  const savedWords = useMemo(() => new Set(vocabularies.map(v => v.text.trim().toLowerCase()).filter(Boolean)).size, [vocabularies])
  const level = studyLevel(savedWords, points)
  const glossReady = showsGloss(level.id) && !!localGloss
  const glossKey = `gloss:${text.trim().toLowerCase()}`
  const glossPaid = xpEvents.some(e => e.key === glossKey)
  const peeksToday = xpEvents.filter(e => e.key.startsWith('gloss:') && e.amount < 0 && new Date(e.at).toDateString() === new Date().toDateString()).length
  const PEEKS_PER_DAY = 3

  const onGlossEye = () => {
    if (!glossReady) return
    if (glossShown) { setGlossShown(false); setGlossEmpty(false); setPeekCapped(false); return }
    if (glossPaid) { setGlossShown(true); setGlossEmpty(false); setPeekCapped(false); return }
    if (peeksToday >= PEEKS_PER_DAY) { setPeekCapped(true); setGlossEmpty(false); return }
    if (points < 1 || !useXpStore.getState().spend(glossKey, 1)) { setGlossEmpty(true); setPeekCapped(false); return }
    setGlossEmpty(false)
    setPeekCapped(false)
    setGlossLoss(n => n + 1)
    setGlossShown(true)
  }

  const handleExplainWithAI = async (source?: string) => {
    // O botão repassa o evento do clique: só vale como termo quando for texto.
    const term = (typeof source === 'string' ? source : text).trim()
    if (!term) return
    setIsGeneratingExplanation(true); setError('')
    try {
      const result = await generateExplanation(term, 'B1', lang, explainLang !== lang ? explainLang : undefined)
      const explanationText = composeExplanation(result.definition, result.definitionTranslation ?? '', result.ipa)
      const noteText = composeNote(result.usageNote, result.usageNoteTranslation ?? '')
      const exampleLines = result.examples.join('\n')
      setExplanation(explanationText)
      setExamplesText(exampleLines)
      setGrammarExamples(result.grammarExamples)
      setUsageNote(noteText)
      setDefShown(false); setStoryShown(false)
      const storyText = composeNote((result.story ?? '').trim(), (result.storyTranslation ?? '').trim())
      if (storyText) setVariantStory(storyText)
      persist({ text: term, explanation: explanationText, examples: result.examples, grammarExamples: result.grammarExamples, usageNote: noteText, ...(storyText ? { variantStory: storyText } : {}) })
    } catch (e) {
      console.error(e)
      setError(aiErrorMessage(e))
    } finally {
      setIsGeneratingExplanation(false)
    }
  }

  // Olhinho (só no A1): troca significado + dica de uso juntos para o português já gerado.
  const showEye = level.id === 'A1'
  const story = useMemo(() => splitNote(variantStory), [variantStory])

  const handleGenerateVariantStory = async () => {
    setIsGeneratingStory(true); setError('')
    try {
      const result = await generateVariantStory(text, explainLang)
      if (result) {
        setVariantStory(result)
        persist({ variantStory: result })
      }
    } catch (e) {
      console.error(e)
      setError(aiErrorMessage(e))
    } finally {
      setIsGeneratingStory(false)
    }
  }

  // Ouve um trecho (a palavra, um exemplo); clicar de novo no mesmo para.
  const say = useCallback(async (key: string, value: string, rate = 0.9) => {
    const trimmed = value.trim()
    if (!trimmed) return
    stopSpeaking()
    if (speaking === key) { setSpeaking(null); return }
    setSpeaking(key)
    try {
      const h = await speak(trimmed, { language: lang, context: trimmed.split(/\s+/).length <= 3 ? 'word' : 'phrase', rate })
      await h.done
    } finally {
      setSpeaking(cur => cur === key ? null : cur)
    }
  }, [lang, speaking])

  const persist = (patch: Partial<{ text: string; explanation: string; examples: string[]; grammarExamples: GrammarExample[]; usageNote: string; variantStory: string }>) => {
    const term = (patch.text ?? text).trim()
    if (!term) return
    const fields = {
      text: term,
      type: term.includes(' ') && type === 'word' ? 'phrase' as const : type,
      status,
      explanation: patch.explanation ?? explanation,
      examples: patch.examples ?? examples,
      grammarExamples: patch.grammarExamples ?? grammarExamples,
      usageNote: patch.usageNote ?? usageNote,
      personalNote,
      variantStory: patch.variantStory ?? variantStory,
      audioData: audioData || undefined,
    }
    const id = savedIdRef.current
    if (id) {
      updateVocabulary(id, fields)
      const v = useVocabularyStore.getState().vocabularies.find(item => item.id === id)
      if (hasSupabase && supabase && userId && v) upsertVocabulary(supabase, userId, v).catch((e) => console.error('Sync vocab update', e))
    } else {
      const created = addVocabulary({ bookId, ...fields })
      savedIdRef.current = created.id
      if (hasSupabase && supabase && userId) upsertVocabulary(supabase, userId, created).catch((e) => console.error('Sync vocab insert', e))
    }
    setSavedHint(true)
  }

  const handleSave = () => {
    if (!text.trim()) return
    persist({})
    stopSpeaking()
    onClose()
  }

  const handleDelete = () => {
    if (vocabId) {
      deleteVocabulary(vocabId)
      if (hasSupabase && supabase && userId) deleteVocabularyRemote(supabase, userId, vocabId).catch((e) => console.error('Sync vocab delete', e))
    }
    onClose()
  }

  const tabs: { id: VocabTab; label: string; icon: typeof Check; filled: boolean }[] = [
    { id: 'meaning', label: L.tabMeaning, icon: BookOpenText, filled: !!explanation.trim() },
    { id: 'examples', label: L.tabExamples, icon: MessageSquareQuote, filled: grammarExamples.length > 0 || examples.length > 0 },
    { id: 'story', label: L.tabStory, icon: WandSparkles, filled: !!variantStory.trim() },
    { id: 'images', label: L.tabImages, icon: Images, filled: imageCount > 0 },
    { id: 'notes', label: L.myNotes, icon: StickyNote, filled: !!personalNote.replace(/<[^>]+>/g, '').trim() },
  ]
  const aiButton = (label: string, busyLabel: string, busy: boolean, onClick: () => void, variant: 'solid' | 'outline' = 'solid') => (
    <button type="button" onClick={onClick} disabled={busy || !text.trim()}
      className={`h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg text-[13.5px] font-medium transition-[opacity,background-color] disabled:opacity-60 ${variant === 'solid' ? 'hover:opacity-90' : 'border hover:bg-[var(--theme-nav-hover)]'}`}
      style={variant === 'solid' ? { backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' } : { borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}>
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
      {busy ? busyLabel : label}
    </button>
  )
  const listenBtn = (key: string, value: string, className = 'w-7 h-7') => (
    <button type="button" onClick={() => say(key, value)} aria-label={L.listen} title={L.listen}
      className={`${className} shrink-0 grid place-items-center rounded-md transition-colors hover:bg-[var(--theme-nav-active)]`}
      style={{ color: speaking === key ? 'var(--theme-text)' : 'var(--theme-text-secondary)' }}>
      <Volume2 className={`w-4 h-4 ${speaking === key ? 'animate-pulse' : ''}`} />
    </button>
  )

  return (
    <Dialog open={isOpen} onOpenChange={() => {
      // Fechar pelo X, fora da janela ou Esc também guarda o que foi escrito (notas, exemplos, status).
      // "Cancelar" é o único jeito de descartar as edições feitas depois do último salvamento.
      if (text.trim() && (savedIdRef.current || explanation.trim() || examplesText.trim() || personalNote.replace(/<[^>]+>/g, '').trim() || variantStory.trim())) persist({})
      stopSpeaking(); onClose()
    }}>
      <DialogContent className="p-0 gap-0 overflow-hidden flex flex-col max-h-[90dvh]"
        style={{ width: 'calc(100vw - 2rem)', maxWidth: '46rem', borderRadius: 20 }}>
        {/* Cabeçalho: a palavra, áudio e status */}
        <div className="px-6 sm:px-8 pt-7 pb-5">
          <div className="flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
            <span>{vocabId ? L.editTerm : L.newTerm}</span>
            <span aria-hidden>·</span>
            <select value={type} onChange={e => setType(e.target.value as VocabType)} aria-label={L.word}
              className="bg-transparent outline-none cursor-pointer rounded hover:bg-[var(--theme-nav-hover)]">
              <option value="word">{L.word}</option>
              <option value="phrase">{L.phrase}</option>
              <option value="sentence">{L.sentence}</option>
            </select>
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <input value={text} onChange={e => setText(e.target.value)} aria-label={L.word}
              className="font-display flex-1 min-w-0 bg-transparent outline-none text-[34px] sm:text-[40px] leading-[1.1] tracking-tight"
              style={{ color: 'var(--theme-text)' }} />
            {glossReady && (
              <div className="relative flex items-center gap-1.5 shrink-0">
                <span className="text-[12px]" style={{ color: 'var(--theme-text-secondary)' }}>{N.peek}</span>
                <span aria-hidden={!glossShown} className={`gloss-veil max-w-[9.5rem] truncate text-[15px] leading-none ${glossShown ? 'is-clear' : ''}`} style={{ color: 'var(--theme-text)' }}>{localGloss}</span>
                <button type="button" onClick={onGlossEye}
                  aria-label={glossShown ? L.hideTranslation : L.showTranslation}
                  title={glossShown ? L.hideTranslation : L.showTranslation}
                  className="w-7 h-7 inline-flex items-center justify-center rounded-lg cursor-pointer hover:bg-[var(--theme-nav-hover)]">
                  {glossShown ? <EyeOff className="w-4 h-4" style={{ color: 'var(--theme-text-secondary)' }} /> : <Eye className="w-4 h-4" style={{ color: 'var(--theme-text-secondary)' }} />}
                </button>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" aria-label={N.peekInfo} title={N.peekInfo}
                      className="w-6 h-6 inline-flex items-center justify-center rounded-full border cursor-pointer hover:bg-[var(--theme-nav-hover)]"
                      style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}>
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="end" className="z-[80] w-64 p-3 text-[13px] leading-relaxed">
                    {N.peekHelp}
                  </PopoverContent>
                </Popover>
                {glossLoss > 0 && <span key={glossLoss} className="gloss-loss">−1</span>}
              </div>
            )}
          </div>
          {peekCapped && !glossShown && <p className="mt-1 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{N.peekLimit}</p>}
          {glossEmpty && !glossShown && <p className="mt-1 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{N.glossEmpty}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {ipa && <span className="text-[14px] font-mono tracking-tight" style={{ color: 'var(--theme-text-secondary)' }}>{ipa}</span>}
            <button type="button" onClick={() => say('term', text)} disabled={!text.trim()}
              className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border text-[13px] font-medium transition-colors hover:bg-[var(--theme-nav-hover)] disabled:opacity-50"
              style={{ borderColor: 'var(--theme-border)' }}>
              <Volume2 className={`w-3.5 h-3.5 ${speaking === 'term' ? 'animate-pulse' : ''}`} />{L.listen}
            </button>
            <button type="button" onClick={() => say('term-slow', text, 0.6)} disabled={!text.trim()}
              className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-[13px] transition-colors hover:bg-[var(--theme-nav-hover)] disabled:opacity-50"
              style={{ color: 'var(--theme-text-secondary)' }}>
              <span className="text-[11px] font-semibold">0.6×</span>{L.slow}
            </button>
          </div>

          <div className="mt-5">
            <p className="text-[12px] mb-1.5" style={{ color: 'var(--theme-text-secondary)' }}>{L.statusQ}</p>
            <div className="inline-flex gap-1.5 flex-wrap">
              {STATUS.map(({ id, icon: Icon }) => (
                <button key={id} type="button" onClick={() => setStatus(id)} aria-pressed={status === id} className={`btn-3d btn-3d--${id}`}>
                  <Icon className="w-3.5 h-3.5" strokeWidth={2.4} fill={id === 'important' && status === id ? 'currentColor' : 'none'} />{L[id]}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Abas */}
        <div role="tablist" className="px-6 sm:px-8 flex gap-1 border-b overflow-x-auto" style={{ borderColor: 'var(--theme-border)' }}>
          {tabs.map(({ id, label, icon: Icon, filled }) => {
            const on = tab === id
            return (
              <button key={id} type="button" role="tab" aria-selected={on} onClick={() => setTab(id)}
                className="relative h-10 px-2.5 inline-flex items-center gap-1.5 text-[13.5px] whitespace-nowrap transition-colors"
                style={{ color: on ? 'var(--theme-text)' : 'var(--theme-text-secondary)', fontWeight: on ? 500 : 400 }}>
                <Icon className="w-4 h-4" />{label}
                {filled && <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--theme-text-secondary)' }} />}
                {on && <span aria-hidden className="absolute left-1.5 right-1.5 -bottom-px h-[2px] rounded-full" style={{ backgroundColor: 'var(--theme-text)' }} />}
              </button>
            )
          })}
        </div>

        {/* Conteúdo da aba */}
        <div className="flex-1 min-h-[260px] overflow-y-auto custom-scrollbar px-6 sm:px-8 py-6">
          {error && (
            <p role="alert" className="mb-4 rounded-lg px-3 py-2 text-[13px]" style={{ backgroundColor: 'var(--pastel-rose-bg)', color: 'var(--pastel-rose-fg)' }}>{error}</p>
          )}
          {savedHint && !error && (
            <p className="mb-4 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Salvo na sua lista.' : 'Saved to your list.'}</p>
          )}
          {explanation.startsWith(API_KEY_REQUIRED_MESSAGE) && (
            <p className="mb-4 rounded-lg px-3 py-2 text-[13px]" style={{ backgroundColor: 'var(--pastel-amber-bg)', color: 'var(--pastel-amber-fg)' }}>{L.aiKey}</p>
          )}

          {tab === 'meaning' && (
            !explanation.trim() && !writeOwn ? (
              <EmptyState illo="/illustrations/reading.svg" title={L.meaningEmptyTitle} text={L.meaningEmptyText}>
                {aiButton(L.explainAi, L.explaining, isGeneratingExplanation, handleExplainWithAI)}
                <button type="button" onClick={() => setWriteOwn(true)} className="text-[13px] underline underline-offset-4" style={{ color: 'var(--theme-text-secondary)' }}>{L.writeOwn}</button>
              </EmptyState>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    {defShown && translation ? (
                      <p className="font-serif text-[17px] leading-[1.7] whitespace-pre-wrap" style={{ color: 'var(--theme-text)' }}>{translation}</p>
                    ) : (
                      <AutoTextarea value={definition} placeholder={L.explanationPh}
                        onChange={v => setExplanation(composeExplanation(v, translation, ipa))}
                        className="font-serif text-[17px] leading-[1.7]" />
                    )}
                  </div>
                  {showEye && translation && (
                    <button type="button" aria-label={defShown ? L.hideTranslation : L.showTranslation} title={defShown ? L.hideTranslation : L.showTranslation}
                      onClick={() => setDefShown(v => !v)}
                      className="w-8 h-8 mt-1 shrink-0 grid place-items-center rounded-md transition-colors hover:bg-[var(--theme-nav-active)]" style={{ color: 'var(--theme-text-secondary)' }}>
                      {defShown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                {note.text && (
                  <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--pastel-amber-bg)', color: 'var(--pastel-amber-fg)' }}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold mb-0.5">{L.usage}</p>
                        <p className="text-[14px] leading-relaxed">{defShown && note.translation ? note.translation : note.text}</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  {aiButton(explanation.trim() ? L.regenerate : L.explainAi, L.explaining, isGeneratingExplanation, handleExplainWithAI, 'outline')}
                </div>
              </div>
            )
          )}

          {tab === 'examples' && (
            <div className="space-y-6">
              {grammarExamples.length > 0 ? (
                <ul className="divide-y rounded-xl border" style={{ borderColor: 'var(--theme-border)' }}>
                  {grammarExamples.map((example) => {
                    const shown = shownTranslations.has(example.form)
                    const tone = example.form === 'affirmative' ? ['var(--pastel-green-bg)', 'var(--pastel-green-fg)'] : example.form === 'negative' ? ['var(--pastel-rose-bg)', 'var(--pastel-rose-fg)'] : ['var(--pastel-blue-bg)', 'var(--pastel-blue-fg)']
                    return (
                      <li key={example.form} className="px-4 py-3.5" style={{ borderColor: 'var(--theme-border)' }}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="h-5 px-2 rounded-full inline-flex items-center text-[11px] font-semibold" style={{ backgroundColor: tone[0], color: tone[1] }}>{L[example.form]}</span>
                          {example.context && <span className="text-[12px] truncate" style={{ color: 'var(--theme-text-secondary)' }}>{example.context}</span>}
                        </div>
                        <div className="flex items-start gap-2">
                          <p className="flex-1 font-serif text-[16px] leading-relaxed">{example.english}</p>
                          {listenBtn(`ex-${example.form}`, example.english)}
                          {level.id === 'A1' && example.portuguese && (
                            <button type="button" aria-label={shown ? L.hideTranslation : L.showTranslation} title={shown ? L.hideTranslation : L.showTranslation}
                              onClick={() => setShownTranslations(prev => { const n = new Set(prev); if (n.has(example.form)) n.delete(example.form); else n.add(example.form); return n })}
                              className="w-7 h-7 shrink-0 grid place-items-center rounded-md transition-colors hover:bg-[var(--theme-nav-active)]" style={{ color: 'var(--theme-text-secondary)' }}>
                              {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                        {level.id === 'A1' && example.portuguese && shown && <p className="mt-1 text-[13.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{example.portuguese}</p>}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <EmptyState illo="/illustrations/chatting.svg" title={L.tabExamples} text={L.examplesEmpty}>
                  {aiButton(L.explainAi, L.explaining, isGeneratingExplanation, handleExplainWithAI)}
                </EmptyState>
              )}
              <div>
                <p className="text-[12.5px] font-medium mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{L.yourExamples}</p>
                <div className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--theme-border)' }}>
                  <AutoTextarea value={examplesText} onChange={setExamplesText} placeholder={L.examplesPh} className="font-serif text-[15px] leading-[1.8] min-h-[3.5rem]" />
                </div>
              </div>
            </div>
          )}

          {tab === 'story' && (
            !variantStory.trim() ? (
              <div className="space-y-4">
                <EmptyState illo="/illustrations/meditation.svg" title={L.storyEmptyTitle} text={L.storyEmptyText}>
                  {aiButton(L.createStory, L.creating, isGeneratingStory, handleGenerateVariantStory)}
                </EmptyState>
                <div className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--theme-border)' }}>
                  <AutoTextarea value={variantStory} onChange={setVariantStory} placeholder={L.storyPh} className="font-serif text-[15px] leading-[1.8]" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end gap-1">
                  {listenBtn('story', story.text, 'w-8 h-8')}
                  {showEye && story.translation && (
                    <button type="button" aria-label={storyShown ? L.hideTranslation : L.showTranslation} title={storyShown ? L.hideTranslation : L.showTranslation}
                      onClick={() => setStoryShown(v => !v)}
                      className="w-8 h-8 shrink-0 grid place-items-center rounded-md transition-colors hover:bg-[var(--theme-nav-active)]" style={{ color: 'var(--theme-text-secondary)' }}>
                      {storyShown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                {storyShown && story.translation
                  ? <p className="font-serif text-[17px] leading-[1.85] whitespace-pre-wrap">{story.translation}</p>
                  : <AutoTextarea value={story.text} onChange={v => setVariantStory(composeNote(v, story.translation))} placeholder={L.storyPh} className="font-serif text-[17px] leading-[1.85]" />}
                {aiButton(L.createStory, L.creating, isGeneratingStory, handleGenerateVariantStory, 'outline')}
              </div>
            )
          )}

          {tab === 'notes' && <NotesEditor value={personalNote} onChange={setPersonalNote} placeholder={L.myNotesPh} />}

          {/* Montado sempre (oculto quando fora da aba) para contar as imagens e marcar a aba. */}
          <div hidden={tab !== 'images'}>
            <CommunityMosaic text={text} lang={bookLanguageCode ?? 'en'} pt={pt} onCount={setImageCount} />
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex items-center gap-2 px-6 sm:px-8 py-3.5 border-t" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
          {vocabId && (
            <button type="button" onClick={handleDelete} className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg text-[13.5px] transition-colors hover:bg-[var(--theme-nav-active)]"
              style={{ color: 'var(--pastel-rose-fg)' }}>
              <Trash2 className="w-4 h-4" />{L.delete}
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => { stopSpeaking(); onClose() }} className="h-9 px-3.5 rounded-lg text-[13.5px] font-medium transition-colors hover:bg-[var(--theme-nav-active)]">
              {L.cancel}
            </button>
            <button type="button" onClick={handleSave} disabled={!text.trim()}
              className="h-9 px-4 rounded-lg text-[13.5px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
              {L.save}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
