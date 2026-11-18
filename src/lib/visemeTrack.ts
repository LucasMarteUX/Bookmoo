// Boca pelos fonemas reais da voz (Kokoro devolve a duração de cada fonema). A trilha guarda os fonemas com início e fim em
// fração do áudio; o personagem lê o relógio do próprio <audio> (currentTime, que já inclui buffering, pausa e velocidade)
// e transforma o fonema da vez em abertura (mouthOpen) e formato (vowel: -1 arredondado, +1 largo).
// Sem trilha (voz do navegador, servidor), vale o lip sync por amplitude de sempre.
import type { PhoneTiming } from '@/lib/kokoro/engine'

export type VisemeTrack = { el: HTMLAudioElement; src: string; phones: PhoneTiming[] }

let current: VisemeTrack | null = null
export function setVisemeTrack(t: VisemeTrack) { current = { ...t, phones: normalize(t.phones) } ; owner = t }
let owner: VisemeTrack | null = null

/** Marcas de tônica (ˈ ˌ) e alongamento (ː) vêm como "fonemas" próprios: o tempo delas vai para o fonema seguinte,
 *  senão a boca fechava no meio da palavra. */
function normalize(ph: PhoneTiming[]): PhoneTiming[] {
  const out: PhoneTiming[] = []
  let carry: number | null = null
  for (const x of ph) {
    const clean = x.p.replace(/[ˈˌː]/g, '')
    if (!clean) { if (carry === null) carry = x.f; continue }
    out.push({ p: clean, f: carry ?? x.f, e: x.e })
    carry = null
  }
  return out
}
export function clearVisemeTrack(t: VisemeTrack) { if (owner === t) { current = null; owner = null } }

/** A trilha que está tocando agora (nada se pausou, acabou ou o <audio> já tem outra frase). */
export function activeVisemeTrack(el?: HTMLAudioElement | null): VisemeTrack | null {
  const t = current
  if (!t) return null
  if (el && t.el !== el) return null
  if (t.el.src !== t.src || t.el.paused || t.el.ended || !(t.el.duration > 0) || !Number.isFinite(t.el.duration)) return null
  return t
}

type Shape = { open: number; vowel: number; vowelish?: boolean }
// Formatos (misaki/IPA do Kokoro). A, I, O, W, Y = ditongos eɪ, aɪ, oʊ, aʊ, ɔɪ.
const V = (open: number, vowel: number): Shape => ({ open, vowel, vowelish: true })
const C = (open: number, vowel: number): Shape => ({ open, vowel })
const SHAPES: Record<string, Shape> = {
  // fechadas: lábios juntos
  p: C(0, 0), b: C(0, 0), m: C(0, 0),
  // lábio inferior nos dentes
  f: C(0.12, 0.35), v: C(0.12, 0.35),
  // arredondadas
  w: C(0.22, -0.95), ʃ: C(0.25, -0.55), ʒ: C(0.25, -0.55), ʧ: C(0.25, -0.55), ʤ: C(0.25, -0.55), ɹ: C(0.28, -0.45), r: C(0.28, -0.45),
  // língua/dentes, boca pouco aberta
  t: C(0.18, 0.3), d: C(0.18, 0.3), n: C(0.2, 0.2), l: C(0.26, 0.2), s: C(0.12, 0.55), z: C(0.12, 0.55),
  θ: C(0.22, 0.3), ð: C(0.22, 0.3), k: C(0.28, 0.1), g: C(0.28, 0.1), ɡ: C(0.28, 0.1), ŋ: C(0.24, 0.1), h: C(0.35, 0),
  j: C(0.22, 0.75), ɾ: C(0.2, 0.25), ʔ: C(0.05, 0),
  // vogais abertas
  ɑ: V(0.95, 0.05), a: V(0.92, 0.1), æ: V(0.85, 0.45), ʌ: V(0.7, 0.05), ɐ: V(0.65, 0.05), A: V(0.62, 0.55), I: V(0.82, 0.3), W: V(0.8, -0.3),
  // médias
  ɛ: V(0.6, 0.6), e: V(0.52, 0.65), ə: V(0.42, 0), ɚ: V(0.4, -0.3), ɜ: V(0.48, -0.2), ᵊ: V(0.3, 0),
  // fechadas largas
  i: V(0.32, 0.95), ɪ: V(0.38, 0.8), y: V(0.3, -0.6),
  // arredondadas
  o: V(0.55, -0.85), O: V(0.52, -0.85), ɔ: V(0.68, -0.7), Y: V(0.6, -0.5), u: V(0.32, -1), ʊ: V(0.36, -0.85),
}
const REST: Shape = { open: 0, vowel: 0 }

