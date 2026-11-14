// Banco de estilos das ilustrações. Nome, prévia e aplicações vêm da tabela comic_styles;
// o super prompt só o admin vê. Um estilo só pode ser escolhido quando já tem prompt (ready).
import { supabase } from '@/lib/supabase'
import { useBookStore, type Book } from '@/store/useBookStore'

export type BankStyle = {
  id: string
  position: number
  name: string
  look: string
  use: string
  ready: boolean
  preview: string
}

export const LEGACY_STYLE = 'legacy'

/** Prévia em /public/styles (a grade de referência recortada). */
export const stylePreview = (id: string) => `/styles/${id}.webp`

let cache: Promise<BankStyle[]> | null = null

export function loadStyleBank(pt: boolean, fresh = false): Promise<BankStyle[]> {
  if (!cache || fresh) {
    cache = (async () => {
      if (!supabase) return []
      const { data, error } = await supabase.from('comic_styles')
        .select('id, position, name_pt, name_en, look_pt, look_en, use_pt, use_en, ready, hidden')
        .eq('hidden', false).order('position')
      if (error || !data) { cache = null; return [] }
      return data.map(row => ({ ...row, _pt: true })) as unknown as BankStyle[]
    })()
  }
  return cache.then(rows => rows.map(row => {
    const raw = row as unknown as Record<string, unknown>
    return {
      id: String(raw.id), position: Number(raw.position) || 0,
      name: String(pt ? raw.name_pt : raw.name_en), look: String(pt ? raw.look_pt : raw.look_en), use: String(pt ? raw.use_pt : raw.use_en),
      ready: raw.ready === true, preview: stylePreview(String(raw.id)),
    }
  }))
}

/** Estilos que um livro da galeria já tem: o padrão (definido por quem gerou primeiro) e os que têm páginas. */
export async function catalogStyleOptions(catalogId: string): Promise<{ styleId: string; pages: number; isDefault: boolean }[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('catalog_style_options', { p_catalog: catalogId })
  if (error || !Array.isArray(data)) return []
  return data.map(row => ({ styleId: String(row.style_id), pages: Number(row.pages) || 0, isDefault: row.is_default === true }))
}

/** O estilo que vale para este exemplar (chave das imagens oficiais da galeria). */
export function bookStyleKey(book: Pick<Book, 'comicStyleDoc'>): string {
  return book.comicStyleDoc?.styleId || LEGACY_STYLE
}

/**
 * Troca o estilo do livro desta pessoa. Recomeça do zero: apaga as páginas e layouts gerados e a
 * direção de arte (mantém as referências visuais). Na galeria, passa a usar as imagens oficiais
 * do novo estilo, se alguém já gerou; se não, as próximas páginas desta pessoa viram as oficiais dele.
 */
export async function applyBookStyle(book: Book, styleId: string, userId: string | undefined): Promise<void> {
  const comicStyleDoc = { references: book.comicStyleDoc?.references, styleId }
  // Livro da galeria: só o estilo padrão é compartilhado com a comunidade. Outro estilo vira coleção individual.
  const defaultStyle = book.catalogId ? (await catalogStyleOptions(book.catalogId)).find(option => option.isDefault)?.styleId : undefined
  const imageMode: Book['imageMode'] = book.catalogId ? (defaultStyle && styleId !== defaultStyle ? 'personal' : 'shared') : book.imageMode
  useBookStore.getState().updateBook(book.id, { comicStyleDoc, comicPages: {}, comicLayouts: {}, ...(imageMode ? { imageMode } : {}) })
  if (!supabase || !userId) return
  const { error } = await supabase.from('books')
    .update({ comic_style_doc: comicStyleDoc, comic_pages: null, comic_layouts: {} })
    .eq('id', book.id).eq('user_id', userId)
  if (error) throw new Error(error.message)
  if (book.catalogId) await supabase.from('book_links').update({ style_id: styleId, ...(imageMode ? { image_mode: imageMode } : {}) }).eq('book_id', book.id).eq('user_id', userId)
}

// ─── Admin ───

export async function adminStylePrompts(): Promise<Record<string, string>> {
  if (!supabase) return {}
  const { data, error } = await supabase.rpc('admin_comic_styles')
  if (error || !Array.isArray(data)) return {}
  return Object.fromEntries(data.map(row => [String(row.id), typeof row.prompt === 'string' ? row.prompt : '']))
}

export async function adminSaveStylePrompt(styleId: string, prompt: string): Promise<void> {
  if (!supabase) throw new Error('offline')
  const { error } = await supabase.rpc('admin_save_style_prompt', { p_style: styleId, p_prompt: prompt })
  if (error) throw new Error(error.message)
  cache = null
}
