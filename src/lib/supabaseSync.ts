import { countWords, readingProgress, splitContentIntoPages } from '@/lib/utils'
import { snapPlaybackRate } from '@/store/useReaderSettings'
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
  const savedPages: string[] = Array.isArray(row.pages) ? row.pages.filter((page: unknown) => typeof page === 'string') : []
  const legacyContent = typeof row.content === 'string' ? row.content.trim() : ''
  const hasComic = Object.keys(comicPagesNum).length > 0
  const needsPagination = legacyContent && !hasComic && !row.word_count
    && (savedPages.length === 0 || (savedPages.length === 1 && savedPages[0].trim() === legacyContent))
  const pages = needsPagination ? splitContentIntoPages(legacyContent) : savedPages.length ? savedPages : legacyContent ? [legacyContent] : []
  const currentPage = Number.isInteger(row.current_page) ? Math.max(0, Math.min(pages.length - 1, row.current_page)) : 0
  const progress = readingProgress(currentPage, pages.length, totalPages)
  const comicStyleDoc = row.comic_style_doc && typeof row.comic_style_doc === 'object' ? row.comic_style_doc : undefined
  const comicCharacters = Array.isArray(row.comic_characters) ? row.comic_characters : undefined
  const comicLayouts: Record<number, any> = {}
  if (row.comic_layouts && typeof row.comic_layouts === 'object') {
    for (const k of Object.keys(row.comic_layouts)) {
      const n = parseInt(k, 10)
      if (!Number.isNaN(n)) comicLayouts[n] = row.comic_layouts[k]
    }
  }
  return {
    id: row.id,
    title: row.title ?? '',
    author: row.author ?? undefined,
    content: row.content ?? '',
    context: row.context ?? '',
    description: row.description ?? undefined,
    pages,
    currentPage,
    progress,
    lastRead: row.last_read ? new Date(row.last_read).getTime() : Date.now(),
    wordCount: row.word_count > 0 ? row.word_count : countWords(pages.join(' ')),
    totalPages,
    comicPages: Object.keys(comicPagesNum).length ? comicPagesNum : undefined,
    comicStyleDoc: comicStyleDoc ?? undefined,
    comicCharacters: comicCharacters ?? undefined,
    comicLayouts: Object.keys(comicLayouts).length ? comicLayouts : undefined,
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
  const progress = readingProgress(book.currentPage, book.pages?.length ?? 0, book.totalPages) / 100
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
    comic_style_doc: book.comicStyleDoc ?? null,
    comic_characters: book.comicCharacters ?? null,
    comic_layouts: book.comicLayouts ?? {},
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
    grammarExamples: Array.isArray(row.grammar_examples) ? row.grammar_examples : undefined,
    usageNote: row.usage_note ?? undefined,
    variantStory: row.variant_story ?? undefined,
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
    grammar_examples: v.grammarExamples ?? [],
    usage_note: v.usageNote ?? null,
    variant_story: v.variantStory ?? null,
    audio_data: v.audioData ?? null
  }
}

export async function fetchBooks(supabase: SupabaseClient, userId: string): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('user_id', userId)
    .order('last_read', { ascending: false })

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

/** Campo do app → colunas no banco. */
const BOOK_FIELD_COLUMNS: Partial<Record<keyof Book, string[]>> = {
  title: ['title'], author: ['author'], content: ['content'], context: ['context'], description: ['description'],
  pages: ['pages', 'progress'], currentPage: ['current_page', 'progress'], progress: ['progress'], lastRead: ['last_read'],
  wordCount: ['word_count'], totalPages: ['total_pages', 'progress'], comicPages: ['comic_pages'],
  comicStyleDoc: ['comic_style_doc'], comicCharacters: ['comic_characters'], comicLayouts: ['comic_layouts'],
  pinnedVocabIds: ['pinned_vocab_ids'], languageCode: ['language_code'], coverData: ['cover_data'],
}

/**
 * Atualiza SÓ as colunas dos campos alterados. Evita que uma mudança pequena (ex.: última leitura)
 * reenvie o livro inteiro a partir do cache local e apague dados que o cache não tem.
 */
export async function updateBookFields(supabase: SupabaseClient, userId: string, book: Book, fields: (keyof Book)[]): Promise<void> {
  const row = bookToRow(book, userId) as Record<string, unknown>
  const patch: Record<string, unknown> = {}
  for (const f of fields) for (const col of BOOK_FIELD_COLUMNS[f] ?? []) patch[col] = row[col]
  if (!Object.keys(patch).length) return
  const { error } = await supabase.from('books').update(patch).eq('id', book.id).eq('user_id', userId)
  if (error) throw error
}

export async function deleteBookRemote(supabase: SupabaseClient, userId: string, bookId: string): Promise<void> {
  const { error } = await supabase.from('books').delete().eq('id', bookId).eq('user_id', userId)
  if (error) throw error
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
} | null> {
  const { data, error } = await supabase.from('reader_settings').select('*').eq('user_id', userId).maybeSingle()
  if (error || !data) return null
  return {
    theme: (data.theme as 'light' | 'sepia' | 'dark') ?? 'dark',
    fontSize: typeof data.font_size === 'number' ? data.font_size : 18,
    lineHeight: typeof data.line_height === 'number' ? data.line_height : 1.8,
    showHighlights: data.show_highlights !== false,
    playbackRate: snapPlaybackRate(typeof data.playback_rate === 'number' ? data.playback_rate : 1),
    voiceGender: (data.voice_gender as 'female' | 'male') ?? 'female',
  }
}
