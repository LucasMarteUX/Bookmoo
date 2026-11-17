// Pontuação do teste de nível: funções puras (testadas em placementScore.test.ts).
import { CONFIRM_AT, PROMOTE_AT, PROMOTION_PASS_AT, type Level } from './placementBank.ts'

const NUMBERS: Record<string, string> = { '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten' }
/** Palavras normalizadas: minúsculas, sem pontuação, apóstrofos unificados, números pequenos por extenso. */
export function words(text: string): string[] {
  return String(text ?? '').toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean).map(w => NUMBERS[w] ?? w)
}

function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    // Duas letras trocadas de lugar ("bougth") contam como um erro só.
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
  }
  return d[a.length][b.length]
}
/** Mesma palavra, tolerando um erro de digitação em palavras de 5+ letras. */
const same = (a: string, b: string) => a === b || (a.length >= 5 && b.length >= 5 && lev(a, b) <= 1)

/** Distância de edição entre listas de palavras (com a tolerância acima). */
function wordDistance(ref: string[], hyp: string[]): number {
  const d = Array.from({ length: ref.length + 1 }, (_, i) => [i, ...new Array(hyp.length).fill(0)])
  for (let j = 1; j <= hyp.length; j++) d[0][j] = j
  for (let i = 1; i <= ref.length; i++) for (let j = 1; j <= hyp.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (same(ref[i - 1], hyp[j - 1]) ? 0 : 1))
  return d[ref.length][hyp.length]
}

/** Ditado: 100 × (1 − WER), com tolerância a pontuação, maiúsculas e digitação leve. */
export function dictationScore(expected: string, typed: string): number {
  const ref = words(expected), hyp = words(typed)
  if (!ref.length) return 0
  return Math.round(Math.max(0, 1 - wordDistance(ref, hyp) / ref.length) * 100)
}

/** Leitura em voz alta: quantas palavras do texto foram ditas, em ordem (subsequência comum), 0..100. */
export function readAloudScore(expected: string, transcript: string): number {
  const ref = words(expected), hyp = words(transcript)
  if (!ref.length) return 0
  const d = Array.from({ length: ref.length + 1 }, () => new Array(hyp.length + 1).fill(0))
  for (let i = 1; i <= ref.length; i++) for (let j = 1; j <= hyp.length; j++) d[i][j] = same(ref[i - 1], hyp[j - 1]) ? d[i - 1][j - 1] + 1 : Math.max(d[i - 1][j], d[i][j - 1])
  const hit = d[ref.length][hyp.length]
  // Falar muito além do texto (outra coisa) também tira pontos.
  const extra = Math.max(0, hyp.length - ref.length * 1.5)
  return Math.round(Math.max(0, (hit - extra * 0.5) / ref.length) * 100)
}

export type Parts = { speaking: number; listening: number; interaction: number }
/** Total ponderado: fala 35%, ditado 25%, conversa 40%. */
export const totalOf = (p: Parts) => Math.round(p.speaking * 0.35 + p.listening * 0.25 + p.interaction * 0.4)

export type Outcome = 'confirmed' | 'promote' | 'step_down' | 'promoted' | 'not_promoted'
/** Resultado pela regra do documento (seção 5.3). */
export function outcomeOf(kind: 'confirm' | 'promotion', level: Level, p: Parts): { total: number; outcome: Outcome } {
  const total = totalOf(p)
  const weakest = Math.min(p.speaking, p.listening, p.interaction)
  if (kind === 'promotion') return { total, outcome: total >= PROMOTION_PASS_AT && weakest >= 40 ? 'promoted' : 'not_promoted' }
  const promo = PROMOTE_AT[level]
  if (promo && weakest >= 40 && total >= promo.total && p.interaction >= promo.talk) return { total, outcome: 'promote' }
  if (level !== 'A1' && total < CONFIRM_AT && p.interaction < 50) return { total, outcome: 'step_down' }
  return { total, outcome: 'confirmed' }
}
