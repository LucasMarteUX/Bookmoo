// Vozes do próprio aparelho (as que já vêm no iPhone, no Android e no computador): funcionam na hora, sem baixar nada.
// No celular a voz Kokoro pesa e às vezes nem baixa; sem isto, ler, conversar e o ditado ficavam mudos. Aqui há sempre
// uma voz feminina e uma masculina em inglês, e um tom mais fino para os jovens (Yuno e Yuri).
//
// Quando o aparelho tem só uma voz em inglês (comum no Android), o gênero sai pelo tom: mais grave para o masculino.
import { boundaryClock, clearSpeechClock, setSpeechClock } from '@/lib/speechClock'
import { wordRegex } from '@/lib/wordTokens'

export type Gender = 'female' | 'male'

const synth = () => (typeof window !== 'undefined' ? window.speechSynthesis : undefined)

// Voz escolhida para a leitura (quando não há personagem na tela): feminina ou masculina. Fica salva no aparelho.
const PREF_KEY = 'bookmoo.deviceVoice.v1'
const prefListeners = new Set<() => void>()
export function getDeviceVoiceGender(): Gender {
  try { return localStorage.getItem(PREF_KEY) === 'male' ? 'male' : 'female' } catch { return 'female' }
}
export function setDeviceVoiceGender(g: Gender) {
  try { localStorage.setItem(PREF_KEY, g) } catch { /* sem armazenamento */ }
  prefListeners.forEach(f => f())
}
export function subscribeDeviceVoice(fn: () => void) { prefListeners.add(fn); return () => { prefListeners.delete(fn) } }
/** Nome da voz do aparelho que fala para este gênero (para mostrar na tela), ou null. */
export async function deviceVoiceName(g: Gender): Promise<string | null> { await voicesReady(); return pick(g).voice?.name ?? null }

// O Chrome perde a referência da fala no meio (coletor de lixo) e o fim nunca chega: guardamos a fala atual aqui.
let currentUtterance: SpeechSynthesisUtterance | null = null

/** O aparelho fala por conta própria? */
export function hasDeviceVoice(): boolean {
  return !!synth() && typeof window.SpeechSynthesisUtterance !== 'undefined'
}

/** Celular ou tablet (onde a voz Kokoro é pesada demais para ser obrigatória). */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
}

// Nomes conhecidos das vozes de cada sistema (iOS/macOS, Android/Chrome, Windows/Edge).
const FEMALE = /samantha|karen|moira|tessa|victoria|allison|ava|susan|zoe|nicky|martha|catherine|serena|kate|fiona|veena|female|woman|zira|aria|jenny|libby|sonia|natasha|michelle|emma|sfg|iob|iog|tpc|tpf|ena\b/i
const MALE = /\b(daniel|alex|fred|aaron|arthur|gordon|rishi|oliver|tom|evan|nathan|lee|male|man|david|mark|guy|ryan|george|james|thomas|christopher|eric|brian|iol|iom|tpd|enc)\b/i
const GOOD = /enhanced|premium|natural|neural|siri|google|online/i

let cache: SpeechSynthesisVoice[] = []
function voices(): SpeechSynthesisVoice[] {
  const list = synth()?.getVoices() ?? []
  if (list.length) cache = list
  return cache
}
/** A lista de vozes chega atrasada em alguns aparelhos (iOS, Chrome): espera até 1,2 s. */
function voicesReady(): Promise<SpeechSynthesisVoice[]> {
  if (voices().length) return Promise.resolve(cache)
  return new Promise(resolve => {
    const s = synth()
    if (!s) { resolve([]); return }
    const done = () => { s.removeEventListener?.('voiceschanged', done); resolve(voices()) }
    s.addEventListener?.('voiceschanged', done)
    window.setTimeout(done, 1200)
  })
}

/** Melhor voz em inglês do gênero pedido, e se ela é mesmo desse gênero (senão o tom compensa). */
function pick(gender: Gender): { voice: SpeechSynthesisVoice | null; matched: boolean } {
  // Fora as vozes de brincadeira do macOS/iOS (sinos, sussurro, robô...) e as "vovó/vovô".
  const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|grandma|grandpa|eddy|flo\b|reed|rocko|sandy|shelley|junior|ralph|kathy|princess/i
  const en = voices().filter(v => /^en/i.test(v.lang) && !NOVELTY.test(v.name))
  if (!en.length) return { voice: null, matched: false }
  const us = (v: SpeechSynthesisVoice) => (/en(-|_)US/i.test(v.lang) ? 1 : /en(-|_)GB/i.test(v.lang) ? 0.8 : 0)
  const score = (v: SpeechSynthesisVoice) => (GOOD.test(v.name) ? 2 : 0) + us(v) + (v.localService ? 0.5 : 0)
  const want = gender === 'male' ? MALE : FEMALE
  const other = gender === 'male' ? FEMALE : MALE
  const byGender = en.filter(v => want.test(v.name) && !other.test(v.name)).sort((a, b) => score(b) - score(a))
  if (byGender[0]) return { voice: byGender[0], matched: true }
  const neutral = en.filter(v => !other.test(v.name)).sort((a, b) => score(b) - score(a))
  return { voice: neutral[0] ?? en.sort((a, b) => score(b) - score(a))[0], matched: false }
}

