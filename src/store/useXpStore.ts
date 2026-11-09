// Gamificação: pontos (XP) por atividade e sequência de dias estudando.
// Cada conquista tem uma chave única (ex.: "speak:<sessão>", "learned:<palavra>") — a mesma
// conquista nunca soma duas vezes, nem entre aparelhos (tabela xp_events, unique user_id+key).
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SupabaseClient } from '@supabase/supabase-js'

export type XpKind = 'speak' | 'write' | 'learned' | 'read' | 'recovered' | 'community'
export interface XpEvent { key: string; amount: number; at: number }

/** Regras de pontuação (fonte única, usada pelas telas e pelo histórico). */
export const XP = {
  speakPage: (stars: number) => 10 + stars * 5,
  writePage: (correct: number, stars: number) => correct + stars * 5,
  learnedWord: 1,
  readPage: 2,
  /** Palavra que tinha errado antes e agora acertou: 2 pontos (o dobro de uma palavra certa). */
  recoveredWord: 2,
  /** Mosaico gerado para a comunidade (fica disponível para todos). */
  communityImage: 5,
} as const

export const kindOf = (key: string) => key.split(':')[0] as XpKind
const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

let sync: { supabase: SupabaseClient; userId: string } | null = null

interface XpState {
  events: XpEvent[]
  /** Soma pontos uma única vez por chave. Devolve false se já tinha sido contado. */
  award: (key: string, amount: number, at?: number) => boolean
  /** Liga o envio ao Supabase e junta o histórico do servidor com o local. */
  connect: (supabase: SupabaseClient | null, userId: string | null) => Promise<void>
}

export const useXpStore = create<XpState>()(
  persist(
    (set, get) => ({
      events: [],
      award: (key, amount, at = Date.now()) => {
        if (!key || amount <= 0 || get().events.some(e => e.key === key)) return false
        const event = { key: key.slice(0, 300), amount: Math.min(1000, Math.round(amount)), at }
        set(state => ({ events: [...state.events, event] }))
        if (sync) void sync.supabase.from('xp_events')
          .upsert({ user_id: sync.userId, key: event.key, amount: event.amount, created_at: new Date(at).toISOString() }, { onConflict: 'user_id,key', ignoreDuplicates: true })
          .then(({ error }) => { if (error) console.warn('xp sync', error.message) })
        return true
      },
      connect: async (supabase, userId) => {
        sync = supabase && userId ? { supabase, userId } : null
        if (!sync) return
        const { data, error } = await sync.supabase.from('xp_events').select('key, amount, created_at')
          .eq('user_id', sync.userId).order('created_at', { ascending: true }).limit(10000)
        if (error) return
        const remote = (data as { key: string; amount: number; created_at: string }[]).map(r => ({ key: r.key, amount: r.amount, at: Date.parse(r.created_at) }))
        const known = new Set(remote.map(e => e.key))
        const localOnly = get().events.filter(e => !known.has(e.key))
        if (localOnly.length) await sync.supabase.from('xp_events').upsert(
          localOnly.map(e => ({ user_id: sync!.userId, key: e.key, amount: e.amount, created_at: new Date(e.at).toISOString() })),
          { onConflict: 'user_id,key', ignoreDuplicates: true })
        set({ events: [...remote, ...localOnly].sort((a, b) => a.at - b.at) })
      },
    }),
    { name: 'bookmoo-xp', partialize: state => ({ events: state.events }) },
  ),
)

/** Totais derivados: pontos, sequência atual/recorde, atividade por dia e por hora. */
export function xpSummary(events: XpEvent[], now = Date.now()) {
  const byDay = new Map<string, { count: number; points: number }>()
  const byHour = Array.from({ length: 24 }, () => 0)
  let total = 0
  for (const e of events) {
    total += e.amount
    const k = dayKey(e.at)
    const d = byDay.get(k) ?? { count: 0, points: 0 }
    d.count++; d.points += e.amount
    byDay.set(k, d)
    byHour[new Date(e.at).getHours()]++
  }
  // Sequência: dias seguidos com atividade, terminando hoje (ou ontem, se hoje ainda não estudou).
  const day = 86_400_000
  let cursor = byDay.has(dayKey(now)) ? now : now - day
  let streak = 0
  while (byDay.has(dayKey(cursor))) { streak++; cursor -= day }
  const days = [...byDay.keys()].sort()
  let best = 0, run = 0, prev = ''
  for (const k of days) {
    const expected = prev ? dayKey(Date.parse(`${prev}T12:00:00`) + day) : k
    run = k === expected ? run + 1 : 1
    best = Math.max(best, run); prev = k
  }
  return { total, streak, best: Math.max(best, streak), byDay, byHour, studiedToday: byDay.has(dayKey(now)), dayKey }
}
