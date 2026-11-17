// Frases de espera (antes de a pessoa começar a conversar). Duas fontes:
// 1. Personalizadas: montadas a partir dos livros que a pessoa está lendo (o atual, o último que terminou, o gênero de que
//    mais gosta) e da memória que o tutor tem desta pessoa (tabela tutor_memory: assuntos, acertos,
//    pontos a melhorar) e do que ela conversou com os outros tutores. Aparecem primeiro.
// 2. O banco do próprio tutor (src/lib/tutorVoices: cada um com seu jeito de falar), misturando inglês e português, sorteado como um "saco": cada frase sai uma vez e só volta depois de
//    todas terem saído. O saco fica salvo no aparelho, então uma sessão nova continua de onde a anterior parou (não repete).
import { supabase } from '@/lib/supabase'
import { CHARACTERS } from '@/lib/livliv/characters'
import type { ReactionLine } from '@/lib/tutorReactions'
import { categoryName } from '@/lib/catalog'
import { readingProgress } from '@/lib/utils'
import type { Book } from '@/store/useBookStore'
import { voiceOf } from '@/lib/tutorVoices'

const L = (mood: ReactionLine['mood'], pt: string, en: string): ReactionLine => ({ mood, pt, en })

export const WAIT_SCENE: ReactionLine[] = [
  L('happy', 'Ready when you are. Toque em Começar.', 'Ready when you are. Tap Start.'),
  L('wink', 'Errar faz parte. Mistakes are how we learn.', 'Mistakes are how we learn. Do not worry.'),
  L('confused', 'Hmm... do you know what to say? Eu ajudo.', 'Hmm... do you know what to say? I will help.'),
  L('surprised', 'Oh! Already here? Vamos entrar na cena!', 'Oh! Already here? Let us step into the scene!'),
  L('shy', 'A little nervous? Eu também. Let us start slowly.', 'A little nervous? Me too. Let us start slowly.'),
  L('excited', 'This scene is fun, I promise. Bora?', 'This scene is fun, I promise. Shall we?'),
  L('happy', 'Respira fundo. Just say hello first.', 'Take a breath. Just say hello first.'),
  L('wink', 'Dica: as frases úteis estão logo ali. Use them!', 'Tip: the useful phrases are right there. Use them!'),
  L('confused', 'Not sure how to start? Comece com "Hi, could I..."', 'Not sure how to start? Try "Hi, could I..."'),
  L('angry', 'O cliente está esperando! Just kidding... bora?', 'The customer is waiting! Just kidding... shall we?'),
  L('laughing', 'Pretend you do this every day. Ninguém vai saber!', 'Pretend you do this every day. Nobody will know!'),
  L('happy', 'Short sentences are perfect. Frases curtas funcionam.', 'Short sentences are perfect.'),
  L('shy', 'Can we practise together? Eu faço a minha parte.', 'Can we practise together? I will do my part.'),
  L('excited', 'Real life, but safe. Vamos lá?', 'Real life, but safe. Ready?'),
  L('surprised', 'Look who is ready! Começamos?', 'Look who is ready! Shall we begin?'),
  L('confused', 'Forgot a word? Descreva com outras palavras, vale!', 'Forgot a word? Describe it another way, that counts!'),
]

// --- saco sem repetição, salvo no aparelho ---------------------------------------------------------------------------
const BAG_KEY = (kind: string) => `bookmoo.wait.bag.v2.${kind}`
function takeFromBag(kind: string, size: number): number {
  let bag: number[] = []
  try { bag = JSON.parse(localStorage.getItem(BAG_KEY(kind)) || '[]') } catch { /* vazio */ }
  bag = bag.filter(i => Number.isInteger(i) && i >= 0 && i < size)
  if (!bag.length) {
    bag = Array.from({ length: size }, (_, i) => i)
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]] }
  }
  const next = bag.shift()!
  try { localStorage.setItem(BAG_KEY(kind), JSON.stringify(bag)) } catch { /* sem armazenamento: só não lembra entre sessões */ }
  return next
}

// --- personalizadas, pela memória dos tutores --------------------------------------------------------------------------
type Memory = { character_id: string; topics: string[] | null; strengths: string[] | null; weaknesses: string[] | null; last_at: string | null }
const short = (s: string) => { const t = s.replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, ''); return t.length > 42 ? t.slice(0, 40).trim() + '…' : t }
const any = <T,>(list: T[] | null | undefined) => (list?.length ? list[Math.floor(Math.random() * Math.min(3, list.length))] : undefined)

