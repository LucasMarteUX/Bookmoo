// Cliente do worker Kokoro: download do pacote, geração e estado local.
import { DEFAULT_KOKORO_VOICE, getKokoroVoice } from './voices'
import { isMobileDevice } from '@/lib/deviceVoice'
import { voiceLog } from '@/lib/voiceLog'

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

// Proteção contra a página cair. Antes, qualquer aba descartada em segundo plano enquanto o motor trabalhava (comum no
// celular: a pessoa troca de app e o sistema fecha a aba) deixava o pacote desligado PARA SEMPRE, e o tutor ficava mudo
// mesmo com o pacote baixado. Agora:
// - só marca "ocupado" com a página visível (em segundo plano o sistema pode matar a aba sem que seja culpa da voz);
// - esconder ou congelar a página limpa a marca;
// - uma queda real conta, mas o pacote só fica de lado depois de 2 quedas em 15 minutos, e por 30 minutos no máximo.
const BUSY_KEY = 'upoonly.kokoro.busy'
const CRASH_KEY = 'upoonly.kokoro.crashes'
const CRASH_WINDOW_MS = 15 * 60_000
const CRASH_COOLDOWN_MS = 30 * 60_000
let busyCount = 0
const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible'
function markBusy(on: boolean) {
  if (!isMobileDevice()) return
  busyCount = Math.max(0, busyCount + (on ? 1 : -1))
  try {
    if (busyCount > 0 && visible()) localStorage.setItem(BUSY_KEY, String(Date.now()))
    else localStorage.removeItem(BUSY_KEY)
  } catch { /* ignore */ }
}
function crashes(): number[] {
  try { return (JSON.parse(localStorage.getItem(CRASH_KEY) || '[]') as number[]).filter(t => Date.now() - t < CRASH_COOLDOWN_MS) } catch { return [] }
}
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('upoonly.kokoro.crashed') // trava antiga (permanente): sai de vez
    const at = Number(localStorage.getItem(BUSY_KEY) || 0)
    // A página anterior morreu, visível, com a voz trabalhando (até 3 min atrás): conta uma queda.
    if (at && Date.now() - at < 3 * 60_000) {
      const list = [...crashes(), Date.now()]
      localStorage.setItem(CRASH_KEY, JSON.stringify(list))
      voiceLog('kokoro.queda_detectada', { quedas: list.length })
    }
    localStorage.removeItem(BUSY_KEY)
  } catch { /* ignore */ }
  const clearBusy = () => { try { localStorage.removeItem(BUSY_KEY) } catch { /* ignore */ } }
  window.addEventListener('pagehide', clearBusy)
  document.addEventListener('visibilitychange', () => {
    if (!visible()) clearBusy()
    else if (busyCount > 0) { try { localStorage.setItem(BUSY_KEY, String(Date.now())) } catch { /* ignore */ } }
  })
  document.addEventListener('freeze', clearBusy)
}
/** A voz baixada derrubou a página 2 vezes em pouco tempo neste aparelho: fica de lado por um tempo. */
export function kokoroCrashedHere() {
  const list = crashes()
  return list.filter(t => Date.now() - t < CRASH_WINDOW_MS).length >= 2
}
/** Tentar de novo a voz baixada (Ajustes, diagnóstico). */
export function clearKokoroCrash() {
  try { localStorage.removeItem(CRASH_KEY) } catch { /* ignore */ }
  listeners.forEach(l => l(readState()))
}
/** Resultado de cada geração (só para o registro de voz; não desliga mais nada). */
export function noteKokoroResult(ok: boolean) { if (!ok) voiceLog('kokoro.falhou') }

export function isKokoroSupported() {
  if (typeof window === 'undefined' || typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') return false
  if (isMobileDevice() && kokoroCrashedHere()) return false
  return true
}

// Velocidade de geração medida neste aparelho (ms de processamento por segundo de áudio). Os prazos saem daqui: um celular
// lento recebe mais tempo em vez de ter a fala cortada (antes era 15 s fixos, e frases longas caíam sempre).
const RTF_KEY = 'upoonly.kokoro.rtf'
let rtfMs = (() => { try { return Number(localStorage.getItem(RTF_KEY)) || 0 } catch { return 0 } })()
function noteRtf(ms: number, audioSec: number) {
  if (!(audioSec > 0.3) || !(ms > 0)) return
  const r = ms / audioSec
  rtfMs = rtfMs ? rtfMs * 0.7 + r * 0.3 : r
  try { localStorage.setItem(RTF_KEY, String(Math.round(rtfMs))) } catch { /* ignore */ }
}
/** ms de processamento por segundo de fala neste aparelho (0 = ainda não medido). */
export function kokoroRtf() { return Math.round(rtfMs) }
/** Prazo para gerar este texto: estimativa da duração × velocidade do aparelho, com folga larga e piso de 25 s. */
function generationDeadline(text: string, speed: number) {
  const audioSec = Math.max(1, text.length / 14 / Math.max(0.5, speed))
  const per = rtfMs || (isMobileDevice() ? 2500 : 800)
  return Math.max(25_000, Math.round(audioSec * per * 2.5 + 10_000))
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
    // Sem prazo enquanto o modelo ainda baixa pela rede (reiniciar recomeçaria o download). Gerar tem prazo sempre: com o motor
    // frio o prazo é grande (inclui carregar o modelo do aparelho), com ele quente vem da velocidade medida.
    if (timeoutMs && (workerReady || msg.type === 'generate')) timer = setTimeout(() => {
      if (!pending.has(reqId)) return
      voiceLog('kokoro.prazo_estourado', { ms: timeoutMs, quente: workerReady })
      resetWorker('kokoro_timeout')
    }, timeoutMs)
    getWorker().postMessage({ ...msg, reqId })
  })
}

