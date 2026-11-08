// Camada centralizada de áudio do Bookmoo.
// 1) Pede o áudio ao Supabase (tts-generate → cache ou job → tts-status)
// 2) Toca com HTMLAudioElement (um único player global: nunca dois áudios ao mesmo tempo)
// 3) Se o serviço TTS falhar, cai para a voz nativa do navegador (fallback temporário).
import { supabase } from '@/lib/supabase'

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
}

export interface SpeakHandle {
  /** Resolve quando o áudio termina (ou é interrompido). */
  done: Promise<void>
  source: 'voicestudio' | 'browser'
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

/** Pré-carrega (gera/aquece cache) sem tocar. Erros são ignorados. */
export function prefetch(text: string, opts: SpeakOptions = {}) {
  if (!text.trim()) return
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
    u.onend = () => resolve()
    u.onerror = () => resolve()
    window.speechSynthesis.speak(u)
  })
}

/** Interrompe qualquer reprodução (VoiceStudio ou navegador). */
export function stopSpeaking() {
  currentToken++
  if (player) {
    player.pause()
    player.removeAttribute('src')
    player.load()
  }
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
}

export function pauseSpeaking() {
  if (player && !player.paused) player.pause()
  else if (typeof window !== 'undefined') window.speechSynthesis?.pause()
}

export function resumeSpeaking() {
  if (player && player.src && player.paused) player.play().catch(() => {})
  else if (typeof window !== 'undefined') window.speechSynthesis?.resume()
}

export function isTtsConfigured() {
  return !!supabase && import.meta.env.VITE_TTS_PROVIDER !== 'browser'
}

/**
 * Fala um texto. Interrompe o áudio anterior. Usa VoiceStudio; se indisponível, voz do navegador.
 */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<SpeakHandle> {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  stopSpeaking()
  const token = currentToken
  if (!trimmed) return { done: Promise.resolve(), source: 'browser' }

  if (isTtsConfigured()) {
    try {
      const url = await getAudioUrl(trimmed, opts)
      if (token !== currentToken) return { done: Promise.resolve(), source: 'voicestudio' }
      const a = getPlayer()
      a.src = url
      a.playbackRate = Math.min(1.5, Math.max(0.5, opts.rate ?? 1))
      ;(a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true
      const done = new Promise<void>((resolve) => {
        const finish = () => { a.removeEventListener('ended', finish); a.removeEventListener('error', finish); a.removeEventListener('emptied', finish); resolve() }
        a.addEventListener('ended', finish)
        a.addEventListener('error', finish)
        a.addEventListener('emptied', finish)
      })
      await a.play()
      return { done, source: 'voicestudio' }
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
