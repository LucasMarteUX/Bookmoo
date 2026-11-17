// Gostos de leitura (docs/TESTE-DE-NIVEL.md, seção 3.2): o que a pessoa marcou no questionário ("que tipo de história você
// gosta") mapeado para as categorias da galeria, somado ao que ela de fato lê (categorias dos livros da galeria que estão
// na estante dela). Alimenta a fileira "De acordo com seu gosto" na Galeria e na Home.
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ageFrom, bookCategories, type BookCategory, type CatalogBook } from '@/lib/catalog'
import type { CefrId } from '@/lib/cefr'

/** Questionário → categorias da galeria (os nomes não são os mesmos). */
export const TOPIC_TO_CATEGORIES: Record<string, BookCategory[]> = {
  fantasy: ['fantasy'],
  adventure: ['adventure'],
  romance: ['romance'],
  mystery: ['mystery'],
  classics: ['classic'],
  kids: ['children'],
  history: ['biography', 'nonfiction'],
  selfhelp: ['nonfiction'],
  scifi: ['adventure', 'fantasy'], // até existir a categoria de ficção científica
}

const KEY = 'bookmoo.tastes.v1'
let cache: { userId: string; topics: string[] } | null = (() => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null } })()

/** Os gostos marcados no questionário (cache no aparelho; atualiza do servidor em segundo plano). */
export function useSurveyTopics(userId: string | null | undefined): string[] {
  const [topics, setTopics] = useState<string[]>(() => (cache && cache.userId === userId ? cache.topics : []))
  useEffect(() => {
    if (!userId || !supabase) return
    let alive = true
    void supabase.from('user_surveys').select('answers').eq('user_id', userId).maybeSingle().then(({ data }) => {
      const list = (data?.answers as { topics?: unknown } | null)?.topics
      const next = Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
      cache = { userId, topics: next }
      try { localStorage.setItem(KEY, JSON.stringify(cache)) } catch { /* sem armazenamento */ }
      if (alive) setTopics(next)
    })
    return () => { alive = false }
  }, [userId])
  return topics
}

const ORDER: CefrId[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/**
 * Livros "De acordo com seu gosto": das categorias preferidas (questionário + o que já lê), no nível da pessoa ou um abaixo,
 * adequados à idade e que ainda não estão na estante. Ordem: mais categorias em comum, depois o nível exato, depois os
 * mais novos.
 */
export function tasteBooks(opts: { catalog: CatalogBook[]; topics: string[]; ownedCatalogIds: Set<string>; level: CefrId; birthDate?: string | null; limit?: number }): CatalogBook[] {
  const weight = new Map<BookCategory, number>()
  for (const t of opts.topics) for (const c of TOPIC_TO_CATEGORIES[t] ?? []) weight.set(c, (weight.get(c) ?? 0) + 2)
  // O que a pessoa lê também conta (aprende com o uso).
  for (const b of opts.catalog) if (opts.ownedCatalogIds.has(b.id)) for (const c of bookCategories(b)) weight.set(c, (weight.get(c) ?? 0) + 1)
  if (!weight.size) return []
  const me = ORDER.indexOf(opts.level)
  const age = ageFrom(opts.birthDate)
  const scored = opts.catalog
    .filter(b => !opts.ownedCatalogIds.has(b.id))
    .filter(b => { const i = b.level ? ORDER.indexOf(b.level) : -1; return i < 0 || (i <= me && i >= me - 1) })
    .filter(b => age === null || !b.ageMin || age >= b.ageMin)
    .map(b => ({ b, s: bookCategories(b).reduce((sum, c) => sum + (weight.get(c) ?? 0), 0) + (b.level === opts.level ? 0.5 : 0) }))
    .filter(x => x.s >= 1)
    .sort((x, y) => y.s - x.s || (y.b.createdAt ?? '').localeCompare(x.b.createdAt ?? ''))
  return scored.slice(0, opts.limit ?? 12).map(x => x.b)
}
