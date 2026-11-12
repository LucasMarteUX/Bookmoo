import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { isComicPageUrl, uploadComicPage } from '@/lib/comicStorage'
import { useAuth } from '@/contexts/AuthContext'
import { useBookStore } from '@/store/useBookStore'
import { useVocabularyStore } from '@/store/useVocabularyStore'
import { useStudyStore } from '@/store/useStudyStore'
import { useReaderSettings } from '@/store/useReaderSettings'
import {
  fetchBooks,
  fetchVocabulary,
  fetchStudyDays,
  fetchReaderSettings,
  updateBookFields,
  upsertVocabulary
} from '@/lib/supabaseSync'
import { fetchBookLinks } from '@/lib/catalog'

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
  } = useReaderSettings()
  const hydratedRef = useRef<string | null>(null)
  const currentUserRef = useRef<string | null>(null)
  currentUserRef.current = userId

  useEffect(() => {
    if (!userId) {
      hydratedRef.current = null
      return
    }
    if (!hasSupabase || !supabase) return
    if (hydratedRef.current === userId) return
    hydratedRef.current = userId
    // Não cancelamos o resultado na limpeza do efeito: no modo de desenvolvimento (StrictMode) o
    // efeito roda, é limpo e roda de novo; cancelar descartava os dados e o app ficava só com o
    // cache local. Só descartamos se o usuário logado mudou nesse meio-tempo.
    const forUser = userId
    ;(async () => {
      try {
        const [books, vocab, study, settings] = await Promise.all([
          fetchBooks(supabase, userId),
          fetchVocabulary(supabase, userId),
          fetchStudyDays(supabase, userId),
          fetchReaderSettings(supabase, userId)
        ])
        if (currentUserRef.current !== forUser) return

        console.log('[useHydrateOnLogin] fetched books', books)
        setBooks(books)
        void fetchBookLinks(userId).then(links => {
          if (currentUserRef.current !== forUser) return
          for (const link of links) useBookStore.getState().updateBook(link.bookId, { catalogId: link.catalogId, imageMode: link.imageMode })
        }).catch(() => {})
        // Migração: páginas de quadrinho antigas salvas em base64 dentro do registro do livro
        // vão para o Storage (o registro fica leve e carrega em qualquer navegador).
        void (async () => {
          for (const b of books) {
            const entries = Object.entries(b.comicPages ?? {})
            if (!entries.some(([, v]) => !isComicPageUrl(v))) continue
            const pagesNow: Record<number, string> = {}
            for (const [k, v] of entries) {
              pagesNow[Number(k)] = isComicPageUrl(v) ? v : await uploadComicPage(supabase!, userId, b.id, Number(k), v).catch(() => v)
            }
            const updated = { ...b, comicPages: pagesNow }
            useBookStore.getState().updateBook(b.id, { comicPages: pagesNow })
            await updateBookFields(supabase!, userId, updated, ['comicPages']).catch((e) => console.warn('[migrate comics]', e))
          }
        })()
        // Junta com o que está só no aparelho (ainda não sincronizado): o banco não apaga o que a
        // pessoa acabou de salvar, e o que faltar lá é reenviado.
        const local = useVocabularyStore.getState().vocabularies
        const remoteById = new Map(vocab.map(v => [v.id, v]))
        const merged = vocab.map(v => {
          const mine = local.find(l => l.id === v.id)
          return mine && !v.explanation?.trim() && mine.explanation?.trim() ? mine : v
        })
        const pending = [...merged.filter(v => { const r = remoteById.get(v.id); return r && r !== v }), ...local.filter(l => !remoteById.has(l.id))]
        setVocabularies([...merged, ...local.filter(l => !remoteById.has(l.id))])
        for (const v of pending) void upsertVocabulary(supabase, userId, v).catch(err => console.warn('[sync vocab]', err))
        setStudyState(study.total, study.daily)
        if (settings) {
          setTheme(settings.theme)
          setFontSize(settings.fontSize)
          setLineHeight(settings.lineHeight)
          setShowHighlights(settings.showHighlights)
          setPlaybackRate(settings.playbackRate)
          setVoiceGender(settings.voiceGender)
        }
      } catch (e) {
        console.error('[useHydrateOnLogin] error hydrating from Supabase', e)
      }
    })()
  }, [hasSupabase, userId, setBooks, setVocabularies, setStudyState, setTheme, setFontSize, setLineHeight, setShowHighlights, setPlaybackRate, setVoiceGender])
}
