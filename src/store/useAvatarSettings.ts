import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_CHARACTER } from '@/lib/livliv/characters'

/** Qual avatar a tutora usa: o personagem 2.5D do Bookmoo ou o desenho vetorial (o de sempre, e o fallback). */
interface AvatarSettings {
  engine: 'livliv' | 'svg'
  characterId: string
  setEngine: (engine: 'livliv' | 'svg') => void
  setCharacter: (id: string) => void
  /** Último tutor com quem a pessoa conversou: é ele que aparece ao entrar em Conversar. */
  lastTalked: string | null
  /** Quando foi a última conversa com um tutor (ms): o banner da home usa para voltar depois de um tempo sem praticar. */
  lastTalkedAt: number | null
  setLastTalked: (id: string) => void
}

export const useAvatarSettings = create<AvatarSettings>()(persist((set) => ({
  engine: 'livliv',
  characterId: DEFAULT_CHARACTER,
  setEngine: (engine) => set({ engine }),
  setCharacter: (characterId) => set({ characterId, engine: 'livliv' }),
  lastTalked: null,
  lastTalkedAt: null,
  setLastTalked: (lastTalked) => set({ lastTalked, lastTalkedAt: Date.now() }),
}), { name: 'bookmoo-avatar' }))
