import React, { useRef, useMemo, useState, useEffect } from 'react'
import { Book, useBookStore } from '@/store/useBookStore'
import { useReaderSettings } from '@/store/useReaderSettings'
import { useVocabularyStore } from '@/store/useVocabularyStore'
import { FloatingAction } from './FloatingAction'
import { VocabularyModal } from '../vocabulary/VocabularyModal'
import { ChevronLeft, ChevronRight, MousePointer2, Type, Pin, PinOff, Pencil, Trash2, Play, Image as ImageIcon, Loader2, Pause, Settings, X, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { playBase64Audio, type PlaybackResult } from '@/lib/audio'
import { generateElevenLabsAudio } from '@/lib/elevenlabs'
import { ELEVENLABS_CONFIG } from '@/lib/elevenlabsConfig'
import {
  generateComicPage,
  generateAudio,
  API_KEY_REQUIRED_MESSAGE,
  enrichComicPromptWithSearch,
  extractComicStyleAndCharacters,
  detectNewCharactersInPageText
} from '@/lib/ai'
import { useEffectiveGeminiKey } from '@/hooks/useEffectiveGeminiKey'
import { useBookSync } from '@/hooks/useBookSync'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { uploadComicPage, getComicPageBase64, compressComicReference, isComicPageUrl } from '@/lib/comicStorage'
import { useLanguage } from '@/store/useLanguage'
import { useTranslations, getGeneratingComicMessage } from '@/lib/i18n'

interface ReaderProps {
  book: Book
}

function buildSpeechQueue(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const queue: string[] = []
  for (const paragraph of paragraphs) {
    const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(Boolean)
    let buffer = ''
    for (const sentence of sentences.length ? sentences : [paragraph]) {
      if (buffer && buffer.length + sentence.length + 1 > ELEVENLABS_CONFIG.maxChunkCharacters) {
        queue.push(buffer)
        buffer = ''
      }
      buffer = buffer ? `${buffer} ${sentence}` : sentence
    }
    if (buffer) queue.push(buffer)
  }
  return queue
}

function ttsLog(...args: unknown[]) {
  if (import.meta.env.DEV) console.debug('[TTS]', ...args)
}

export function Reader({ book }: ReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { locale } = useLanguage()
  const { t } = useTranslations(locale)
  const { theme, fontSize, lineHeight, showHighlights, playbackRate, setPlaybackRate, ttsProvider, fontFamily, setFontSize, setLineHeight, setFontFamily } = useReaderSettings()

  const readerFontFamily = fontFamily === 'sans' ? '"Inter", ui-sans-serif, system-ui, sans-serif' : '"Playfair Display", ui-serif, Georgia, serif'
  const { updateBook } = useBookStore()
  const { updateBookAndSync, updateBookAndSyncAsync } = useBookSync()
  const { session, hasSupabase } = useAuth()
  const userId = session?.user?.id ?? null
  const effectiveGeminiKey = useEffectiveGeminiKey()
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [vocabToEdit, setVocabToEdit] = useState<string | null>(null)
  const [modalInitialText, setModalInitialText] = useState('')
  const [interactionMode, setInteractionMode] = useState<'hand' | 'text'>('hand')
  const [viewMode, setViewMode] = useState<'text' | 'comic'>('text')
  const [isGeneratingComic, setIsGeneratingComic] = useState(false)
  
  // TTS State
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isLoadingGeminiTts, setIsLoadingGeminiTts] = useState(false)
  const [ttsHighlightWordIndices, setTtsHighlightWordIndices] = useState<Set<number> | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const geminiPlaybackStopRef = useRef<(() => void) | null>(null)
  const geminiPlaybackCancelledRef = useRef(false)
  const elevenPlaybackStopRef = useRef<(() => void) | null>(null)
  const elevenPlaybackCancelledRef = useRef(false)
  const speechSessionRef = useRef<{
    generation: number
    controller: AbortController | null
    currentAudio: PlaybackResult | null
    speechQueue: string[]
  }>({ generation: 0, controller: null, currentAudio: null, speechQueue: [] })
  const browserPlaybackCancelledRef = useRef(false)
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

  // Make vocabularies reactive so the component re-renders when a new word is saved
  const vocabularies = useVocabularyStore(state => state.vocabularies).filter(v => v.bookId === book.id)
  const deleteVocabulary = useVocabularyStore(state => state.deleteVocabulary)

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    }
  }, [])
  const pages = book.pages || [book.content]
  const currentPage = book.currentPage || 0
  const currentContent = pages[currentPage] || ''

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
    setVocabToEdit(null)
    setModalInitialText(text)
    setIsModalOpen(true)
  }

  const handleEditVocab = (id: string) => {
    setVocabToEdit(id)
    setIsModalOpen(true)
  }

  const contentWithHighlights = useMemo(() => {
    const escapeMap: Record<string, string> = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }
    const escapeHtml = (str: string) => str.replace(/[&<>"']/g, m => escapeMap[m] || m)
    const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    let segments = [{ text: currentContent, isVocab: false, vocabId: null as string | null, status: null as string | null }]

    if (showHighlights && vocabularies.length > 0) {
      const sortedVocab = [...vocabularies].sort((a, b) => b.text.length - a.text.length)

      sortedVocab.forEach(vocab => {
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
    let wordIndex = 0
    segments.forEach(seg => {
      if (seg.isVocab) {
        const safeText = escapeHtml(seg.text)
        const idx = wordIndex++
        const isSelected = selectedRange && idx >= selectedRange[0] && idx <= selectedRange[1]
        const selectedClass = isSelected ? 'border-b-2 border-[var(--theme-accent)] bg-[var(--theme-accent)]/10' : ''
        const ttsClass = isTtsHighlight(idx) ? 'tts-current' : ''
        finalHtml += `<span data-vocab-id="${seg.vocabId}" data-word-index="${idx}" class="vocab-${seg.status} relative group cursor-pointer ${selectedClass} ${ttsClass}">${safeText}</span>`
      } else {
        // Run regex on unescaped text, then escape the match and the spaces
        let lastIdx = 0;
        const regex = /([\p{L}\p{N}_]+(?:'[\p{L}\p{N}_]+)*)/gu;
        let match;
        while ((match = regex.exec(seg.text)) !== null) {
          if (match.index > lastIdx) {
            finalHtml += escapeHtml(seg.text.substring(lastIdx, match.index));
          }
          const idx = wordIndex++
          const isSelected = selectedRange && idx >= selectedRange[0] && idx <= selectedRange[1]
          const selectedClass = isSelected ? 'border-b-2 border-[var(--theme-accent)] bg-[var(--theme-accent)]/10' : ''
          const ttsClass = isTtsHighlight(idx) ? 'tts-current' : ''
          const hoverClass = interactionMode === 'hand' ? 'hover-word' : 'cursor-pointer hover:bg-[var(--theme-accent)]/10'
          finalHtml += `<span data-word-index="${idx}" class="word-span ${hoverClass} ${selectedClass} ${ttsClass} transition-colors duration-150 rounded-sm">${escapeHtml(match[0])}</span>`
          lastIdx = regex.lastIndex;
        }
        if (lastIdx < seg.text.length) {
          finalHtml += escapeHtml(seg.text.substring(lastIdx));
        }
      }
    })

    return finalHtml
  }, [currentContent, vocabularies, showHighlights, interactionMode, selectedRange, ttsHighlightWordIndices])

  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    
    // Check if clicked on a saved vocabulary FIRST, regardless of interaction mode
    const vocabSpan = target.closest('span[data-vocab-id]')
    if (vocabSpan) {
      const id = vocabSpan.getAttribute('data-vocab-id')
      if (id) {
        handleEditVocab(id)
        return // Stop processing, we handled the click
      }
    }

    // If we are in text mode and didn't click a saved vocab, handle text selection
    if (interactionMode === 'text') {
      const wordSpan = target.closest('span[data-word-index]')
      if (wordSpan) {
        const idx = parseInt(wordSpan.getAttribute('data-word-index') || '-1', 10)
        if (idx >= 0) {
          if (!selectedRange) {
            setSelectedRange([idx, idx])
          } else {
            const [start, end] = selectedRange
            if (idx < start) {
              setSelectedRange([idx, end])
            } else if (idx > end) {
              setSelectedRange([start, idx])
            } else {
              setSelectedRange([idx, idx])
            }
          }
        }
      }
      return
    }

    // If we are in hand mode and didn't click a saved vocab, handle new word selection
    if (interactionMode === 'hand') {
      const wordSpan = target.closest('span[data-word-index]')
      if (wordSpan) {
        const idx = parseInt(wordSpan.getAttribute('data-word-index') || '-1', 10)
        if (idx >= 0) {
          setSelectedRange([idx, idx])
          const text = wordSpan.textContent || ''
          handleAddVocab(text)
        }
      }
    }
  }

  const handleMouseOver = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const vocabSpan = target.closest('span[data-vocab-id]')
    if (vocabSpan) {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
      const id = vocabSpan.getAttribute('data-vocab-id')
      if (id) {
        const rect = vocabSpan.getBoundingClientRect()
        setHoverPos({ x: rect.left + rect.width / 2, y: rect.bottom + 6 })
        setHoveredVocabId(id)
      }
    } else {
      if (!target.closest('.post-it-card')) {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = setTimeout(() => {
          setHoveredVocabId(null)
        }, 250)
      }
    }
  }

  const goToPage = (index: number) => {
    const newPage = Math.max(0, Math.min(pages.length - 1, index))
    if (newPage !== currentPage) {
      const total = book.totalPages && book.totalPages > 0 ? book.totalPages : pages.length
      const progress = total > 0 ? Math.min(100, Math.round((pages.length / total) * 100)) : (pages.length > 0 ? Math.round(((newPage + 1) / pages.length) * 100) : 0)
      updateBookAndSync(book.id, { currentPage: newPage, progress, lastRead: Date.now() })
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

  const playAudio = (base64: string) => {
    playBase64Audio(base64)
  }

  const handleGenerateComic = async (opts?: { regenerate?: boolean }) => {
    const regenerate = opts?.regenerate === true
    try {
      // @ts-ignore
      if (window.aistudio && !await window.aistudio.hasSelectedApiKey()) {
        // @ts-ignore
        await window.aistudio.openSelectKey()
      }
      setIsGeneratingComic(true)

      const bookContextForPrompt = (book.context && book.context.trim()) ? book.context : book.content
      const pageKeys = book.comicPages ? Object.keys(book.comicPages).map(Number).sort((a, b) => a - b) : []
      const firstPageIndex = pageKeys[0] ?? 0
      const firstPageImage = book.comicPages?.[firstPageIndex]
      const prevPageImage = currentPage > 0 ? book.comicPages?.[currentPage - 1] : undefined
      const isFirstPage = !regenerate && pageKeys.length === 0

      let searchContext = ''
      if (!regenerate && isFirstPage) {
        try {
          searchContext = await enrichComicPromptWithSearch(book.title, bookContextForPrompt, currentContent, effectiveGeminiKey)
        } catch (_) {
          // optional: continue without search context
        }
      }

      let comicStyleDoc = book.comicStyleDoc
      let comicCharacters = book.comicCharacters ? [...book.comicCharacters] : []

      if (!regenerate && !isFirstPage) {
        try {
          const newChars = await detectNewCharactersInPageText(currentContent, comicCharacters, effectiveGeminiKey)
          if (newChars.length > 0) {
            comicCharacters = [...comicCharacters, ...newChars.map(c => ({ ...c, firstPage: currentPage }))]
            updateBookAndSync(book.id, { comicCharacters })
          }
        } catch (_) {
          // optional: continue with existing characters
        }
      }

      const refsToConvert: string[] = []
      if (firstPageImage) refsToConvert.push(firstPageImage)
      if (prevPageImage && prevPageImage !== firstPageImage) refsToConvert.push(prevPageImage)
      const referenceImages = await Promise.all(
        refsToConvert.map(async (value) => compressComicReference(await getComicPageBase64(value)))
      )

      const comicImage = await generateComicPage(
        {
          pageText: currentContent,
          bookTitle: book.title,
          bookContext: bookContextForPrompt,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
          referenceImage: referenceImages[0],
          comicStyleDoc,
          comicCharacters: comicCharacters.length > 0 ? comicCharacters : undefined,
          searchContext: searchContext || undefined,
          languageCode: book.languageCode
        },
        undefined,
        undefined,
        effectiveGeminiKey
      )

      if (comicImage) {
        const newComicPages = { ...(book.comicPages || {}) }
        let valueToSave = comicImage
        if (hasSupabase && supabase && userId) {
          try {
            const url = await uploadComicPage(supabase, userId, book.id, currentPage, comicImage)
            valueToSave = url
          } catch (e) {
            console.warn('Comic Storage upload failed, saving base64 in row', e)
          }
        }
        newComicPages[currentPage] = valueToSave
        await updateBookAndSyncAsync(book.id, { comicPages: newComicPages })
        setViewMode('comic')
        // Extração de estilo/personagens em segundo plano; não deve afetar a UX
        if (!regenerate && isFirstPage) {
          extractComicStyleAndCharacters(comicImage, currentContent, effectiveGeminiKey)
            .then((extracted) => {
              if (extracted) {
                updateBookAndSync(book.id, {
                  comicStyleDoc: extracted.styleDoc,
                  comicCharacters: extracted.characters.map(c => ({ ...c, firstPage: currentPage }))
                })
              }
            })
            .catch((e) => console.warn('Comic style extraction failed', e))
        }
      } else {
        alert(API_KEY_REQUIRED_MESSAGE)
      }
    } catch (error) {
      console.error("Failed to generate comic:", error)
      // Só mostra erro se a geração falhou de fato; não mostrar se a imagem já foi salva
      const bookNow = useBookStore.getState().books.find((b) => b.id === book.id)
      const imageWasSaved = bookNow?.comicPages?.[currentPage] != null
      if (!imageWasSaved) {
        alert("Failed to generate comic. Please try again.")
      }
    } finally {
      setIsGeneratingComic(false)
    }
  }

  const handleDeleteComic = () => {
    if (book.comicPages && book.comicPages[currentPage]) {
      const newComicPages = { ...book.comicPages }
      delete newComicPages[currentPage]
      updateBookAndSync(book.id, { comicPages: newComicPages })
      setViewMode('text')
    }
  }

  // TTS Functions
  useEffect(() => {
    synthRef.current = window.speechSynthesis
    
    // Pre-load voices to ensure they are available when requested
    const loadVoices = () => {
      window.speechSynthesis.getVoices()
    }
    loadVoices()
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel()
      }
      cancelSpeechSession()
    }
  }, [])

  const cancelSpeechSession = () => {
    const session = speechSessionRef.current
    session.generation += 1
    session.controller?.abort()
    session.currentAudio?.stop()
    session.controller = null
    session.currentAudio = null
    session.speechQueue = []
  }

  const togglePlayback = () => {
    // A narração padrão usa a voz nativa do navegador.
    const activeTtsProvider = ttsProvider
    const useGemini = activeTtsProvider === 'gemini' && !!effectiveGeminiKey
    const useElevenLabs = activeTtsProvider === 'elevenlabs'

    // Ao iniciar qualquer reprodução, cancela a outra fonte para não ter duas vozes ao mesmo tempo.
    const cancelAllPlayback = () => {
      geminiPlaybackCancelledRef.current = true
      geminiPlaybackStopRef.current?.()
      geminiPlaybackStopRef.current = null
      elevenPlaybackCancelledRef.current = true
      elevenPlaybackStopRef.current?.()
      elevenPlaybackStopRef.current = null
      cancelSpeechSession()
      setIsLoadingGeminiTts(false)
      if (synthRef.current) {
        synthRef.current.cancel()
      }
      browserPlaybackCancelledRef.current = true
    }

    if (isPlaying || isPaused) {
      if (useElevenLabs && speechSessionRef.current.currentAudio) {
        if (isPaused) {
          speechSessionRef.current.currentAudio.resume?.()
          setIsPlaying(true)
          setIsPaused(false)
        } else {
          speechSessionRef.current.currentAudio.pause?.()
          setIsPlaying(false)
          setIsPaused(true)
        }
      } else if (useGemini || useElevenLabs) {
        cancelAllPlayback()
        setIsPlaying(false)
        setIsPaused(false)
      } else if (synthRef.current) {
        if (isPaused) {
          synthRef.current.resume()
          setIsPlaying(true)
          setIsPaused(false)
        } else {
          synthRef.current.pause()
          setIsPaused(true)
          setIsPlaying(false)
        }
      }
      return
    }

    cancelAllPlayback()
    browserPlaybackCancelledRef.current = false
    geminiPlaybackCancelledRef.current = false
    elevenPlaybackCancelledRef.current = false
    const speechSession = speechSessionRef.current
    speechSession.generation += 1
    const speechGeneration = speechSession.generation
    speechSession.controller = new AbortController()
    speechSession.currentAudio = null
    speechSession.speechQueue = []

    if (useGemini) {
      // Gemini TTS: chunk text, generate and play in sequence
      const runGeminiTts = async () => {
        const raw = (currentContent || '').replace(/\s+/g, ' ').trim()
        if (!raw) return
        const sentences = raw.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
        const chunks: string[] = []
        const maxChunk = 400
        let buf = ''
        for (const s of sentences.length ? sentences : [raw]) {
          if (buf.length + s.length + 1 <= maxChunk) {
            buf = buf ? buf + ' ' + s : s
          } else {
            if (buf) chunks.push(buf)
            buf = s.length <= maxChunk ? s : s.slice(0, maxChunk)
          }
        }
        if (buf) chunks.push(buf)
        if (chunks.length === 0) return

        geminiPlaybackCancelledRef.current = false
        setIsPlaying(true)
        setIsLoadingGeminiTts(true)

        for (const chunk of chunks) {
          if (geminiPlaybackCancelledRef.current) break
          const audio = await generateAudio(chunk, effectiveGeminiKey, book.languageCode)
          if (!audio || geminiPlaybackCancelledRef.current) break
          const result = await playBase64Audio(audio)
          if (!result || geminiPlaybackCancelledRef.current) break
          geminiPlaybackStopRef.current = result.stop
          if (result.whenEnded) await result.whenEnded
        }

        geminiPlaybackStopRef.current = null
        setIsLoadingGeminiTts(false)
        setIsPlaying(false)
        setIsPaused(false)
      }
      runGeminiTts()
      return
    }

    if (useElevenLabs) {
      const runElevenLabsTts = async () => {
        const raw = (currentContent || '').replace(/\s+/g, ' ').trim()
        if (!raw) return
        const chunks = buildSpeechQueue(raw)
        speechSession.speechQueue = [...chunks]
        setIsPlaying(true)
        setIsLoadingGeminiTts(true)
        let nextAudioPromise: Promise<PlaybackResult | null> | null = null
        for (let index = 0; index < speechSession.speechQueue.length; index++) {
          const chunk = speechSession.speechQueue[index]
          if (speechSession.generation !== speechGeneration || speechSession.controller?.signal.aborted) break
          ttsLog(`chunk ${index + 1} generating`)
          const result = nextAudioPromise
            ? await nextAudioPromise
            : await generateElevenLabsAudio(chunk, undefined, playbackRate, speechSession.controller?.signal)
          if (!result || speechSession.generation !== speechGeneration || speechSession.controller?.signal.aborted) break
          ttsLog(`chunk ${index + 1} ready`)
          speechSession.currentAudio = result
          elevenPlaybackStopRef.current = result.stop
          await result.play?.()
          ttsLog(`chunk ${index + 1} playing`)
          const nextChunk = speechSession.speechQueue[index + 1]
          nextAudioPromise = nextChunk
            ? generateElevenLabsAudio(nextChunk, undefined, playbackRate, speechSession.controller?.signal)
            : null
          if (result.whenEnded) await result.whenEnded
          speechSession.currentAudio = null
          ttsLog(`chunk ${index + 1} ended`)
        }
        if (speechSession.generation !== speechGeneration) return
        speechSession.controller = null
        speechSession.speechQueue = []
        elevenPlaybackStopRef.current = null
        setIsLoadingGeminiTts(false)
        setIsPlaying(false)
        setIsPaused(false)
      }
      runElevenLabsTts().catch((error) => {
        if (speechSession.controller?.signal.aborted) return
        console.error('ElevenLabs TTS failed:', error)
        setIsLoadingGeminiTts(false)
        setIsPlaying(false)
      })
      return
    }

    // Browser SpeechSynthesis: uma única voz (feminina quando disponível)
    if (!synthRef.current) return
    synthRef.current.cancel()
    const normalized = (currentContent || '').replace(/\s+/g, ' ').trim()
    const rate = playbackRate
    const isVerySlow = rate <= 0.3 // 0.3x: palavra a palavra, 0.4, 480ms
    const useWords = rate <= 0.8 // 0.3, 0.5, 0.8 por palavra; 1.0 por frase (normal)
    // 1.0x mais lento, com pausas praticamente inexistentes
    const effectiveRate =
      rate <= 0.3 ? 0.4
      : rate >= 1.0 ? 0.7
      : 0.4 + (rate - 0.3) * (0.3 / 0.7) // 0.3→0.4, 0.8→~0.7
    const effectivePauseMs =
      rate <= 0.3 ? 480
      : rate >= 1.0 ? 60 // pausa quase imperceptível em 1.0x
      : Math.round(480 - (rate - 0.3) * (360 / 0.7)) // interpola até perto de ~120ms

    const words = normalized ? normalized.split(/\s+/).filter(Boolean) : []
    const chunks: string[] = useWords
      ? words
      : (() => {
          const segments = normalized ? normalized.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean) : []
          return segments.length > 0 ? segments : [normalized || '']
        })()

    const phraseWordRanges: [number, number][] = useWords
      ? []
      : (() => {
          let wi = 0
          return chunks.map((phrase) => {
            const n = phrase.split(/\s+/).filter(Boolean).length
            const start = wi
            wi += n
            return [start, wi] as [number, number]
          })
        })()

    const voices = synthRef.current.getVoices()
    const enUS = voices.filter((v) => v.lang === 'en-US')
    const enOther = voices.filter((v) => v.lang.startsWith('en') && v.lang !== 'en-US')
    const pool = enUS.length > 0 ? enUS : enOther
    const preferredVoice =
      pool.length > 0
        ? pool.find((v) => /Google US English(?!\s*Male)|Samantha|Zira|Karen/i.test(v.name)) ||
          pool.find((v) => /Female|woman|Natural|Premium/i.test(v.name)) ||
          pool[0]
        : undefined

    const PAUSE_MS = effectivePauseMs
    const totalPages = pages.length

    browserPlaybackCancelledRef.current = false
    let index = 0
    const speakNext = () => {
      if (browserPlaybackCancelledRef.current) {
        setTtsHighlightWordIndices(null)
        setIsPlaying(false)
        setIsPaused(false)
        return
      }
      if (index >= chunks.length || !synthRef.current) {
        setTtsHighlightWordIndices(null)
        setIsPlaying(false)
        setIsPaused(false)
        if (currentPage < totalPages - 1) {
          changePage(1)
          autoPlayNextPageRef.current = true
        }
        return
      }
      const text = chunks[index]
      if (!text) {
        index++
        speakNext()
        return
      }
      if (useWords) {
        setTtsHighlightWordIndices(new Set([index]))
      } else {
        const [start, end] = phraseWordRanges[index] ?? [0, 0]
        setTtsHighlightWordIndices(new Set(Array.from({ length: end - start }, (_, i) => start + i)))
      }
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-US'
      utterance.rate = effectiveRate
      utterance.pitch = 1
      if (preferredVoice) utterance.voice = preferredVoice

      utterance.onend = () => {
        if (browserPlaybackCancelledRef.current) return
        index++
        if (index >= chunks.length) {
          setTtsHighlightWordIndices(null)
          setIsPlaying(false)
          setIsPaused(false)
          if (currentPage < totalPages - 1) {
            changePage(1)
            autoPlayNextPageRef.current = true
          }
          return
        }
        setTimeout(speakNext, PAUSE_MS)
      }
      utterance.onerror = () => {
        setTtsHighlightWordIndices(null)
        setIsPlaying(false)
        setIsPaused(false)
      }

      utteranceRef.current = utterance
      synthRef.current.speak(utterance)
    }

    setIsPlaying(true)
    setIsPaused(false)
    speakNext()
  }
  togglePlaybackRef.current = togglePlayback

  useEffect(() => {
    if (autoPlayNextPageRef.current && containerRef.current) {
      autoPlayNextPageRef.current = false
      requestAnimationFrame(() => {
        togglePlaybackRef.current?.()
      })
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
    if (span) {
      span.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    updateTtsHandPosition()
    const onScroll = () => updateTtsHandPosition()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [ttsHighlightWordIndices])

  useEffect(() => {
    if (!ttsHighlightWordIndices?.size) return
    const raf = requestAnimationFrame(updateTtsHandPosition)
    return () => cancelAnimationFrame(raf)
  }, [ttsHighlightWordIndices, currentContent])

  const stopPlayback = () => {
    cancelSpeechSession()
    geminiPlaybackCancelledRef.current = true
    browserPlaybackCancelledRef.current = true
    geminiPlaybackStopRef.current?.()
    geminiPlaybackStopRef.current = null
    setIsLoadingGeminiTts(false)
    setTtsHighlightWordIndices(null)
    if (synthRef.current) {
      synthRef.current.cancel()
    }
    setIsPlaying(false)
    setIsPaused(false)
  }

  const handleRateChange = (newRate: number) => {
    setPlaybackRate(newRate)
    
    if (isPlaying || isPaused) {
      stopPlayback()
      setTimeout(() => {
        togglePlaybackRef.current?.()
      }, 50)
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
                    {vocab.audioData && (
                      <button onClick={(e) => { e.stopPropagation(); playAudio(vocab.audioData!); }} className="hover:text-[var(--theme-accent)] rounded p-1 transition-colors" style={{ color: 'var(--theme-text-secondary)', backgroundColor: 'var(--theme-bg-secondary)' }} title="Play Audio">
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleEditVocab(vocab.id); }} className="hover:text-[var(--theme-accent)] rounded p-1 transition-colors" style={{ color: 'var(--theme-text-secondary)', backgroundColor: 'var(--theme-bg-secondary)' }} title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteVocabulary(vocab.id); setHoveredVocabId(null); }} className="hover:text-red-500 rounded p-1 transition-colors" style={{ color: 'var(--theme-text-secondary)', backgroundColor: 'var(--theme-bg-secondary)' }} title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => togglePin(vocab.id, e)} className="rounded p-1 transition-colors" style={{ color: 'var(--theme-text-secondary)', backgroundColor: 'var(--theme-bg-secondary)' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--theme-text)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--theme-text-secondary)'} title="Pin">
                      <Pin className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {vocab.explanation && (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{vocab.explanation}</p>
                  )}
                  {vocab.examples && vocab.examples.length > 0 && (
                    <div className="pt-2 border-t" style={{ borderColor: 'var(--theme-postit-border)' }}>
                      <span className="font-semibold text-[10px] uppercase tracking-wider block mb-1" style={{ color: 'var(--theme-text-secondary)' }}>Examples</span>
                      <ul className="list-disc pl-4 space-y-1 text-xs opacity-80">
                        {vocab.examples.map((ex, i) => (
                          <li key={i} className="leading-relaxed">{ex}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {vocab.grammarExamples && vocab.grammarExamples.length > 0 && (
                    <div className="space-y-2 border-t pt-2" style={{ borderColor: 'var(--theme-postit-border)' }}>
                      <span className="font-semibold text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-secondary)' }}>Formas de uso</span>
                      {vocab.grammarExamples.map((example) => (
                        <div key={example.form} className="rounded-lg p-2" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                          <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--theme-accent)' }}>
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
                      <strong>Nota: </strong>{vocab.usageNote}
                    </p>
                  )}
                  {vocab.variantStory && (
                    <div className="border-t pt-2" style={{ borderColor: 'var(--theme-postit-border)' }}>
                      <span className="font-semibold text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-secondary)' }}>História paralela</span>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{vocab.variantStory}</p>
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
          <div className="fixed right-8 top-24 w-80 flex flex-col gap-4 z-40 max-h-[calc(100vh-8rem)] overflow-y-auto pb-8 pr-2 custom-scrollbar">
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
                      {vocab.audioData && (
                        <button onClick={(e) => { e.stopPropagation(); playAudio(vocab.audioData!); }} className="hover:text-[var(--theme-accent)] rounded p-1 transition-colors" style={{ color: 'var(--theme-text-secondary)', backgroundColor: 'var(--theme-bg-secondary)' }} title="Play Audio">
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); handleEditVocab(vocab.id); }} className="hover:text-[var(--theme-accent)] rounded p-1 transition-colors" style={{ color: 'var(--theme-text-secondary)', backgroundColor: 'var(--theme-bg-secondary)' }} title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteVocabulary(vocab.id); setPinnedVocabIds(prev => { const next = new Set(prev); next.delete(vocab.id); updateBookAndSync(book.id, { pinnedVocabIds: Array.from(next) }); return next; }); }} className="hover:text-red-500 rounded p-1 transition-colors" style={{ color: 'var(--theme-text-secondary)', backgroundColor: 'var(--theme-bg-secondary)' }} title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => togglePin(id, e)} className="rounded p-1 transition-colors" style={{ color: 'var(--theme-text-secondary)', backgroundColor: 'var(--theme-bg-secondary)' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--theme-text)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--theme-text-secondary)'} title="Unpin">
                        <PinOff className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {vocab.explanation && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{vocab.explanation}</p>
                    )}
                    {vocab.examples && vocab.examples.length > 0 && (
                      <div className="pt-2 border-t" style={{ borderColor: 'var(--theme-postit-border)' }}>
                        <span className="font-semibold text-[10px] uppercase tracking-wider block mb-1" style={{ color: 'var(--theme-text-secondary)' }}>Examples</span>
                        <ul className="list-disc pl-4 space-y-1 text-xs opacity-80">
                          {vocab.examples.map((ex, i) => (
                            <li key={i} className="leading-relaxed">{ex}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {vocab.grammarExamples && vocab.grammarExamples.length > 0 && (
                      <div className="space-y-2 border-t pt-2" style={{ borderColor: 'var(--theme-postit-border)' }}>
                        <span className="font-semibold text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-secondary)' }}>Formas de uso</span>
                        {vocab.grammarExamples.map((example) => (
                          <div key={example.form} className="rounded-lg p-2" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                            <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--theme-accent)' }}>
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
                        <strong>Nota: </strong>{vocab.usageNote}
                      </p>
                    )}
                    {vocab.variantStory && (
                      <div className="border-t pt-2" style={{ borderColor: 'var(--theme-postit-border)' }}>
                        <span className="font-semibold text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-text-secondary)' }}>História paralela</span>
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{vocab.variantStory}</p>
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

  return (
    <div 
      className={`min-h-full transition-colors duration-300 theme-${theme} pb-32`}
    >
      <div className="max-w-[720px] mx-auto pt-6 md:pt-10 px-4 md:px-8">
        <div className="mb-10 md:mb-16 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <h1 className="font-semibold tracking-tight mb-0" style={{ fontSize: '1.25em', fontFamily: 'var(--font-sans)' }}>
            {book.title}
          </h1>
          
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* View Mode Tabs */}
            <div className="flex flex-nowrap p-1 rounded-full border transition-colors" style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-subtle)' }}>
              <button
                onClick={() => setViewMode('text')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all min-h-[44px]"
                style={{
                  backgroundColor: viewMode === 'text' ? 'var(--theme-bg)' : 'transparent',
                  color: viewMode === 'text' ? 'var(--theme-text)' : 'var(--theme-text-secondary)',
                  boxShadow: viewMode === 'text' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                <Type className="w-4 h-4 shrink-0" />
                {t('text')}
              </button>
              <button
                onClick={() => setViewMode('comic')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all min-h-[44px]"
                style={{
                  backgroundColor: viewMode === 'comic' ? 'var(--theme-bg)' : 'transparent',
                  color: viewMode === 'comic' ? 'var(--theme-text)' : 'var(--theme-text-secondary)',
                  boxShadow: viewMode === 'comic' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                <ImageIcon className="w-4 h-4 shrink-0" />
                {t('comic')}
              </button>
            </div>
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
                  className="w-72 p-4 rounded-2xl shadow-2xl border backdrop-blur-md"
                  style={{ backgroundColor: 'var(--theme-nav-bg)', borderColor: 'var(--theme-border-subtle)' }}
                  align="end"
                  sideOffset={8}
                >
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{t('fontSize')}</p>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setFontSize(Math.max(12, fontSize - 1))} className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold transition-colors hover:bg-[var(--theme-nav-hover)] disabled:opacity-40" style={{ color: 'var(--theme-text)' }} disabled={fontSize <= 12}>A-</button>
                        <span className="flex-1 text-center text-sm font-medium tabular-nums" style={{ color: 'var(--theme-text)' }}>{fontSize}</span>
                        <button type="button" onClick={() => setFontSize(Math.min(32, fontSize + 1))} className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold transition-colors hover:bg-[var(--theme-nav-hover)] disabled:opacity-40" style={{ color: 'var(--theme-text)' }} disabled={fontSize >= 32}>A+</button>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{t('lineHeight')}</p>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setLineHeight(Math.max(1.2, Math.round((lineHeight - 0.1) * 10) / 10))} className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-colors hover:bg-[var(--theme-nav-hover)] disabled:opacity-40" style={{ color: 'var(--theme-text)' }} disabled={lineHeight <= 1.2}>−</button>
                        <span className="flex-1 text-center text-sm font-medium tabular-nums" style={{ color: 'var(--theme-text)' }}>{lineHeight}</span>
                        <button type="button" onClick={() => setLineHeight(Math.min(2.4, Math.round((lineHeight + 0.1) * 10) / 10))} className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-colors hover:bg-[var(--theme-nav-hover)] disabled:opacity-40" style={{ color: 'var(--theme-text)' }} disabled={lineHeight >= 2.4}>+</button>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{t('fontType')}</p>
                      <div className="flex gap-2">
                        {(['serif', 'sans'] as const).map((f) => (
                          <button key={f} type="button" onClick={() => setFontFamily(f)} className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${fontFamily === f ? 'ring-2' : ''}`} style={{ backgroundColor: fontFamily === f ? 'var(--theme-primary)' : 'var(--theme-bg-secondary)', color: fontFamily === f ? 'var(--theme-primary-text)' : 'var(--theme-text-secondary)', ringColor: 'var(--theme-primary)' }}>{f === 'serif' ? t('serif') : t('sansSerif')}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {viewMode === 'text' ? (
          <>
            <article 
              ref={containerRef}
              className={`whitespace-pre-wrap relative ${interactionMode === 'text' ? 'select-text' : 'select-none'}`}
              style={{ fontFamily: readerFontFamily, fontSize: `${fontSize}px`, lineHeight: lineHeight }}
              onClick={handleContentClick}
              onMouseOver={handleMouseOver}
              dangerouslySetInnerHTML={{ __html: contentWithHighlights }}
            />
            <div
              ref={ttsHandRef}
              className="tts-hand fixed z-50 pointer-events-none transition-all duration-150"
              style={{ display: 'none' }}
              aria-hidden
            >
              <MousePointer2 className="w-5 h-5" style={{ color: 'var(--theme-tts-hand)' }} strokeWidth={2.5} />
            </div>
          </>
        ) : null}

      </div>

      {/* Floating Toolbar — no livro no mobile fica embaixo (BottomNav escondido) */}
      <div className="fixed bottom-4 left-2 right-2 md:left-64 md:right-8 md:bottom-8 z-40 flex flex-col items-center">
        <div 
          className="backdrop-blur-md border p-2.5 rounded-full shadow-2xl flex items-center justify-between md:justify-center gap-1 md:gap-1.5 transition-colors w-full flex-nowrap md:w-auto"
          style={{ backgroundColor: 'var(--theme-nav-bg)', borderColor: 'var(--theme-border-subtle)' }}
        >
          {/* Previous page — à esquerda no mobile; no desktop no fluxo central */}
          <button
            type="button"
            onClick={() => changePage(-1)}
            disabled={currentPage === 0}
            className="flex items-center justify-center w-12 h-12 min-w-[48px] min-h-[48px] rounded-full transition-colors shrink-0 disabled:opacity-40 hover:bg-[var(--theme-nav-hover)] md:px-4 md:w-auto"
            style={{ color: 'var(--theme-nav-text)' }}
            title={t('previousPage')}
            aria-label={t('previousPage')}
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden md:inline ml-2 text-sm font-medium">
              {t('previousPage')}
            </span>
          </button>

          <div className="flex items-center gap-0.5 md:gap-1 flex-1 justify-center min-w-0">
          <button
            onClick={() => setInteractionMode('hand')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all min-h-[44px] shrink-0"
            style={{
              backgroundColor: interactionMode === 'hand' ? 'var(--theme-primary)' : 'transparent',
              color: interactionMode === 'hand' ? 'var(--theme-primary-text)' : 'var(--theme-nav-text-muted)'
            }}
            title={t('clickWord')}
            aria-label={t('clickWord')}
          >
            <MousePointer2 className="w-4 h-4 shrink-0" />
            <span className="md:hidden">{t('clickShort')}</span>
            <span className="hidden md:inline">{t('clickWord')}</span>
          </button>
          <button
            onClick={() => setInteractionMode('text')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all min-h-[44px] shrink-0"
            style={{
              backgroundColor: interactionMode === 'text' ? 'var(--theme-primary)' : 'transparent',
              color: interactionMode === 'text' ? 'var(--theme-primary-text)' : 'var(--theme-nav-text-muted)'
            }}
            title={t('selectText')}
            aria-label={t('selectText')}
          >
            <Type className="w-4 h-4 shrink-0" />
            <span className="md:hidden">{t('selectShort')}</span>
            <span className="hidden md:inline">{t('selectText')}</span>
          </button>
          
          <div className="w-px h-6 mx-0.5 md:mx-1 transition-colors shrink-0" style={{ backgroundColor: 'var(--theme-border-subtle)' }}></div>
          
          <button
            onClick={togglePlayback}
            disabled={isLoadingGeminiTts}
            className="flex items-center justify-center w-12 h-12 min-w-[48px] min-h-[48px] rounded-full transition-colors shrink-0"
            style={{
              backgroundColor: isPlaying || isPaused || isLoadingGeminiTts ? 'var(--theme-primary)' : 'transparent',
              color: isPlaying || isPaused || isLoadingGeminiTts ? 'var(--theme-primary-text)' : 'var(--theme-nav-text)'
            }}
            title={isLoadingGeminiTts ? t('generating') : isPlaying ? t('pause') : isPaused ? t('listen') : t('listen')}
            aria-label={isLoadingGeminiTts ? t('generating') : isPlaying ? t('pause') : isPaused ? t('listen') : t('listen')}
          >
            {isLoadingGeminiTts ? <Loader2 className="w-4 h-4 animate-spin" /> : isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          
          {(isPlaying || isPaused || isLoadingGeminiTts) && (
            <button
              onClick={stopPlayback}
              className="flex items-center justify-center w-12 h-12 min-w-[48px] min-h-[48px] rounded-full transition-colors hover:bg-[var(--theme-nav-hover)] shrink-0"
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
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-bold transition-all hover:bg-[var(--theme-nav-hover)] min-h-[44px] shrink-0"
                style={{ color: 'var(--theme-nav-text)' }}
                title={t('speedLabel')}
                aria-label={t('speedLabel')}
              >
                {playbackRate.toFixed(1)}x
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-40 p-1.5 rounded-2xl shadow-2xl border backdrop-blur-md z-50"
              style={{ backgroundColor: 'var(--theme-nav-bg)', borderColor: 'var(--theme-border-subtle)' }}
              align="center"
              sideOffset={8}
            >
              <div className="flex flex-col gap-0.5">
                {[0.75, 1.0, 1.25, 1.5].map((r) => {
                  const isSelected = Math.abs(playbackRate - r) < 0.01
                  return (
                    <button
                      key={r}
                      onClick={() => handleRateChange(r)}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${!isSelected ? 'hover:bg-black/5 dark:hover:bg-white/5' : ''}`}
                      style={{
                        color: isSelected ? 'rgba(0, 0, 0, 0.9)' : 'var(--theme-text)',
                        backgroundColor: isSelected ? 'var(--theme-pastel-2)' : undefined
                      }}
                    >
                      {r === 0.3 && t('speedVerySlow')}
                      {r === 0.5 && t('speedSlowComfortable')}
                      {r === 0.8 && t('speedSlow')}
                      {r === 1.0 && t('speedNormal')}
                    </button>
                  )
                })}
              </div>
            </PopoverContent>
          </Popover>

          <div className="w-px h-6 rounded-full opacity-50 shrink-0" style={{ backgroundColor: 'var(--theme-nav-text-muted)' }} />

          {/* Settings — desktop only; on mobile the gear is next to Text/Comic tabs */}
          <div className="hidden md:block">
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="flex items-center justify-center w-12 h-12 min-w-[48px] min-h-[48px] rounded-full transition-colors hover:bg-[var(--theme-nav-hover)] shrink-0"
                style={{ color: 'var(--theme-nav-text)' }}
                title={t('readingOptions')}
                aria-label={t('readingOptions')}
              >
                <Settings className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-72 p-4 rounded-2xl shadow-2xl border backdrop-blur-md"
              style={{ backgroundColor: 'var(--theme-nav-bg)', borderColor: 'var(--theme-border-subtle)' }}
              align="center"
              sideOffset={8}
            >
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{t('fontSize')}</p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setFontSize(Math.max(12, fontSize - 1))}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold transition-colors hover:bg-[var(--theme-nav-hover)] disabled:opacity-40"
                      style={{ color: 'var(--theme-text)' }}
                      disabled={fontSize <= 12}
                    >
                      A-
                    </button>
                    <span className="flex-1 text-center text-sm font-medium tabular-nums" style={{ color: 'var(--theme-text)' }}>{fontSize}</span>
                    <button
                      type="button"
                      onClick={() => setFontSize(Math.min(32, fontSize + 1))}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold transition-colors hover:bg-[var(--theme-nav-hover)] disabled:opacity-40"
                      style={{ color: 'var(--theme-text)' }}
                      disabled={fontSize >= 32}
                    >
                      A+
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{t('lineHeight')}</p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setLineHeight(Math.max(1.2, Math.round((lineHeight - 0.1) * 10) / 10))}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-colors hover:bg-[var(--theme-nav-hover)] disabled:opacity-40"
                      style={{ color: 'var(--theme-text)' }}
                      disabled={lineHeight <= 1.2}
                    >
                      −
                    </button>
                    <span className="flex-1 text-center text-sm font-medium tabular-nums" style={{ color: 'var(--theme-text)' }}>{lineHeight}</span>
                    <button
                      type="button"
                      onClick={() => setLineHeight(Math.min(2.4, Math.round((lineHeight + 0.1) * 10) / 10))}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-colors hover:bg-[var(--theme-nav-hover)] disabled:opacity-40"
                      style={{ color: 'var(--theme-text)' }}
                      disabled={lineHeight >= 2.4}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--theme-text-secondary)' }}>{t('fontType')}</p>
                  <div className="flex gap-2">
                    {(['serif', 'sans'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFontFamily(f)}
                        className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                          fontFamily === f ? 'ring-2' : ''
                        }`}
                        style={{
                          backgroundColor: fontFamily === f ? 'var(--theme-primary)' : 'var(--theme-bg-secondary)',
                          color: fontFamily === f ? 'var(--theme-primary-text)' : 'var(--theme-text-secondary)',
                          ringColor: 'var(--theme-primary)'
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

          {/* Contador de página — desktop only, após Settings */}
          <span className="hidden md:flex items-center text-sm font-medium tabular-nums shrink-0 px-2" style={{ color: 'var(--theme-nav-text-muted)' }}>
            {currentPage + 1} / {pages.length}
          </span>

          </div>

          {/* Next page — direita no mobile; no desktop no fluxo central */}
          <button
            type="button"
            onClick={() => changePage(1)}
            disabled={currentPage >= pages.length - 1}
            className="flex items-center justify-center w-12 h-12 min-w-[48px] min-h-[48px] rounded-full transition-colors shrink-0 disabled:opacity-40 hover:bg-[var(--theme-nav-hover)] md:px-4 md:w-auto"
            style={{ color: 'var(--theme-nav-text)' }}
            title={t('nextPage')}
            aria-label={t('nextPage')}
          >
            <span className="hidden md:inline ml-2 text-sm font-medium">
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
          onAdd={() => handleAddVocab()} 
        />
      )}

      <VocabularyModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedRange(null)
        }}
        initialText={modalInitialText}
        bookId={book.id}
        vocabId={vocabToEdit}
      />

      {viewMode === 'comic' && (
        <ComicReader
          book={book}
          pages={pages}
          currentPage={currentPage}
          goToPage={goToPage}
          onExit={() => setViewMode('text')}
          onGenerateComic={handleGenerateComic}
          onDeleteComic={handleDeleteComic}
          isGeneratingComic={isGeneratingComic}
          t={t}
          onTogglePlayback={togglePlayback}
          onStopPlayback={stopPlayback}
          isPlaying={isPlaying}
          isPaused={isPaused}
          isLoadingTts={isLoadingGeminiTts}
          playbackRate={playbackRate}
          onChangeRate={handleRateChange}
        />
      )}
    </div>
  )
}

interface ComicReaderProps {
  book: Book
  pages: string[]
  currentPage: number
  goToPage: (index: number) => void
  onExit: () => void
  onGenerateComic: (opts?: { regenerate?: boolean }) => void
  onDeleteComic: () => void
  isGeneratingComic: boolean
  t: (key: any) => string
  onTogglePlayback: () => void
  onStopPlayback: () => void
  isPlaying: boolean
  isPaused: boolean
  isLoadingTts: boolean
  playbackRate: number
  onChangeRate: (rate: number) => void
}

function ComicReader({
  book,
  pages,
  currentPage,
  goToPage,
  onExit,
  onGenerateComic,
  onDeleteComic,
  isGeneratingComic,
  t,
  onTogglePlayback,
  onStopPlayback,
  isPlaying,
  isPaused,
  isLoadingTts,
  playbackRate,
  onChangeRate
}: ComicReaderProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [uiVisible, setUiVisible] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const isSwipingRef = useRef(false)
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null)
  const hideUiTimeoutRef = useRef<number | null>(null)

  const showUiTemporarily = () => {
    setUiVisible(true)
    if (hideUiTimeoutRef.current) {
      window.clearTimeout(hideUiTimeoutRef.current)
    }
    hideUiTimeoutRef.current = window.setTimeout(() => {
      setUiVisible(false)
    }, 2500)
  }

  useEffect(() => {
    showUiTemporarily()
    return () => {
      if (hideUiTimeoutRef.current) {
        window.clearTimeout(hideUiTimeoutRef.current)
      }
    }
  }, [])

  // Keyboard navigation and fullscreen toggle
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goToPage(currentPage + 1)
        showUiTemporarily()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPage(currentPage - 1)
        showUiTemporarily()
      } else if (e.key === 'Escape') {
        onExit()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [currentPage, goToPage, onExit])

  const handleTapOrClick = (clientX: number, clientY: number) => {
    const width = window.innerWidth
    const zone = clientX / width

    if (zone < 0.25) {
      goToPage(currentPage - 1)
    } else if (zone > 0.75) {
      goToPage(currentPage + 1)
    } else {
      showUiTemporarily()
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return
    setIsPanning(true)
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX,
      offsetY
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !panStartRef.current) {
      if (!uiVisible) {
        showUiTemporarily()
      }
      return
    }
    const dx = e.clientX - panStartRef.current.x
    const dy = e.clientY - panStartRef.current.y
    setOffsetX(panStartRef.current.offsetX + dx)
    setOffsetY(panStartRef.current.offsetY + dy)
  }

  const handleMouseUp = () => {
    setIsPanning(false)
    panStartRef.current = null
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = -e.deltaY * 0.001
      setZoom(prev => {
        const next = Math.min(3, Math.max(1, prev + delta))
        if (next === 1) {
          setOffsetX(0)
          setOffsetY(0)
        }
        return next
      })
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
      isSwipingRef.current = false
    } else if (e.touches.length === 2) {
      const [t1, t2] = Array.from(e.touches) as [Touch, Touch]
      const dx = t2.clientX - t1.clientX
      const dy = t2.clientY - t1.clientY
      const dist = Math.hypot(dx, dy)
      pinchRef.current = { dist, zoom }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault()
      const [t1, t2] = Array.from(e.touches) as [Touch, Touch]
      const dx = t2.clientX - t1.clientX
      const dy = t2.clientY - t1.clientY
      const dist = Math.hypot(dx, dy)
      const diff = dist - pinchRef.current.dist
      setZoom(() => {
        const next = Math.min(3, Math.max(1, pinchRef.current!.zoom + diff * 0.005))
        if (next === 1) {
          setOffsetX(0)
          setOffsetY(0)
        }
        return next
      })
      return
    }

    if (e.touches.length === 1 && touchStartRef.current && zoom <= 1) {
      const touch = e.touches[0]
      const dx = touch.clientX - touchStartRef.current.x
      const dy = touch.clientY - touchStartRef.current.y
      if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
        isSwipingRef.current = true
      }
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (pinchRef.current && e.touches.length < 2) {
      pinchRef.current = null
    }

    if (!touchStartRef.current || e.changedTouches.length === 0) {
      touchStartRef.current = null
      return
    }

    const touch = e.changedTouches[0]
    const dx = touch.clientX - touchStartRef.current.x
    const dy = touch.clientY - touchStartRef.current.y
    const dt = Date.now() - touchStartRef.current.time

    if (zoom > 1) {
      touchStartRef.current = null
      return
    }

    if (isSwipingRef.current && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) && dt < 500) {
      if (dx < 0) {
        goToPage(currentPage + 1)
      } else {
        goToPage(currentPage - 1)
      }
    } else if (dt < 250 && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      handleTapOrClick(touch.clientX, touch.clientY)
    }

    touchStartRef.current = null
    isSwipingRef.current = false
  }

  const currentImage = book.comicPages?.[currentPage]

  const totalPages = pages.length
  const progress = totalPages > 0 ? (currentPage + 1) / totalPages : 0

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col overflow-hidden bg-black"
      onMouseMove={() => {
        if (!uiVisible) showUiTemporarily()
      }}
      onWheel={handleWheel}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top bar (sempre ocupa espaço; só muda opacidade/pointer-events) */}
      <div
        className={
          uiVisible
            ? 'pointer-events-auto opacity-100 transition-opacity duration-200'
            : 'pointer-events-none opacity-0 transition-opacity duration-200'
        }
      >
        <div className="flex items-center justify-between px-4 md:px-8 py-3 md:py-4 text-xs md:text-sm font-medium text-white bg-black/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 w-8 md:w-9" />
          <span className="truncate px-4 text-center">
            {book.title} — {t('page')} {currentPage + 1}
          </span>
          <button
            type="button"
            onClick={onExit}
            className="flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-full bg-white/10 hover:bg-white/20"
            title={t('exitFullscreen')}
            aria-label={t('exitFullscreen')}
          >
            <X className="w-3 h-3 md:w-4 md:h-4" />
          </button>
        </div>
      </div>

      {/* Content layer */}
      <div
        className="min-h-0 flex-1 flex items-center justify-center overflow-hidden"
        style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
        onClick={e => handleTapOrClick(e.clientX, e.clientY)}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex h-full min-h-0 w-full items-center justify-center">
            {currentImage && !isGeneratingComic ? (
              <div
                className="group relative flex max-h-full max-w-full items-center justify-center"
                onClick={e => e.stopPropagation()}
              >
                <div
                  className="relative flex max-h-full max-w-full items-center justify-center will-change-transform"
                  style={{
                    transform: `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${zoom})`,
                    transition: isPanning || zoom > 1 ? 'none' : 'transform 0.25s ease-out'
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    if (zoom > 1) {
                      setZoom(1)
                      setOffsetX(0)
                      setOffsetY(0)
                    } else {
                      setZoom(2)
                    }
                  }}
                >
                  <img
                    src={isComicPageUrl(currentImage) ? currentImage : `data:image/jpeg;base64,${currentImage}`}
                    alt={`${t('comicPageAlt')} ${currentPage + 1}`}
                    className="block max-h-[calc(100dvh-10rem)] w-auto max-w-full select-none object-contain md:max-h-[calc(100dvh-11rem)]"
                    referrerPolicy="no-referrer"
                    draggable={false}
                  />
                </div>
                <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onGenerateComic({ regenerate: true }) }}
                    disabled={isGeneratingComic}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white disabled:opacity-50 shadow-lg"
                    title={t('regenerateComic')}
                    aria-label={t('regenerateComic')}
                  >
                    {isGeneratingComic ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDeleteComic() }}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-red-600/90 hover:bg-red-600 text-white shadow-lg"
                    title={t('deleteComicPage')}
                    aria-label={t('deleteComicPage')}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full max-w-full px-4">
                <div
                  className="relative flex flex-col items-center justify-center rounded-2xl text-center max-w-md w-full py-8 px-6 border border-white/10 bg-black/30 backdrop-blur-sm min-h-[320px]"
                >
                  {isGeneratingComic ? (
                    <div className="flex flex-col items-center gap-6">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-white/80" />
                        </div>
                      </div>
                      <p className="text-sm md:text-base text-white/95 font-medium leading-relaxed max-w-xs">
                        {getGeneratingComicMessage(book.languageCode)}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-6 flex items-center justify-center animate-comic-icon-float">
                        <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white/90" aria-hidden>
                          <rect x="8" y="10" width="48" height="38" rx="4" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.9" />
                          <rect x="64" y="10" width="48" height="38" rx="4" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.7" />
                          <rect x="8" y="52" width="48" height="38" rx="4" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.7" />
                          <rect x="64" y="52" width="48" height="38" rx="4" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5" />
                          <path d="M20 28 L36 28 M20 34 L32 34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
                          <path d="M76 28 L92 28 M76 34 L88 34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">
                        {t('comicEmptyTitle')}
                      </h3>
                      <p className="text-sm text-white/80 leading-relaxed mb-6 max-w-sm">
                        {t('comicEmptyDescription')}
                      </p>
                      <Button
                        type="button"
                        onClick={() => onGenerateComic()}
                        disabled={isGeneratingComic}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black hover:bg-white/90 font-medium shadow-lg"
                      >
                        <ImageIcon className="w-5 h-5" />
                        <span>{t('comicEmptyCta')}</span>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Side controls (left/right) */}
          <div
            className={
              uiVisible
                ? 'opacity-100 transition-opacity duration-200'
                : 'opacity-0 pointer-events-none transition-opacity duration-200'
            }
          >
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 0}
              className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/30 disabled:opacity-40"
              title={t('previousPage')}
              aria-label={t('previousPage')}
            >
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
              className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/30 disabled:opacity-40"
              title={t('nextPage')}
              aria-label={t('nextPage')}
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
        </div>
      </div>

      {/* Bottom controls: progresso + TTS no modo Comic (sempre com mesma altura) */}
      <div
        className={
          uiVisible
            ? 'pointer-events-auto opacity-100 transition-opacity duration-200'
            : 'pointer-events-none opacity-0 transition-opacity duration-200'
        }
      >
        <div className="px-4 md:px-8 pb-4 md:pb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-[11px] md:text-xs text-white/80 max-w-3xl mx-auto">
            <div className="flex flex-col items-center md:items-start gap-1">
              <span>
                {t('page')} {currentPage + 1} / {totalPages}
              </span>
              <div className="w-full max-w-xs h-0.5 bg-white/15 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onTogglePlayback}
                disabled={isLoadingTts}
                className="flex items-center justify-center w-9 h-9 rounded-full border border-white/30 bg-white/10 hover:bg-white/20 disabled:opacity-50"
              >
                {isLoadingTts ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>
              {(isPlaying || isPaused || isLoadingTts) && (
                <button
                  type="button"
                  onClick={onStopPlayback}
                  className="flex items-center justify-center w-9 h-9 rounded-full border border-white/30 bg-white/5 hover:bg-white/15"
                >
                  <div className="w-2.5 h-2.5 bg-white rounded-sm" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const speeds = [0.75, 1.0, 1.25, 1.5] as const
                  const idx = speeds.findIndex(s => Math.abs(s - playbackRate) < 0.01)
                  const next = speeds[(idx + 1) % speeds.length]
                  onChangeRate(next)
                }}
                className="px-3 py-1 rounded-full border border-white/25 bg-white/5 hover:bg-white/15 text-[11px] md:text-xs"
              >
                {playbackRate.toFixed(1)}x
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
