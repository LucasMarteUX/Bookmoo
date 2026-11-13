// Galeria compartilhada. Livro enviado pela pessoa não tem catalogId e não passa por aqui.
import { supabase } from '@/lib/supabase'
import type { CefrId } from '@/lib/cefr'

export type CatalogBook = {
  id: string
  title: string
  author?: string
  description?: string
  languageCode: string
  coverData?: string
  /** Dificuldade do texto, escolhida na área admin. */
  level?: CefrId
  category?: BookCategory
  pages: string[]
  createdAt?: string
}

export type CatalogVersion = {
  id: string
  catalogId: string
  userId: string
  authorName?: string
  images: Record<string, string>
  createdAt?: string
  stars: number
  votes: number
  mine?: number
}

export type BookFeedback = {
  id: string
  catalogId: string
  userId: string
  authorName?: string
  body: string
  createdAt?: string
}

export type BookLink = {
  bookId: string
  catalogId: string
  imageMode: 'shared' | 'personal'
  styleId?: string
}

export const BOOK_CATEGORIES = [
  { id: 'classic', pt: 'Clássico', en: 'Classic' },
  { id: 'children', pt: 'Infantil', en: "Children's" },
  { id: 'adventure', pt: 'Aventura', en: 'Adventure' },
  { id: 'fantasy', pt: 'Fantasia', en: 'Fantasy' },
  { id: 'mystery', pt: 'Mistério', en: 'Mystery' },
  { id: 'romance', pt: 'Romance', en: 'Romance' },
  { id: 'short', pt: 'Contos', en: 'Short stories' },
  { id: 'poetry', pt: 'Poesia', en: 'Poetry' },
  { id: 'nonfiction', pt: 'Não ficção', en: 'Nonfiction' },
  { id: 'biography', pt: 'Biografia', en: 'Biography' },
] as const

export type BookCategory = (typeof BOOK_CATEGORIES)[number]['id']

const LEVELS: CefrId[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const CATEGORY_IDS = BOOK_CATEGORIES.map(item => item.id)

export function categoryName(id: string | undefined, pt: boolean) {
  const found = BOOK_CATEGORIES.find(item => item.id === id)
  return found ? (pt ? found.pt : found.en) : ''
}

function categoryOf(value: unknown): BookCategory | undefined {
  return CATEGORY_IDS.includes(value as BookCategory) ? value as BookCategory : undefined
}

function levelOf(value: unknown): CefrId | undefined {
  return LEVELS.includes(value as CefrId) ? value as CefrId : undefined
}

function pagesOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((page): page is string => typeof page === 'string') : []
}

let listCache: { at: number; limit?: number; data: CatalogBook[] } | null = null
let listInflight: Promise<CatalogBook[]> | null = null
const LIST_TTL = 60_000

/** Redimensiona uma capa (data URL) para uma miniatura leve usada nas listas. */
export async function makeCoverThumb(dataUrl: string, width = 320): Promise<string | null> {
  try {
    const img = new Image()
    img.src = dataUrl
    await img.decode()
    const scale = Math.min(1, width / img.naturalWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/webp', 0.72)
  } catch {
    return null
  }
}

/**
 * Lista da galeria. Usa a miniatura da capa (a completa só na página do livro) e guarda o
 * resultado por 1 minuto: galeria, comunidade e admin não repetem a mesma consulta.
 */
export async function listCatalog(limit?: number): Promise<CatalogBook[]> {
  if (!supabase) return []
  if (listCache && listCache.limit === limit && Date.now() - listCache.at < LIST_TTL) return listCache.data
  if (listInflight && !limit) return listInflight
  const run = (async () => {
    const request = supabase!.from('catalog_books').select('id, title, author, description, language_code, cover_thumb, cefr_level, category, created_at').order('created_at', { ascending: false })
    const { data, error } = await (limit ? request.limit(limit) : request)
    if (error) throw error
    const rows: CatalogBook[] = (data ?? []).map(row => ({
      id: row.id,
      title: row.title ?? '',
      author: row.author ?? undefined,
      description: row.description ?? undefined,
      languageCode: row.language_code ?? 'en',
      coverData: row.cover_thumb ?? undefined,
      level: levelOf(row.cefr_level),
      category: categoryOf(row.category),
      pages: [],
      createdAt: row.created_at,
    }))
    listCache = { at: Date.now(), limit, data: rows }
    return rows
  })()
  if (!limit) listInflight = run.finally(() => { listInflight = null })
  return run
}

/** Esquece a lista guardada (depois de adicionar, editar ou remover um livro). */
export function invalidateCatalogList() { listCache = null }

export async function getCatalogBook(id: string): Promise<CatalogBook | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('catalog_books').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    title: data.title ?? '',
    author: data.author ?? undefined,
    description: data.description ?? undefined,
    languageCode: data.language_code ?? 'en',
    coverData: data.cover_data ?? undefined,
    level: levelOf(data.cefr_level),
    category: categoryOf(data.category),
    pages: pagesOf(data.pages),
    createdAt: data.created_at,
  }
}

