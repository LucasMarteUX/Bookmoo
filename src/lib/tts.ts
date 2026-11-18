// Camada centralizada de áudio do Bookmoo.
// 1) Pede o áudio ao Supabase (tts-generate → cache ou job → tts-status)
// 2) Toca com HTMLAudioElement (um único player global: nunca dois áudios ao mesmo tempo)
// 3) Se o serviço TTS falhar, cai para a voz nativa do navegador (fallback temporário).
import { supabase } from '@/lib/supabase'
import { activeKokoroVoice, ensureKokoroReady, isKokoroSupported, kokoroAudioUrl, type WordTiming } from '@/lib/kokoro/engine'
import { askVoiceOnce } from '@/lib/voiceGate'
import { isTutorVoice, resolveReadingVoice } from '@/lib/tutorReadingVoices'
import { deviceSpeak, hasDeviceVoice, isMobileDevice } from '@/lib/deviceVoice'
import { getSpeakerVoice, resolveSpeakerVoice } from '@/lib/speakerVoice'
import { audioClock, clearSpeechClock, setSpeechClock, type SpeechClock } from '@/lib/speechClock'
import { clearVisemeTrack, setVisemeTrack, type VisemeTrack } from '@/lib/visemeTrack'
import type { PhoneTiming } from '@/lib/kokoro/engine'
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
  /** Tom da voz (1 = natural; 1.1–1.25 = mais jovem/infantil). O ritmo da fala continua o mesmo. */
  pitch?: number
  /** De-esser (dB máx. nas sibilantes), vindo do tutor escolhido como voz. */
  deEssDb?: number
  /** Gênero da voz quando cai na voz do aparelho (padrão: o do personagem na tela, senão feminina). */
  gender?: 'female' | 'male'
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

// Um personagem animado (LivLiv) pode emprestar o próprio <audio> enquanto está na tela: a mesma voz
// toca por ele, e a boca do personagem lê esse áudio. Continua sendo um único player: nunca duas vozes.
const playbackOverrides: HTMLAudioElement[] = []
/** Usa este elemento para tocar as falas até a função devolvida ser chamada (o último a entrar vence). */
export function borrowPlaybackElement(el: HTMLAudioElement): () => void {
  haltPlayback()
  playbackOverrides.push(el)
  return () => {
    const i = playbackOverrides.indexOf(el)
    if (i < 0) return
    if (i === playbackOverrides.length - 1) haltPlayback()
    playbackOverrides.splice(i, 1)
  }
}
function activeElement(): HTMLAudioElement | null {
  return playbackOverrides[playbackOverrides.length - 1] ?? player
}

