// O que a pessoa acrescenta à aula de uma página (explicações aprofundadas, exemplos extras, imagens, conversa do chat,
// explicações de palavras e o último conjunto de exercícios). Fica no aparelho: a aula em si vem do servidor.
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import { ApiError, type LessonChatMsg, type LessonExercise, type LessonExplain, type LessonPair } from '@/lib/billingApi'

export type ItemExtra = {
  expand?: { explanation: string; steps: string[]; examples: LessonPair[]; remember: string; question?: string }[]
  examples?: (LessonPair & { note?: string })[]
  images?: { path: string; url: string | null; sentence: string }[]
}
export type ExerciseRun = { questions: LessonExercise[]; answers: (number | null)[]; done: boolean; at: number }
export type PageLessonData = {
  at: number
  items: Record<string, ItemExtra>
  chat: LessonChatMsg[]
  explains: Record<string, LessonExplain>
  exercises?: ExerciseRun
}

type State = {
  pages: Record<string, PageLessonData>
  patch: (key: string, fn: (d: PageLessonData) => PageLessonData) => void
}

const empty = (): PageLessonData => ({ at: Date.now(), items: {}, chat: [], explains: {} })
const MAX_PAGES = 60

export const useLessonStore = create<State>()(persist((set) => ({
  pages: {},
  patch: (key, fn) => set(s => {
    const next = { ...s.pages, [key]: { ...fn(s.pages[key] ?? empty()), at: Date.now() } }
    // Guarda só as páginas estudadas mais recentemente.
    const keys = Object.keys(next)
    if (keys.length > MAX_PAGES) keys.sort((a, b) => next[a].at - next[b].at).slice(0, keys.length - MAX_PAGES).forEach(k => delete next[k])
    return { pages: next }
  }),
}), { name: 'upo-lesson-extras' }))

export const lessonKey = (bookId: string, page: number, level: string) => `${bookId}:${page}:${level}`
export function usePageLesson(key: string) {
  const data = useLessonStore(s => s.pages[key])
  const patch = useLessonStore(s => s.patch)
  return { data: data ?? null, patch: (fn: (d: PageLessonData) => PageLessonData) => patch(key, fn) }
}
export const patchItem = (d: PageLessonData, id: string, fn: (x: ItemExtra) => ItemExtra): PageLessonData => ({ ...d, items: { ...d.items, [id]: fn(d.items[id] ?? {}) } })

/** As imagens ficam no Storage privado: o link assinado vence, então é renovado ao mostrar. */
const signed = new Map<string, string>()
export function useSignedImage(path: string, fallback: string | null) {
  const [url, setUrl] = useState<string | null>(signed.get(path) ?? null)
  useEffect(() => {
    if (signed.has(path) || !supabase) return
    let alive = true
    void supabase.storage.from('vocab-images').createSignedUrl(path, 60 * 60 * 6).then(({ data }) => {
      const u = data?.signedUrl ?? fallback
      if (u) signed.set(path, u)
      if (alive) setUrl(u)
    })
    return () => { alive = false }
  }, [path, fallback])
  return url
}

/** Erros de crédito/plano já abrem o convite de assinatura; os outros viram uma mensagem curta. */
export function failMessage(e: unknown, pt: boolean): string | null {
  const code = e instanceof ApiError ? e.code : ''
  if (['no_credits', 'cap_reached', 'plan_required', 'no_minutes'].includes(code)) return null
  if (code === 'rate_limited') return pt ? 'Muitos pedidos seguidos. Espere alguns segundos.' : 'Too many requests. Wait a few seconds.'
  if (code === 'ai_paused') return pt ? 'A IA está em pausa por alguns instantes.' : 'AI is paused for a moment.'
  if (code === 'lesson_missing') return pt ? 'Gere a aula desta página primeiro.' : 'Create this page’s lesson first.'
  return pt ? 'Não deu certo agora. Tente de novo.' : 'That did not work. Try again.'
}
