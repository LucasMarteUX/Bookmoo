// Camada centralizada de áudio do Bookmoo.
// 1) Pede o áudio ao Supabase (tts-generate → cache ou job → tts-status)
// 2) Toca com HTMLAudioElement (um único player global: nunca dois áudios ao mesmo tempo)
// 3) Se o serviço TTS falhar, cai para a voz nativa do navegador (fallback temporário).
import { supabase } from '@/lib/supabase'
import { activeKokoroVoice, kokoroAudioUrl, type WordTiming } from '@/lib/kokoro/engine'
import { askVoiceOnce } from '@/lib/voiceGate'
import { countWords, listWords, wordRegex } from '@/lib/wordTokens'

export type TtsContext = 'word' | 'phrase' | 'reader' | 'lesson' | 'preview'

export interface TtsVoice {
  id: string
  name: string
  language: string | null
  accent: string | null
  description: string | null
  model_id: string
  is_default: boolean
  preview_url: string | null
}
export interface TtsPreferences {
  preferred_voice_id: string | null
  playback_speed: number
  auto_play: boolean
}

export interface SpeakOptions {
  language?: string
  voiceId?: string | null
  context?: TtsContext
  /** Velocidade do player (0.5–1.5). Aplicada com preservesPitch, sem regenerar o áudio. */
  rate?: number
  onLoading?: (loading: boolean) => void
  /** Chamado quando a reprodução usa o fallback do navegador (útil para UI/telemetria). */
  onFallback?: (reason: string) => void
  signal?: AbortSignal
  /** Força uma voz Kokoro específica (ex.: prévia). */
  kokoroVoice?: string
  /** Índice (0-based) da palavra sendo falada dentro do texto, para destaque palavra a palavra. */
  onWord?: (wordIndex: number) => void
}

export interface SpeakHandle {
  /** Resolve quando o áudio termina (ou é interrompido). */
  done: Promise<void>
  source: 'kokoro' | 'voicestudio' | 'browser'
}

const POLL_INTERVAL_MS = 700
const GENERATION_TIMEOUT_MS = 60_000
const URL_CACHE_TTL_MS = 50 * 60_000 // signed URLs duram 1h

const urlCache = new Map<string, { url: string; at: number }>()
const inflight = new Map<string, Promise<string>>()
let player: HTMLAudioElement | null = null
let currentToken = 0
let serviceDownUntil = 0

function getPlayer(): HTMLAudioElement {
  if (!player) {
    player = new Audio()
    player.preload = 'auto'
  }
  return player
}

async function invoke<T>(name: string, body?: unknown, method: 'POST' | 'GET' = 'POST'): Promise<T> {
  if (!supabase) throw new Error('supabase_not_configured')
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown>, method })
  if (error) throw error
  return data as T
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('aborted', 'AbortError')) }, { once: true })
  })

function cacheKey(text: string, o: SpeakOptions) {
  return JSON.stringify([text.replace(/\s+/g, ' ').trim(), o.language ?? 'en', o.voiceId ?? '', o.context ?? 'reader'])
}

/** Obtém uma URL reproduzível (cache local → Supabase → job). */
export async function getAudioUrl(text: string, opts: SpeakOptions = {}): Promise<string> {
  if (Date.now() < serviceDownUntil) throw new Error('tts_service_cooldown')
  const key = cacheKey(text, opts)
  const hit = urlCache.get(key)
  if (hit && Date.now() - hit.at < URL_CACHE_TTL_MS) return hit.url
  const existing = inflight.get(key)
  if (existing) return existing

  const p = (async () => {
    type GenRes = { status: string; audio_url?: string; job_id?: string; error?: string }
    const res = await invoke<GenRes>('tts-generate', {
      text, language: opts.language ?? 'en', voice_id: opts.voiceId ?? undefined, context: opts.context ?? 'reader',
    })
    if (res.status === 'completed' && res.audio_url) return res.audio_url
    if (!res.job_id) throw new Error(res.error ?? 'tts_generate_failed')

    opts.onLoading?.(true)
    const deadline = Date.now() + GENERATION_TIMEOUT_MS
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS, opts.signal)
      const s = await invoke<GenRes>('tts-status', { job_id: res.job_id })
      if (s.status === 'completed' && s.audio_url) return s.audio_url
      if (s.status === 'failed' || s.status === 'cancelled') throw new Error(s.error ?? `tts_${s.status}`)
    }
    throw new Error('tts_timeout')
  })()

  inflight.set(key, p)
  try {
    const url = await p
    urlCache.set(key, { url, at: Date.now() })
    return url
  } finally {
    inflight.delete(key)
    opts.onLoading?.(false)
  }
}