function shapeOf(p: string): Shape {
  const clean = p.replace(/[ˈˌː]/g, '')
  if (!clean) return REST
  return SHAPES[clean] ?? SHAPES[clean[0]] ?? C(0.3, 0)
}

const smooth = (t: number) => t * t * (3 - 2 * t)

/**
 * Forma da boca no instante `f` (fração do áudio). Coarticulação: perto do fim de cada fonema a boca já vai para o próximo;
 * as consoantes pegam metade do formato da vogal vizinha (o "o" de "go" já arredonda o "g"). Entre palavras com pausa real a
 * boca fecha; emendas curtas (< 70 ms) não fecham.
 */
export function shapeAt(t: VisemeTrack, f: number): { open: number; vowel: number } {
  const ph = t.phones
  const dur = t.el.duration
  if (!ph.length) return REST
  // fonema da vez (busca binária)
  let lo = 0, hi = ph.length - 1
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ph[mid].f <= f) lo = mid; else hi = mid - 1 }
  const cur = ph[lo]
  if (f < cur.f) {
    // antes do primeiro fonema: só abre nos últimos 60 ms
    const lead = (cur.f - f) * dur
    if (lead > 0.06) return REST
    const s = shapeOf(cur.p)
    const k = smooth(1 - lead / 0.06)
    return { open: s.open * k, vowel: s.vowel * k }
  }
  const next = ph[lo + 1]
  const gapAfter = next ? (next.f - cur.e) * dur : Infinity
  const sCur = withNeighborVowel(ph, lo)
  if (f > cur.e) {
    // entre fonemas (pausa)
    if (gapAfter < 0.07 && next) return mix(sCur, withNeighborVowel(ph, lo + 1), (f - cur.e) / Math.max(1e-4, next.f - cur.e))
    const after = (f - cur.e) * dur
    const k = smooth(Math.min(1, after / 0.08))
    return mix(sCur, REST, k)
  }
  const len = Math.max(1e-4, cur.e - cur.f)
  const u = (f - cur.f) / len
  if (next && gapAfter < 0.07 && u > 0.6) return mix(sCur, withNeighborVowel(ph, lo + 1), smooth((u - 0.6) / 0.4) * 0.6)
  return sCur
}

function withNeighborVowel(ph: PhoneTiming[], i: number): Shape {
  const s = shapeOf(ph[i].p)
  if (s.vowelish || s.open === 0) return s
  const n = ph[i + 1] && shapeOf(ph[i + 1].p)
  const p = ph[i - 1] && shapeOf(ph[i - 1].p)
  const v = n?.vowelish ? n : p?.vowelish ? p : null
  return v ? { open: s.open, vowel: s.vowel * 0.5 + v.vowel * 0.5 } : s
}

function mix(a: { open: number; vowel: number }, b: { open: number; vowel: number }, k: number) {
  k = Math.max(0, Math.min(1, k))
  return { open: a.open + (b.open - a.open) * k, vowel: a.vowel + (b.vowel - a.vowel) * k }
}

if (import.meta.env.DEV) (globalThis as unknown as { __visemeTrack?: () => VisemeTrack | null }).__visemeTrack = () => current
