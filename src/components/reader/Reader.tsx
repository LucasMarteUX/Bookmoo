import { toast } from '@/components/ui/toast'
import { mainText } from '@/lib/vocabText'
import { askConfirm } from '@/components/ui/confirm'
import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Book, useBookStore } from '@/store/useBookStore'
import { useReaderSettings, PLAYBACK_SPEEDS } from '@/store/useReaderSettings'
import { useVocabularyStore, type VocabStatus } from '@/store/useVocabularyStore'
import { upsertVocabulary } from '@/lib/supabaseSync'
import { WordTooltip, type WordTooltipState, type ScoreBurst } from './WordTooltip'
import { FloatingAction } from './FloatingAction'
import { NoteDialog } from './NoteDialog'
import { deletePin, loadPins, savePin, usePinStore, type StoryPin } from '@/store/usePinStore'
import { fetchSharedImages, publishSharedImage } from '@/lib/catalog'
import { bookStyleKey, catalogStyleOptions } from '@/lib/comicStyles'
import { StylePickerDialog, useApplyBookStyle, useStyleBank } from '@/components/book/StylePicker'
import { VocabularyModal, type VocabTab } from '../vocabulary/VocabularyModal'
import { useMediaSession, useWakeLock } from '@/hooks/useNativeMedia'
import { ChevronLeft, ChevronRight, MousePointer2, Type, Pin, PinOff, Pencil, Trash2, Play, Image as ImageIcon, Loader2, WandSparkles, Pause, Settings, X, RefreshCw, Eye, EyeOff, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  generateComicPage,
  prepareComicArt,
  suggestComicStyle,
  inspectComicPage,
  locateComicFaces,
  AiRequestError,
  isNoApiKeyError,
  aiErrorMessage,
} from '@/lib/ai'
import { getAiStatus, useAiStatus } from '@/lib/aiKeys'
import { detectLetteringTheme, letteringThemeFor, type LetteringThemeId } from '@/lib/comicThemes'
import { ToolButton, ToolDivider, ToolGroup } from '@/components/ui/toolbar'
import { needsVoiceInstall } from './VoiceRequiredDialog'
import { askVoiceOnce } from '@/lib/voiceGate'
import { XP, useXpStore } from '@/store/useXpStore'
import { motion, useReducedMotion } from 'motion/react'
import { ComicPageView, type ComicStage } from './ComicPageView'
import { saveComicPage } from '@/lib/comicPersistence'
import { browserMeasure, placePanelBoxes } from '@/lib/comicLettering'
import { resolveSpeakers } from '@/lib/speakerResolution'
import { CHILD_SPEED, buildVoiceCast, defaultFemaleVoice, defaultMaleVoice, type VoiceSettings } from '@/lib/voiceCast'
import { speechSpans } from '@/lib/speechSpans'
import { fullComicText } from '../../../supabase/functions/_shared/comicText'
import { detectPanels } from '@/lib/comicPanels'
import type { EditorialLayout, PanelInspection, VisualBeat } from '../../../supabase/functions/_shared/comicEditorial'
import type { ComicCharacter } from '@/store/useBookStore'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useNavigate } from 'react-router-dom'
import { useBookSync } from '@/hooks/useBookSync'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { speak, stopSpeaking, pauseSpeaking, resumeSpeaking, prefetch, waitWhilePaused } from '@/lib/tts'
import { activeKokoroVoice, cancelKokoroPrefetch, subscribeKokoro, warmUpKokoro } from '@/lib/kokoro/engine'
import { wordRegex, WORD_PATTERN } from '@/lib/wordTokens'
import { findExpression } from '@/lib/expressions'
import { isComicPageUrl } from '@/lib/comicStorage'
import { useLanguage } from '@/store/useLanguage'
import { useTranslations, getGeneratingComicMessage } from '@/lib/i18n'

interface ReaderProps {
  book: Book
  /** Aba "Escutar": começa a narração ao abrir. */
  autoPlay?: boolean
  /** No computador, a barra de leitura (Texto | Ilustrado e ferramentas) vai para o topo do livro. */
  headerSlot?: HTMLElement | null
}

function speedNumber(rate: number) {
  return String(rate)
}

function speedName(rate: number, pt: boolean) {
  if (rate === 0.5) return pt ? 'Lento' : 'Slow'
  if (rate === 1) return pt ? 'Normal' : 'Normal'
  if (rate === 1.5) return pt ? 'Rápido' : 'Fast'
  return ''
}

function PageJump({ page, total, onGo, pt }: { page: number; total: number; onGo: (index: number) => void; pt: boolean }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(String(page + 1))
  useEffect(() => { if (open) setDraft(String(page + 1)) }, [open, page])
  const go = (n: number) => {
    if (!Number.isFinite(n)) return
    onGo(Math.max(0, Math.min(total - 1, Math.round(n) - 1)))
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center h-10 px-2 rounded-xl text-xs md:text-sm font-medium tabular-nums shrink-0 cursor-pointer hover:bg-[var(--ui-hover)]"
          style={{ color: 'var(--theme-nav-text)' }}
          aria-label={pt ? 'Ir para uma página' : 'Go to a page'}
        >
          <span className="md:hidden">{page + 1}/{total}</span>
          <span className="hidden md:inline">{page + 1} / {total}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-3" align="end" side="top" sideOffset={10}>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); go(Number(draft)) }}
        >
          <label className="sr-only" htmlFor="page-jump">{pt ? 'Número da página' : 'Page number'}</label>
          <input
            id="page-jump"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
            className="h-9 w-full rounded-lg border bg-transparent px-3 text-[14px] tabular-nums outline-none"
            style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}
          />
          <button type="submit" className="h-9 px-3 rounded-lg text-[13px] font-medium shrink-0 cursor-pointer" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            {pt ? 'Ir' : 'Go'}
          </button>
        </form>
        <p className="mt-2 text-[12px]" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? `1 até ${total}` : `1 to ${total}`}
        </p>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={page === 0}
          className="mt-2 h-9 w-full rounded-lg text-[13px] font-medium cursor-pointer hover:bg-[var(--ui-hover)] disabled:opacity-40"
          style={{ color: 'var(--theme-text)' }}
        >
          {pt ? 'Voltar ao início' : 'Back to the start'}
        </button>
      </PopoverContent>
    </Popover>
  )
}

