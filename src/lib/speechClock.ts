// Relógio da fala: diz qual letra do texto a voz está pronunciando neste instante, a partir do áudio
// que está tocando de verdade (tempo do <audio> + início real de cada palavra do Kokoro). A boca dos
// personagens lê daqui, então só mexe quando há som e acompanha o atraso exato da voz.
import { wordRegex } from '@/lib/wordTokens'

export type SpeechClock = {
  text: string
  /** Posição (em letras, fracionária) do que está sendo dito agora; null = sem som neste instante. */
  position: () => number | null
}

let current: SpeechClock | null = null

export function setSpeechClock(clock: SpeechClock | null) { current = clock }
export function clearSpeechClock(clock: SpeechClock) { if (current === clock) current = null }
export function getSpeechClock() { return current }

type Span = { start: number; end: number; pauseAfter: boolean }
function spans(text: string): Span[] {
  return [...text.matchAll(wordRegex())].map((m, k, all) => {
    const start = m.index ?? 0
    const end = start + m[0].length
    const gap = text.slice(end, k + 1 < all.length ? all[k + 1].index : text.length)
    return { start, end, pauseAfter: /[.!?…,;:—–]/.test(gap) }
  })
}

/** Relógio de um <audio>: fração tocada → palavra (pelos inícios reais) → letra dentro da palavra. */
export function audioClock(text: string, el: HTMLAudioElement, starts: number[]): SpeechClock {
  const words = spans(text)
  return {
    text,
    position: () => {
      if (el.paused || el.ended || !(el.duration > 0) || !Number.isFinite(el.duration) || !words.length) return null
      const f = el.currentTime / el.duration
      let i = 0
      while (i + 1 < starts.length && i + 1 < words.length && starts[i + 1] <= f) i++
      const s0 = starts[i] ?? 0
      const s1 = starts[i + 1] ?? 1
      if (f < s0) return null
      const w = words[Math.min(i, words.length - 1)]
      // Parte final do trecho é pausa (pontuação) ou passagem para a próxima palavra: boca fecha.
      const voiced = w.pauseAfter ? 0.72 : 0.94
      const local = (f - s0) / Math.max(1e-4, s1 - s0)
      if (local > voiced) return null
      return w.start + (local / voiced) * (w.end - w.start)
    },
  }
}

/** Relógio da voz do navegador: avança pelas marcas de palavra (onboundary) e estima entre elas. */
export function boundaryClock(text: string, rate: number) {
  const words = spans(text)
  let idx = 0
  let at = 0
  let playing = false
  // Algumas vozes do aparelho (Android/Google) não mandam o aviso de cada palavra: sem eles, o relógio corre sozinho pelo
  // texto todo no ritmo estimado, para a boca não parar depois da primeira palavra.
  let gotBoundary = false
  const msPerChar = 68 / Math.max(0.5, rate)
  const clock: SpeechClock = {
    text,
    position: () => {
      if (!playing) return null
      const p = idx + (performance.now() - at) / msPerChar
      if (!gotBoundary) return p > text.length ? null : p
      const w = words.find(x => x.end > idx) ?? words[words.length - 1]
      if (!w) return null
      return p > w.end + 1 ? null : p
    },
  }
  return {
    clock,
    start: () => { playing = true; idx = 0; at = performance.now() },
    boundary: (charIndex: number) => { if (charIndex > 0) gotBoundary = true; idx = charIndex; at = performance.now() },
    end: () => { playing = false },
  }
}
