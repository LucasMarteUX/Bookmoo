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

/** Amostra visual do estilo (a miniatura do banco), enviada à IA de imagem como referência de técnica. */
export async function styleSample(sb: SupabaseClient, id: string | undefined | null): Promise<{ mime: string; blob: Blob } | null> {
  if (!id) return null
  const { data } = await sb.from('comic_styles').select('sample').eq('id', id).maybeSingle()
  if (typeof data?.sample !== 'string' || !data.sample) return null
  const bytes = Uint8Array.from(atob(data.sample), c => c.charCodeAt(0))
  return { mime: 'image/webp', blob: new Blob([bytes], { type: 'image/webp' }) }
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

/**
 * Só a parte de estilo do super prompt: a cena, os personagens e o formato vêm do plano da página.
 * Corta no bloco de entrada da cena ("SCENE TO ILLUSTRATE:", "16. SCENE GENERATION INPUT", "17. DYNAMIC SCENE INPUT — BOOKMOO")
 * ou, se não houver, na primeira variável {{...}}. Variáveis que sobrarem nunca vão para a imagem.
 */
export function masterStyle(prompt: string) {
  const marker = prompt.search(/^[ \t]*(?:\d+\.\s*)?(?:DYNAMIC\s+)?SCENE\s+(?:TO\s+ILLUSTRATE|GENERATION\s+INPUT|INPUT|DESCRIPTION)\b.*$/im)
  const variable = prompt.search(/^.*\{\{[^}]+\}\}.*$/m)
  const cut = marker > 0 ? marker : variable > 0 ? variable : -1
  return (cut > 0 ? prompt.slice(0, cut) : prompt)
    .split('\n')
    .filter(line => !/\{\{[^}]+\}\}/.test(line))
    .join('\n')
    .replace(/^\s*Output a single complete illustration.*$/gim, '')
    .trim()
}

/**
 * Compacta o super prompt sem mudar o conteúdo: listas de tópicos viram uma linha só ("a; b; c.")
 * e linhas vazias somem. Os prompts completos têm até ~26 mil caracteres e a geração de imagem
 * aceita no máximo 32 mil no pedido inteiro.
 */
export function compactStyle(text: string) {
  const out: string[] = []
  let bullets: string[] = []
  const flush = () => { if (bullets.length) { out.push(bullets.join('; ') + '.'); bullets = [] } }
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const bullet = /^[*•-]\s+(.*)$/.exec(line)
    if (bullet) { bullets.push(bullet[1].replace(/[.;]\s*$/, '')); continue }
    flush()
    out.push(line)
  }
  flush()
  return out.join('\n')
}

/** Seções que podem sair primeiro quando o pedido não cabe (o resto do prompt já cobre o assunto). */
const DROPPABLE = /ORIGINALITY|COPYRIGHT|CONSISTENCY|CONTINUITY|EMOTIONAL|FLEXIBILITY|GENRE|DETAIL DISTRIBUTION|LEVEL OF DETAIL|INFLUENCE|SUBSTYLE|PANEL RULES|MOTION|ACTION AND MOVEMENT/i

/** Estilo dentro de um orçamento de caracteres: compacta, tira seções secundárias e, por fim, corta em fim de linha. */
export function fitStyle(text: string, budget: number) {
  let style = compactStyle(text)
  if (style.length <= budget) return style
  const parts = style.split(/\n(?=\d{1,2}\.\s+[A-Z])/)
  for (let i = parts.length - 1; i > 0 && parts.join('\n').length > budget; i--) {
    if (DROPPABLE.test(parts[i].split('\n')[0])) parts.splice(i, 1)
  }
  style = parts.join('\n')
  if (style.length <= budget) return style
  const cut = style.lastIndexOf('\n', budget)
  return style.slice(0, cut > 0 ? cut : budget)
}

/**
 * Campos do livro que seguem valendo junto do estilo do banco: só o conteúdo (lugar e roupas).
 * Paleta e luz vêm do super prompt do estilo; a paleta "do livro" (ex.: tons terrosos apagados)
 * puxava a imagem de volta para o visual antigo.
 */
export const BOOK_FIELDS = ['setting', 'costume'] as const
