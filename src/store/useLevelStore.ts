// Nível de inglês da pessoa (docs/TESTE-DE-NIVEL.md): o do teste (placement_level, só o servidor grava) ou, sem teste, o
// declarado no primeiro acesso (declared_level). level_state diz se ainda está pendente de teste.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type { CefrId } from '@/lib/cefr'

const LEVELS: CefrId[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const asLevel = (v: unknown): CefrId | null => (LEVELS.includes(v as CefrId) ? (v as CefrId) : null)

type LevelState = {
  userId: string | null
  declared: CefrId | null
  placement: CefrId | null
  state: 'pending' | 'verified' | 'review'
  /** Selo CEFR da última prova de proficiência concluída (só o servidor grava). */
  proficiency: CefrId | null
  load: (userId: string) => Promise<void>
  clear: () => void
}

export const useLevelStore = create<LevelState>()(persist((set) => ({
  userId: null,
  declared: null,
  placement: null,
  state: 'pending',
  proficiency: null,
  load: async (userId) => {
    if (!supabase) return
    const { data } = await supabase.from('profiles').select('declared_level, placement_level, level_state, proficiency_cefr').eq('user_id', userId).maybeSingle()
    set({
      userId,
      declared: asLevel(data?.declared_level),
      placement: asLevel(data?.placement_level),
      proficiency: asLevel(data?.proficiency_cefr),
      state: data?.level_state === 'verified' || data?.level_state === 'review' ? data.level_state : 'pending',
    })
  },
  clear: () => set({ userId: null, declared: null, placement: null, state: 'pending', proficiency: null }),
}), { name: 'bookmoo-level' }))

/** O nível que vale no app: o do teste, senão o declarado (null: ainda não informou nada). */
export const currentLevel = (s: Pick<LevelState, 'declared' | 'placement'>): CefrId | null => s.placement ?? s.declared
