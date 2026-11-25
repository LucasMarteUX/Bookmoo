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
  const stub = row.pages === undefined && row.content === undefined
  const currentPage = Number.isInteger(row.current_page) ? (stub ? Math.max(0, row.current_page) : Math.max(0, Math.min(pages.length - 1, row.current_page))) : 0
  const progress = stub && typeof row.progress === 'number' ? Math.round(row.progress * 100) : readingProgress(currentPage, pages.length, totalPages)
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
    ...(stub ? { stub: true } : {}),
    title: row.title ?? '',
    author: row.author ?? undefined,
    content: row.content ?? '',
    context: row.context ?? '',
    description: row.description ?? undefined,
    pages,
    currentPage,
    progress,
    lastRead: row.last_read ? new Date(row.last_read).getTime() : Date.now(),
    wordCount: row.word_count > 0 ? row.word_count : stub ? 0 : countWords(pages.join(' ')),
    totalPages,
    comicPages: Object.keys(comicPagesNum).length ? comicPagesNum : undefined,
    comicStyleDoc: comicStyleDoc ?? undefined,
    comicCharacters: comicCharacters ?? undefined,
    comicLayouts: Object.keys(comicLayouts).length ? comicLayouts : undefined,
    pinnedVocabIds: Array.isArray(row.pinned_vocab_ids) ? row.pinned_vocab_ids : undefined,
    languageCode: row.language_code ?? undefined,
    coverData: row.cover_data ?? undefined,
    source: row.source ?? undefined,
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
    cover_data: book.coverData ?? null,
    ...(book.source ? { source: book.source } : {}),
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
    personalNote: row.personal_note ?? undefined,
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
    personal_note: v.personalNote ?? null,
    variant_story: v.variantStory ?? null,
    audio_data: v.audioData ?? null
  }
}

const LIGHT_BOOK_COLUMNS = 'id,user_id,title,current_page,progress,last_read,word_count,total_pages,comic_pages,pinned_vocab_ids,language_code,cover_data,context,author,created_at,updated_at,description,comic_style_doc,comic_characters,comic_layouts,finished_at,shelf_status,favorite,source'

/** Texto completo de um livro (pages e content). */
export async function fetchBookFull(supabase: SupabaseClient, userId: string, id: string): Promise<Book | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    // Tempo limite: uma requisição pendurada não pode travar a fila dos outros livros.
    const { data, error } = await supabase.from('books').select('*').eq('user_id', userId).eq('id', id).abortSignal(AbortSignal.timeout(20_000)).maybeSingle()
    if (!error) return data ? bookFromRow(data) : null
    await new Promise(r => setTimeout(r, 1200 * (attempt + 1)))
  }
  return null
}

const fullLoads = new Map<string, Promise<Book | null>>()
/**
 * Garante o texto de um livro que chegou leve. Junta pedidos repetidos e troca o livro no store, preservando o que a
 * pessoa mudou nesse meio-tempo (página atual, última leitura).
 */
export function ensureBookFull(supabase: SupabaseClient, userId: string, id: string, update: (id: string, patch: Partial<Book>) => void): Promise<Book | null> {
  let p = fullLoads.get(id)
  if (!p) {
    p = fetchBookFull(supabase, userId, id).then(full => {
      if (full) update(id, { stub: undefined, content: full.content, pages: full.pages, wordCount: full.wordCount, progress: full.progress, totalPages: full.totalPages })
      return full
    }).finally(() => fullLoads.delete(id))
    fullLoads.set(id, p)
  }
  return p
}

let filling: Promise<void> | null = null
/**
 * Preenche em segundo plano o texto dos livros que chegaram leves, dois por vez, na ordem da estante.
 * Uma execução só por vez; chamar de novo enquanto roda não duplica nada.
 */
export function fillBookTexts(supabase: SupabaseClient, userId: string, getBooks: () => Book[], update: (id: string, patch: Partial<Book>) => void): Promise<void> {
  if (filling) return filling
  filling = (async () => {
    // Algumas voltas: se a lista for trocada no meio (nova sincronização), o que voltou sem texto entra de novo.
    for (let pass = 0; pass < 4; pass++) {
      const queue = getBooks().filter(b => b.stub).map(b => b.id)
      if (!queue.length) return
      const worker = async () => {
        for (let id = queue.shift(); id; id = queue.shift()) {
          if (!getBooks().find(b => b.id === id)?.stub) continue
          await ensureBookFull(supabase, userId, id, update).catch(() => null)
        }
      }
      await Promise.all([worker(), worker()])
      await new Promise(r => setTimeout(r, 500))
    }
  })().finally(() => { filling = null })
  return filling
}

/**
 * Biblioteca em duas etapas. 1) Lista leve (sem o texto dos livros): aparece na hora. 2) O texto de cada livro chega
 * depois, um por vez, começando pelos lidos por último. Antes uma consulta só trazia tudo (vários MB por livro) e
 * estourava o tempo limite do banco: a biblioteca ficava vazia.
 */
export async function fetchBooks(supabase: SupabaseClient, userId: string): Promise<Book[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.from('books').select(LIGHT_BOOK_COLUMNS).eq('user_id', userId).order('last_read', { ascending: false }).abortSignal(AbortSignal.timeout(20_000))
    if (!error) return (data ?? []).map(bookFromRow)
    console.error('fetchBooks error', error)
    await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
  }
  return []
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
  // Livro ainda sem o texto (carregamento leve): gravar agora apagaria o texto no banco.
  if (book.stub) return
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
  // Sem o texto ainda: nada que dependa dele (texto, páginas, contagem, progresso calculado) vai para o banco.
  if (book.stub) for (const col of ['content', 'pages', 'word_count', 'progress']) delete patch[col]
  if (!Object.keys(patch).length) return
  const { error } = await supabase.from('books').update(patch).eq('id', book.id).eq('user_id', userId)
  if (error) throw error
}

export async function deleteBookRemote(supabase: SupabaseClient, userId: string, bookId: string): Promise<void> {
  const { error } = await supabase.from('books').delete().eq('id', bookId).eq('user_id', userId)
  if (error) throw error
}

export async function upsertVocabulary(supabase: SupabaseClient, userId: string, v: Vocabulary): Promise<void> {
  const row = vocabularyToRow(v, userId) as Record<string, unknown>
  let { error } = await supabase.from('vocabulary').upsert(row, { onConflict: 'id' })
  if (error && /column/i.test(error.message)) {
    for (const key of ['grammar_examples', 'usage_note', 'variant_story', 'personal_note']) delete row[key]
    ;({ error } = await supabase.from('vocabulary').upsert(row, { onConflict: 'id' }))
  }
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
    theme: (data.theme as 'light' | 'sepia' | 'dark') ?? 'sepia',
    fontSize: typeof data.font_size === 'number' ? data.font_size : 18,
    lineHeight: typeof data.line_height === 'number' ? data.line_height : 1.8,
    showHighlights: data.show_highlights !== false,
    playbackRate: snapPlaybackRate(typeof data.playback_rate === 'number' ? data.playback_rate : 1),
    voiceGender: (data.voice_gender as 'female' | 'male') ?? 'female',
  }
}
