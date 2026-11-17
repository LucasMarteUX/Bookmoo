// Nome e gênero de quem conversa com a pessoa: o personagem 2.5D ou a Bia do avatar vetorial.
import { useAvatarSettings } from '@/store/useAvatarSettings'
import { characterById, effectiveCharacterId } from '@/lib/livliv/characters'

export function useTutorPersona(): { id: string; name: string; female: boolean } {
  const engine = useAvatarSettings(s => s.engine)
  const chosen = useAvatarSettings(s => s.characterId)
  const characterId = effectiveCharacterId(chosen)
  const c = engine === 'livliv' ? characterById(characterId) : undefined
  if (!c) return { id: 'bookmoo-mulher', name: 'Bia', female: true }
  return { id: c.id, name: c.name.replace(/\s*\(.*\)$/, ''), female: c.voice.gender === 'female' }
}
