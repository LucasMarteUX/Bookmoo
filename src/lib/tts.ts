// Camada centralizada de áudio do Bookmoo.
// 1) Pede o áudio ao Supabase (tts-generate → cache ou job → tts-status)
// 2) Toca com HTMLAudioElement (um único player global: nunca dois áudios ao mesmo tempo)
// 3) Se o serviço TTS falhar, cai para a voz nativa do navegador (fallback temporário).
import { supabase } from '@/lib/supabase'
import { activeKokoroVoice, kokoroAudioUrl, type WordTiming } from '@/lib/kokoro/engine'
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
 * Velocidade escolhida pelo aluno → velocidade de geração do Kokoro (fala real: 0.5x dura o dobro de 1.0x).
 * As pausas extras entre frases nas velocidades lentas ficam a cargo do Reader.
 */
export function kokoroSpeed(rate: number): number {
  return Math.round(Math.min(1.5, Math.max(0.5, rate)) * 100) / 100
}

/** Pré-carrega (gera/aquece cache) sem tocar. Erros são ignorados. */
export function prefetch(text: string, opts: SpeakOptions = {}) {
  if (!text.trim()) return
  const kv = activeKokoroVoice()
  if (kv && (opts.language ?? 'en').toLowerCase().startsWith('en')) {
    kokoroAudioUrl(text.replace(/\s+/g, ' ').trim(), kv, kokoroSpeed(opts.rate ?? 1)).catch(() => {})
    return
  }
  if (!isTtsConfigured()) return
  getAudioUrl(text, opts).then((url) => {
    const a = new Audio()
    a.preload = 'auto'
    a.src = url
  }).catch(() => {})
}

function speakWithBrowser(text: string, opts: SpeakOptions): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return resolve()
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const lang = (opts.language ?? 'en').toLowerCase()
    u.lang = lang === 'en' ? 'en-US' : lang
    u.rate = Math.min(1.2, Math.max(0.4, (opts.rate ?? 1) * 0.9))
    const voices = window.speechSynthesis.getVoices()
    const v = voices.find((x) => x.lang === u.lang) ?? voices.find((x) => x.lang.startsWith(lang.slice(0, 2)))
    if (v) u.voice = v
    if (opts.onWord) {
      opts.onWord(0)
      u.onboundary = (ev) => {
        if (ev.name !== 'word') return
        opts.onWord!(countWords(text.slice(0, ev.charIndex)))
      }
    }
    u.onend = () => resolve()
    u.onerror = () => resolve()
    window.speechSynthesis.speak(u)
  })
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
function startsFromTimings(text: string, timings: WordTiming[]): number[] | undefined {
  const words = listWords(text)
  if (!words.length || !timings.length) return undefined
  if (timings.length === words.length) return timings.map((t) => t.f)
  const wLen = words.map((w) => w.length)
  const wTot = wLen.reduce((a, b) => a + b, 0)
  const gLen = timings.map((t) => Math.max(1, t.n))
  const gTot = gLen.reduce((a, b) => a + b, 0)
  const gStartPos: number[] = []
  let acc = 0
  for (const n of gLen) { gStartPos.push(acc / gTot); acc += n }
  const out: number[] = []
  let wAcc = 0
  let j = 0
  for (const len of wLen) {
    const pos = wAcc / wTot
    while (j + 1 < timings.length && gStartPos[j + 1] <= pos + 1e-6) j++
    out.push(Math.max(out[out.length - 1] ?? 0, timings[j].f))
    wAcc += len
  }
  return out
}

async function playUrl(url: string, rate: number, text?: string, onWord?: (i: number) => void, realStarts?: number[]): Promise<{ done: Promise<void> }> {
  const a = getPlayer()
  a.src = url
  const mySrc = a.src
  a.playbackRate = Math.min(1.5, Math.max(0.5, rate))
  ;(a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true
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
        // Pequena antecipação para o destaque não parecer atrasado.
        const f = Math.min(1, (a.currentTime + 0.03) / a.duration)
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
 * Fala um texto. Interrompe o áudio anterior. Usa VoiceStudio; se indisponível, voz do navegador.
 */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<SpeakHandle> {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  haltPlayback()
  const token = currentToken
  if (!trimmed) return { done: Promise.resolve(), source: 'browser' }

  // 1) Voz local Kokoro (baixada pelo aluno), só para inglês.
  const lang = (opts.language ?? 'en').toLowerCase()
  const kokoroVoice = opts.kokoroVoice ?? activeKokoroVoice()
  if (kokoroVoice && lang.startsWith('en')) {
    try {
      opts.onLoading?.(true)
      // Velocidade aplicada na geração: fala mais lenta e natural, sem esticar o áudio.
      const clip = await kokoroAudioUrl(trimmed, kokoroVoice, kokoroSpeed(opts.rate ?? 1), 'high')
      opts.onLoading?.(false)
      if (token !== currentToken) return { done: Promise.resolve(), source: 'kokoro' }
      const starts = clip.words ? startsFromTimings(trimmed, clip.words) : undefined
      return { ...(await playUrl(clip.url, 1, trimmed, opts.onWord, starts)), source: 'kokoro' }
    } catch (e) {
      opts.onLoading?.(false)
      if (token !== currentToken) return { done: Promise.resolve(), source: 'kokoro' }
      console.warn('[tts] Kokoro falhou, usando voz do navegador:', e)
      opts.onFallback?.(String((e as Error)?.message ?? e))
      return { done: speakWithBrowser(trimmed, opts), source: 'browser' }
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
      // Evita martelar um serviço fora do ar: 30s de cooldown em erros de rede/servidor.
      if (!/text_too_long|empty_text|rate_limited/.test(reason)) serviceDownUntil = Date.now() + 30_000
      console.warn('[tts] VoiceStudio indisponível, usando voz do navegador:', reason)
      opts.onFallback?.(reason)
    }
  }
  return { done: speakWithBrowser(trimmed, opts), source: 'browser' }
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