let memoryCache: { at: number; rows: Memory[] } | null = null
async function memories(): Promise<Memory[]> {
  if (memoryCache && Date.now() - memoryCache.at < 5 * 60_000) return memoryCache.rows
  if (!supabase) return []
  const { data } = await supabase.from('tutor_memory').select('character_id,topics,strengths,weaknesses,last_at').order('last_at', { ascending: false })
  memoryCache = { at: Date.now(), rows: (data ?? []) as Memory[] }
  return memoryCache.rows
}

/** Frases que só fazem sentido para esta pessoa e este tutor (vazio se ainda não conversaram). */
export async function personalLines(tutorId: string): Promise<ReactionLine[]> {
  try {
    const rows = await memories()
    const mine = rows.find(r => r.character_id === tutorId)
    const other = rows.find(r => r.character_id !== tutorId && (r.topics?.length ?? 0) > 0)
    const out: ReactionLine[] = []
    const topic = any(mine?.topics)
    const strong = any(mine?.strengths)
    const weak = any(mine?.weaknesses)
    const v = voiceOf(tutorId)
    if (topic) out.push(v.topic(short(topic)))
    if (strong) out.push(v.strong(short(strong)))
    if (weak) out.push(v.weak(short(weak)))
    if (other) {
      const name = CHARACTERS.find(c => c.id === other.character_id)?.name ?? ''
      const t = any(other.topics)
      if (name && t) out.push(v.other(short(t), name))
    }
    if (mine?.last_at && Date.now() - +new Date(mine.last_at) > 5 * 86_400_000) out.push(v.missed())
    // Ordem variada, mas sem repetir a mesma frase pessoal na sessão seguinte em primeiro lugar.
    return out.sort(() => Math.random() - 0.5)
  } catch { return [] }
}

// --- pelos livros da pessoa ------------------------------------------------------------------------------------------------
const title = (t: string) => { const x = t.replace(/\s+/g, ' ').trim(); return x.length > 38 ? x.slice(0, 36).trim() + '…' : x }
async function favoriteCategory(books: Book[], pt: boolean): Promise<string | null> {
  const ids = books.map(b => b.catalogId).filter((x): x is string => !!x)
  if (!ids.length || !supabase) return null
  const { data } = await supabase.from('catalog_books').select('id, category').in('id', ids.slice(0, 50))
  const count = new Map<string, number>()
  for (const r of (data ?? []) as { category: string | null }[]) if (r.category) count.set(r.category, (count.get(r.category) ?? 0) + 1)
  const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  return top ? categoryName(top, pt).toLowerCase() : null
}

/** Frases sobre os livros: o que está lendo, o último que terminou, um não começado e o gênero preferido. */
export async function bookLines(books: Book[], tutorId: string): Promise<ReactionLine[]> {
  try {
    const v = voiceOf(tutorId)
    const progress = (b: Book) => readingProgress(b.currentPage, b.pages.length, b.totalPages)
    const recent = [...books].sort((a, b) => +new Date(b.lastRead) - +new Date(a.lastRead))
    const reading = recent.find(b => (b.currentPage || 0) >= 1 && progress(b) < 100)
    const finished = recent.find(b => progress(b) >= 100)
    const untouched = recent.find(b => !(b.currentPage >= 1))
    const out: ReactionLine[] = []
    if (reading) { const [a, b] = v.reading(title(reading.title)); out.push(Math.random() < 0.5 ? a : b) }
    if (finished) out.push(v.finished(title(finished.title)))
    if (untouched && untouched !== reading) out.push(v.untouched(title(untouched.title)))
    const fav = await favoriteCategory(books, true)
    if (fav) out.push(v.genre(fav))
    return out.sort(() => Math.random() - 0.5)
  } catch { return [] }
}

/** Próxima frase de espera: as pessoais primeiro (até 4 por sessão), depois o banco, sem repetir entre sessões. */
export function makeWaitingPicker(kind: 'free' | 'scene', tutorId = '') {
  let personal: ReactionLine[] = []
  let used = 0
  // Conversa livre: o banco do próprio tutor (cada um fala do seu jeito), com o saco sem repetição separado por tutor.
  const list = kind === 'scene' ? WAIT_SCENE : voiceOf(tutorId).bank
  const bag = kind === 'scene' ? 'scene' : `free.${tutorId || 'default'}`
  return {
    setPersonal(lines: ReactionLine[]) { personal = lines.slice(0, 4); used = 0 },
    next(): ReactionLine {
      if (kind === 'free' && used < personal.length) return personal[used++]
      return list[takeFromBag(bag, list.length)]
    },
  }
}
