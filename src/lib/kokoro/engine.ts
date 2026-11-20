// Cliente do worker Kokoro: download do pacote, geração e estado local.
import { DEFAULT_KOKORO_VOICE, getKokoroVoice } from './voices'
import { isMobileDevice } from '@/lib/deviceVoice'

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

// Celular: o pacote de voz (modelo leve + 2 vozes) só baixa quando a pessoa aceita o aviso. Até lá, e sempre que a voz
// baixada falhar ou demorar, a fala sai na voz do próprio aparelho: o tutor nunca fica mudo.
/** As duas vozes do pacote do celular: feminina (Bia, Yuno) e masculina (Luck, Yuri); o tom de cada tutor vem por cima. */
export const MOBILE_VOICES = ['af_heart', 'am_michael'] as const
export function mobileVoiceFor(gender: 'female' | 'male') { return gender === 'male' ? MOBILE_VOICES[1] : MOBILE_VOICES[0] }

// Proteção contra a página cair: antes de carregar/gerar no celular marca "ocupado"; se a página morrer no meio (o
// navegador recarrega a aba), a marca sobra e, na volta, a voz baixada fica desligada neste aparelho (cai na voz dele).
const BUSY_KEY = 'upoonly.kokoro.busy'
const CRASH_KEY = 'upoonly.kokoro.crashed'
let busyCount = 0
function markBusy(on: boolean) {
  if (!isMobileDevice()) return
  busyCount = Math.max(0, busyCount + (on ? 1 : -1))
  try { if (busyCount > 0) localStorage.setItem(BUSY_KEY, String(Date.now())); else localStorage.removeItem(BUSY_KEY) } catch { /* ignore */ }
}
if (typeof window !== 'undefined') {
  try {
    const at = Number(localStorage.getItem(BUSY_KEY) || 0)
    // A página anterior morreu enquanto a voz trabalhava (em até 3 min): desliga a voz baixada neste aparelho.
    if (at && Date.now() - at < 3 * 60_000) localStorage.setItem(CRASH_KEY, String(Date.now()))
    localStorage.removeItem(BUSY_KEY)
  } catch { /* ignore */ }
  // Saída normal da página (fechar, recarregar, trocar de site) não conta como queda: só a morte da aba deixa a marca.
  window.addEventListener('pagehide', () => { try { localStorage.removeItem(BUSY_KEY) } catch { /* ignore */ } })
}
/** A voz baixada derrubou a página neste aparelho: fica desligada (a voz do aparelho fala). */
export function kokoroCrashedHere() {
  try { return !!localStorage.getItem(CRASH_KEY) } catch { return false }
}
/** Tentar de novo a voz baixada (Ajustes). */
export function clearKokoroCrash() {
  try { localStorage.removeItem(CRASH_KEY) } catch { /* ignore */ }
  sessionFailures = 0
  listeners.forEach(l => l(readState()))
}
// Falhas seguidas nesta sessão (celular): depois de 2, a sessão segue na voz do aparelho sem ficar esperando.
let sessionFailures = 0
export function noteKokoroResult(ok: boolean) { sessionFailures = ok ? 0 : sessionFailures + 1 }

export function isKokoroSupported() {
  if (typeof window === 'undefined' || typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') return false
  if (isMobileDevice() && (kokoroCrashedHere() || sessionFailures >= 2)) return false
  return true
}

/** Início de cada palavra falada, como fração (0–1) da duração do áudio; n = nº de fonemas. */
export type WordTiming = { f: number; n: number }
/** Fonema com início/fim em fração do áudio. */
/** Fonema com início e fim em fração do áudio; `s` = sílaba tônica (vem da marca ˈ do Kokoro). */
export type PhoneTiming = { p: string; f: number; e: number; s?: 1 }
export type KokoroClip = { url: string; words: WordTiming[] | null; phones?: PhoneTiming[] | null }

let worker: Worker | null = null
let lastBackend: { device: string; dtype: string } | null = null
// true depois que este worker carregou o modelo (só então aplicamos timeout de geração)
let workerReady = false
export function kokoroBackend() { return lastBackend }
/** Motor já carregado neste aparelho (gera em poucos segundos). */
export function kokoroWarm() { return workerReady }
let reqSeq = 0
const pending = new Map<number, {
  resolve: (v: { blob?: Blob; ms?: number; words?: WordTiming[] | null; phones?: PhoneTiming[] | null }) => void
  reject: (e: Error) => void
  onProgress?: (fraction: number) => void
  files: Map<string, { loaded: number; total: number }>
}>()

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./kokoro.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (ev) => {
    const m = ev.data as { type: string; reqId: number; blob?: Blob; ms?: number; words?: WordTiming[] | null; phones?: PhoneTiming[] | null; error?: string; file?: string; loaded?: number; total?: number }
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
    else p.resolve({ blob: m.blob, ms: m.ms, words: m.words, phones: m.phones })
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
  return new Promise<{ blob?: Blob; ms?: number; words?: WordTiming[] | null; phones?: PhoneTiming[] | null }>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    markBusy(true)
    const done = <T,>(fn: (v: T) => void) => (v: T) => { if (timer) clearTimeout(timer); markBusy(false); fn(v) }
    pending.set(reqId, { resolve: done(resolve), reject: done(reject), onProgress, files: new Map() })
    // Sem timeout enquanto o modelo ainda baixa/carrega: reiniciar aqui recomeçaria o download. No celular a fala tem prazo
    // mesmo com o motor ainda carregando do aparelho: passou dele, a voz do aparelho fala no lugar.
    if (timeoutMs && (workerReady || (isMobileDevice() && msg.type === 'generate'))) timer = setTimeout(() => { if (pending.has(reqId)) resetWorker('kokoro_timeout') }, timeoutMs)
    getWorker().postMessage({ ...msg, reqId })
  })
}

