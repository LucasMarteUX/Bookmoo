// "Ouvir a palavra" com a mesma voz do leitor (Kokoro/VoiceStudio, com fallback do navegador).
// Igual ao tradutor do Google: o primeiro toque fala em velocidade normal; tocar de novo na mesma
// palavra logo em seguida fala mais devagar, e assim por diante, alternando.
import { speak, stopSpeaking } from '@/lib/tts'

export const NORMAL_RATE = 1
export const SLOW_RATE = 0.62
const ALTERNATE_WINDOW_MS = 6000

let last: { key: string; at: number; slow: boolean } | null = null

/** Speaks `text`; returns whether this time was the slow version. Pass `slow` to force a speed. */
export function sayWord(text: string, slow?: boolean): boolean {
  const key = text.trim().toLowerCase()
  if (!key) return false
  const now = Date.now()
  const useSlow = slow ?? (!!last && last.key === key && now - last.at < ALTERNATE_WINDOW_MS && !last.slow)
  last = { key, at: now, slow: useSlow }
  stopSpeaking()
  void speak(text.trim(), {
    language: 'en',
    context: key.includes(' ') ? 'phrase' : 'word',
    rate: useSlow ? SLOW_RATE : NORMAL_RATE,
  }).catch(() => { /* sem voz disponível */ })
  return useSlow
}

/** Whether the next tap on this word will be the slow version (for button labels). */
export function nextIsSlow(text: string) {
  const key = text.trim().toLowerCase()
  return !!last && last.key === key && Date.now() - last.at < ALTERNATE_WINDOW_MS && !last.slow
}