function getPlayer(): HTMLAudioElement {
  const borrowed = playbackOverrides[playbackOverrides.length - 1]
  if (borrowed) return borrowed
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
/**
 * Personagem com tom: o Kokoro gera em `gen` (nunca abaixo de 0,92, que estragava o começo das frases), o tom é aplicado no
 * áudio (fica gen × tom mais rápido) e o player corrige o resto com o tom preservado (`play`) até a velocidade escolhida.
 */
export function characterGen(rate: number, pitch: number) {
  const target = kokoroSpeed(rate)
  const gen = Math.round(Math.min(1.4, Math.max(0.92, target / pitch)) * 100) / 100
  return { gen, play: Math.round((target / (gen * pitch)) * 1000) / 1000 }
}

export function kokoroSpeed(rate: number): number {
  return Math.round(Math.min(1.5, Math.max(0.5, rate)) * 100) / 100
}

/**
 * Toca um áudio pronto (URL) pelo mesmo player das falas do app: o avatar que estiver com a voz mexe a boca junto.
 * Usado na entrevista da prova de proficiência, cujos áudios são gerados antes da prova.
 */
export async function playClip(url: string): Promise<{ done: Promise<void> }> {
  haltPlayback()
  return await playUrl(url, 1)
}

/** Pré-carrega (gera/aquece cache) sem tocar. Erros são ignorados. */
export function prefetch(text: string, opts: SpeakOptions = {}) {
  if (!text.trim()) return
  const kv = opts.kokoroVoice ?? activeKokoroVoice()
  if (kv && activeKokoroVoice() && (opts.language ?? 'en').toLowerCase().startsWith('en')) {
    // Tutor: mesmos parâmetros da fala (velocidade de geração e de-esser), para o cache servir na hora de tocar.
    const r = resolveReadingVoice(kv)
    const p = r.pitch && Math.abs(r.pitch - 1) > 0.01 ? Math.min(1.35, Math.max(0.8, r.pitch)) : 1
    const gen = p !== 1 ? characterGen(opts.rate ?? 1, p).gen : 1
    kokoroAudioUrl(text.replace(/\s+/g, ' ').trim(), r.kokoroVoice, gen, 'low', r.deEssDb && p !== 1 ? { maxDb: r.deEssDb, hz: 4500 / p } : undefined, p !== 1 ? p : undefined).catch(() => {})
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

async function playUrl(url: string, rate: number, text?: string, onWord?: (i: number) => void, realStarts?: number[], pitch = 1, phones?: PhoneTiming[] | null): Promise<{ done: Promise<void> }> {
  const a = getPlayer()
  a.src = url
  const mySrc = a.src
  // Tom diferente: o áudio já veio gerado mais devagar (ver speak) e toca mais rápido sem preservar o tom,
  // então fica mais agudo com o mesmo ritmo. Sem tom: velocidade com o tom preservado, como sempre.
  const shifted = Math.abs(pitch - 1) > 0.01
  a.playbackRate = shifted ? Math.min(1.5, pitch * kokoroSpeed(rate)) : kokoroSpeed(rate)
  const pitched = a as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean }
  pitched.preservesPitch = !shifted
  pitched.webkitPreservesPitch = !shifted
  let raf = 0
  let clock: SpeechClock | null = null
  // Fonemas com tempo real (Kokoro): a boca segue o relógio deste <audio>; some quando a frase acaba ou é interrompida.
  const track: VisemeTrack | null = phones?.length ? { el: a, src: a.src, phones } : null
  if (track) setVisemeTrack(track)
  const done = new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      cancelAnimationFrame(raf)
      if (clock) clearSpeechClock(clock)
      if (track) clearVisemeTrack(track)
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
  // Relógio para a boca dos personagens: segue o áudio de verdade, não uma estimativa.
  if (text) { clock = audioClock(text, a, realStarts ?? wordStartFractions(text)); setSpeechClock(clock) }
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
  const el = activeElement()
  if (el) {
    el.pause()
    el.removeAttribute('src')
    el.load()
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
  const el = activeElement()
  if (el && !el.paused) el.pause()
  if (typeof window !== 'undefined') window.speechSynthesis?.pause()
}

export function resumeSpeaking() {
  paused = false
  releaseWaiters()
  const el = activeElement()
  if (el && el.getAttribute('src') && el.paused && !el.ended) el.play().catch(() => {})
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
  // Personagem na tela (Yuno, Yuri…): voz e tom dele valem em qualquer fala e em qualquer velocidade, mesmo quando quem
  // chamou não passou (antes só a conversa passava, e no resto a Yuno e o Yuri falavam com a voz adulta).
  // Tutor escolhido como voz da leitura ("tutor:..."): vira a voz Kokoro dele, com tom e de-esser.
  if (isTutorVoice(opts.kokoroVoice)) {
    const r = resolveReadingVoice(opts.kokoroVoice)
    opts = { ...opts, kokoroVoice: r.kokoroVoice, pitch: opts.pitch ?? r.pitch ?? 1, gender: opts.gender ?? r.gender, deEssDb: r.deEssDb }
  }
  const sp = getSpeakerVoice()
  if (sp && opts.pitch == null) opts = { ...opts, pitch: sp.pitch, gender: opts.gender ?? sp.gender }
  // Personagem no computador: instala a voz na hora se ainda não estiver (nunca cai na voz do navegador).
  // Voz própria em todo aparelho (celular incluso): se ainda não está pronta, instala e espera; nunca usa a voz do navegador.
  if (lang.startsWith('en') && !activeKokoroVoice() && isKokoroSupported()) {
    opts.onLoading?.(true)
    await ensureKokoroReady()
    opts.onLoading?.(false)
    if (token !== currentToken) return { done: Promise.resolve(), source: 'kokoro' }
  }
  const spVoice = sp && !opts.kokoroVoice ? resolveSpeakerVoice(sp) : undefined
  const kokoroVoice = activeKokoroVoice() ? (opts.kokoroVoice ?? spVoice ?? activeKokoroVoice()) : null
  if (lang.startsWith('en') && !kokoroVoice && !isTtsConfigured()) {
    // Sem voz baixada: fala com a voz do próprio aparelho (no celular é o normal; no computador o aviso sugere baixar a melhor).
    if (!isMobileDevice()) askVoiceOnce()
    if (hasDeviceVoice()) return { ...(await speakOnDevice(trimmed, opts, token)), source: 'browser' }
    return { done: Promise.resolve(), source: 'kokoro' }
  }
  if (kokoroVoice && lang.startsWith('en')) {
    try {
      opts.onLoading?.(true)
      const pitch = opts.pitch && Math.abs(opts.pitch - 1) > 0.01 ? Math.min(1.35, Math.max(0.8, opts.pitch)) : 1
      // Com tom alterado, o Kokoro gera sempre no ritmo natural (gerar mais devagar estraga o começo das frases) e o player
      // toca mais rápido (tom * ritmo), o que deixa a voz mais fina.
      // Com tom de personagem, o player acelera só pelo tom (deixa a voz mais jovem) e o ritmo pedido vem da geração:
      // gera em velocidade/tom para o resultado final sair na velocidade escolhida com o tom do personagem igual em
      // qualquer velocidade (antes, tom × velocidade: no "devagar" o tom sumia e no "rápido" batia no limite).
      // Tom do personagem aplicado no próprio áudio (worker) e a velocidade escolhida feita pelo player com o tom preservado:
      // assim o "devagar" fica devagar de verdade e o tom é o mesmo em qualquer velocidade.
      const g = characterGen(opts.rate ?? 1, pitch)
      const deEssDb = opts.deEssDb ?? sp?.deEssDb
      const deEssOpt = deEssDb && pitch !== 1 ? { maxDb: deEssDb, hz: 4500 / pitch } : undefined
      const clip = await kokoroAudioUrl(trimmed, kokoroVoice, g.gen, 'high', deEssOpt, pitch !== 1 ? pitch : undefined)
      opts.onLoading?.(false)
      if (token !== currentToken) return { done: Promise.resolve(), source: 'kokoro' }
      const starts = clip.words ? startsFromTimings(trimmed, clip.words) : undefined
      return { ...(await playUrl(clip.url, pitch !== 1 ? g.play : (opts.rate ?? 1), trimmed, opts.onWord, starts, 1, clip.phones)), source: 'kokoro' }
    } catch (e) {
      opts.onLoading?.(false)
      if (token !== currentToken) return { done: Promise.resolve(), source: 'kokoro' }
      console.warn('[tts] A voz baixada não respondeu:', e)
      opts.onFallback?.(String((e as Error)?.message ?? e))
      // Nunca fica mudo: a voz do aparelho fala no lugar (menos para personagem no computador, que tenta de novo).
      if (isKokoroSupported()) {
        try {
          const again = await kokoroAudioUrl(trimmed, kokoroVoice, 1, 'high')
          if (token === currentToken) return { ...(await playUrl(again.url, opts.rate ?? 1, trimmed, opts.onWord)), source: 'kokoro' }
        } catch { /* sem voz: fica em silêncio */ }
        return { done: Promise.resolve(), source: 'kokoro' }
      }
      if (hasDeviceVoice()) return { ...(await speakOnDevice(trimmed, opts, token)), source: 'browser' }
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
  if (hasDeviceVoice()) return { ...(await speakOnDevice(trimmed, opts, token)), source: 'browser' }
  askVoiceOnce()
  return { done: Promise.resolve(), source: 'kokoro' }
}

/** Voz do aparelho com o gênero e o tom do personagem na tela (Yuno e Yuri mais finos). */
async function speakOnDevice(text: string, opts: SpeakOptions, token: number) {
  const sp = getSpeakerVoice()
  const h = await deviceSpeak(text, {
    rate: opts.rate ?? 1,
    pitch: opts.pitch ?? sp?.pitch ?? 1,
    gender: opts.gender ?? sp?.gender,
    onWord: opts.onWord,
    isStale: () => token !== currentToken,
  })
  // Encerrar a frase (stopSpeaking/haltPlayback) cancela a voz do aparelho: a promessa termina pelo onend/onerror.
  return h
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