export async function addCatalogBook(book: Omit<CatalogBook, 'id'>, userId: string): Promise<string> {
  if (!supabase) throw new Error('Sem conexão.')
  const thumb = book.coverData ? await makeCoverThumb(book.coverData) : null
  const { data, error } = await supabase.from('catalog_books').insert({
    title: book.title,
    author: book.author ?? null,
    description: book.description ?? null,
    language_code: book.languageCode,
    cover_data: book.coverData ?? null,
    cover_thumb: thumb,
    cefr_level: book.level ?? null,
    category: book.category ?? null,
    pages: book.pages,
    created_by: userId,
  }).select('id').single()
  if (error) throw error
  invalidateCatalogList()
  return data.id as string
}

/** A área admin ajusta nível, categoria e capa de um livro que já está na galeria. */
export async function updateCatalogMeta(id: string, patch: { level?: CefrId | null; category?: BookCategory | null; coverData?: string | null }): Promise<void> {
  if (!supabase) throw new Error('Sem conexão.')
  const row: { cefr_level?: string | null; category?: string | null; cover_data?: string | null; cover_thumb?: string | null } = {}
  if ('level' in patch) row.cefr_level = patch.level ?? null
  if ('category' in patch) row.category = patch.category ?? null
  if ('coverData' in patch) { row.cover_data = patch.coverData ?? null; row.cover_thumb = patch.coverData ? await makeCoverThumb(patch.coverData) : null }
  const { error } = await supabase.from('catalog_books').update(row).eq('id', id)
  if (error) throw error
  invalidateCatalogList()
}

/**
 * Edição completa de um livro já publicado (só admin, pela política do banco): dados e texto.
 * A capa só é enviada quando trocada (a lista traz apenas a miniatura). As cópias que os leitores
 * já têm na estante não mudam; quem baixar o livro depois recebe esta versão.
 */
export async function updateCatalogBook(id: string, patch: {
  title?: string; author?: string | null; description?: string | null; languageCode?: string
  level?: CefrId | null; category?: BookCategory | null; coverData?: string | null; pages?: string[]
}): Promise<void> {
  if (!supabase) throw new Error('Sem conexão.')
  const row: Record<string, unknown> = {}
  if (patch.title !== undefined) row.title = patch.title
  if ('author' in patch) row.author = patch.author ?? null
  if ('description' in patch) row.description = patch.description ?? null
  if (patch.languageCode !== undefined) row.language_code = patch.languageCode
  if ('level' in patch) row.cefr_level = patch.level ?? null
  if ('category' in patch) row.category = patch.category ?? null
  if ('coverData' in patch) { row.cover_data = patch.coverData ?? null; row.cover_thumb = patch.coverData ? await makeCoverThumb(patch.coverData) : null }
  if (patch.pages) row.pages = patch.pages
  const { data, error } = await supabase.from('catalog_books').update(row).eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('not_allowed')
  invalidateCatalogList()
}

/** Imagens oficiais de um livro da galeria num estilo (a primeira pessoa que gera cada página define). */
/**
 * Remove o livro da galeria (só admin, pela política do banco). Apaga junto avaliações, imagens
 * compartilhadas, versões, comentários e vínculos; as cópias na estante de cada leitor continuam
 * como livro próprio. Posts que citavam o livro ficam sem o vínculo.
 */
export async function deleteCatalogBook(id: string): Promise<void> {
  if (!supabase) throw new Error('supabase_not_configured')
  const { data, error } = await supabase.from('catalog_books').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('not_allowed')
  invalidateCatalogList()
}

