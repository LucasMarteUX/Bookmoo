// Coleções de livros: grupos ordenados de livros que já estão na galeria (nada é duplicado).
import { supabase } from '@/lib/supabase'
import { BOOK_CATEGORIES, type BookCategory, type CatalogBook } from '@/lib/catalog'
import type { CefrId } from '@/lib/cefr'

export interface Collection {
  id: string
  slug: string
  title: string
  description?: string
  authorName?: string
  category?: BookCategory
  languageCode: string
  bannerData?: string
  isFeatured: boolean
  isPublished: boolean
  bookCount: number
}
export interface CollectionWithBooks extends Collection { books: CatalogBook[] }

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const CATEGORY_IDS = BOOK_CATEGORIES.map(item => item.id) as string[]
const COLLECTION_FIELDS = 'id, slug, title, description, author_name, category, language_code, banner_data, is_featured, is_published, collection_books(count)'

function mapCollection(row: any): Collection {
  return {
    id: row.id, slug: row.slug, title: row.title, description: row.description ?? undefined, authorName: row.author_name ?? undefined,
    category: CATEGORY_IDS.includes(row.category) ? row.category as BookCategory : undefined, languageCode: row.language_code ?? 'en',
    bannerData: row.banner_data ?? undefined, isFeatured: !!row.is_featured, isPublished: !!row.is_published,
    bookCount: Number(row.collection_books?.[0]?.count ?? 0),
  }
}

/** Coleções publicadas (as em destaque primeiro). A RLS já esconde rascunhos de quem não é admin. */
const listCache = new Map<boolean, { at: number; promise: Promise<Collection[]> }>()
/** Mesma consulta por 60 s: o React em dev monta duas vezes e várias telas pedem a lista. */
export function listCollections(onlyFeatured = false): Promise<Collection[]> {
  const hit = listCache.get(onlyFeatured)
  if (hit && Date.now() - hit.at < 60_000) return hit.promise
  const promise = fetchCollections(onlyFeatured)
  listCache.set(onlyFeatured, { at: Date.now(), promise })
  promise.catch(() => listCache.delete(onlyFeatured))
  return promise
}
async function fetchCollections(onlyFeatured: boolean): Promise<Collection[]> {
  if (!supabase) return []
  let request = supabase.from('collections').select(COLLECTION_FIELDS).eq('is_published', true)
  if (onlyFeatured) request = request.eq('is_featured', true)
  const { data, error } = await request.order('is_featured', { ascending: false }).order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapCollection)
}

/** Uma coleção pelo slug, com os livros na ordem salva (sort_order). */
export async function getCollection(slug: string): Promise<CollectionWithBooks | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('collections').select(COLLECTION_FIELDS).eq('slug', slug).eq('is_published', true).maybeSingle()
  if (error) throw error
  if (!data) return null
  const { data: links, error: linkError } = await supabase.from('collection_books')
    .select('sort_order, book:catalog_books(id, title, author, description, language_code, cover_thumb, cefr_level, category, categories, age_min, age_info, created_at)')
    .eq('collection_id', data.id).order('sort_order', { ascending: true })
  if (linkError) throw linkError
  const books: CatalogBook[] = (links ?? []).flatMap((link: any) => link.book ? [{
    id: link.book.id, title: link.book.title ?? '', author: link.book.author ?? undefined, description: link.book.description ?? undefined,
    languageCode: link.book.language_code ?? 'en', coverData: link.book.cover_thumb ?? undefined,
    level: LEVELS.includes(link.book.cefr_level) ? link.book.cefr_level as CefrId : undefined,
    category: CATEGORY_IDS.includes(link.book.category) ? link.book.category as BookCategory : undefined, ageMin: link.book.age_min ?? undefined, ageInfo: link.book.age_info ?? undefined, pages: [], createdAt: link.book.created_at,
  }] : [])
  return { ...mapCollection(data), books }
}
