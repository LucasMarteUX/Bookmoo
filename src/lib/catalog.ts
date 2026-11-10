// Galeria compartilhada. Livro enviado pela pessoa não tem catalogId e não passa por aqui.
import { supabase } from '@/lib/supabase'

export type CatalogBook = {
  id: string
  title: string
  author?: string
  description?: string
  languageCode: string
  coverData?: string
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
}

function pagesOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((page): page is string => typeof page === 'string') : []
}

export async function listCatalog(): Promise<CatalogBook[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('catalog_books').select('id, title, author, description, language_code, cover_data, created_at').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => ({
    id: row.id,
    title: row.title ?? '',
    author: row.author ?? undefined,
    description: row.description ?? undefined,
    languageCode: row.language_code ?? 'en',
    coverData: row.cover_data ?? undefined,
    pages: [],
    createdAt: row.created_at,
  }))
}

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
    pages: pagesOf(data.pages),
    createdAt: data.created_at,
  }
}

export async function addCatalogBook(book: Omit<CatalogBook, 'id'>, userId: string): Promise<string> {
  if (!supabase) throw new Error('Sem conexão.')
  const { data, error } = await supabase.from('catalog_books').insert({
    title: book.title,
    author: book.author ?? null,
    description: book.description ?? null,
    language_code: book.languageCode,
    cover_data: book.coverData ?? null,
    pages: book.pages,
    created_by: userId,
  }).select('id').single()
  if (error) throw error
  return data.id as string
}

export async function fetchSharedImages(catalogId: string): Promise<Record<number, string>> {
  if (!supabase) return {}
  const { data, error } = await supabase.from('catalog_comic_pages').select('page, image_url').eq('catalog_id', catalogId)
  if (error) return {}
  const images: Record<number, string> = {}
  for (const row of data ?? []) images[row.page] = row.image_url
  return images
}

/** Publica só se a página ainda não tem imagem. Um conflito significa que outra pessoa chegou antes. */
export async function publishSharedImage(catalogId: string, page: number, imageUrl: string, userId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('catalog_comic_pages').insert({
    catalog_id: catalogId, page, image_url: imageUrl, created_by: userId,
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
