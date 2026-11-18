// Os 4 tutores (Bia, Luck, Yuno, Yuri) como vozes de leitura. Um tutor é guardado como "tutor:<id do personagem>" no
// lugar de uma voz Kokoro: na hora de falar, vira a voz Kokoro do personagem com o tom e o de-esser dele (tts.speak).
import { CHARACTERS, characterAvatarUrl, characterById, type Character } from '@/lib/livliv/characters'
import { resolveSpeakerVoice } from '@/lib/speakerVoice'
import { DEFAULT_KOKORO_VOICE, getKokoroVoice } from '@/lib/kokoro/voices'
import type { BookCategory } from '@/lib/catalog'

export const TUTOR_PREFIX = 'tutor:'
export const tutorVoiceId = (characterId: string) => `${TUTOR_PREFIX}${characterId}`
export const isTutorVoice = (id: string | null | undefined): id is string => !!id && id.startsWith(TUTOR_PREFIX)
export const tutorOf = (id: string | null | undefined): Character | undefined => isTutorVoice(id) ? characterById(id.slice(TUTOR_PREFIX.length)) : undefined
export const TUTORS = CHARACTERS
export const tutorAvatar = (c: Character) => characterAvatarUrl(c.id)

export type ResolvedVoice = { kokoroVoice: string; pitch?: number; deEssDb?: number; gender?: 'female' | 'male' }

/** Voz Kokoro de verdade por trás de um id (tutor ou voz comum). */
export function resolveReadingVoice(id: string): ResolvedVoice {
  const t = tutorOf(id)
  if (!t) return { kokoroVoice: id }
  const v = t.voice
  return { kokoroVoice: resolveSpeakerVoice(v) ?? DEFAULT_KOKORO_VOICE, pitch: v.pitch, deEssDb: v.deEssDb, gender: v.gender }
}

/** Gênero da voz (tutor ou Kokoro), para filtrar as listas. */
export function voiceGender(id: string | null | undefined): 'female' | 'male' | undefined {
  return tutorOf(id)?.voice.gender ?? getKokoroVoice(id ?? '')?.gender
}

// Temas mais sérios (aventura, ação, mistério/terror, clássicos, fantasia, não ficção) ficam com o Luck;
// infantis e mais leves, com a Bia.
const SERIOUS: BookCategory[] = ['adventure', 'mystery', 'fantasy', 'classic', 'nonfiction', 'biography']
export function defaultNarratorFor(categories: BookCategory[] | undefined): string {
  const cats = categories ?? []
  const light = cats.includes('children') || cats.includes('bible-stories')
  const serious = !light && cats.some(c => SERIOUS.includes(c))
  return tutorVoiceId(serious ? 'bookmoo-homem' : 'bookmoo-mulher')
}
