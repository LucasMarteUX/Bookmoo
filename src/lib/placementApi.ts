// Cliente da função `placement` (teste de nível, docs/TESTE-DE-NIVEL.md).
import { supabase } from '@/lib/supabase'
import type { CefrId } from '@/lib/cefr'

export class PlacementError extends Error {
  constructor(public code: string, public extra: Record<string, unknown> = {}) { super(code) }
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new PlacementError('supabase_not_configured')
  const { data, error } = await supabase.functions.invoke('placement', { body })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const j = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) as Record<string, unknown> | null : null
    throw new PlacementError(String(j?.error ?? 'request_failed'), j ?? {})
  }
  return data as T
}

export type PlacementKind = 'confirm' | 'promotion'
export type Outcome = 'confirmed' | 'promote' | 'step_down' | 'promoted' | 'not_promoted'
export type PlacementItems = {
  read: { id: string; text: string }[]
  open: { id: string; question: string }[]
  dictation: { id: string; say: string; words: number }[]
  talk: { topic: string; opening: string; tasks: number }
}
export type Scores = { speaking: number; listening: number; interaction: number; read: number; open: number; tasks_done: number; strengths: string[]; improve: string[]; summary: string }
export type Attempt = { id: string; level: CefrId; kind: PlacementKind; status: string; started_at: string; finished_at: string | null; scores: Scores | null; total: number | null; outcome: Outcome | null }
export type Status = {
  level: CefrId; state: 'pending' | 'verified' | 'review'; emblems: CefrId[]; declared: CefrId | null; placement: CefrId | null; next: CefrId | null
  confirmAvailableAt: string | null; promotionAvailableAt: string | null; promotionOffered: boolean
  monthUsed: number; monthLimit: number; monthBest: number | null
  attempts: Attempt[]; history: { at: string; from_level: CefrId | null; to_level: CefrId; reason: string }[]
}
export type Result = { level: CefrId; kind: PlacementKind; total: number; outcome: Outcome; scores: Scores; newLevel: CefrId; previousLevel: CefrId; next: CefrId | null }

export const placement = {
  status: () => call<Status>({ action: 'status' }),
  start: (kind: PlacementKind, characterId?: string) => call<{ attemptId: string; level: CefrId; kind: PlacementKind; items: PlacementItems }>({ action: 'start', kind, characterId }),
  read: (attemptId: string, itemId: string, transcript: string, extra: { confidence?: number; durationMs?: number; typed?: boolean }) => call<{ ok: true }>({ action: 'read', attemptId, itemId, transcript, ...extra }),
  open: (attemptId: string, itemId: string, transcript: string, typed: boolean) => call<{ ok: true }>({ action: 'open', attemptId, itemId, transcript, typed }),
  dictation: (attemptId: string, itemId: string, text: string) => call<{ ok: true }>({ action: 'dictation', attemptId, itemId, text }),
  turn: (attemptId: string, transcript: string, typed: boolean) => call<{ reply: string; done: boolean }>({ action: 'turn', attemptId, transcript, typed }),
  finish: (attemptId: string) => call<Result>({ action: 'finish', attemptId }),
  stepDown: () => call<{ level: CefrId }>({ action: 'step_down' }),
}
