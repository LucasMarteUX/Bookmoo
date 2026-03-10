import type { SupabaseClient } from '@supabase/supabase-js'
import type { Book } from '@/store/useBookStore'
import type { Vocabulary } from '@/store/useVocabularyStore'

/** DB row (snake_case) -> App Book */
export function bookFromRow(row: any): Book {
  const comicPages = row.comic_pages
  const comicPagesNum: Record<number, string> = {}
  if (comicPages && typeof comicPages === 'object') {
    for (const k of Object.keys(comicPages)) {
      const n = parseInt(k, 10)
      if (!Number.isNaN(n)) comicPagesNum[n] = comicPages[k]
    }
  }
  const totalPages = typeof row.total_pages === 'number' && row.total_pages > 0 ? row.total_pages : undefined
  const pages = Array.isArray(row.pages) ? row.pages : [row.content ?? '']
  const progress = totalPages ? Math.min(100, Math.round((pages.length / totalPages) * 100)) : (typeof row.progress === 'number' ? row.progress * 100 : 0)
  return {
    id: row.id,
    title: row.title ?? '',
    author: row.author ?? undefined,
    content: row.content ?? '',
    context: row.context ?? '',
    description: row.description ?? undefined,
    pages,
    currentPage: typeof row.current_page === 'number' ? row.current_page : 0,
    progress,
    lastRead: row.last_read ? new Date(row.last_read).getTime() : Date.now(),
    wordCount: typeof row.word_count === 'number' ? row.word_count : 0,
    totalPages,
    comicPages: Object.keys(comicPagesNum).length ? comicPagesNum : undefined,
    pinnedVocabIds: Array.isArray(row.pinned_vocab_ids) ? row.pinned_vocab_ids : undefined,
    languageCode: row.language_code ?? undefined,
    coverData: row.cover_data ?? undefined
  }
}

/** App Book -> DB row for insert/update */
export function bookToRow(book: Book, userId: string) {
  const comicPages: Record<string, string> = {}
  if (book.comicPages) {
    for (const [k, v] of Object.entries(book.comicPages)) {
      comicPages[String(k)] = v
    }
  }
  const progress = book.totalPages && book.totalPages > 0
    ? Math.min(1, (book.pages?.length ?? 0) / book.totalPages)
    : (book.progress ?? 0) / 100
  return {
    id: book.id,
    user_id: userId,
    title: book.title,
    author: book.author ?? null,
    content: book.content,
    context: book.context ?? '',
    description: book.description ?? null,
    pages: book.pages ?? [],
    current_page: book.currentPage ?? 0,
    progress,
    last_read: new Date(book.lastRead ?? Date.now()).toISOString(),
    word_count: book.wordCount ?? 0,
    total_pages: book.totalPages ?? null,
    comic_pages: Object.keys(comicPages).length ? comicPages : null,
    pinned_vocab_ids: book.pinnedVocabIds ?? [],
    language_code: book.languageCode ?? 'en',
    cover_data: book.coverData ?? null
  }
}

/** DB row -> App Vocabulary */
export function vocabularyFromRow(row: any): Vocabulary {
  return {
    id: row.id,
    bookId: row.book_id,
    text: row.text ?? '',
    type: (row.type as Vocabulary['type']) ?? 'word',
    status: (row.status as Vocabulary['status']) ?? 'review',
    explanation: row.explanation ?? '',
    examples: Array.isArray(row.examples) ? row.examples : [],
    audioData: row.audio_data ?? undefined,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
  }
}

/** App Vocabulary -> DB row */
export function vocabularyToRow(v: Vocabulary, userId: string) {
  return {
    id: v.id,
    user_id: userId,
    book_id: v.bookId,
    text: v.text,
    type: v.type,
    status: v.status,
    explanation: v.explanation,
    examples: v.examples ?? [],
    audio_data: v.audioData ?? null
  }
}

export async function fetchBooks(supabase: SupabaseClient, userId: string): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('user_id', userId)
    .order('last_read', { ascending: false })

  console.log('[fetchBooks] raw response', { userId, data, error })

  if (error) {
    console.error('fetchBooks error', error)
    return []
  }

  return (data ?? []).map(bookFromRow)
}