/**
 * A voz é sempre gravada na velocidade natural. Pedir para o modelo falar a 0.6x
 * estica os sons e deixa a voz abafada. O devagar acontece só na hora de tocar.
 */
export function kokoroSpeed(rate: number): number {
  return Math.round(Math.min(1.5, Math.max(0.5, rate)) * 100) / 100
}

/** Pré-carrega (gera/aquece cache) sem tocar. Erros são ignorados. */
export function prefetch(text: string, opts: SpeakOptions = {}) {
  if (!text.trim()) return
  const kv = opts.kokoroVoice ?? activeKokoroVoice()
  if (kv && activeKokoroVoice() && (opts.language ?? 'en').toLowerCase().startsWith('en')) {
    kokoroAudioUrl(text.replace(/\s+/g, ' ').trim(), kv, 1).catch(() => {})
    return
  }
  if (!isTtsConfigured()) return
  getAudioUrl(text, opts).then((url) => {
    const a = new Audio()
    a.preload = 'auto'
    a.src = url
  }).catch(() => {})
}

/**
 * Estimativa do início de cada palavra no áudio (fração de 0 a 1).
 * O Kokoro não devolve alinhamento temporal, então ponderamos pelo tamanho da palavra
 * e por pausas de pontuação. Fica próximo o bastante para o destaque acompanhar a fala.
 */
function wordStartFractions(text: string): number[] {
  // Mesmas palavras que a tela numera (wordTokens); a pontuação entre elas vira pausa.
  const matches = [...text.matchAll(wordRegex())]
  const weights = matches.map((m, k) => {
    const end = (m.index ?? 0) + m[0].length
    const gap = text.slice(end, k + 1 < matches.length ? matches[k + 1].index : text.length)
    const pause = /[.!?…]/.test(gap) ? 4 : /[,;:—–]/.test(gap) ? 2 : 0
    return { speak: m[0].length + 1.5, pause }
  })
  const total = weights.reduce((s, w) => s + w.speak + w.pause, 0) || 1
  const starts: number[] = []
  let acc = 0
  for (const w of weights) {
    starts.push(acc / total)
    acc += w.speak + w.pause
  }
  return starts
}

// Encerra a frase em reprodução. Chamado por stopSpeaking: é a ÚNICA forma, além do fim
// real do áudio, de dar uma frase por terminada.
let finishCurrent: (() => void) | null = null

/**
 * Converte os tempos reais por palavra falada (fonemas agrupados pelo Kokoro) para as palavras
 * do texto como a tela as numera. Normalmente a contagem bate 1:1. Quando não bate (números
 * lidos por extenso, siglas, hífens), alinha proporcionalmente por letras/fonemas, mantendo a ordem.
 */
/**
 * Casa os blocos de som do Kokoro com as palavras da tela. O sintetizador às vezes junta palavrinhas
 * ("a mere", "of the" viram um bloco) ou parte uma palavra (números). Alinhamento por programação
 * dinâmica: cada bloco cobre 1–3 palavras, ou uma palavra ocupa 2 blocos, escolhendo a combinação em
 * que o nº de fonemas bate com o tamanho das palavras. Dentro de um bloco com várias palavras, o
 * tempo é dividido pelo tamanho de cada uma — o erro fica preso ao bloco e não se acumula.
 */