/** Carrega o motor em segundo plano (sem gerar nada) para o primeiro play não esperar. */
export function warmUpKokoro() {
  if (!activeKokoroVoice()) return
  send({ type: 'load' }).then(() => {}, () => {})
}

export const KOKORO_INSTALL_FAILED = 'bookmoo:kokoro-install-failed'
/** Abre o aviso "pacote de voz" (celular). */
export function requestVoicePack() { if (typeof window !== 'undefined') window.dispatchEvent(new Event(KOKORO_INSTALL_FAILED)) }
/** Pacote do celular instalado (modelo + as 2 vozes). */
export function mobilePackReady() {
  const s = readState()
  return s.modelReady && MOBILE_VOICES.every(v => s.voices.includes(v))
}
/** Baixa o pacote do celular: modelo leve e as duas vozes, testando cada uma com uma frase curta. */
export async function downloadMobilePack(onProgress?: (f: number) => void) {
  clearKokoroCrash()
  await downloadKokoroVoice(MOBILE_VOICES[0], f => onProgress?.(f * 0.92))
  await downloadKokoroVoice(MOBILE_VOICES[1])
  onProgress?.(1)
}
/** Tamanho aproximado do pacote de voz (modelo q8 + vozes), mostrado no aviso. */
export const KOKORO_PACKAGE_MB = 90
let installing: Promise<unknown> | null = null
/** Deixa a voz pronta sem pedir nada (os personagens nunca falam com a voz do navegador). */
export function ensureKokoroReady(): Promise<boolean> {
  if (!isKokoroSupported()) return Promise.resolve(false)
  if (activeKokoroVoice()) return Promise.resolve(true)
  // Celular: nunca baixa 90 MB no meio de uma fala. Pede o aviso do pacote e a fala segue na voz do aparelho.
  if (isMobileDevice()) { requestVoicePack(); return Promise.resolve(false) }
  installing ??= downloadKokoroVoice(DEFAULT_KOKORO_VOICE).finally(() => { installing = null })
  return installing.then(() => !!activeKokoroVoice(), () => false).then((ok) => {
    // Não instalou sozinha: o app avisa (no celular) e oferece baixar o pacote com um toque.
    if (!ok && typeof window !== 'undefined') window.dispatchEvent(new Event(KOKORO_INSTALL_FAILED))
    return ok
  })
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
    const { blob } = await send({ type: 'generate', text: 'Hello! I will read with you.', voice: voiceId, speed: 1 }, undefined, isMobileDevice() ? 60_000 : undefined)
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
  if (!isKokoroSupported()) return null
  const s = readState()
  if (!s.modelReady || s.voices.length === 0) return null
  if (s.selected && s.voices.includes(s.selected)) return s.selected
  return s.voices.includes(DEFAULT_KOKORO_VOICE) ? DEFAULT_KOKORO_VOICE : s.voices[0]
}

// Cache em memória dos áudios gerados nesta sessão (texto+voz+velocidade).
const audioCache = new Map<string, Promise<KokoroClip>>()
const MAX_CACHE = 200

/** Gera (ou reaproveita) o áudio; devolve a object URL e os tempos reais de cada palavra. */
export function kokoroAudioUrl(text: string, voice: string, speed: number, priority: 'high' | 'low' = 'low', deEss?: { maxDb: number; hz: number }, pitch?: number): Promise<KokoroClip> {
  const key = `${voice}|${speed.toFixed(2)}|${deEss ? `${deEss.maxDb}@${Math.round(deEss.hz)}` : ''}|${pitch ? pitch.toFixed(2) : ''}|${text}`
  const hit = audioCache.get(key)
  if (hit) return hit
  // Frase atual: se o motor não responder em 30s (após carregado), ele é reiniciado e o app cai para a voz do navegador.
  // Celular: prazo também no primeiro pedido (motor carregando do aparelho) e no pré-carregamento.
  const limit = isMobileDevice() ? (workerReady ? 15_000 : 30_000) : (priority === 'high' ? 30_000 : undefined)
  const p = send({ type: 'generate', text, voice, speed, priority, deEss, pitch }, undefined, limit)
    .then(({ blob, ms, words, phones }) => {
      if (import.meta.env.DEV) console.debug(`[kokoro] ${ms}ms "${text.slice(0, 40)}"`)
      return { url: URL.createObjectURL(blob!), words: words ?? null, phones: phones ?? null }
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