export async function fetchVocabulary(supabase: SupabaseClient, userId: string): Promise<Vocabulary[]> {
  const { data, error } = await supabase.from('vocabulary').select('*').eq('user_id', userId)
  if (error) {
    console.error('fetchVocabulary error', error)
    return []
  }
  return (data ?? []).map(vocabularyFromRow)
}

export async function fetchStudyDays(supabase: SupabaseClient, userId: string): Promise<{ total: number; daily: Record<string, number> }> {
  const { data, error } = await supabase.from('study_days').select('date, seconds').eq('user_id', userId)
  if (error) {
    console.error('fetchStudyDays error', error)
    return { total: 0, daily: {} }
  }
  const daily: Record<string, number> = {}
  let total = 0
  for (const row of data ?? []) {
    const date = row.date
    const sec = typeof row.seconds === 'number' ? row.seconds : 0
    daily[date] = sec
    total += sec
  }
  return { total, daily }
}

export async function upsertBook(supabase: SupabaseClient, userId: string, book: Book): Promise<void> {
  const row = bookToRow(book, userId)
  const { error } = await supabase.from('books').upsert(row, { onConflict: 'id' })
  if (error) {
    console.error('upsertBook error', error)
    throw error
  }
}

export async function deleteBookRemote(supabase: SupabaseClient, userId: string, bookId: string): Promise<void> {
  await supabase.from('books').delete().eq('id', bookId).eq('user_id', userId)
}

export async function upsertVocabulary(supabase: SupabaseClient, userId: string, v: Vocabulary): Promise<void> {
  const row = vocabularyToRow(v, userId)
  const { error } = await supabase.from('vocabulary').upsert(row, { onConflict: 'id' })
  if (error) {
    console.error('upsertVocabulary error', error)
    throw error
  }
}

export async function deleteVocabularyRemote(supabase: SupabaseClient, userId: string, vocabId: string): Promise<void> {
  await supabase.from('vocabulary').delete().eq('id', vocabId).eq('user_id', userId)
}

/** Upsert study_days for one day (add seconds to existing or insert). */
export async function addStudyTimeRemote(supabase: SupabaseClient, userId: string, date: string, seconds: number): Promise<void> {
  const { data, error } = await supabase.from('study_days').select('seconds').eq('user_id', userId).eq('date', date).single()
  if (error && error.code !== 'PGRST116') {
    console.error('addStudyTimeRemote fetch error', error)
    throw error
  }
  const current = (data?.seconds ?? 0) + seconds
  const { error: upsertError } = await supabase.from('study_days').upsert({ user_id: userId, date, seconds: current }, { onConflict: 'user_id, date' })
  if (upsertError) {
    console.error('addStudyTimeRemote upsert error', upsertError)
    throw upsertError
  }
}

export async function fetchReaderSettings(supabase: SupabaseClient, userId: string): Promise<{
  theme: 'light' | 'sepia' | 'dark'
  fontSize: number
  lineHeight: number
  showHighlights: boolean
  playbackRate: number
  voiceGender: 'female' | 'male'
  geminiApiKey: string | null
  ttsProvider: 'browser' | 'gemini'
} | null> {
  const { data, error } = await supabase.from('reader_settings').select('*').eq('user_id', userId).single()
  if (error || !data) return null
  return {
    theme: (data.theme as 'light' | 'sepia' | 'dark') ?? 'dark',
    fontSize: typeof data.font_size === 'number' ? data.font_size : 18,
    lineHeight: typeof data.line_height === 'number' ? data.line_height : 1.8,
    showHighlights: data.show_highlights !== false,
    playbackRate: (() => {
      const r = typeof data.playback_rate === 'number' ? data.playback_rate : 1
      const valid = [0.3, 0.5, 0.8, 1.0]
      if (valid.includes(r)) return r
      if (r <= 0.4) return 0.3
      if (r <= 0.65) return 0.5
      if (r <= 0.9) return 0.8
      return 1.0
    })(),
    voiceGender: (data.voice_gender as 'female' | 'male') ?? 'female',
    geminiApiKey: data.gemini_api_key ?? null,
    ttsProvider: (data.tts_provider as 'browser' | 'gemini') ?? 'browser'
  }
}