/** Carrega o motor em segundo plano (sem gerar nada) para o primeiro play não esperar. */
export function warmUpKokoro() {
  if (!activeKokoroVoice() || workerReady || warming) return
  const t0 = performance.now()
  voiceLog('kokoro.aquecendo')
  warming = send({ type: 'load' }).then(
    () => { voiceLog('kokoro.pronto', { ms: Math.round(performance.now() - t0), backend: lastBackend }) },
    (e) => { voiceLog('kokoro.aquecer_falhou', { erro: String((e as Error)?.message ?? e) }) },
  ).finally(() => { warming = null })
}
let warming: Promise<void> | null = null
/** Espera o motor ficar pronto (aquecendo se preciso). false se não há pacote ou se a carga falhou. */
export async function waitKokoroWarm(): Promise<boolean> {
  if (workerReady) return true
  if (!activeKokoroVoice()) return false
  warmUpKokoro()
  try { await warming } catch { /* registrado acima */ }
  return workerReady
}

export const KOKORO_INSTALL_FAILED = 'bookmoo:kokoro-install-failed'
/** Abre o aviso "pacote de voz" (celular). */
export function requestVoicePack() { if (typeof window !== 'undefined') window.dispatchEvent(new Event(KOKORO_INSTALL_FAILED)) }
/** Pacote do celular instalado (modelo + as 2 vozes). */
export function mobilePackReady() {
  const s = readState()
  return s.modelReady && MOBILE_VOICES.every(v => s.voices.includes(v))
}
/** Baixa o pacote do celular: modelo leve e as duas vozes, testando cada uma com uma frase curta.
 *  Devolve se a frase de teste foi gerada (o pacote está no aparelho mesmo quando o teste demora demais). */
export async function downloadMobilePack(onProgress?: (f: number) => void): Promise<{ sampleOk: boolean }> {
  clearKokoroCrash()
  const a = await downloadKokoroVoice(MOBILE_VOICES[0], f => onProgress?.(f * 0.92))
  const b = await downloadKokoroVoice(MOBILE_VOICES[1])
  onProgress?.(1)
  return { sampleOk: a.size > 0 || b.size > 0 }
}
/** Tamanho aproximado do pacote de voz (modelo q8 + vozes), mostrado no aviso. */
export const KOKORO_PACKAGE_MB = 90
let installing: Promise<unknown> | null = null
/** Deixa a voz pronta sem pedir nada (os personagens nunca falam com a voz do navegador). */
export function ensureKokoroReady(): Promise<boolean> {
  if (!isKokoroSupported()) return Promise.resolve(false)
  if (activeKokoroVoice()) return Promise.resolve(true)
  // Celular: nunca baixa 90 MB no meio de uma fala. Pede o aviso do pacote (a fala espera; nunca usa a voz do navegador).
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
    const text = 'Hello! I will read with you.'
    const t0 = performance.now()
    const { blob } = await send({ type: 'generate', text, voice: voiceId, speed: 1 }, undefined, isMobileDevice() ? 120_000 : undefined)
    const sec = blob ? (blob.size - 44) / 2 / 24_000 : 0
    noteRtf(performance.now() - t0, sec)
    voiceLog('kokoro.amostra_ok', { voz: voiceId, ms: Math.round(performance.now() - t0) })
    return blob!
  } catch (e) {
    voiceLog('kokoro.amostra_falhou', { voz: voiceId, erro: String((e as Error)?.message ?? e) })
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
  // Prazo pela velocidade medida deste aparelho (e grande com o motor frio, que ainda carrega o modelo do aparelho).
  const limit = workerReady ? generationDeadline(text, speed) : (isMobileDevice() ? 150_000 : (priority === 'high' ? 90_000 : undefined))
  const t0 = performance.now()
  const p = send({ type: 'generate', text, voice, speed, priority, deEss, pitch }, undefined, limit)
    .then(({ blob, ms, words, phones }) => {
      const sec = blob ? Math.max(0, (blob.size - 44) / 2 / 24_000 - 0.25) : 0
      if (ms) noteRtf(ms, sec)
      voiceLog('kokoro.gerou', { ms: ms ?? Math.round(performance.now() - t0), s: Math.round(sec * 10) / 10, letras: text.length, prioridade: priority })
      return { url: URL.createObjectURL(blob!), words: words ?? null, phones: phones ?? null }
    })
  p.catch((e) => { audioCache.delete(key); voiceLog('kokoro.geracao_falhou', { erro: String((e as Error)?.message ?? e), letras: text.length, prioridade: priority }) })
  audioCache.set(key, p)
  if (audioCache.size > MAX_CACHE) {
    const oldest = audioCache.keys().next().value as string
    audioCache.get(oldest)?.then((c) => URL.revokeObjectURL(c.url)).catch(() => {})
    audioCache.delete(oldest)
  }
  return p
}
