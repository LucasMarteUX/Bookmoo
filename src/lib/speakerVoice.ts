// Voz de quem está falando na tela (o personagem da tutora). O personagem escolhe gênero e tom;
// a voz em si continua sendo uma das vozes Kokoro instaladas no aparelho (a "voz atual do app").
import { getKokoroState } from '@/lib/kokoro/engine'
import { getKokoroVoice } from '@/lib/kokoro/voices'

export type SpeakerVoice = {
  gender: 'female' | 'male'
  /** 1 = natural; acima de 1, mais jovem (criança ~1.2). */
  pitch: number
  /** Vozes preferidas, na ordem (se estiverem instaladas). */
  prefer?: string[]
}

let current: SpeakerVoice | null = null
export function setSpeakerVoice(v: SpeakerVoice | null) { current = v }
export function clearSpeakerVoice(v: SpeakerVoice) { if (current === v) current = null }
export function getSpeakerVoice() { return current }

/** Voz Kokoro instalada para o personagem: a preferida, senão a primeira do gênero, senão nenhuma (usa a ativa). */
export function resolveSpeakerVoice(v: SpeakerVoice): string | undefined {
  const installed = getKokoroState().voices
  return v.prefer?.find(id => installed.includes(id)) ?? installed.find(id => getKokoroVoice(id)?.gender === v.gender)
}