/** Tom final: o do personagem (1 = adulto; Yuno 1,3; Yuri 1,35), mais forte aqui porque a voz do aparelho muda pouco. */
function devicePitch(gender: Gender, pitch: number, matched: boolean) {
  let p = 1 + (pitch - 1) * 1.8
  // Voz do gênero errado: adulto masculino desce o tom; jovem não (um menino com voz grave soava como homem adulto).
  if (!matched) p *= gender === 'male' ? (pitch > 1.1 ? 0.92 : 0.78) : 1.08
  return Math.max(0.5, Math.min(1.8, p))
}

/** Libera a voz no iPhone: ele só fala depois de um toque da pessoa, então o primeiro toque fala um silêncio. */
let unlocked = false
export function installDeviceVoiceUnlock() {
  if (unlocked || !hasDeviceVoice()) return
  const unlock = () => {
    if (unlocked) return
    unlocked = true
    try { const u = new SpeechSynthesisUtterance('.'); u.volume = 0; u.rate = 2; synth()!.speak(u) } catch { /* sem voz */ }
    void voicesReady()
    window.removeEventListener('pointerdown', unlock, true)
    window.removeEventListener('keydown', unlock, true)
  }
  window.addEventListener('pointerdown', unlock, true)
  window.addEventListener('keydown', unlock, true)
  // Alguns Androids pausam a voz quando a aba volta do segundo plano: retoma.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) synth()?.resume() })
}

/** Fala com a voz do aparelho. Destaca palavra a palavra (onWord) e alimenta a boca do personagem (relógio da fala). */
export async function deviceSpeak(text: string, o: { rate?: number; pitch?: number; gender?: Gender; onWord?: (i: number) => void; isStale?: () => boolean } = {}): Promise<{ done: Promise<void> }> {
  const s = synth()
  if (!s || !text.trim()) return { done: Promise.resolve() }
  await voicesReady()
  if (o.isStale?.()) return { done: Promise.resolve() }
  const gender = o.gender ?? getDeviceVoiceGender()
  const { voice, matched } = pick(gender)
  const u = new SpeechSynthesisUtterance(text)
  u.lang = voice?.lang ?? 'en-US'
  if (voice) u.voice = voice
  const rate = Math.max(0.5, Math.min(1.5, o.rate ?? 1))
  // As vozes do aparelho falam um pouco mais rápido que o Kokoro: 0,95 deixa o ritmo parecido.
  u.rate = rate * 0.95
  u.pitch = devicePitch(gender, o.pitch ?? 1, matched)
  const starts = [...text.matchAll(wordRegex())].map(m => m.index ?? 0)
  const bc = boundaryClock(text, rate)
  setSpeechClock(bc.clock)
  const done = new Promise<void>(resolve => {
    let over = false
    let watch = 0
    const finish = () => { if (over) return; over = true; bc.end(); clearSpeechClock(bc.clock); window.clearInterval(watch); window.clearTimeout(noStart); resolve() }
    // Alguns aparelhos não avisam o fim quando a fala é cancelada: depois que começa, confere de tempos em tempos.
    // E se nunca começar (voz bloqueada), não fica preso.
    const noStart = window.setTimeout(() => { if (!s.speaking) finish() }, 5000)
    u.onstart = () => {
      window.clearTimeout(noStart)
      bc.start(); o.onWord?.(0)
      watch = window.setInterval(() => { if (!s.speaking && !s.pending) finish() }, 400)
    }
    u.onboundary = e => {
      bc.boundary(e.charIndex)
      if (!o.onWord) return
      let i = 0
      while (i + 1 < starts.length && starts[i + 1] <= e.charIndex) i++
      o.onWord(i)
    }
    u.onend = finish
    u.onerror = finish
  })
  currentUtterance = u
  // Cancelar e falar no mesmo instante faz o Chrome do Android engolir a fala nova: só cancela se havia algo, e espera um pouco.
  if (s.speaking || s.pending) { s.cancel(); await new Promise(r => setTimeout(r, 80)) }
  if (o.isStale?.()) { currentUtterance = null; return { done: Promise.resolve() } }
  s.resume() // iOS às vezes fica "pausado" depois de um cancel
  s.speak(u)
  void done.then(() => { if (currentUtterance === u) currentUtterance = null })
  return { done }
}