export function startsFromTimings(text: string, timings: WordTiming[]): number[] | undefined {
  const words = listWords(text)
  if (!words.length || !timings.length) return undefined
  if (timings.length === words.length) return timings.map((t) => t.f)
  const W = words.length, G = timings.length
  const est = words.map((w) => Math.max(1, w.replace(/['’]/g, '').length * 0.85))
  const n = timings.map((t) => Math.max(1, t.n))
  const fit = (phon: number, letters: number) => Math.abs(phon - letters) / Math.max(phon, letters)
  const INF = 1e9
  const dp = Array.from({ length: W + 1 }, () => new Array<number>(G + 1).fill(INF))
  const back = Array.from({ length: W + 1 }, () => new Array<[number, number]>(G + 1).fill([0, 0]))
  dp[0][0] = 0
  for (let i = 0; i <= W; i++) for (let j = 0; j <= G; j++) {
    if (dp[i][j] >= INF) continue
    // k palavras -> 1 bloco
    for (let k = 1; k <= 3 && i + k <= W && j + 1 <= G; k++) {
      let sum = 0
      for (let x = i; x < i + k; x++) sum += est[x]
      const c = dp[i][j] + fit(n[j], sum) + (k - 1) * 0.12
      if (c < dp[i + k][j + 1]) { dp[i + k][j + 1] = c; back[i + k][j + 1] = [k, 1] }
    }
    // 1 palavra -> 2 blocos (ex.: números por extenso)
    if (i + 1 <= W && j + 2 <= G) {
      const c = dp[i][j] + fit(n[j] + n[j + 1], est[i]) + 0.25
      if (c < dp[i + 1][j + 2]) { dp[i + 1][j + 2] = c; back[i + 1][j + 2] = [1, 2] }
    }
  }
  if (dp[W][G] >= INF) return undefined
  const out = new Array<number>(W).fill(0)
  let i = W, j = G
  while (i > 0 && j > 0) {
    const [k, g] = back[i][j]
    const g0 = j - g
    const from = timings[g0].f
    const to = g0 + g < G ? timings[g0 + g].f : Math.min(1, from + (1 - from) * 0.9)
    if (k === 1) out[i - 1] = from
    else {
      const total = est.slice(i - k, i).reduce((a, b) => a + b, 0)
      let acc = 0
      for (let x = i - k; x < i; x++) { out[x] = from + (to - from) * (acc / total); acc += est[x] }
    }
    i -= k; j -= g
  }
  for (let x = 1; x < W; x++) out[x] = Math.max(out[x], out[x - 1])
  return out
}

const HIGHLIGHT_LEAD_S = 0.12

async function playUrl(url: string, rate: number, text?: string, onWord?: (i: number) => void, realStarts?: number[]): Promise<{ done: Promise<void> }> {
  const a = getPlayer()
  a.src = url
  const mySrc = a.src
  a.playbackRate = kokoroSpeed(rate)
  const pitched = a as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean }
  pitched.preservesPitch = true
  pitched.webkitPreservesPitch = true
  let raf = 0
  const done = new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      cancelAnimationFrame(raf)
      a.removeEventListener('ended', onEnded)
      a.removeEventListener('error', onError)
      if (finishCurrent === finish) finishCurrent = null
      resolve()
    }
    // Não usamos 'emptied': ao parar a frase anterior o navegador agenda esse evento e ele
    // chegava já com a frase nova tocando, encerrando-a na hora (o "pulo" depois do ponto final).
    // Só aceitamos eventos que pertencem a ESTE áudio.
    const onEnded = () => { if (a.src === mySrc && a.ended) finish() }
    const onError = () => { if (a.src === mySrc && a.error) finish() }
    a.addEventListener('ended', onEnded)
    a.addEventListener('error', onError)
    finishCurrent = finish
  })
  // Se o aluno pausou enquanto a frase era preparada, só começa quando ele retomar.
  await waitWhilePaused()
  if (a.src !== mySrc) return { done } // parado enquanto esperava
  await a.play()
  if (text && onWord) {
    // Tempos reais do Kokoro quando disponíveis; senão, estimativa pelo tamanho das palavras.
    const starts = realStarts ?? wordStartFractions(text)
    let last = -1
    const tick = () => {
      // O player é compartilhado: se já está tocando outra frase, este observador encerra.
      if (a.src !== mySrc) return
      if (a.duration > 0 && Number.isFinite(a.duration)) {
        // Antecipa ~120 ms (em tempo real, por isso multiplica pela velocidade): é o tempo de
        // perceber o destaque. Sem isso a palavra acende quando já está sendo dita.
        const f = Math.min(1, (a.currentTime + HIGHLIGHT_LEAD_S * a.playbackRate) / a.duration)
        let i = last < 0 ? 0 : last
        while (i + 1 < starts.length && starts[i + 1] <= f) i++
        if (i !== last) { last = i; onWord(i) }
      }
      // Continua observando também durante pausa; o loop termina em `finish`.
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  }
  return { done }
}

/** Interrompe qualquer reprodução (VoiceStudio ou navegador). */
// ---------------------------------------------------------------------------
// Pausa: enquanto pausado, nenhuma frase nova começa (inclusive a que está sendo gerada)
// e o Reader espera antes de seguir para a próxima frase.
// ---------------------------------------------------------------------------
let paused = false
let resumeWaiters: (() => void)[] = []
function releaseWaiters() {
  const w = resumeWaiters
  resumeWaiters = []
  w.forEach((f) => f())
}
export function waitWhilePaused(): Promise<void> {
  return paused ? new Promise((r) => resumeWaiters.push(r)) : Promise.resolve()
}

/** Para o áudio atual sem mexer no estado de pausa (usado ao trocar de frase). */
function haltPlayback() {
  currentToken++
  const f = finishCurrent
  finishCurrent = null
  f?.()
  if (player) {
    player.pause()
    player.removeAttribute('src')
    player.load()
  }
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
}

/** Interrompe qualquer reprodução e sai do estado de pausa. */
export function stopSpeaking() {
  paused = false
  haltPlayback()
  releaseWaiters()
}

export function pauseSpeaking() {
  paused = true
  if (player && !player.paused) player.pause()
  if (typeof window !== 'undefined') window.speechSynthesis?.pause()
}

export function resumeSpeaking() {
  paused = false
  releaseWaiters()
  if (player && player.getAttribute('src') && player.paused && !player.ended) player.play().catch(() => {})
  if (typeof window !== 'undefined') window.speechSynthesis?.resume()
}

/** VoiceStudio (servidor) só quando explicitamente habilitado. */
export function isTtsConfigured() {
  return !!supabase && import.meta.env.VITE_TTS_PROVIDER === 'voicestudio'
}


/**
 * Fala um texto com a voz baixada. Nunca usa a voz do navegador.
 * Sem voz instalada, pede o aviso uma única vez e não toca nada.
 */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<SpeakHandle> {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  haltPlayback()
  const token = currentToken
  if (!trimmed) return { done: Promise.resolve(), source: 'kokoro' }

  const lang = (opts.language ?? 'en').toLowerCase()
  const kokoroVoice = activeKokoroVoice() ? (opts.kokoroVoice ?? activeKokoroVoice()) : null
  if (lang.startsWith('en') && !kokoroVoice && !isTtsConfigured()) {
    askVoiceOnce()
    return { done: Promise.resolve(), source: 'kokoro' }
  }
  if (kokoroVoice && lang.startsWith('en')) {
    try {
      opts.onLoading?.(true)
      const clip = await kokoroAudioUrl(trimmed, kokoroVoice, 1, 'high')
      opts.onLoading?.(false)
      if (token !== currentToken) return { done: Promise.resolve(), source: 'kokoro' }
      const starts = clip.words ? startsFromTimings(trimmed, clip.words) : undefined
      return { ...(await playUrl(clip.url, opts.rate ?? 1, trimmed, opts.onWord, starts)), source: 'kokoro' }
    } catch (e) {
      opts.onLoading?.(false)
      if (token !== currentToken) return { done: Promise.resolve(), source: 'kokoro' }
      console.warn('[tts] A voz baixada não respondeu:', e)
      opts.onFallback?.(String((e as Error)?.message ?? e))
      return { done: Promise.resolve(), source: 'kokoro' }
    }
  }

  if (isTtsConfigured()) {
    try {
      const url = await getAudioUrl(trimmed, opts)
      if (token !== currentToken) return { done: Promise.resolve(), source: 'voicestudio' }
      return { ...(await playUrl(url, opts.rate ?? 1, trimmed, opts.onWord)), source: 'voicestudio' }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError' || token !== currentToken) return { done: Promise.resolve(), source: 'voicestudio' }
      const reason = (e as Error)?.message ?? String(e)
      if (!/text_too_long|empty_text|rate_limited/.test(reason)) serviceDownUntil = Date.now() + 30_000
      console.warn('[tts] VoiceStudio indisponível:', reason)
      opts.onFallback?.(reason)
    }
  }
  askVoiceOnce()
  return { done: Promise.resolve(), source: 'kokoro' }
}

// ---------------------------------------------------------------------------
// Catálogo e preferências
// ---------------------------------------------------------------------------
export async function listVoices(): Promise<{ voices: TtsVoice[]; preferences: TtsPreferences | null }> {
  return invoke('tts-list-voices', undefined, 'GET')
}

export async function savePreferences(p: Partial<TtsPreferences>): Promise<TtsPreferences> {
  const r = await invoke<{ preferences: TtsPreferences }>('tts-save-preferences', p)
  urlCache.clear()
  return r.preferences
}

/** Divide textos longos em segmentos por frase, preservando ordem e pontuação. */
export function splitIntoSegments(text: string, maxChars = 400): string[] {
  const sentences = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?…])\s+/).filter(Boolean)
  const out: string[] = []
  for (const s of sentences) {
    if (s.length <= maxChars) { out.push(s); continue }
    let rest = s
    while (rest.length > maxChars) {
      const cut = Math.max(rest.lastIndexOf(', ', maxChars), rest.lastIndexOf('; ', maxChars), rest.lastIndexOf(' ', maxChars))
      const at = cut > 0 ? cut + 1 : maxChars
      out.push(rest.slice(0, at).trim())
      rest = rest.slice(at).trim()
    }
    if (rest) out.push(rest)
  }
  return out
}
