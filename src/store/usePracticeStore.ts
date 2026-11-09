// Resultados das práticas por página: Falar (leitura em voz alta) e Escrever (ditado).
// Ficam no aparelho e são enviados ao Supabase (tabela practice_sessions) quando há login.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SupabaseClient } from '@supabase/supabase-js'

export type PracticeKind = 'speak' | 'write'

export interface PracticeSession {
  id: string
  kind: PracticeKind
  bookId: string
  bookTitle: string
  page: number
  accuracy: number
  ok: number
  close: number
  errors: number
  total: number
  stars: number
  /** Palavras erradas (ou quase) nesta tentativa, em minúsculas. */
  missed: string[]
  /** Listas por resultado (minúsculas, com repetição removida). Tentativas antigas não têm. */
  words?: PracticeWords
  createdAt: number
}

export interface PracticeWords { ok: string[]; close: string[]; bad: string[]; skipped: string[] }

/** Normaliza para agrupar estatísticas: minúsculas e apóstrofo reto, sem repetir. */
export const wordList = (list: string[]) => [...new Set(list.map(w => w.toLowerCase().replace(/[’‘]/g, "'")))]

export function starsFor(accuracy: number) {
  return accuracy >= 95 ? 3 : accuracy >= 80 ? 2 : accuracy >= 60 ? 1 : 0
}

type Row = {
  id: string; kind: PracticeKind; book_id: string; book_title: string; page: number; accuracy: number
  ok: number; close: number; errors: number; total: number; stars: number; missed: string[]; words?: PracticeWords | null; created_at: string
}

const toRow = (s: PracticeSession, userId: string) => ({
  id: s.id, user_id: userId, kind: s.kind, book_id: s.bookId, book_title: s.bookTitle, page: s.page,
  accuracy: s.accuracy, ok: s.ok, close: s.close, errors: s.errors, total: s.total, stars: s.stars,
  missed: s.missed, words: s.words ?? {}, created_at: new Date(s.createdAt).toISOString(),
})
const fromRow = (r: Row): PracticeSession => ({
  id: r.id, kind: r.kind, bookId: r.book_id, bookTitle: r.book_title, page: r.page, accuracy: r.accuracy,
  ok: r.ok, close: r.close, errors: r.errors, total: r.total, stars: r.stars, missed: r.missed ?? [],
  words: r.words && 'ok' in r.words ? r.words : undefined,
  createdAt: Date.parse(r.created_at),
})

interface PracticeState {
  sessions: PracticeSession[]
  add: (session: Omit<PracticeSession, 'id' | 'createdAt' | 'stars'>, sync?: { supabase: SupabaseClient; userId: string } | null) => PracticeSession
  /** Junta o histórico do servidor com o local (sem duplicar) e envia o que só existe aqui. */
  syncWithServer: (supabase: SupabaseClient, userId: string) => Promise<void>
}

export const usePracticeStore = create<PracticeState>()(
  persist(
    (set, get) => ({
      sessions: [],
      add: (data, sync) => {
        const session: PracticeSession = { ...data, id: crypto.randomUUID(), createdAt: Date.now(), stars: starsFor(data.accuracy) }
        set(state => ({ sessions: [...state.sessions, session].slice(-2000) }))
        if (sync) void sync.supabase.from('practice_sessions').insert(toRow(session, sync.userId)).then(({ error }) => {
          if (error) console.warn('practice sync', error.message)
        })
        return session
      },
      syncWithServer: async (supabase, userId) => {
        const { data, error } = await supabase.from('practice_sessions').select('*').eq('user_id', userId)
          .order('created_at', { ascending: true }).limit(2000)
        if (error) return
        const remote = (data as Row[]).map(fromRow)
        const known = new Set(remote.map(s => s.id))
        const localOnly = get().sessions.filter(s => !known.has(s.id))
        if (localOnly.length) await supabase.from('practice_sessions').insert(localOnly.map(s => toRow(s, userId)))
        set({ sessions: [...remote, ...localOnly].sort((a, b) => a.createdAt - b.createdAt) })
      },
    }),
    { name: 'bookmoo-practice' },
  ),
)
