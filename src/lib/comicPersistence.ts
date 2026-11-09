import type { ComicLayout } from '@/lib/ai'
import { AiRequestError } from '@/lib/ai'
import { supabase } from '@/lib/supabase'
import { useBookStore, type Book } from '@/store/useBookStore'
import type { Character, StyleDocument } from '../../supabase/functions/_shared/comicEditorial'

export async function saveComicPage(
  book: Book, page: number, image: string | null, layout: ComicLayout | null,
  generation?: { style?: StyleDocument; styleRevision: string | null; characters: Character[]; previousCharacters: Character[] },
) {
  if (!supabase) throw new Error('Supabase indisponível.')
  const previousLayout = book.comicLayouts?.[page]
  const { data, error } = await supabase.rpc('save_comic_page', {
    p_book: book.id, p_page: page, p_image: image, p_layout: layout,
    p_previous_image: book.comicPages?.[page] ?? null,
    p_previous_edit: previousLayout?.v === 3 ? previousLayout.editRevision ?? null : null,
    p_style: generation?.style ?? null, p_style_revision: generation?.styleRevision ?? null,
    p_characters: generation?.characters ?? null, p_previous_characters: generation?.previousCharacters ?? null,
  })
  if (error?.code === '40001') {
    const { data: latest } = await supabase.from('books')
      .select('comic_pages, comic_layouts, comic_style_doc, comic_characters')
      .eq('id', book.id).maybeSingle()
    if (latest) useBookStore.getState().updateBook(book.id, {
      comicPages: latest.comic_pages,
      comicLayouts: latest.comic_layouts,
      comicStyleDoc: latest.comic_style_doc,
      comicCharacters: latest.comic_characters,
    })
    throw new AiRequestError('comic_save_conflict')
  }
  if (error) throw error
  useBookStore.getState().updateBook(book.id, data)
}

/**
 * Comics are stored by page index, but belong to the page's text. When pages are added, removed
 * or re-split, move each comic to the page that still has its text, so images never land on (or
 * vanish from) the wrong page. A page whose text was edited in place keeps its comic.
 */
export function remapComics(oldPages: string[], newPages: string[], comicPages?: Book['comicPages'], comicLayouts?: Book['comicLayouts']) {
  const pages: Record<number, string> = {}
  const layouts: NonNullable<Book['comicLayouts']> = {}
  const owners = Object.keys(comicPages ?? {}).map(Number).filter(i => comicPages![i])
  const used = new Set<number>()
  const taken = new Set<number>()
  const assign = (from: number, to: number) => {
    pages[to] = comicPages![from]
    if (comicLayouts?.[from]) layouts[to] = comicLayouts[from]
    used.add(from); taken.add(to)
  }
  // 1) Exact text match, nearest index first.
  for (const from of owners) {
    const text = oldPages[from]
    if (text === undefined) continue
    let best = -1
    newPages.forEach((page, to) => {
      if (page === text && !taken.has(to) && (best < 0 || Math.abs(to - from) < Math.abs(best - from))) best = to
    })
    if (best >= 0) assign(from, best)
  }
  // 2) Edited in place: same index, and neither side matched anything else.
  for (const from of owners) {
    if (used.has(from) || from >= newPages.length || taken.has(from)) continue
    if (oldPages.length === newPages.length) assign(from, from)
  }
  return { comicPages: pages, comicLayouts: layouts, kept: used.size, lost: owners.length - used.size }
}