export function Reader({ book, autoPlay = false, headerSlot }: ReaderProps) {
  // Topo numa linha só a partir de 1024px; no celular a barra continua aqui embaixo.
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const inHeader = wide && !!headerSlot
  const containerRef = useRef<HTMLDivElement>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { locale } = useLanguage()
  const { t } = useTranslations(locale)
  const { theme, fontSize, lineHeight, showHighlights, hiddenMarks, setHiddenMarks, playbackRate, setPlaybackRate, fontFamily, setFontSize, setLineHeight, setFontFamily } = useReaderSettings()

  const readerFontFamily = fontFamily === 'sans' ? '"Inter", ui-sans-serif, system-ui, sans-serif' : '"Playfair Display", ui-serif, Georgia, serif'
  const { updateBook } = useBookStore()
  const { updateBookAndSync } = useBookSync()
  const { session, hasSupabase } = useAuth()
  const userId = session?.user?.id ?? null
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [vocabToEdit, setVocabToEdit] = useState<string | null>(null)
  const [modalInitialText, setModalInitialText] = useState('')
  const [interactionMode, setInteractionMode] = useState<'hand' | 'text' | 'pin'>('hand')
  const [autoExplain, setAutoExplain] = useState(false)
  const [modalTab, setModalTab] = useState<VocabTab>('meaning')
  const [noteDraft, setNoteDraft] = useState<(Partial<StoryPin> & { note: string }) | null>(null)
  const [expressionIdx, setExpressionIdx] = useState<number[] | null>(null)
  const [tipSpeaking, setTipSpeaking] = useState(false)
  const [sharedImages, setSharedImages] = useState<Record<number, string>>({})
  // Chave das imagens oficiais da galeria: o estilo deste exemplar.
  const sharedStyle = bookStyleKey(book)
  const dragSelect = useRef<number | null>(null)
  const dragMoved = useRef(false)
  const pins = usePinStore(s => s.pins)
  // Livro que já tem ilustração abre no modo ilustrado (imagem tem prioridade sobre o texto).
  // Páginas ainda sem imagem continuam mostrando o texto, com o botão de ilustrar.
  const hasIllustrations = Object.keys(book.comicPages ?? {}).length > 0
  const [viewMode, setViewMode] = useState<'text' | 'comic'>(hasIllustrations ? 'comic' : 'text')
  const firstIllustration = useRef(hasIllustrations)
  useEffect(() => {
    // Gerou a primeira imagem agora (ou trocou de livro): passa a priorizar o ilustrado.
    if (hasIllustrations && !firstIllustration.current) setViewMode('comic')
    firstIllustration.current = hasIllustrations
  }, [hasIllustrations])
  useEffect(() => { setViewMode(Object.keys(book.comicPages ?? {}).length ? 'comic' : 'text') }, [book.id])
  const [comicStage, setComicStage] = useState<ComicStage>(null)
  const [comicError, setComicError] = useState<{ page: number; message: string } | null>(null)
  const isGeneratingComic = comicStage !== null
  const [showConnectApi, setShowConnectApi] = useState(false)
  // Primeira geração do livro: escolher o estilo (com sugestão) antes de desenhar.
  const [firstStyle, setFirstStyle] = useState<{ suggested: string | null; note?: string; loading: boolean } | null>(null)
  const connectApiShownRef = useRef(false)
  const readerRootRef = useRef<HTMLDivElement>(null)
  const { status: aiStatus } = useAiStatus()
  const navigate = useNavigate()
  
  // TTS State — native browser SpeechSynthesis only
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isLoadingTts, setIsLoadingTts] = useState(false)
  const isPlayingRef = useRef(false)
  const [ttsHighlightWordIndices, setTtsHighlightWordIndices] = useState<Set<number> | null>(null)
  const browserPlaybackCancelledRef = useRef(false)
  // Cada narração recebe um id; qualquer laço com id antigo encerra sozinho (evita duas leituras simultâneas).
  const playbackRunIdRef = useRef(0)
  // Palavra que está sendo falada agora; usada para continuar dela ao trocar a velocidade.
  const currentWordRef = useRef<number | null>(null)
  // Ao trocar a velocidade com a leitura pausada, o próximo play continua desta palavra.
  const resumeFromWordRef = useRef<number | null>(null)
  const startPlaybackRef = useRef<(o?: { startWord?: number; rate?: number }) => void>(() => {})
  const autoPlayNextPageRef = useRef(false)
  const togglePlaybackRef = useRef<() => void>(() => {})
  const ttsHandRef = useRef<HTMLDivElement>(null)

  // Custom Selection State
  const [selectedRange, setSelectedRange] = useState<[number, number] | null>(null)
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null)
  const [selectedText, setSelectedText] = useState('')

  // Post-it state (pinnedVocabIds synced from and persisted to book)
  const [hoveredVocabId, setHoveredVocabId] = useState<string | null>(null)
  const [pinnedVocabIds, setPinnedVocabIds] = useState<Set<string>>(() => new Set(book.pinnedVocabIds ?? []))
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    setPinnedVocabIds(new Set(book.pinnedVocabIds ?? []))
  }, [book.id, book.pinnedVocabIds])

  useEffect(() => { if (userId) void loadPins(userId) }, [userId])
  useEffect(() => {
    if (!book.catalogId || book.imageMode === 'personal') { setSharedImages({}); return }
    let alive = true
    void fetchSharedImages(book.catalogId, sharedStyle).then(images => { if (alive) setSharedImages(images) })
    return () => { alive = false }
  }, [book.catalogId, book.imageMode, sharedStyle])

  // Make vocabularies reactive so the component re-renders when a new word is saved
  const allVocabularies = useVocabularyStore(state => state.vocabularies)
  const vocabularies = useMemo(() => allVocabularies.filter(v => v.bookId === book.id), [allVocabularies, book.id])
  // Marcações compartilhadas entre livros: a mesma palavra aparece marcada em qualquer livro. Vale a deste livro; senão, a mais recente.
  const markVocabularies = useMemo(() => {
    const best = new Map<string, { v: (typeof allVocabularies)[number]; rank: number }>()
    for (const v of allVocabularies) {
      const key = v.text.trim().toLowerCase()
      if (!key) continue
      const rank = (v.bookId === book.id ? 1e15 : 0) + v.createdAt
      const cur = best.get(key)
      if (!cur || rank > cur.rank) best.set(key, { v, rank })
    }
    return [...best.values()].map(item => item.v).filter(v => !hiddenMarks.includes(v.status))
  }, [allVocabularies, book.id, hiddenMarks])
  const deleteVocabulary = useVocabularyStore(state => state.deleteVocabulary)
  const addVocabulary = useVocabularyStore(state => state.addVocabulary)
  const updateVocabulary = useVocabularyStore(state => state.updateVocabulary)
  const [wordTip, setWordTip] = useState<WordTooltipState | null>(null)
  const [toolbarSlot, setToolbarSlot] = useState<HTMLDivElement | null>(null)
  const [nudgeHidden, setNudgeHidden] = useState(() => { try { return sessionStorage.getItem(`illustrate-nudge:${book.id}`) === '1' } catch { return false } })
  const pendingPlaybackRef = useRef<{ startWord?: number; rate?: number } | null>(null)
  useEffect(() => subscribeKokoro(() => {
    if (!activeKokoroVoice() || !pendingPlaybackRef.current) return
    const opts = pendingPlaybackRef.current
    pendingPlaybackRef.current = null
    setTimeout(() => startPlaybackRef.current(opts), 300)
  }), [])
  const reduceMotion = useReducedMotion()
  const lastPageRef = useRef(book.currentPage || 0)
  const pageDirection = (book.currentPage || 0) >= lastPageRef.current ? 1 : -1
  useEffect(() => { lastPageRef.current = book.currentPage || 0 }, [book.currentPage])
  const [scoreBurst, setScoreBurst] = useState<ScoreBurst | null>(null)
  const [popWordIdx, setPopWordIdx] = useState<number | null>(null)

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    }
  }, [])
  const pages = book.pages || [book.content]
  const currentPage = book.currentPage || 0
  const currentContent = pages[currentPage] || ''
  // Numeração única das palavras da página, pela posição no texto. A tela (data-word-index)
  // e a narração usam esta mesma lista; assim o destaque não se desalinha mesmo quando o
  // vocabulário recorta uma palavra ao meio (ex.: "it" dentro de "it's").
  const pageWordTokens = useMemo(
    () => [...currentContent.matchAll(wordRegex())].map((m) => ({ start: m.index!, end: m.index! + m[0].length })),
    [currentContent],
  )
  const charToWord = useMemo(() => {
    const arr = new Int32Array(currentContent.length).fill(-1)
    pageWordTokens.forEach((t, i) => { for (let c = t.start; c < t.end; c++) arr[c] = i })
    return arr
  }, [currentContent, pageWordTokens])

  useEffect(() => {
    if (selectedRange && containerRef.current) {
      const [start, end] = selectedRange
      const spans = Array.from(containerRef.current.querySelectorAll('span[data-word-index]')) as HTMLElement[]
      const selectedSpans = spans.filter(span => {
        const idx = parseInt(span.getAttribute('data-word-index') || '-1', 10)
        return idx >= start && idx <= end
      })

      if (selectedSpans.length > 0) {
        const rect = {
          left: Math.min(...selectedSpans.map(s => s.getBoundingClientRect().left)),
          top: Math.min(...selectedSpans.map(s => s.getBoundingClientRect().top)),
          right: Math.max(...selectedSpans.map(s => s.getBoundingClientRect().right)),
          bottom: Math.max(...selectedSpans.map(s => s.getBoundingClientRect().bottom)),
          width: 0,
          height: 0,
          x: 0,
          y: 0,
          toJSON: () => {}
        }
        rect.width = rect.right - rect.left
        rect.height = rect.bottom - rect.top
        rect.x = rect.left
        rect.y = rect.top

        setSelectionRect(rect as DOMRect)

        const range = document.createRange()
        range.setStartBefore(selectedSpans[0])
        range.setEndAfter(selectedSpans[selectedSpans.length - 1])
        
        let text = range.toString()
        text = text.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '')
        setSelectedText(text)
      }
    } else {
      setSelectionRect(null)
      setSelectedText('')
    }
  }, [selectedRange, currentContent])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('span[data-word-index]') && !target.closest('.floating-action-btn') && !target.closest('[role="dialog"]')) {
        setSelectedRange(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAddVocab = (textOverride?: string) => {
    const text = typeof textOverride === 'string' ? textOverride : selectedText;
    // Palavra que já está na lista: abre a que existe (com explicação, exemplos e notas salvos)
    // em vez de começar uma nova em branco.
    const key = text.trim().toLowerCase()
    const existing = key ? useVocabularyStore.getState().vocabularies.find(v => v.bookId === book.id && v.text.trim().toLowerCase() === key) : undefined
    if (existing) { setVocabToEdit(existing.id); setIsModalOpen(true); return }
    setVocabToEdit(null)
    setModalInitialText(text)
    setIsModalOpen(true)
  }

  const handleEditVocab = (id: string) => {
    setVocabToEdit(id)
    setIsModalOpen(true)
  }

  // HTML das palavras de um trecho da página [charStart, charEnd). O modo texto usa a página inteira;
  // os balões do quadrinho usam seus trechos. Mesmos índices (data-word-index), classes e cliques.
  const buildWordsHtml = useCallback((charStart: number, charEnd: number) => {
    const escapeMap: Record<string, string> = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }
    const escapeHtml = (str: string) => str.replace(/[&<>"']/g, m => escapeMap[m] || m)
    const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    let segments = [{ text: currentContent.slice(charStart, charEnd), isVocab: false, vocabId: null as string | null, status: null as string | null }]

    if (showHighlights && markVocabularies.length > 0) {
      const sortedVocab = [...markVocabularies].sort((a, b) => b.text.length - a.text.length)

      sortedVocab.forEach(vocab => {
        if (!vocab.text.trim()) return
        const newSegments: typeof segments = []
        const regex = new RegExp(`\\b(${escapeRegExp(vocab.text)})\\b`, 'gi')
        
        segments.forEach(seg => {
          if (seg.isVocab) {
            newSegments.push(seg)
            return
          }
          
          let lastIndex = 0
          let match
          regex.lastIndex = 0
          
          while ((match = regex.exec(seg.text)) !== null) {
            if (match.index > lastIndex) {
              newSegments.push({ text: seg.text.substring(lastIndex, match.index), isVocab: false, vocabId: null, status: null })
            }
            newSegments.push({ text: match[0], isVocab: true, vocabId: vocab.id, status: vocab.status })
            lastIndex = regex.lastIndex
          }
          if (lastIndex < seg.text.length) {
            newSegments.push({ text: seg.text.substring(lastIndex), isVocab: false, vocabId: null, status: null })
          }
        })
        segments = newSegments
      })
    }

    const isTtsHighlight = (idx: number) => ttsHighlightWordIndices != null && ttsHighlightWordIndices.has(idx)
    let finalHtml = ''
    let segOffset = charStart // posição do segmento dentro de currentContent
    segments.forEach(seg => {
      const base = segOffset
      segOffset += seg.text.length
      if (seg.isVocab) {
        let pos = 0
        seg.text.split(new RegExp(`(${WORD_PATTERN})`, 'u')).forEach((part, k) => {
          const at = pos
          pos += part.length
          if (k % 2 === 0) {
            if (part) finalHtml += escapeHtml(part)
            return
          }
          const idx = charToWord[base + at] ?? -1
          const isSelected = selectedRange && idx >= selectedRange[0] && idx <= selectedRange[1]
          const selectedClass = isSelected ? 'border-b-2 border-[var(--theme-accent)] bg-[var(--theme-accent)]/10' : ''
          const ttsClass = (isTtsHighlight(idx) ? 'tts-current' : '') + (idx === popWordIdx ? ' vocab-pop' : '')
          finalHtml += `<span data-vocab-id="${escapeHtml(seg.vocabId ?? '')}" data-word-index="${idx}" class="vocab-${escapeHtml(seg.status ?? '')} relative group cursor-pointer ${selectedClass} ${ttsClass}">${escapeHtml(part)}</span>`
        })
      } else {
        // Run regex on unescaped text, then escape the match and the spaces
        let lastIdx = 0;
        const regex = wordRegex();
        let match;
        while ((match = regex.exec(seg.text)) !== null) {
          if (match.index > lastIdx) {
            finalHtml += escapeHtml(seg.text.substring(lastIdx, match.index));
          }
          const idx = charToWord[base + match.index] ?? -1
          const isSelected = selectedRange && idx >= selectedRange[0] && idx <= selectedRange[1]
          const selectedClass = isSelected ? 'border-b-2 border-[var(--theme-accent)] bg-[var(--theme-accent)]/10' : ''
          const ttsClass = isTtsHighlight(idx) ? 'tts-current' : ''
          const hoverClass = interactionMode === 'hand' ? 'hover-word' : 'cursor-pointer hover:bg-[var(--theme-accent)]/10'
          const pinClass = pins.some(pin => pin.bookId === book.id && pin.page === currentPage && pin.kind === 'word' && pin.wordIndex === idx) ? 'has-pin' : ''
          const exprClass = expressionIdx?.includes(idx) ? 'expr-part' : ''
          finalHtml += `<span data-word-index="${idx}" class="word-span ${hoverClass} ${selectedClass} ${ttsClass} ${pinClass} ${exprClass} transition-colors duration-150 rounded-sm">${escapeHtml(match[0])}</span>`
          lastIdx = regex.lastIndex;
        }
        if (lastIdx < seg.text.length) {
          finalHtml += escapeHtml(seg.text.substring(lastIdx));
        }
      }
    })

    return finalHtml
  }, [currentContent, charToWord, markVocabularies, showHighlights, interactionMode, selectedRange, ttsHighlightWordIndices, popWordIdx, pins, book.id, currentPage, expressionIdx])
  const contentWithHighlights = useMemo(() => buildWordsHtml(0, currentContent.length), [buildWordsHtml, currentContent])

  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const wordSpan = target.closest('span[data-word-index]')
    const idx = wordSpan ? parseInt(wordSpan.getAttribute('data-word-index') || '-1', 10) : -1

    if (interactionMode === 'pin') {
      if (idx < 0 || !wordSpan) return
      const existing = pins.find(pin => pin.bookId === book.id && pin.page === currentPage && pin.kind === 'word' && pin.wordIndex === idx)
      setNoteDraft(existing ?? { bookId: book.id, page: currentPage, kind: 'word', wordIndex: idx, quote: wordSpan.textContent || '', note: '' })
      return
    }

    // Modo "Select Text": clicar estende a seleção (para salvar frases).
    // Se a pessoa arrastou, o intervalo já está pronto e o clique não pode encolher para uma palavra.
    if (interactionMode === 'text') {
      if (dragMoved.current) { dragMoved.current = false; return }
      if (idx >= 0) {
        if (!selectedRange) setSelectedRange([idx, idx])
        else {
          const [start, end] = selectedRange
          if (idx < start) setSelectedRange([idx, end])
          else if (idx > end) setSelectedRange([start, idx])
          else setSelectedRange([idx, idx])
        }
      }
      return
    }

    // Modo "Click Word": clicar seleciona a palavra (ou a expressão inteira), pausa a leitura
    // e abre as opções acima (ouvir a palavra, ouvir daqui, voltar, status, explicação).
    if (idx < 0 || !wordSpan) { setWordTip(null); setExpressionIdx(null); return }
    if (isPlaying || isPaused) stopPlayback()
    resumeFromWordRef.current = idx
    currentWordRef.current = idx
    const pageWords = pageWordTokens.map(token => currentContent.slice(token.start, token.end))
    const grouped = expressionIdx?.includes(idx) && expressionIdx.length > 1
    const hit = grouped ? null : findExpression(pageWords, idx, book.languageCode || 'en')
    const focus = hit && hit.indices.length > 1 ? hit.indices : [idx]
    setTtsHighlightWordIndices(new Set(focus))
    setExpressionIdx(hit ? hit.indices : null)
    const anchors = focus
      .map(i => containerRef.current?.querySelector(`span[data-word-index="${i}"]`))
      .filter((el): el is HTMLElement => el instanceof HTMLElement)
    const rects = (anchors.length ? anchors : [wordSpan as HTMLElement]).map(el => el.getBoundingClientRect())
    const left = Math.min(...rects.map(r => r.left))
    const right = Math.max(...rects.map(r => r.right))
    const top = Math.min(...rects.map(r => r.top))
    const bottom = Math.max(...rects.map(r => r.bottom))
    setWordTip({ idx, text: hit?.canonical || wordSpan.textContent || '', x: (left + right) / 2, y: bottom, top: top - 2 })
  }

  const playFromWord = (idx: number) => {
    setWordTip(null)
    stopPlayback()
    startPlaybackRef.current({ startWord: idx })
  }

  // Status rápido pelo tooltip: cria ou atualiza a palavra no vocabulário.
  const vocabForText = (text: string) => {
    const key = text.trim().toLowerCase()
    const all = useVocabularyStore.getState().vocabularies.filter((v) => v.text.trim().toLowerCase() === key)
    return all.find((v) => v.bookId === book.id) ?? all.sort((a, b) => b.createdAt - a.createdAt)[0]
  }
  const setWordStatus = (text: string, status: VocabStatus) => {
    const existing = vocabForText(text)
    let saved
    if (existing) {
      updateVocabulary(existing.id, { status })
      saved = { ...existing, status }
    } else {
      saved = addVocabulary({ bookId: book.id, text: text.trim(), type: text.trim().includes(' ') ? 'phrase' : 'word', status, explanation: '', examples: [] })
    }
    // Pop na palavra e "+1" acima dela ao aprender.
    if (wordTip) {
      setPopWordIdx(wordTip.idx)
      setTimeout(() => setPopWordIdx(null), 650)
      if (status === 'learned' && existing?.status !== 'learned') {
        setScoreBurst({ key: Date.now(), x: wordTip.x, y: wordTip.top - 84 })
        setTimeout(() => setScoreBurst(null), 1100)
      }
    }
    if (hasSupabase && supabase && userId) upsertVocabulary(supabase, userId, saved).catch((err) => console.error('Sync vocab', err))
  }
  const openWordCard = (text: string, tab: VocabTab) => {
    setWordTip(null)
    if (isPlaying) { pauseSpeaking(); setIsPaused(true); setIsPlaying(false) }
    setModalTab(tab)
    const existing = vocabForText(text)
    if (existing) handleEditVocab(existing.id)
    else handleAddVocab(text)
  }

  // O tooltip é fixo na tela: some ao rolar ou trocar de página.
  // Fecha ao clicar fora (o clique numa palavra é tratado por handleContentClick) ou com Esc.
  useEffect(() => {
    if (!wordTip) return
    const hide = () => setWordTip(null)
    const onPointer = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null
      if (el?.closest('.word-tooltip, span[data-word-index]')) return
      hide()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide() }
    window.addEventListener('scroll', hide, true)
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', hide, true)
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [wordTip])
  useEffect(() => { setWordTip(null); setExpressionIdx(null) }, [currentPage, viewMode])

  const goToPage = (index: number) => {
    const newPage = Math.max(0, Math.min(pages.length - 1, index))
    if (newPage !== currentPage) {
      // Avançar conta a página lida (uma vez por página de cada livro).
      if (newPage > currentPage) useXpStore.getState().award(`read:${book.id}:${currentPage}`, XP.readPage)
      updateBookAndSync(book.id, { currentPage: newPage, lastRead: Date.now() })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const changePage = (delta: number) => {
    goToPage(currentPage + delta)
  }

  // Preload comic images (previous, current, next) for smoother navigation
  useEffect(() => {
    if (!book.comicPages || viewMode !== 'comic') return
    const indices = [currentPage, currentPage - 1, currentPage + 1]
    indices.forEach(i => {
      if (i >= 0 && i < pages.length) {
        const imgData = book.comicPages?.[i]
        if (imgData) {
          const img = new Image()
          img.src = isComicPageUrl(imgData) ? imgData : `data:image/jpeg;base64,${imgData}`
        }
      }
    })
  }, [book.comicPages, currentPage, pages.length, viewMode])

  const togglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPinnedVocabIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      updateBookAndSync(book.id, { pinnedVocabIds: Array.from(next) })
      return next
    })
  }

  const speakVocabText = (text: string) => {
    if (!text.trim()) return
    void speak(text.trim(), { language: 'en', context: text.trim().split(/\s+/).length <= 3 ? 'word' : 'phrase', rate: 0.9 })
  }

  const comicOperation = useRef(false)
  /** Troca os rostos de cada quadro pelos localizados no recorte (quando a visão encontrar algum). */
  const withLocatedFaces = async (imageUrl: string, panels: PanelInspection[], beats: VisualBeat[], characters: ComicCharacter[]) => {
    try {
      const faces = await locateComicFaces(imageUrl, panels.map(panel => {
        const beat = beats.find(b => b.id === panel.panelId)
        return {
          bounds: panel.bounds,
          cast: characters.filter(c => c.id && beat?.cast.includes(c.id)),
          speakers: [...new Set((beat?.dialogue ?? []).flatMap(line => line.speakerId ? [line.speakerId] : []))],
        }
      }))
      return panels.map((panel, i) => faces[i]?.length ? { ...panel, faces: faces[i] } : panel)
    } catch (error) {
      console.warn('face pass failed', error)
      return panels
    }
  }

  // Reposiciona os balões de uma página pronta: localiza os rostos de novo e refaz o encaixe
  // (sem gerar outra imagem). Custa só uma chamada de visão barata.
  const handleRelayoutComic = async () => {
    const pageIndex = currentPage
    const layout = book.comicLayouts?.[pageIndex]
    const image = book.comicPages?.[pageIndex]
    if (comicOperation.current || layout?.v !== 3 || !image) return
    comicOperation.current = true
    setComicError(null)
    setComicStage('layout')
    try {
      const img = new Image(); img.crossOrigin = 'anonymous'; img.src = image; await img.decode()
      const aspect = img.naturalWidth / img.naturalHeight
      const panels = await withLocatedFaces(image, layout.panels, layout.beats, book.comicCharacters ?? [])
      const dialogue = resolveSpeakers(fullComicText(currentContent, layout.panels.map(panel => layout.beats.find(b => b.id === panel.panelId)
        ?? { id: panel.panelId, sourceSentenceIds: [], dialogue: [] })), layout.beats, book.comicCharacters ?? [], currentContent)
      const lettering = placePanelBoxes({ panels, aspect, issues: [] }, dialogue,
        browserMeasure(letteringThemeFor(book.comicStyleDoc).font))
      const { reflow: _old, ...rest } = layout
      await saveComicPage(book, pageIndex, image, { ...rest, panels, balloons: lettering.balloons, issues: lettering.issues, lettering: 'lines', editRevision: crypto.randomUUID() })
    } catch (error) {
      setComicError({ page: pageIndex, message: aiErrorMessage(error) })
    } finally {
      comicOperation.current = false
      setComicStage(null)
    }
  }
  const styleBank = useStyleBank(locale === 'pt-BR')
  const styleChange = useApplyBookStyle(book, userId ?? undefined, locale === 'pt-BR', styleBank)
  /** Abre o banco de estilos com a sugestão do livro (comunidade na galeria; leitura da IA nos EPUBs). */
  const askFirstStyle = () => {
    setFirstStyle({ suggested: null, loading: true })
    const context = book.context?.trim() || book.pages.slice(0, 2).join('\n\n') || book.content
    suggestComicStyle(book.id, currentContent, context)
      .then(r => setFirstStyle(prev => prev && {
        suggested: r.styleId, loading: false,
        note: r.source === 'community' ? (locale === 'pt-BR' ? 'Estilo da comunidade' : 'Community style') : (locale === 'pt-BR' ? 'Sugerido para este livro' : 'Suggested for this book'),
      }))
      .catch(() => setFirstStyle(prev => prev && { ...prev, loading: false }))
  }
  const handleGenerateComic = async (opts?: { styleChosen?: boolean }) => {
    if (comicOperation.current) return
    comicOperation.current = true
    const pageIndex = currentPage
    setComicError(null)
    const pageText = currentContent
    try {
      const status = aiStatus ?? await getAiStatus().catch(() => null)
      if (!status) throw new AiRequestError('ai_status_unavailable')
      if (!status.openai.connected) { setShowConnectApi(true); return }
      // Livro ainda sem estilo escolhido: primeiro o banco de estilos (com sugestão), depois desenha.
      if (!opts?.styleChosen && !book.comicStyleDoc?.styleId) { askFirstStyle(); return }
      setComicStage('prepare')
      const styleDoc = await prepareComicArt(book.id)
      useBookStore.getState().updateBook(book.id, { comicStyleDoc: styleDoc })
      const options = {
        bookId: book.id, page: pageIndex, pageText, bookTitle: book.title,
        bookContext: book.context?.trim() || book.pages.slice(0, 2).join('\n\n') || book.content,
        priorContext: book.pages[pageIndex - 1]?.slice(-1500),
        languageCode: book.languageCode,
      }
      const generateAndInspect = async (replan?: string) => {
        setComicStage('image')
        const generated = await generateComicPage({ ...options, replan })
        setComicStage('layout')
        const img = new Image()
        img.src = generated.imageUrl
        await img.decode()
        const aspect = img.naturalWidth / img.naturalHeight
        const rows = generated.generation.composition
        const measured = rows?.length && !rows.some(row => row.rightStack) ? await detectPanels(generated.imageUrl, rows, true) : null
        const inspected = await inspectComicPage(generated, aspect, measured?.detected ? measured.panels : undefined)
        // Segunda passada: rostos quadro a quadro, para o rabicho apontar para quem fala.
        const inspection = { ...inspected, panels: await withLocatedFaces(generated.imageUrl, inspected.panels, generated.beats, generated.characters) }
        const dialogue = resolveSpeakers(fullComicText(pageText, generated.beats), generated.beats, generated.characters, pageText)
        const lettering = placePanelBoxes(inspection, dialogue,
          browserMeasure(letteringThemeFor(generated.styleDoc ?? book.comicStyleDoc).font))
        lettering.issues.push(...(generated.editorialIssues ?? []))
        return { generated, inspection, lettering }
      }
      // The inspection never rejects finished art. Only a clearly off-style first render earns
      // one more attempt; otherwise the page is kept and marked for review.
      const first = await generateAndInspect()
      const result = first.inspection.issues.includes('art_style_mismatch')
        ? await generateAndInspect('The first render looked too realistic. Draw clean stylized faces with flat base colors and a single shadow shape. Use broad quiet background color fields. Reduce surface detail aggressively.')
          .then(second => second.inspection.issues.includes('art_style_mismatch') ? first : second)
          .catch(() => first)
        : first
      const { generated, inspection, lettering } = result
      const old = book.comicLayouts?.[pageIndex]
      const layout: EditorialLayout = {
        v: 3, panels: inspection.panels, beats: generated.beats, context: generated.context,
        generation: generated.generation, ...lettering, lettering: 'lines',
        quality: lettering.issues.length ? 'needs-review' : 'validated',
        history: old?.v === 3 ? [...(old.history ?? []), old.generation] : undefined,
      }
      await saveComicPage(book, pageIndex, generated.imageUrl, layout, {
        style: generated.styleDoc, styleRevision: generated.previousStyleRevision,
        characters: generated.characters, previousCharacters: generated.previousCharacters,
      })
      // Só estilos do banco têm imagens oficiais compartilhadas.
      // Só o estilo padrão do livro é compartilhado; cada página publicada nele vale pontos de contribuição.
      const publishStyle = generated.styleDoc?.styleId
      const defaultStyle = book.catalogId ? (await catalogStyleOptions(book.catalogId).catch(() => [])).find(option => option.isDefault)?.styleId : undefined
      if (book.catalogId && publishStyle && (!defaultStyle || publishStyle === defaultStyle) && book.imageMode !== 'personal' && userId && /^https?:\/\//.test(generated.imageUrl) && !sharedImages[pageIndex]) {
        try {
          const published = await publishSharedImage(book.catalogId, publishStyle, pageIndex, generated.imageUrl, userId)
          if (published) {
            setSharedImages(prev => ({ ...prev, [pageIndex]: generated.imageUrl }))
            useXpStore.getState().award(`community:page:${book.catalogId}:${publishStyle}:${pageIndex}`, XP.communityImage)
          }
        } catch (error) {
          console.warn('shared comic image', error)
        }
      }
    } catch (error) {
      console.error('Failed to generate comic:', error)
      if (isNoApiKeyError(error)) setShowConnectApi(true)
      else setComicError({ page: pageIndex, message: aiErrorMessage(error) })
    } finally {
      comicOperation.current = false
      setComicStage(null)
    }
  }

  const handleDeleteComic = async () => {
    if (comicOperation.current || !book.comicPages?.[currentPage]) return
    const pt = locale === 'pt-BR'
    if (!await askConfirm(pt ? 'Apagar a ilustração desta página?' : 'Delete this page’s illustration?',
      { detail: pt ? 'A página volta a ser só texto. Para ter a imagem de novo é preciso gerar outra vez (usa sua chave de IA).' : 'The page goes back to text only. Getting an image again means generating it again (uses your AI key).', confirmLabel: pt ? 'Apagar' : 'Delete' })) return
    comicOperation.current = true
    try { await saveComicPage(book, currentPage, null, null) }
    catch (error) { console.error('Comic delete failed:', error); toast(aiErrorMessage(error), { tone: 'error' }) }
    finally { comicOperation.current = false }
  }

  const handleSaveLettering = async (layout: EditorialLayout) => {
    const page = currentPage
    try {
      if (comicOperation.current) throw new AiRequestError('comic_save_conflict')
      const latest = useBookStore.getState().books.find(item => item.id === book.id)
      const saved = latest?.comicLayouts?.[page]
      const image = latest?.comicPages?.[page]
      if (!latest || !image || saved?.v !== 3 || saved.generation.id !== layout.generation.id || saved.editRevision !== layout.editRevision) {
        throw new AiRequestError('comic_save_conflict')
      }
      comicOperation.current = true
      setComicError(null)
      try { await saveComicPage(latest, page, image, { ...layout, editRevision: crypto.randomUUID() }) }
      finally { comicOperation.current = false }
    } catch (error) {
      setComicError({ page, message: aiErrorMessage(error) })
      throw error
    }
  }

  const openComicMode = async () => {
    setViewMode('comic')
    stopPlayback()
    const status = aiStatus ?? await getAiStatus().catch(() => null)
    if (status && !status?.openai?.connected && !connectApiShownRef.current) {
      connectApiShownRef.current = true
      setShowConnectApi(true)
    }
  }

  // TTS — camada centralizada (VoiceStudio via Supabase, fallback para voz do navegador em src/lib/tts.ts)
  useEffect(() => {
    return () => {
      browserPlaybackCancelledRef.current = true
      playbackRunIdRef.current++
      stopSpeaking()
    }
  }, [])

  // Frases montadas a partir da MESMA numeração de palavras da tela (pageWordTokens):
  // cada trecho sabe exatamente quais índices de palavra ele cobre.
  // `startWord` permite começar no meio de uma frase (ex.: ao trocar a velocidade).
  type Chunk = { text: string; range: [number, number]; voice?: string; child?: boolean }
  // Vozes por personagem nesta página: falas com falante resolvido (HQ ou pistas no texto).
  const castDoc = (book.comicStyleDoc ?? {}) as VoiceSettings & { characterVoices?: boolean; narratorVoice?: string }
  // Narrador: voz própria escolhida no elenco; senão, a voz da leitura.
  const narratorVoice = castDoc.characterVoices !== false && castDoc.narratorVoice ? castDoc.narratorVoice : undefined
  const voiceCastMap = useMemo(() => buildVoiceCast(book.comicCharacters ?? [], narratorVoice ?? activeKokoroVoice(), castDoc),
    [book.comicCharacters, castDoc.femaleVoice, castDoc.maleVoice, castDoc.voiceRoles, narratorVoice])
  const voiceSpans = useMemo(() => {
    if (castDoc.characterVoices === false) return []
    const narr = narratorVoice ?? activeKokoroVoice()
    return speechSpans(currentContent, book.comicLayouts?.[currentPage], book.comicCharacters ?? [], voiceCastMap, narr,
      { female: castDoc.femaleVoice ?? defaultFemaleVoice(narr), male: castDoc.maleVoice ?? defaultMaleVoice(narr) })
  }, [currentContent, book.comicLayouts, currentPage, book.comicCharacters, voiceCastMap, castDoc.characterVoices, castDoc.femaleVoice, castDoc.maleVoice, narratorVoice])

  const buildChunks = (rate: number, useWords: boolean, startWord?: number): Chunk[] => {
    const startChar = startWord != null ? pageWordTokens[startWord]?.start ?? 0 : 0
    if (useWords) {
      return pageWordTokens
        .map((t, i) => ({ text: currentContent.slice(t.start, t.end), range: [i, i + 1] as [number, number] }))
        .filter((c) => c.range[0] >= (startWord ?? 0))
    }
    // Em velocidades lentas também divide em vírgulas/ponto e vírgula: pausas curtas ajudam quem está aprendendo.
    const splitter = rate <= 0.7 ? /(?<=[.!?;:,])\s+/g : /(?<=[.!?])\s+/g
    const bounds: [number, number][] = []
    let from = 0
    for (const m of currentContent.matchAll(splitter)) {
      bounds.push([from, m.index!])
      from = m.index! + m[0].length
    }
    bounds.push([from, currentContent.length])
    // Falas dos personagens: corta também nas aspas, para cada fala sair na voz de quem fala.
    const spans = voiceSpans
    const cuts = bounds.flatMap(([a0, b]) => {
      const points = [a0, b, ...spans.flatMap(sp => [sp.start, sp.end]).filter(x => x > a0 && x < b)]
      const sortedPoints = [...new Set(points)].sort((x, y) => x - y)
      return sortedPoints.slice(0, -1).map((x, i) => [x, sortedPoints[i + 1]] as [number, number])
    })
    const out: Chunk[] = []
    let wi = 0
    for (const [a0, b] of cuts) {
      if (b <= startChar) continue
      const a = Math.max(a0, startChar)
      const text = currentContent.slice(a, b).replace(/\s+/g, ' ').trim()
      if (!text || !/[\p{L}\p{N}]/u.test(text)) continue
      while (wi < pageWordTokens.length && pageWordTokens[wi].start < a) wi++
      const start = wi
      while (wi < pageWordTokens.length && pageWordTokens[wi].start < b) wi++
      const mid = (a + b) / 2
      const span = spans.find(sp => mid >= sp.start && mid < sp.end)
      out.push({ text, range: [start, wi], voice: span?.voice ?? narratorVoice, child: span?.child })
    }
    return out
  }

  const narrationLanguage = (book.languageCode || 'en').slice(0, 2).toLowerCase()
  const clampRate = (r: number) => Math.min(1.5, Math.max(0.5, r))

  const startPlayback = (opts: { startWord?: number; rate?: number } = {}) => {
    // Sem voz instalada (livro em inglês): pede para instalar em vez de usar a voz do navegador.
    if (needsVoiceInstall(narrationLanguage)) {
      pendingPlaybackRef.current = opts
      askVoiceOnce()
      return
    }
    browserPlaybackCancelledRef.current = false
    resumeFromWordRef.current = null
    const runId = ++playbackRunIdRef.current
    const isStale = () => runId !== playbackRunIdRef.current || browserPlaybackCancelledRef.current
    stopSpeaking()
    const rate = opts.rate ?? playbackRate
    // Sem voz Kokoro, a velocidade mínima lê palavra por palavra (como antes).
    // Com Kokoro, lê por frase em fala lenta: palavras isoladas soam mal nesse modelo.
    const useWords = rate <= 0.5 && !activeKokoroVoice()
    // A velocidade escolhida é a velocidade real da fala.
    const playerRate = clampRate(rate)
    // Pausa entre frases: maior em velocidades lentas para dar tempo de assimilar.
    const PAUSE_MS = rate <= 0.5 ? 650 : rate <= 0.6 ? 500 : rate <= 0.7 ? 380 : rate <= 0.8 ? 250 : rate <= 1.0 ? 120 : 60
    const language = narrationLanguage
    const context = useWords ? 'word' as const : 'reader' as const
    const chunks = buildChunks(rate, useWords, opts.startWord)

    const totalPages = pages.length
    const finish = (advance: boolean) => {
      setTtsHighlightWordIndices(null)
      currentWordRef.current = null
      setIsPlaying(false)
      setIsPaused(false)
      if (advance && currentPage < totalPages - 1) {
        changePage(1)
        autoPlayNextPageRef.current = true
      }
    }
    const highlight = (i: number) => {
      currentWordRef.current = i
      // Marca a palavra na tela já neste quadro de animação; o React confirma logo depois.
      // (Esperar o re-render da página inteira deixava o destaque um pouco atrás da voz.)
      const root = readerRootRef.current
      if (root) {
        root.querySelectorAll('span.tts-current[data-word-index]').forEach(el => el.classList.remove('tts-current'))
        root.querySelectorAll(`span[data-word-index="${i}"]`).forEach(el => el.classList.add('tts-current'))
      }
      setTtsHighlightWordIndices(new Set([i]))
    }

    const run = async () => {
      for (let index = 0; index < chunks.length; index++) {
        // Pausado entre frases: espera o aluno retomar antes de seguir.
        await waitWhilePaused()
        if (isStale()) return
        const { text, range } = chunks[index]
        if (!text) continue
        const [phraseStart, phraseEnd] = range
        highlight(phraseStart)
        // Pré-carrega as próximas duas frases (mesma velocidade => mesmo cache) enquanto a atual toca.
        for (const next of chunks.slice(index + 1, index + 3)) prefetch(next.text, { language, context, rate: next.child ? Math.min(1.5, playerRate * CHILD_SPEED) : playerRate, kokoroVoice: next.voice })
        try {
          const handle = await speak(text, {
            language, context, rate: chunks[index].child ? Math.min(1.5, playerRate * CHILD_SPEED) : playerRate, onLoading: setIsLoadingTts,
            kokoroVoice: chunks[index].voice,
            // Destaque palavra a palavra: tempos reais do Kokoro (ou onboundary da voz do navegador).
            onWord: useWords ? undefined : (i) => {
              if (!isStale()) highlight(Math.min(phraseStart + i, Math.max(phraseStart, phraseEnd - 1)))
            },
          })
          await handle.done
        } catch {
          if (!isStale()) finish(false)
          return
        }
        if (isStale()) return
        await new Promise((r) => setTimeout(r, PAUSE_MS))
      }
      if (!isStale()) finish(true)
    }

    setIsPlaying(true)
    setIsPaused(false)
    void run()
  }
  startPlaybackRef.current = startPlayback

  const togglePlayback = () => {
    if (isPlaying) {
      pauseSpeaking()
      setIsPaused(true)
      setIsPlaying(false)
      return
    }
    if (isPaused) {
      resumeSpeaking()
      setIsPlaying(true)
      setIsPaused(false)
      return
    }
    startPlayback({ startWord: resumeFromWordRef.current ?? undefined })
  }
  togglePlaybackRef.current = togglePlayback
  isPlayingRef.current = isPlaying

  // Controles na tela de bloqueio/fones enquanto há narração; tela sempre acesa durante a leitura.
  useMediaSession({
    enabled: isPlaying || isPaused,
    title: book.title,
    artist: book.author,
    artwork: book.coverData?.startsWith('http') ? book.coverData : undefined,
    playing: isPlaying,
    onToggle: () => togglePlaybackRef.current(),
    onNext: () => changePage(1),
    onPrev: () => changePage(-1),
  })
  useWakeLock(true)

  // Aba "Escutar": inicia a leitura em voz alta ao entrar. Ao voltar para "Ler", para a
  // narração que o "Escutar" iniciou — em "Ler" nada toca sozinho.
  const wasAutoPlayRef = useRef(autoPlay)
  useEffect(() => {
    if (autoPlay) {
      wasAutoPlayRef.current = true
      const t = setTimeout(() => { if (!isPlayingRef.current) startPlaybackRef.current({}) }, 500)
      return () => clearTimeout(t)
    }
    if (wasAutoPlayRef.current) {
      wasAutoPlayRef.current = false
      stopPlayback()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay])

  // Pré-carregamento: com uma voz Kokoro escolhida, carrega o motor e já gera as primeiras
  // frases da página na velocidade atual, para o play começar praticamente na hora.
  // Página nova: o "continuar desta palavra" da página anterior não vale mais.
  useEffect(() => { resumeFromWordRef.current = null }, [currentPage])

  useEffect(() => {
    if (!activeKokoroVoice() || !narrationLanguage.startsWith('en')) return
    warmUpKokoro()
    // Durante a leitura o próprio laço já pré-carrega as próximas frases.
    if (isPlaying || isPaused) return
    const t = setTimeout(() => {
      const first = buildChunks(playbackRate, false).slice(0, 2)
      for (const c of first) prefetch(c.text, { language: narrationLanguage, context: 'reader', rate: clampRate(playbackRate) })
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, currentContent, playbackRate])

  useEffect(() => {
    if (autoPlayNextPageRef.current && containerRef.current) {
      autoPlayNextPageRef.current = false
      const timer = setTimeout(() => togglePlaybackRef.current?.(), 300)
      return () => clearTimeout(timer)
    }
  }, [currentPage])

  const updateTtsHandPosition = () => {
    if (!ttsHighlightWordIndices || ttsHighlightWordIndices.size === 0 || !containerRef.current || !ttsHandRef.current) {
      if (ttsHandRef.current) ttsHandRef.current.style.display = 'none'
      return
    }
    const firstIdx = Math.min(...ttsHighlightWordIndices)
    const span = containerRef.current.querySelector(`span[data-word-index="${firstIdx}"]`) as HTMLElement | null
    if (!span) {
      ttsHandRef.current.style.display = 'none'
      return
    }
    const rect = span.getBoundingClientRect()
    ttsHandRef.current.style.display = 'block'
    ttsHandRef.current.style.left = `${rect.left}px`
    ttsHandRef.current.style.top = `${rect.bottom - 4}px`
  }

  useEffect(() => {
    if (!ttsHighlightWordIndices || ttsHighlightWordIndices.size === 0 || !containerRef.current) {
      if (ttsHandRef.current) ttsHandRef.current.style.display = 'none'
      return
    }
    const firstIdx = Math.min(...ttsHighlightWordIndices)
    const span = containerRef.current.querySelector(`span[data-word-index="${firstIdx}"]`) as HTMLElement | null
    if (viewMode === 'comic') {
      // No quadrinho o destaque aparece dentro do balão; sem rolagem nem mãozinha.
      if (ttsHandRef.current) ttsHandRef.current.style.display = 'none'
      return
    }
    if (span) {
      // Só rola quando a palavra sai da faixa central da tela; rolar a cada palavra faz a página "pular".
      const r = span.getBoundingClientRect()
      const vh = window.innerHeight
      if (r.top < vh * 0.15 || r.bottom > vh * 0.75) span.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    updateTtsHandPosition()
    const onScroll = () => updateTtsHandPosition()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [ttsHighlightWordIndices, viewMode])

  useEffect(() => {
    if (!ttsHighlightWordIndices?.size) return
    const raf = requestAnimationFrame(updateTtsHandPosition)
    return () => cancelAnimationFrame(raf)
  }, [ttsHighlightWordIndices, currentContent])

  // Acompanha a leitura: enquanto toca, mantém a palavra lida na área visível (rolagem vertical e,
  // na HQ com zoom, também horizontal dentro da página). Pausar, parar ou clicar numa palavra encerra.
  const followWordRef = useRef(0)
  useEffect(() => {
    if (!isPlaying || !ttsHighlightWordIndices?.size) return
    const index = [...ttsHighlightWordIndices][0]
    const el = readerRootRef.current?.querySelector(`span[data-word-index="${index}"]`) as HTMLElement | null
    if (!el) return
    const r = el.getBoundingClientRect()
    const vh = window.innerHeight, vw = window.innerWidth
    // Só reposiciona quando a palavra sai da faixa confortável (evita a tela "tremendo" a cada palavra).
    const viewport = el.closest('.overflow-auto') as HTMLElement | null
    const vr = viewport?.getBoundingClientRect()
    const outV = r.top < vh * 0.22 || r.bottom > vh * 0.72
    const outH = vr ? r.left < vr.left + vr.width * 0.12 || r.right > vr.right - vr.width * 0.12 : r.left < 0 || r.right > vw
    if (!outV && !outH) return
    const now = performance.now()
    if (now - followWordRef.current < 250) return
    followWordRef.current = now
    el.scrollIntoView({ block: outV ? 'center' : 'nearest', inline: outH ? 'center' : 'nearest', behavior: 'smooth' })
  }, [ttsHighlightWordIndices, isPlaying])

  const stopPlayback = () => {
    browserPlaybackCancelledRef.current = true
    playbackRunIdRef.current++
    cancelKokoroPrefetch()
    setTtsHighlightWordIndices(null)
    stopSpeaking()
    setIsLoadingTts(false)
    setIsPlaying(false)
    setIsPaused(false)
  }

  const handleRateChange = (newRate: number) => {
    setPlaybackRate(newRate)
    const word = currentWordRef.current
    if (isPlaying) {
      // Continua da palavra em que estava, já na nova velocidade (não volta ao início).
      stopPlayback()
      startPlaybackRef.current({ startWord: word ?? undefined, rate: newRate })
    } else if (isPaused) {
      stopPlayback()
      resumeFromWordRef.current = word
      if (word != null) setTtsHighlightWordIndices(new Set([word]))
    }
  }

  // Render Post-its
  const renderPostIts = () => {
    return (
      <>
        {/* Hovered Post-it */}
        {hoveredVocabId && !pinnedVocabIds.has(hoveredVocabId) && (
          (() => {
            const vocab = vocabularies.find(v => v.id === hoveredVocabId)
            if (!vocab) return null
            return (
              <div 
                className="post-it-card fixed z-50 max-h-[min(70vh,42rem)] w-[min(90vw,42rem)] overflow-y-auto border shadow-xl rounded-xl p-4 transform -translate-x-1/2 transition-opacity"
                style={{ left: hoverPos.x, top: hoverPos.y, backgroundColor: 'var(--theme-postit-bg)', borderColor: 'var(--theme-postit-border)', color: 'var(--theme-postit-text)' }}
                onMouseEnter={() => {
                  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
                }}
                onMouseLeave={() => setHoveredVocabId(null)}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-start mb-2 gap-2">
                  <span className="font-bold text-base" style={{ color: 'var(--theme-postit-title)' }}>{vocab.text}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); speakVocabText(vocab.text); }} className="hover:text-[var(--theme-accent)] rounded p-1 transition-colors" style={{ color: 'var(--theme-text-secondary)', backgroundColor: 'var(--theme-bg-secondary)' }} title="Play Audio">
                        <Play className="w-4 h-4" />
                      </button>
                    <button onClick={(e) => { e.stopPropagation(); handleEditVocab(vocab.id); }} className="hover:text-[var(--theme-accent)] rounded p-1 transition-colors" style={{ color: 'var(--theme-text-secondary)', backgroundColor: 'var(--theme-bg-secondary)' }} title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteVocabulary(vocab.id); setHoveredVocabId(null); }} className="hover:text-[var(--pastel-rose-fg)] rounded p-1 transition-colors" style={{ color: 'var(--theme-text-secondary)', backgroundColor: 'var(--theme-bg-secondary)' }} title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => togglePin(vocab.id, e)} className="rounded p-1 transition-colors" style={{ color: 'var(--theme-text-secondary)', backgroundColor: 'var(--theme-bg-secondary)' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--theme-text)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--theme-text-secondary)'} title="Pin">
                      <Pin className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {vocab.explanation && (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{mainText(vocab.explanation)}</p>
                  )}
                  {vocab.examples && vocab.examples.length > 0 && (
                    <div className="pt-2 border-t" style={{ borderColor: 'var(--theme-postit-border)' }}>
                      <span className="font-semibold text-[11.5px] block mb-1" style={{ color: 'var(--theme-text-secondary)' }}>Examples</span>
                      <ul className="list-disc pl-4 space-y-1 text-xs opacity-80">
                        {vocab.examples.map((ex, i) => (
                          <li key={i} className="leading-relaxed">{ex}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {vocab.grammarExamples && vocab.grammarExamples.length > 0 && (
                    <div className="space-y-2 border-t pt-2" style={{ borderColor: 'var(--theme-postit-border)' }}>
                      <span className="font-semibold text-[11.5px]" style={{ color: 'var(--theme-text-secondary)' }}>Formas de uso</span>
                      {vocab.grammarExamples.map((example) => (
                        <div key={example.form} className="rounded-lg p-2" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                          <span className="text-[11.5px] font-bold uppercase" style={{ color: 'var(--theme-accent)' }}>
                            {example.form === 'affirmative' ? 'Afirmativa' : example.form === 'negative' ? 'Negativa' : 'Interrogativa'}
                          </span>
                          <p className="mt-1 text-xs font-medium">{example.english}</p>
                          <p className="text-[11px] opacity-75">{example.portuguese}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {vocab.usageNote && (
                    <p className="border-t pt-2 text-xs leading-relaxed" style={{ borderColor: 'var(--theme-postit-border)' }}>
                      <strong>Nota: </strong>{mainText(vocab.usageNote)}
                    </p>
                  )}
                  {vocab.variantStory && (
                    <div className="border-t pt-2" style={{ borderColor: 'var(--theme-postit-border)' }}>
                      <span className="font-semibold text-[11.5px]" style={{ color: 'var(--theme-text-secondary)' }}>História paralela</span>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{mainText(vocab.variantStory)}</p>
                    </div>
                  )}
                  {!vocab.explanation && (!vocab.examples || vocab.examples.length === 0) && (!vocab.grammarExamples || vocab.grammarExamples.length === 0) && !vocab.variantStory && (
                    <p className="text-xs italic" style={{ color: 'var(--theme-text-secondary)' }}>No explanation added. Click the edit icon to add one.</p>
                  )}
                </div>
              </div>
            )
          })()
        )}

        {/* Pinned Post-its Sidebar */}
        {pinnedVocabIds.size > 0 && (
          // No celular os post-its fixados viram um carrossel horizontal acima da barra de ferramentas (sem cobrir o texto).
          <div data-no-swipe-back data-reader-panel className="fixed right-8 top-24 w-80 flex flex-col gap-4 z-40 max-h-[calc(100dvh-8rem)] overflow-y-auto pb-8 pr-2 custom-scrollbar max-md:top-auto max-md:right-0 max-md:left-0 max-md:w-auto max-md:bottom-[calc(var(--safe-b)+5.5rem)] max-md:max-h-[38dvh] max-md:flex-row max-md:snap-row max-md:overflow-y-visible max-md:pb-2 max-md:px-4 max-md:[&>*]:w-[78vw] max-md:[&>*]:shrink-0 max-md:[&>*]:snap-start">
            {Array.from(pinnedVocabIds as Set<string>).map(id => {
              const vocab = vocabularies.find(v => v.id === id)
              if (!vocab) return null
              return (
                <div 
                  key={id}
                  className="border shadow-lg rounded-xl p-4 text-sm animate-in slide-in-from-right-8"
                  style={{ backgroundColor: 'var(--theme-postit-bg)', borderColor: 'var(--theme-postit-border)', color: 'var(--theme-postit-text)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <span className="font-bold text-base" style={{ color: 'var(--theme-postit-title)' }}>{vocab.text}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); speakVocabText(vocab.text); }} className="hover:text-[var(--theme-accent)] rounded p-1 transition-colors" style={{ color: 'var(--theme-text-secondary)', backgroundColor: 'var(--theme-bg-secondary)' }} title="Play Audio">
                        <Play className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleEditVocab(vocab.id); }} className="hover:text-[var(--theme-accent)] rounded p-1 transition-colors" style={{ color: 'var(--theme-text-secondary)', backgroundColor: 'var(--theme-bg-secondary)' }} title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteVocabulary(vocab.id); setPinnedVocabIds(prev => { const next = new Set(prev); next.delete(vocab.id); updateBookAndSync(book.id, { pinnedVocabIds: Array.from(next) }); return next; }); }} className="hover:text-[var(--pastel-rose-fg)] rounded p-1 transition-colors" style={{ color: 'var(--theme-text-secondary)', backgroundColor: 'var(--theme-bg-secondary)' }} title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => togglePin(id, e)} className="rounded p-1 transition-colors" style={{ color: 'var(--theme-text-secondary)', backgroundColor: 'var(--theme-bg-secondary)' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--theme-text)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--theme-text-secondary)'} title="Unpin">
                        <PinOff className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {vocab.explanation && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{mainText(vocab.explanation)}</p>
                    )}
                    {vocab.examples && vocab.examples.length > 0 && (
                      <div className="pt-2 border-t" style={{ borderColor: 'var(--theme-postit-border)' }}>
                        <span className="font-semibold text-[11.5px] block mb-1" style={{ color: 'var(--theme-text-secondary)' }}>Examples</span>
                        <ul className="list-disc pl-4 space-y-1 text-xs opacity-80">
                          {vocab.examples.map((ex, i) => (
                            <li key={i} className="leading-relaxed">{ex}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {vocab.grammarExamples && vocab.grammarExamples.length > 0 && (
                      <div className="space-y-2 border-t pt-2" style={{ borderColor: 'var(--theme-postit-border)' }}>
                        <span className="font-semibold text-[11.5px]" style={{ color: 'var(--theme-text-secondary)' }}>Formas de uso</span>
                        {vocab.grammarExamples.map((example) => (
                          <div key={example.form} className="rounded-lg p-2" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                            <span className="text-[11.5px] font-bold uppercase" style={{ color: 'var(--theme-accent)' }}>
                              {example.form === 'affirmative' ? 'Afirmativa' : example.form === 'negative' ? 'Negativa' : 'Interrogativa'}
                            </span>
                            <p className="mt-1 text-xs font-medium">{example.english}</p>
                            <p className="text-[11px] opacity-75">{example.portuguese}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {vocab.usageNote && (
                      <p className="border-t pt-2 text-xs leading-relaxed" style={{ borderColor: 'var(--theme-postit-border)' }}>
                        <strong>Nota: </strong>{mainText(vocab.usageNote)}
                      </p>
                    )}
                    {vocab.variantStory && (
                      <div className="border-t pt-2" style={{ borderColor: 'var(--theme-postit-border)' }}>
                        <span className="font-semibold text-[11.5px]" style={{ color: 'var(--theme-text-secondary)' }}>História paralela</span>
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{mainText(vocab.variantStory)}</p>
                      </div>
                    )}
                    {!vocab.explanation && (!vocab.examples || vocab.examples.length === 0) && (!vocab.grammarExamples || vocab.grammarExamples.length === 0) && !vocab.variantStory && (
                      <p className="text-xs italic" style={{ color: 'var(--theme-text-secondary)' }}>No explanation added. Click the edit icon to add one.</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </>
    )
  }

  const comicImage = (() => {
    const own = book.comicPages?.[currentPage]
    const shared = book.catalogId && book.imageMode !== 'personal' ? sharedImages[currentPage] : undefined
    const v = book.imageMode === 'personal' ? own : (shared || own)
    return v ? (isComicPageUrl(v) ? v : `data:image/jpeg;base64,${v}`) : null
  })()
  // No modo HQ, página ainda sem quadrinho continua mostrando o texto (com o botão de gerar no topo).
  const showComicPage = viewMode === 'comic' && !!comicImage

  const modeBar = (
            <ToolGroup flat={inHeader} label={locale === 'pt-BR' ? 'Modo de leitura' : 'Reading mode'}>
              <ToolButton icon={<Type className="w-4 h-4" />} label={t('text')} compact active={viewMode === 'text'}
                hint={locale === 'pt-BR' ? 'Ler só o texto' : 'Read the text only'} onClick={() => setViewMode('text')} />
              <ToolButton icon={<ImageIcon className="w-4 h-4" />} label={t('comic')} compact active={viewMode === 'comic'}
                hint={locale === 'pt-BR' ? 'Ler com as ilustrações da página' : 'Read with the page illustrations'} onClick={openComicMode} />
              <ToolDivider />
              <Popover>
                <PopoverTrigger asChild>
                  <ToolButton icon={hiddenMarks.length >= 3 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} active={hiddenMarks.length > 0}
                    hint={locale === 'pt-BR' ? 'Esconder marcações das palavras' : 'Hide word marks'} aria-label={locale === 'pt-BR' ? 'Esconder marcações' : 'Hide marks'} />
                </PopoverTrigger>
                <PopoverContent className="w-60 p-3" align="start" sideOffset={8}>
                  <p className="text-[12.5px] font-medium">{locale === 'pt-BR' ? 'Esconder marcações' : 'Hide marks'}</p>
                  <div className="mt-2 space-y-1">
                    {([['learned', locale === 'pt-BR' ? 'Aprendidas' : 'Learned'], ['review', locale === 'pt-BR' ? 'Em revisão' : 'Review'], ['important', locale === 'pt-BR' ? 'Importantes' : 'Important']] as const).map(([id, label]) => (
                      <label key={id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-[13px] hover:bg-[var(--ui-hover)]">
                        <input type="checkbox" className="size-4 cursor-pointer accent-[var(--theme-primary)]" checked={hiddenMarks.includes(id)}
                          onChange={e => setHiddenMarks(e.target.checked ? [...hiddenMarks, id] : hiddenMarks.filter(m => m !== id))} />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => setHiddenMarks(['learned', 'review', 'important'])} className="h-8 flex-1 rounded-lg border text-[12.5px]" style={{ borderColor: 'var(--theme-border)' }}>{locale === 'pt-BR' ? 'Esconder tudo' : 'Hide all'}</button>
                    <button type="button" onClick={() => setHiddenMarks([])} className="h-8 flex-1 rounded-lg border text-[12.5px]" style={{ borderColor: 'var(--theme-border)' }}>{locale === 'pt-BR' ? 'Mostrar tudo' : 'Show all'}</button>
                  </div>
                  <p className="mt-2 text-[11.5px] leading-snug" style={{ color: 'var(--theme-text-secondary)' }}>{locale === 'pt-BR' ? 'As marcações valem em todos os livros: o que você marca em um aparece nos outros.' : 'Marks work across all books: what you mark in one shows up in the others.'}</p>
                </PopoverContent>
              </Popover>
              {showComicPage && <><ToolDivider /><div ref={setToolbarSlot} className="flex items-center" /></>}
              {viewMode === 'comic' && !comicImage && <>
                <ToolDivider />
                <ToolButton tone="primary" disabled={!!comicStage} onClick={() => { void handleGenerateComic() }}
                  icon={comicStage ? <Loader2 className="w-4 h-4 animate-spin" /> : <WandSparkles className="w-4 h-4" />}
                  label={comicStage
                    ? (locale === 'pt-BR'
                      ? { prepare: 'Preparando a arte…', image: 'Desenhando a página…', layout: 'Encaixando os balões…' }[comicStage]
                      : { prepare: 'Preparing the art…', image: 'Drawing the page…', layout: 'Fitting balloons…' }[comicStage])
                    : (locale === 'pt-BR' ? 'Ilustrar esta página' : 'Illustrate this page')}
                  hint={locale === 'pt-BR' ? 'Desenha esta página como quadrinho, com o texto nos balões. Usa sua chave de IA.' : 'Draws this page as a comic with the text in balloons. Uses your AI key.'} />
              </>}
            </ToolGroup>
  )

  return (
    <div
      ref={readerRootRef}
      className={`reader-root min-h-full transition-colors duration-300 theme-${theme} pb-32`}
    >
      <div className={`${showComicPage ? 'max-w-[1400px]' : 'max-w-[720px]'} mx-auto pt-1 md:pt-2 px-4 md:px-8`}>
        <div className={`mb-5 md:mb-8 flex flex-wrap justify-between items-center gap-3 ${viewMode === 'comic' && !inHeader ? 'sticky z-30 py-2 -mx-2 px-2 rounded-2xl' : ''}`}
          style={viewMode === 'comic' && !inHeader ? { top: 'var(--reader-sticky-top, 76px)', backgroundColor: 'color-mix(in srgb, var(--theme-bg) 85%, transparent)', backdropFilter: 'blur(8px)' } : undefined}>
          {/* Título do livro: no conteúdo, abaixo das barras fixas. */}
          <div className="min-w-0 max-w-full">
            <h1 className="font-semibold tracking-tight mb-0 whitespace-nowrap overflow-hidden text-ellipsis max-w-full" style={{ fontSize: '1.25em', fontFamily: 'var(--font-sans)' }}>
              {book.title}
            </h1>
            <p className="mt-0.5 text-[12.5px] font-medium tabular-nums" style={{ color: 'var(--theme-text-secondary)', fontFamily: 'var(--font-sans)' }}>
              {book.wordCount.toLocaleString(locale)} {t('words')}
            </p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap justify-end ml-auto min-w-0 max-w-full">
            {/* Modo de leitura e, no modo ilustrado, as ferramentas da página: uma barra só. */}
            {inHeader ? createPortal(modeBar, headerSlot!) : modeBar}
            {/* Settings (gear) next to tabs — mobile only */}
            <div className="md:hidden flex items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-full transition-colors hover:bg-[var(--theme-bg-secondary)]"
                    style={{ color: 'var(--theme-text-secondary)', borderColor: 'var(--theme-border-subtle)', border: '1px solid transparent' }}
                    title={t('readingOptions')}
                    aria-label={t('readingOptions')}
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-72 p-4"
                  style={{ backgroundColor: 'var(--theme-nav-bg)', borderColor: 'var(--theme-border-subtle)' }}
                  align="end"
                  sideOffset={8}
                >
                  <div className="space-y-5">
                    <div>
                      <p className="text-[12px] font-medium mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{t('fontSize')}</p>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setFontSize(Math.max(12, fontSize - 1))} className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold transition-colors hover:bg-[var(--ui-hover)] disabled:opacity-40" style={{ color: 'var(--theme-text)' }} disabled={fontSize <= 12}>A-</button>
                        <span className="flex-1 text-center text-sm font-medium tabular-nums" style={{ color: 'var(--theme-text)' }}>{fontSize}</span>
                        <button type="button" onClick={() => setFontSize(Math.min(32, fontSize + 1))} className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold transition-colors hover:bg-[var(--ui-hover)] disabled:opacity-40" style={{ color: 'var(--theme-text)' }} disabled={fontSize >= 32}>A+</button>
                      </div>
                    </div>
                    <div>
                      <p className="text-[12px] font-medium mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{t('lineHeight')}</p>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setLineHeight(Math.max(1.2, Math.round((lineHeight - 0.1) * 10) / 10))} className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-colors hover:bg-[var(--ui-hover)] disabled:opacity-40" style={{ color: 'var(--theme-text)' }} disabled={lineHeight <= 1.2}>−</button>
                        <span className="flex-1 text-center text-sm font-medium tabular-nums" style={{ color: 'var(--theme-text)' }}>{lineHeight}</span>
                        <button type="button" onClick={() => setLineHeight(Math.min(2.4, Math.round((lineHeight + 0.1) * 10) / 10))} className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-colors hover:bg-[var(--ui-hover)] disabled:opacity-40" style={{ color: 'var(--theme-text)' }} disabled={lineHeight >= 2.4}>+</button>
                      </div>
                    </div>
                    <div>
                      <p className="text-[12px] font-medium mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{t('fontType')}</p>
                      <div className="flex gap-2">
                        {(['serif', 'sans'] as const).map((f) => (
                          <button key={f} type="button" onClick={() => setFontFamily(f)} className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${fontFamily === f ? 'ring-2 ring-[var(--theme-primary)]' : ''}`} style={{ backgroundColor: fontFamily === f ? 'var(--theme-primary)' : 'var(--theme-bg-secondary)', color: fontFamily === f ? 'var(--theme-primary-text)' : 'var(--theme-text-secondary)' }}>{f === 'serif' ? t('serif') : t('sansSerif')}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {!showComicPage ? (
          <>
            {viewMode === 'text' && !comicImage && !nudgeHidden && (
              <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-secondary)' }}>
                <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: 'var(--theme-card-bg)' }}><Sparkles className="w-4 h-4" /></span>
                <div className="min-w-0 flex-1 basis-56">
                  <p className="text-[13.5px] font-medium">{locale === 'pt-BR' ? 'Esta página ainda não tem ilustração' : 'This page has no illustration yet'}</p>
                  <p className="text-[12.5px] leading-snug" style={{ color: 'var(--theme-text-secondary)' }}>
                    {book.catalogId && book.imageMode !== 'personal'
                      ? (locale === 'pt-BR' ? 'Seja a primeira pessoa a ilustrar: a imagem fica para todo mundo que ler este livro.' : 'Be the first to illustrate it: the image is shared with everyone who reads this book.')
                      : (locale === 'pt-BR' ? 'Dê vida à história com um quadrinho desta página.' : 'Bring the story to life with a comic of this page.')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { void openComicMode().then(() => handleGenerateComic()) }} className="h-9 px-4 rounded-full text-[13px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{locale === 'pt-BR' ? 'Ilustrar esta página' : 'Illustrate this page'}</button>
                  <button type="button" onClick={() => { try { sessionStorage.setItem(`illustrate-nudge:${book.id}`, '1') } catch { /* sem armazenamento */ } setNudgeHidden(true) }} className="h-9 px-3 rounded-full text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{locale === 'pt-BR' ? 'Agora não' : 'Not now'}</button>
                </div>
              </div>
            )}
            {viewMode === 'comic' && comicError?.page === currentPage && (
              <p role="alert" className="mb-4 text-sm rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>{comicError.message}</p>
            )}
            {/* Troca de página no texto: avançar entra da direita, voltar entra da esquerda. */}
            <motion.article
              key={currentPage}
              ref={containerRef}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: pageDirection * 36 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: reduceMotion ? 0.12 : 0.32, ease: [0.22, 0.8, 0.28, 1] }}
              className={`whitespace-pre-wrap relative ${interactionMode === 'text' ? 'select-text' : 'select-none'}`}
              style={{ fontFamily: readerFontFamily, fontSize: `${fontSize}px`, lineHeight: lineHeight }}
              onClick={handleContentClick}
              onMouseDown={(e) => {
                if (interactionMode !== 'text') return
                const raw = (e.target as HTMLElement).closest?.('span[data-word-index]')?.getAttribute('data-word-index')
                if (raw == null) return
                dragSelect.current = Number(raw)
                dragMoved.current = false
              }}
              onMouseOver={(e) => {
                if (interactionMode === 'hand') {
                  const root = containerRef.current
                  const rawHover = (e.target as HTMLElement).closest?.('span[data-word-index]')?.getAttribute('data-word-index')
                  if (!root || rawHover == null) {
                    root?.querySelectorAll('span.expr-hover').forEach(el => el.classList.remove('expr-hover'))
                    return
                  }
                  const hoverIdx = Number(rawHover)
                  const pageWords = pageWordTokens.map(token => currentContent.slice(token.start, token.end))
                  const hit = findExpression(pageWords, hoverIdx, book.languageCode || 'en')
                  const next = hit && hit.indices.length > 1 ? hit.indices : null
                  root.querySelectorAll('span.expr-hover').forEach(el => el.classList.remove('expr-hover'))
                  next?.forEach(i => root.querySelectorAll(`span[data-word-index="${i}"]`).forEach(el => el.classList.add('expr-hover')))
                  return
                }
                if (dragSelect.current == null || interactionMode !== 'text') return
                const raw = (e.target as HTMLElement).closest?.('span[data-word-index]')?.getAttribute('data-word-index')
                if (raw == null) return
                const idx = Number(raw)
                const start = dragSelect.current
                if (idx === start) return
                dragMoved.current = true
                setSelectedRange(start <= idx ? [start, idx] : [idx, start])
              }}
              onMouseOut={(e) => {
                const next = e.relatedTarget
                if (next instanceof Node && e.currentTarget.contains(next)) return
                containerRef.current?.querySelectorAll('span.expr-hover').forEach(el => el.classList.remove('expr-hover'))
              }}
              onMouseUp={() => { dragSelect.current = null }}
              dangerouslySetInnerHTML={{ __html: contentWithHighlights }}
            />
          </>
        ) : (
          <ComicPageView
            ref={containerRef}
            pageIndex={currentPage}
            imageUrl={comicImage}
            layout={book.comicLayouts?.[currentPage]}
            wordsHtml={buildWordsHtml}
            sourceText={currentContent}
            locale={locale}
            onContentClick={handleContentClick}
            pinMode={interactionMode === 'pin'}
            comicPins={pins.filter(pin => pin.bookId === book.id && pin.page === currentPage && pin.kind === 'comic' && pin.x != null && pin.y != null).map(pin => ({ id: pin.id, x: pin.x!, y: pin.y!, note: pin.note }))}
            onPlacePin={(x, y) => setNoteDraft({ bookId: book.id, page: currentPage, kind: 'comic', x, y, note: '' })}
            onOpenPin={(id) => {
              const pin = pins.find(item => item.id === id)
              if (pin) setNoteDraft(pin)
            }}
            fullscreenTarget={() => readerRootRef.current}
            stage={comicStage}
            error={comicError?.page === currentPage ? comicError.message : undefined}
            onGenerate={() => { void handleGenerateComic() }}
            onDelete={handleDeleteComic}
            onSaveLettering={handleSaveLettering}
            onRelayout={handleRelayoutComic}
            characters={book.comicCharacters ?? []}
            currentChar={(isPlaying || isPaused) && ttsHighlightWordIndices?.size ? pageWordTokens[[...ttsHighlightWordIndices][0]]?.start ?? null : null}
            onPlayLine={(charStart) => {
              const idx = pageWordTokens.findIndex(token => token.end > charStart)
              if (idx >= 0) playFromWord(idx)
            }}
            letteringTheme={letteringThemeFor(book.comicStyleDoc)}
            letteringDetected={detectLetteringTheme(book.comicStyleDoc)}
            toolbarSlot={toolbarSlot}
            letteringChoice={(book.comicStyleDoc?.letteringTheme as LetteringThemeId | undefined) ?? null}
            onLetteringThemeChange={(id) => {
              const { letteringTheme: _previous, ...rest } = book.comicStyleDoc ?? {}
              updateBookAndSync(book.id, { comicStyleDoc: id ? { ...rest, letteringTheme: id } : rest })
            }}
            onPrev={() => { if (currentPage > 0) changePage(-1) }}
            onNext={() => { if (currentPage < pages.length - 1) changePage(1) }}
            labels={{
              generate: locale === 'pt-BR' ? 'Gerar quadrinho desta página' : 'Generate comic for this page',
              regenerate: locale === 'pt-BR' ? 'Regenerar página' : 'Regenerate page',
              delete: locale === 'pt-BR' ? 'Excluir quadrinho' : 'Delete comic',
              fitWidth: locale === 'pt-BR' ? 'Ajustar à largura' : 'Fit width',
              fitPage: locale === 'pt-BR' ? 'Página inteira' : 'Fit page',
              preparingArt: locale === 'pt-BR' ? 'Preparando a direção de arte…' : 'Preparing the art direction…',
              generatingImage: locale === 'pt-BR' ? 'Desenhando a página…' : 'Drawing the page…',
              generatingLayout: locale === 'pt-BR' ? 'Encaixando as legendas nos quadros…' : 'Fitting captions into the panels…',
              empty: locale === 'pt-BR' ? 'Esta página ainda não tem quadrinho. Gere uma versão ilustrada com o texto real nos balões.' : 'This page has no comic yet. Generate an illustrated version with real text in the balloons.',
            }}
          />
        )}

      </div>

      {/* Floating Toolbar — no livro no mobile fica embaixo (BottomNav escondido) */}
      <div data-reader-bar className="fixed left-2 right-2 md:left-[var(--sidebar-w,16rem)] md:right-8 md:bottom-8 z-40 flex flex-col items-center" style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div 
          className="backdrop-blur-md border p-1.5 rounded-2xl shadow-[0_1px_2px_rgba(15,15,15,0.06),0_18px_44px_-14px_rgba(15,15,15,0.38)] flex items-center justify-between md:justify-center gap-0.5 md:gap-1.5 transition-colors w-full flex-nowrap md:w-auto"
          style={{ backgroundColor: 'color-mix(in srgb, var(--theme-card-bg) 92%, transparent)', borderColor: 'var(--theme-border)' }}
        >
          {/* Previous page — à esquerda no mobile; no desktop no fluxo central */}
          <button
            type="button"
            onClick={() => changePage(-1)}
            disabled={currentPage === 0}
            className="flex items-center justify-center w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl transition-colors shrink-0 disabled:opacity-40 hover:bg-[var(--ui-hover)] xl:px-4 xl:w-auto"
            style={{ color: 'var(--theme-nav-text)' }}
            title={t('previousPage')}
            aria-label={t('previousPage')}
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden xl:inline ml-2 text-sm font-medium">
              {t('previousPage')}
            </span>
          </button>

          <div className="flex items-center gap-0.5 md:gap-1 flex-1 justify-center min-w-0">
          <button
            onClick={() => setInteractionMode('hand')}
            className="flex items-center gap-2 px-3 h-10 rounded-xl text-[13.5px] font-medium transition-all min-w-[40px] justify-center shrink-0"
            style={{
              backgroundColor: interactionMode === 'hand' ? 'var(--theme-nav-active)' : 'transparent',
              color: interactionMode === 'hand' ? 'var(--theme-text)' : 'var(--theme-nav-text-muted)'
            }}
            title={t('clickWord')}
            aria-label={t('clickWord')}
          >
            <MousePointer2 className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline">{t('clickWord')}</span>
          </button>
          <button
            onClick={() => setInteractionMode('text')}
            className="flex items-center gap-2 px-3 h-10 rounded-xl text-[13.5px] font-medium transition-all min-w-[40px] justify-center shrink-0"
            style={{
              backgroundColor: interactionMode === 'text' ? 'var(--theme-nav-active)' : 'transparent',
              color: interactionMode === 'text' ? 'var(--theme-text)' : 'var(--theme-nav-text-muted)'
            }}
            title={t('selectText')}
            aria-label={t('selectText')}
          >
            <Type className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline">{t('selectText')}</span>
          </button>
          <button
            onClick={() => { setInteractionMode('pin'); setSelectedRange(null) }}
            className="flex items-center gap-2 px-3 h-10 rounded-xl text-[13.5px] font-medium transition-all min-w-[40px] justify-center shrink-0"
            style={{
              backgroundColor: interactionMode === 'pin' ? 'var(--theme-pastel-3)' : 'transparent',
              color: interactionMode === 'pin' ? 'var(--theme-pastel-text)' : 'var(--theme-nav-text-muted)'
            }}
            title={locale === 'pt-BR' ? 'Cravar uma nota' : 'Pin a note'}
            aria-label={locale === 'pt-BR' ? 'Cravar uma nota' : 'Pin a note'}
          >
            <Pin className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline">{locale === 'pt-BR' ? 'Nota' : 'Note'}</span>
          </button>
          
          <div className="w-px h-6 mx-0.5 md:mx-1 transition-colors shrink-0" style={{ backgroundColor: 'var(--theme-border-subtle)' }}></div>
          
          <button
            onClick={togglePlayback}
            className="flex items-center justify-center w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl transition-colors shrink-0"
            style={{
              backgroundColor: 'var(--theme-primary)',
              color: 'var(--theme-primary-text)'
            }}
            title={isPlaying ? t('pause') : isPaused ? t('listen') : t('listen')}
            aria-label={isPlaying ? t('pause') : isPaused ? t('listen') : t('listen')}
          >
            {isLoadingTts ? <Loader2 className="w-4 h-4 animate-spin" /> : isPlaying ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />}
          </button>
          
          {(isPlaying || isPaused) && (
            <button
              onClick={stopPlayback}
              className="flex items-center justify-center w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl transition-colors hover:bg-[var(--ui-hover)] shrink-0"
              style={{ color: 'var(--theme-nav-text)' }}
              title={t('stop')}
              aria-label={t('stop')}
            >
              <div className="w-3 h-3 bg-current rounded-sm"></div>
            </button>
          )}
          
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="flex items-center justify-center gap-1.5 px-3 h-10 rounded-xl text-[13.5px] font-semibold tabular-nums transition-all hover:bg-[var(--ui-hover)] shrink-0"
                style={{ color: 'var(--theme-nav-text)' }}
                title={t('speedLabel')}
                aria-label={t('speedLabel')}
              >
                {speedNumber(playbackRate)}x
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[220px] p-2 z-50"
              align="center"
              side="top"
              sideOffset={10}
            >
              <p className="px-1.5 pb-1.5 text-[11.5px] font-medium" style={{ color: 'var(--theme-text-secondary)' }}>{t('speedLabel')}</p>
              <div className="grid grid-cols-3 gap-1">
                {PLAYBACK_SPEEDS.map((r) => {
                  const isSelected = Math.abs(playbackRate - r) < 0.01
                  const name = speedName(r, locale === 'pt-BR')
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleRateChange(r)}
                      aria-pressed={isSelected}
                      className="h-12 rounded-lg cursor-pointer transition-colors hover:bg-[var(--ui-hover)]"
                      style={{
                        color: 'var(--theme-text)',
                        backgroundColor: isSelected ? 'var(--theme-nav-active)' : undefined,
                      }}
                    >
                      <span className="block text-[13.5px] font-semibold tabular-nums leading-none">{speedNumber(r)}x</span>
                      <span className="mt-1 block text-[10.5px] leading-none" style={{ color: 'var(--theme-text-secondary)' }}>{name || ' '}</span>
                    </button>
                  )
                })}
              </div>
            </PopoverContent>
          </Popover>

          <div className="hidden md:block w-px h-6 shrink-0" style={{ backgroundColor: 'var(--theme-border)' }} />

          {/* Settings — desktop only; on mobile the gear is next to Text/Comic tabs */}
          <div className="hidden md:block">
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="flex items-center justify-center w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl transition-colors hover:bg-[var(--ui-hover)] shrink-0"
                style={{ color: 'var(--theme-nav-text)' }}
                title={t('readingOptions')}
                aria-label={t('readingOptions')}
              >
                <Settings className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-72 p-4"
              align="center"
              sideOffset={8}
            >
              <div className="space-y-5">
                <div>
                  <p className="text-[12px] font-medium mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{t('fontSize')}</p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setFontSize(Math.max(12, fontSize - 1))}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold transition-colors hover:bg-[var(--ui-hover)] disabled:opacity-40"
                      style={{ color: 'var(--theme-text)' }}
                      disabled={fontSize <= 12}
                    >
                      A-
                    </button>
                    <span className="flex-1 text-center text-sm font-medium tabular-nums" style={{ color: 'var(--theme-text)' }}>{fontSize}</span>
                    <button
                      type="button"
                      onClick={() => setFontSize(Math.min(32, fontSize + 1))}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold transition-colors hover:bg-[var(--ui-hover)] disabled:opacity-40"
                      style={{ color: 'var(--theme-text)' }}
                      disabled={fontSize >= 32}
                    >
                      A+
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-[12px] font-medium mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{t('lineHeight')}</p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setLineHeight(Math.max(1.2, Math.round((lineHeight - 0.1) * 10) / 10))}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-colors hover:bg-[var(--ui-hover)] disabled:opacity-40"
                      style={{ color: 'var(--theme-text)' }}
                      disabled={lineHeight <= 1.2}
                    >
                      −
                    </button>
                    <span className="flex-1 text-center text-sm font-medium tabular-nums" style={{ color: 'var(--theme-text)' }}>{lineHeight}</span>
                    <button
                      type="button"
                      onClick={() => setLineHeight(Math.min(2.4, Math.round((lineHeight + 0.1) * 10) / 10))}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-colors hover:bg-[var(--ui-hover)] disabled:opacity-40"
                      style={{ color: 'var(--theme-text)' }}
                      disabled={lineHeight >= 2.4}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-[12px] font-medium mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{t('fontType')}</p>
                  <div className="flex gap-2">
                    {(['serif', 'sans'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFontFamily(f)}
                        className="flex-1 h-9 px-3 rounded-lg text-[13px] font-medium transition-all border"
                        style={{
                          backgroundColor: fontFamily === f ? 'var(--theme-nav-active)' : 'transparent',
                          borderColor: fontFamily === f ? 'var(--theme-text-secondary)' : 'var(--theme-border)',
                          color: fontFamily === f ? 'var(--theme-text)' : 'var(--theme-text-secondary)',
                          fontFamily: f === 'serif' ? 'var(--font-serif)' : 'var(--font-sans)',
                        }}
                      >
                        {f === 'serif' ? t('serif') : t('sansSerif')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          </div>

          <PageJump page={currentPage} total={pages.length} onGo={goToPage} pt={locale === 'pt-BR'} />

          </div>

          {/* Next page — direita no mobile; no desktop no fluxo central */}
          <button
            type="button"
            onClick={() => changePage(1)}
            disabled={currentPage >= pages.length - 1}
            className="flex items-center justify-center w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl transition-colors shrink-0 disabled:opacity-40 hover:bg-[var(--ui-hover)] xl:px-4 xl:w-auto"
            style={{ color: 'var(--theme-nav-text)' }}
            title={t('nextPage')}
            aria-label={t('nextPage')}
          >
            <span className="hidden xl:inline ml-2 text-sm font-medium">
              {t('nextPage')}
            </span>
            <ChevronRight className="w-5 h-5 ml-1 md:ml-2" />
          </button>
        </div>
      </div>

      {renderPostIts()}

      {selectedText && selectionRect && interactionMode === 'text' && (
        <FloatingAction
          rect={selectionRect}
          pt={locale === 'pt-BR'}
          onSave={() => { setAutoExplain(false); setModalTab('meaning'); handleAddVocab() }}
          onNote={() => setNoteDraft({ bookId: book.id, page: currentPage, kind: 'word', wordIndex: selectedRange?.[0], quote: selectedText, note: '' })}
          onExplain={() => { setAutoExplain(true); setModalTab('meaning'); handleAddVocab() }}
        />
      )}

      <NoteDialog
        open={!!noteDraft}
        draft={noteDraft}
        pt={locale === 'pt-BR'}
        onClose={() => setNoteDraft(null)}
        onDelete={noteDraft?.id ? () => { void deletePin(noteDraft.id!, userId ?? undefined); setNoteDraft(null) } : undefined}
        onSave={(note) => {
          if (!noteDraft) return
          void savePin({ ...noteDraft, note, bookId: book.id, page: currentPage, kind: noteDraft.kind ?? 'word' }, userId ?? undefined)
          setNoteDraft(null)
        }}
      />

      <VocabularyModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setAutoExplain(false)
          setSelectedRange(null)
        }}
        initialText={modalInitialText}
        bookId={book.id}
        vocabId={vocabToEdit}
        autoExplain={autoExplain}
        initialTab={modalTab}
      />


      <WordTooltip
        state={wordTip}
        status={wordTip ? vocabForText(wordTip.text)?.status ?? null : null}
        onStatus={(st) => wordTip && setWordStatus(wordTip.text, st)}
        onExplain={() => wordTip && openWordCard(wordTip.text, 'meaning')}
        onNote={() => wordTip && openWordCard(wordTip.text, 'notes')}
        onImage={() => wordTip && openWordCard(wordTip.text, 'images')}
        speaking={tipSpeaking}
        onSpeak={() => {
          if (!wordTip) return
          setTipSpeaking(true)
          void speak(wordTip.text.trim(), { language: book.languageCode || 'en', context: wordTip.text.trim().split(/\s+/).length <= 3 ? 'word' : 'phrase', rate: 0.9 })
            .then(h => h.done)
            .finally(() => setTipSpeaking(false))
        }}
        burst={scoreBurst}
        labels={locale === 'pt-BR'
          ? { learned: 'Aprendido', review: 'Revisão', important: 'Importante', explain: 'Explicação', note: 'Nota', image: 'Imagem', listen: 'Ouvir a palavra' }
          : { learned: 'Learned', review: 'Review', important: 'Important', explain: 'Explain', note: 'Note', image: 'Image', listen: 'Say this word' }}
      />

      <StylePickerDialog open={!!firstStyle} onOpenChange={open => { if (!open) setFirstStyle(null) }} pt={locale === 'pt-BR'}
        value={book.comicStyleDoc?.styleId} initial={firstStyle?.suggested} busy={styleChange.busy} warn={styleChange.warn}
        notes={firstStyle?.suggested && firstStyle.note ? { [firstStyle.suggested]: firstStyle.note } : undefined}
        title={locale === 'pt-BR' ? 'Escolha o estilo das ilustrações' : 'Choose the illustration style'}
        description={firstStyle?.loading
          ? (locale === 'pt-BR' ? 'Lendo o livro para sugerir um estilo…' : 'Reading the book to suggest a style…')
          : (locale === 'pt-BR' ? 'Todas as páginas deste livro saem neste estilo. Dá para trocar depois em Ajustes do livro → Estilo de arte.' : 'Every page of this book uses this style. You can change it later in Book settings → Art style.')}
        confirmLabel={locale === 'pt-BR' ? 'Usar e ilustrar' : 'Use and illustrate'}
        onPick={styleId => {
          void styleChange.apply(styleId).then(ok => {
            if (!ok) return
            setFirstStyle(null)
            void handleGenerateComic({ styleChosen: true })
          })
        }} />
      <Dialog open={showConnectApi} onOpenChange={setShowConnectApi}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{locale === 'pt-BR' ? 'Conecte sua API' : 'Connect your API'}</DialogTitle>
            <DialogDescription>
              {locale === 'pt-BR'
                ? 'Para gerar quadrinhos, conecte sua própria chave da OpenAI em Configurações. Os custos vão para a sua conta no provedor, e a chave fica guardada cifrada no servidor.'
                : 'To generate comics, connect your own OpenAI key in Settings. Usage is billed to your provider account, and the key is stored encrypted on the server.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setShowConnectApi(false)}>
              {locale === 'pt-BR' ? 'Agora não' : 'Not now'}
            </Button>
            <Button
              className="rounded-xl"
              style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
              onClick={() => { setShowConnectApi(false); navigate('/settings') }}
            >
              {locale === 'pt-BR' ? 'Ir para Configurações' : 'Go to Settings'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
