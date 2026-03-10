import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useBookStore } from '@/store/useBookStore'
import { useVocabularyStore } from '@/store/useVocabularyStore'
import { useStudyStore } from '@/store/useStudyStore'
import { useReaderSettings } from '@/store/useReaderSettings'
import {
  fetchBooks,
  fetchVocabulary,
  fetchStudyDays,
  fetchReaderSettings
} from '@/lib/supabaseSync'

/** When Supabase is configured and user is logged in, load books, vocabulary, study_days and reader_settings and hydrate stores. */
export function useHydrateOnLogin() {
  const { session, hasSupabase } = useAuth()
  const userId = session?.user?.id ?? null
  const setBooks = useBookStore((s) => s.setBooks)
  const setVocabularies = useVocabularyStore((s) => s.setVocabularies)
  const setStudyState = useStudyStore((s) => s.setStudyState)
  const {
    setTheme,
    setFontSize,
    setLineHeight,
    setShowHighlights,
    setPlaybackRate,
    setVoiceGender,
    setGeminiApiKey,
    setTtsProvider
  } = useReaderSettings()
  const hydratedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!userId) {
      hydratedRef.current = null
      return
    }
    if (!hasSupabase || !supabase) return
    if (hydratedRef.current === userId) return
    hydratedRef.current = userId

    let cancelled = false
    ;(async () => {
      try {
        const [books, vocab, study, settings] = await Promise.all([
          fetchBooks(supabase, userId),
          fetchVocabulary(supabase, userId),
          fetchStudyDays(supabase, userId),
          fetchReaderSettings(supabase, userId)
        ])
        if (cancelled) return

        console.log('[useHydrateOnLogin] fetched books', books)
        setBooks(books)
        setVocabularies(vocab)
        setStudyState(study.total, study.daily)
        if (settings) {
          setTheme(settings.theme)
          setFontSize(settings.fontSize)
          setLineHeight(settings.lineHeight)
          setShowHighlights(settings.showHighlights)
          setPlaybackRate(settings.playbackRate)
          setVoiceGender(settings.voiceGender)
          setGeminiApiKey(settings.geminiApiKey)
          setTtsProvider(settings.ttsProvider)
        }
      } catch (e) {
        console.error('[useHydrateOnLogin] error hydrating from Supabase', e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hasSupabase, userId, setBooks, setVocabularies, setStudyState, setTheme, setFontSize, setLineHeight, setShowHighlights, setPlaybackRate, setVoiceGender, setGeminiApiKey, setTtsProvider])
}
