// Banco de estilos (tabela comic_styles). O super prompt de cada estilo vai inteiro para a imagem;
// do livro só entram paleta, luz, cenário e figurino.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.98.0'

export type BankStyle = { id: string; name: string; look: string; use: string; categories: string[] }

/** Estilos prontos (com prompt) que podem ser escolhidos. */
export async function readyStyles(sb: SupabaseClient): Promise<BankStyle[]> {
  const { data } = await sb.from('comic_styles').select('id, name_en, look_en, use_en, categories').eq('ready', true).eq('hidden', false).order('position')
  return (data ?? []).map(row => ({
    id: String(row.id), name: String(row.name_en), look: String(row.look_en), use: String(row.use_en),
    categories: Array.isArray(row.categories) ? row.categories.map(String) : [],
  }))
}

export async function stylePrompt(sb: SupabaseClient, id: string | undefined | null): Promise<string | null> {
  if (!id) return null
  const { data } = await sb.from('comic_styles').select('prompt, ready').eq('id', id).maybeSingle()
  return data?.ready && typeof data.prompt === 'string' ? data.prompt : null
}

/** Categoria da galeria → estilos preferidos, na ordem. O primeiro que estiver pronto vence. */
const PREFERENCE: Record<string, string[]> = {
  children: ['infantil-guache', 'aquarela-nanquim'],
  short: ['aquarela-nanquim'],
  classic: ['aquarela-nanquim', 'pintura-historica', 'realismo-magico'],
  fantasy: ['fantasia-epica', 'aquarela-nanquim', 'anime-colorido'],
  adventure: ['hq-europeia', 'anime-colorido', 'fantasia-epica'],
  mystery: ['noir-misterio', 'thriller-cinematografico', 'terror-gotico'],
  romance: ['romance-aquarela', 'pintura-historica'],
  poetry: ['realismo-magico', 'aquarela-nanquim'],
  nonfiction: ['hq-europeia', 'pintura-historica'],
  biography: ['hq-europeia', 'pintura-historica'],
}

export function styleForCategory(category: string | null | undefined, ready: BankStyle[]): string | null {
  if (!category) return null
  const ids = new Set(ready.map(style => style.id))
  return PREFERENCE[category]?.find(id => ids.has(id)) ?? null
}

/** Estilos pintados à mão pedem balões de papel e serifa; os gráficos, balões brancos. */
const PAPER = new Set(['aquarela-nanquim', 'romance-aquarela', 'pintura-historica', 'infantil-guache', 'realismo-magico', 'fantasia-epica'])
export function styleLettering(id: string) {
  return PAPER.has(id) ? { lettering: 'paper', fonts: 'serif' } : { lettering: 'white', fonts: 'humanist' }
}

/** Só a parte de estilo do super prompt: a cena, os personagens e o formato vêm do plano da página. */
export function masterStyle(prompt: string) {
  const cut = prompt.search(/^\s*SCENE TO ILLUSTRATE\s*:/im)
  return (cut > 0 ? prompt.slice(0, cut) : prompt)
    .replace(/^\s*Output a single complete illustration.*$/gim, '')
    .trim()
}

/** Campos do livro que seguem valendo junto do estilo do banco. */
export const BOOK_FIELDS = ['palette', 'lighting', 'setting', 'costume'] as const
