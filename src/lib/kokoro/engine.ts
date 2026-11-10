// Cliente do worker Kokoro: download do pacote, geração e estado local.
import { DEFAULT_KOKORO_VOICE, getKokoroVoice } from './voices'

const LS_KEY = 'bookmoo.kokoro.v1'

interface LocalState {
  modelReady: boolean
  voices: string[] // vozes baixadas
  selected: string | null
}

function readState(): LocalState {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { modelReady: false, voices: [], selected: null, ...JSON.parse(raw) }
  } catch { /* storage indisponível */ }
  return { modelReady: false, voices: [], selected: null }
}
function writeState(s: LocalState) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch { /* ignore */ }
  listeners.forEach((l) => l(s))
}

const listeners = new Set<(s: LocalState) => void>()
export function subscribeKokoro(fn: (s: LocalState) => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
export function getKokoroState() { return readState() }

export function isKokoroSupported() {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined'
}

/** Início de cada palavra falada, como fração (0–1) da duração do áudio; n = nº de fonemas. */
export type WordTiming = { f: number; n: number }
export type KokoroClip = { url: string; words: WordTiming[] | null }

let worker: Worker | null = null
let lastBackend: { device: string; dtype: string } | null = null
// true depois que este worker carregou o modelo (só então aplicamos timeout de geração)
let workerReady = false
export function kokoroBackend() { return lastBackend }
let reqSeq = 0
const pending = new Map<number, {
  resolve: (v: { blob?: Blob; ms?: number; words?: WordTiming[] | null }) => void
  reject: (e: Error) => void
  onProgress?: (fraction: number) => void
  files: Map<string, { loaded: number; total: number }>
}>()

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./kokoro.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (ev) => {
    const m = ev.data as { type: string; reqId: number; blob?: Blob; ms?: number; words?: WordTiming[] | null; error?: string; file?: string; loaded?: number; total?: number }
    if (m.type === 'backend') {
      lastBackend = m as unknown as { device: string; dtype: string }
      return
    }
    const p = pending.get(m.reqId)
    if (!p) return
    if (m.type === 'progress' && m.file && m.total) {
      p.files.set(m.file, { loaded: m.loaded ?? 0, total: m.total })
      let l = 0, t = 0
      p.files.forEach((f) => { l += f.loaded; t += f.total })
      p.onProgress?.(t ? l / t : 0)
      return
    }
    pending.delete(m.reqId)
    if (m.type === 'loaded' || m.type === 'audio') workerReady = true
    if (m.type === 'error') p.reject(new Error(m.error))
    else p.resolve({ blob: m.blob, ms: m.ms, words: m.words })
  }
  worker.onerror = (e) => {
    pending.forEach((p) => p.reject(new Error(e.message || 'kokoro_worker_error')))
    pending.clear()
    worker = null
  }
  return worker
}

/** Encerra o worker travado; o próximo pedido cria outro (o modelo volta do cache do navegador). */
function resetWorker(reason: string) {
  worker?.terminate()
  worker = null
  workerReady = false
  pending.forEach((p) => p.reject(new Error(reason)))
  pending.clear()
}

function send(msg: Record<string, unknown>, onProgress?: (f: number) => void, timeoutMs?: number) {
  const reqId = ++reqSeq
  return new Promise<{ blob?: Blob; ms?: number; words?: WordTiming[] | null }>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const done = <T,>(fn: (v: T) => void) => (v: T) => { if (timer) clearTimeout(timer); fn(v) }
    pending.set(reqId, { resolve: done(resolve), reject: done(reject), onProgress, files: new Map() })
    // Sem timeout enquanto o modelo ainda baixa/carrega: reiniciar aqui recomeçaria o download.
    if (timeoutMs && workerReady) timer = setTimeout(() => { if (pending.has(reqId)) resetWorker('kokoro_timeout') }, timeoutMs)
    getWorker().postMessage({ ...msg, reqId })
  })
}

/** Carrega o motor em segundo plano (sem gerar nada) para o primeiro play não esperar. */
export function warmUpKokoro() {
  if (!activeKokoroVoice()) return
  send({ type: 'load' }).then(() => {}, () => {})
}

/** Descarta pré-carregamentos pendentes (ex.: ao parar ou trocar a velocidade). */
export function cancelKokoroPrefetch() {
  worker?.postMessage({ type: 'cancelLow' })
}

/** Baixa o modelo (uma vez) e a voz escolhida, gerando uma amostra curta. */
export async function downloadKokoroVoice(voiceId: string, onProgress?: (f: number) => void): Promise<Blob> {
  if (!getKokoroVoice(voiceId)) throw new Error('unknown_voice')
  // Pede ao navegador para não apagar o pacote de voz quando faltar espaço.
  navigator.storage?.persist?.().catch(() => {})
  await send({ type: 'load' }, onProgress)
  // Marca como instalada assim que o pacote está no aparelho, antes da frase de teste.
  // Se a frase falhar, a próxima visita não pede para baixar de novo.
  const s = readState()
  s.modelReady = true
  if (!s.voices.includes(voiceId)) s.voices.push(voiceId)
  if (!s.selected) s.selected = voiceId
  writeState(s)
  try {
    const { blob } = await send({ type: 'generate', text: 'Hello! I will read with you.', voice: voiceId, speed: 1 })
    return blob!
  } catch {
    return new Blob()
  }
}

export function removeKokoroVoice(voiceId: string) {
  const s = readState()
  s.voices = s.voices.filter((v) => v !== voiceId)
  if (s.selected === voiceId) s.selected = s.voices[0] ?? null
  writeState(s)
}

export function selectKokoroVoice(voiceId: string) {
  const s = readState()
  s.selected = voiceId
  writeState(s)
}

/** Voz pronta para uso (selecionada e baixada) ou null. */
export function activeKokoroVoice(): string | null {
  const s = readState()
  if (!s.modelReady || s.voices.length === 0) return null
  if (s.selected && s.voices.includes(s.selected)) return s.selected
  return s.voices.includes(DEFAULT_KOKORO_VOICE) ? DEFAULT_KOKORO_VOICE : s.voices[0]
}

// Cache em memória dos áudios gerados nesta sessão (texto+voz+velocidade).
const audioCache = new Map<string, Promise<KokoroClip>>()
const MAX_CACHE = 200

/** Gera (ou reaproveita) o áudio; devolve a object URL e os tempos reais de cada palavra. */
export function kokoroAudioUrl(text: string, voice: string, speed: number, priority: 'high' | 'low' = 'low'): Promise<KokoroClip> {
  const key = `${voice}|${speed.toFixed(2)}|${text}`
  const hit = audioCache.get(key)
  if (hit) return hit
  // Frase atual: se o motor não responder em 30s (após carregado), ele é reiniciado e o app cai para a voz do navegador.
  const p = send({ type: 'generate', text, voice, speed, priority }, undefined, priority === 'high' ? 30_000 : undefined)
    .then(({ blob, ms, words }) => {
      if (import.meta.env.DEV) console.debug(`[kokoro] ${ms}ms "${text.slice(0, 40)}"`)
      return { url: URL.createObjectURL(blob!), words: words ?? null }
    })
  p.catch(() => audioCache.delete(key))
  audioCache.set(key, p)
  if (audioCache.size > MAX_CACHE) {
    const oldest = audioCache.keys().next().value as string
    audioCache.get(oldest)?.then((c) => URL.revokeObjectURL(c.url)).catch(() => {})
    audioCache.delete(oldest)
  }
  return p
}