export async function fetchSharedImages(catalogId: string, styleId: string): Promise<Record<number, string>> {
  if (!supabase) return {}
  const { data, error } = await supabase.from('catalog_comic_pages').select('page, image_url').eq('catalog_id', catalogId).eq('style_id', styleId)
  if (error) return {}
  const images: Record<number, string> = {}
  for (const row of data ?? []) images[row.page] = row.image_url
  return images
}

/** Publica só se a página ainda não tem imagem nesse estilo. Um conflito significa que outra pessoa chegou antes. */
export async function publishSharedImage(catalogId: string, styleId: string, page: number, imageUrl: string, userId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('catalog_comic_pages').insert({
    catalog_id: catalogId, style_id: styleId, page, image_url: imageUrl, created_by: userId,
  })
  if (!error) return true
  return error.code === '23505'
}

export async function fetchBookLinks(userId: string): Promise<BookLink[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('book_links').select('book_id, catalog_id, image_mode').eq('user_id', userId)
  if (error) return []
  return (data ?? []).map(row => ({
    bookId: row.book_id,
    catalogId: row.catalog_id,
    imageMode: row.image_mode === 'personal' ? 'personal' : 'shared',
  }))
}

export async function saveBookLink(link: BookLink, userId: string): Promise<void> {
  if (!supabase) return
  await supabase.from('book_links').upsert({
    book_id: link.bookId,
    user_id: userId,
    catalog_id: link.catalogId,
    image_mode: link.imageMode,
    ...(link.styleId ? { style_id: link.styleId } : {}),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'book_id' })
}

export async function listVersions(catalogId: string, userId?: string): Promise<CatalogVersion[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('catalog_versions').select('id, catalog_id, user_id, author_name, images, created_at').eq('catalog_id', catalogId).order('created_at', { ascending: false })
  if (error) return []
  const ids = (data ?? []).map(row => row.id)
  const stars = new Map<string, { sum: number; votes: number; mine?: number }>()
  if (ids.length) {
    const { data: rows } = await supabase.from('catalog_version_stars').select('version_id, user_id, stars').in('version_id', ids)
    for (const row of rows ?? []) {
      const cur = stars.get(row.version_id) ?? { sum: 0, votes: 0 }
      cur.sum += row.stars
      cur.votes += 1
      if (userId && row.user_id === userId) cur.mine = row.stars
      stars.set(row.version_id, cur)
    }
  }
  return (data ?? []).map(row => {
    const score = stars.get(row.id)
    return {
      id: row.id,
      catalogId: row.catalog_id,
      userId: row.user_id,
      authorName: row.author_name ?? undefined,
      images: row.images && typeof row.images === 'object' ? row.images as Record<string, string> : {},
      createdAt: row.created_at,
      stars: score && score.votes ? score.sum / score.votes : 0,
      votes: score?.votes ?? 0,
      mine: score?.mine,
    }
  }).sort((a, b) => b.stars - a.stars || b.votes - a.votes)
}

export async function publishVersion(catalogId: string, userId: string, authorName: string, images: Record<string, string>): Promise<void> {
  if (!supabase) throw new Error('Sem conexão.')
  const { error } = await supabase.from('catalog_versions').insert({
    catalog_id: catalogId, user_id: userId, author_name: authorName, images,
  })
  if (error) throw error
}

export async function rateVersion(versionId: string, userId: string, stars: number): Promise<void> {
  if (!supabase) return
  await supabase.from('catalog_version_stars').upsert({ version_id: versionId, user_id: userId, stars }, { onConflict: 'version_id,user_id' })
}

export async function listFeedback(catalogId: string): Promise<BookFeedback[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('book_feedback').select('id, catalog_id, user_id, author_name, body, created_at').eq('catalog_id', catalogId).order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []).map(row => ({
    id: row.id, catalogId: row.catalog_id, userId: row.user_id, authorName: row.author_name ?? undefined, body: row.body, createdAt: row.created_at,
  }))
}

export async function addFeedback(catalogId: string, userId: string, authorName: string, body: string): Promise<void> {
  if (!supabase) throw new Error('Sem conexão.')
  const { error } = await supabase.from('book_feedback').insert({ catalog_id: catalogId, user_id: userId, author_name: authorName, body })
  if (error) throw error
}

export async function adminOverview(): Promise<{ users: number; readers_today: number; books: number; catalog: number } | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('admin_overview')
  if (error || !data) return null
  return data as { users: number; readers_today: number; books: number; catalog: number }
}
