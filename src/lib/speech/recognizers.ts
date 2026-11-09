// Motores de reconhecimento de fala da aba "Falar". Os dois são gratuitos (sem API paga).
//
// ┌──────────────┬───────────────────────────────────────────┬───────────────────────────────────────────┐
// │              │ Web Speech API (SpeechRecognition)        │ Whisper local (transformers.js)           │
// ├──────────────┼───────────────────────────────────────────┼───────────────────────────────────────────┤
// │ Custo        │ Grátis                                    │ Grátis                                    │
// │ Navegadores  │ Chrome, Edge, Safari (não Firefox; Brave  │ Todos com WebAssembly (inclui Firefox)    │
// │              │ expõe a API mas ela falha com "network")  │                                           │
// │ Privacidade  │ O áudio vai para servidores do Google     │ O áudio NUNCA sai do aparelho             │
// │              │ (Chrome/Edge) ou da Apple (Safari)        │                                           │
// │ Download     │ Nenhum                                    │ ~77 MB uma vez (fica em cache)            │
// │ Resposta     │ Ao vivo, palavra por palavra              │ Ao parar de gravar (alguns segundos)      │
// │ Tempos/pal.  │ Não                                       │ Sim (ouvir a própria leitura por palavra) │
// │ Precisão     │ Boa; corrige para palavras "prováveis"    │ Boa (base.en); também tende a "corrigir"  │
// └──────────────┴───────────────────────────────────────────┴───────────────────────────────────────────┘
//
// Limite comum aos dois: são reconhecedores de fala, não avaliadores de pronúncia. Ambos
// têm um modelo de linguagem que puxa sons ambíguos para a palavra mais provável, então um
// "quase certo" pode aparecer como certo. A nota mede inteligibilidade ("um nativo
// entenderia esta palavra?"), não sotaque.
//
// Escolha automática: Web Speech quando existe (resposta ao vivo, sem download); se não
// existir ou o serviço falhar (Firefox, Brave, offline), cai para o Whisper local. O aluno
// pode forçar o modo privado (Whisper) nas opções.

import { tokenizeTranscript } from './align'

export type EngineId = 'webspeech' | 'whisper'

export interface TimedWord { text: string; start: number; end: number }

export interface RecognitionOutput {
  text: string
  /** Só no Whisper: instante (s) de cada palavra no áudio gravado. */
  words: TimedWord[] | null
  /** Só no Whisper: o áudio gravado, para o aluno ouvir a própria leitura. */
  audio: Blob | null
}

export interface RecognizerCallbacks {
  /** Transcrição acumulada até agora (final + provisória). */
  onTranscript?: (text: string) => void
  /** 0–1 enquanto o modelo local baixa/carrega. */
  onModelProgress?: (fraction: number) => void
  /** Whisper: 'recording' → 'transcribing'. */
  onPhase?: (phase: 'recording' | 'loading' | 'transcribing') => void
}

export interface Recognizer {
  engine: EngineId
  start(): Promise<void>
  /** Para de ouvir e devolve o resultado final. */
  stop(): Promise<RecognitionOutput>
  /** Interrompe sem resultado. */
  abort(): void
}

/** Erros que fazem a aba trocar sozinha para o Whisper local. */
export class EngineUnavailableError extends Error {}
/** O aluno negou (ou o navegador bloqueou) o microfone. */
export class MicPermissionError extends Error {}

// ---------------------------------------------------------------------------
// Web Speech API
// ---------------------------------------------------------------------------

interface SRResultList { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } }
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: { resultIndex: number; results: SRResultList }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type SRCtor = new () => SpeechRecognitionLike

function getSR(): SRCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isWebSpeechAvailable() {
  return getSR() !== null
}

export function isWhisperAvailable() {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
}

function createWebSpeech(cb: RecognizerCallbacks): Recognizer {
  const SR = getSR()
  if (!SR) throw new EngineUnavailableError('webspeech_missing')
  let rec: SpeechRecognitionLike | null = null
  let active = false
  let finals = '' // texto final de sessões anteriores (o Chrome encerra sozinho após silêncio)
  let sessionFinal = ''
  let interim = ''
  let fatal: Error | null = null
  let gotAnyResult = false
  let endResolve: (() => void) | null = null
  let startResolve: (() => void) | null = null
  let startReject: ((e: Error) => void) | null = null

  const full = () => `${finals} ${sessionFinal} ${interim}`.replace(/\s+/g, ' ').trim()

  const spawn = () => {
    const r = new SR()
    r.lang = 'en-US'
    r.continuous = true
    r.interimResults = true
    r.maxAlternatives = 1
    r.onstart = () => { startResolve?.(); startResolve = startReject = null }
    r.onresult = (e) => {
      gotAnyResult = true
      let f = ''
      let i = ''
      for (let k = 0; k < e.results.length; k++) {
        const res = e.results[k]
        if (res.isFinal) f += ' ' + res[0].transcript
        else i += ' ' + res[0].transcript
      }
      sessionFinal = f
      interim = i
      cb.onTranscript?.(full())
    }
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      if (e.error === 'not-allowed') fatal = gotAnyResult ? new EngineUnavailableError(e.error) : new MicPermissionError(e.error)
      // 'service-not-allowed' no Chrome também significa microfone bloqueado pelo usuário;
      // no Safari/Brave significa serviço indisponível. Sem resultado nenhum, trocamos de motor.
      else fatal = new EngineUnavailableError(e.error)
      startReject?.(fatal)
      startResolve = startReject = null
    }
    r.onend = () => {
      finals = `${finals} ${sessionFinal} ${interim}`.trim()
      sessionFinal = ''
      interim = ''
      if (active && !fatal) {
        try { spawn() } catch { active = false }
        return
      }
      active = false
      endResolve?.()
      endResolve = null
    }
    rec = r
    r.start()
  }

  return {
    engine: 'webspeech',
    start() {
      return new Promise<void>((resolve, reject) => {
        active = true
        startResolve = resolve
        startReject = reject
        try { spawn() } catch (e) { reject(new EngineUnavailableError(String(e))) }
      })
    },
    stop() {
      return new Promise<RecognitionOutput>((resolve, reject) => {
        const finish = () => (fatal && !gotAnyResult ? reject(fatal) : resolve({ text: full() || finals, words: null, audio: null }))
        if (!active || !rec) return finish()
        active = false
        endResolve = finish
        rec.stop()
        // segurança: alguns navegadores não disparam onend após stop()
        setTimeout(() => { if (endResolve) { endResolve = null; finals = full(); finish() } }, 2500)
      })
    },
    abort() {
      active = false
      endResolve = null
      rec?.abort()
    },
  }
}

// ---------------------------------------------------------------------------
// Whisper local (Web Worker)
// ---------------------------------------------------------------------------

let worker: Worker | null = null
let reqSeq = 0
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; onProgress?: (f: number) => void; files: Map<string, { loaded: number; total: number }> }>()
const LS_WHISPER = 'bookmoo.whisper.ready'

export function isWhisperModelCached() {
  try { return localStorage.getItem(LS_WHISPER) === '1' } catch { return false }
}

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (ev) => {
    const m = ev.data as { type: string; reqId: number; file?: string; loaded?: number; total?: number; error?: string }
    const p = pending.get(m.reqId)
    if (!p) return
    if (m.type === 'progress') {
      if (m.file && m.total) {
        p.files.set(m.file, { loaded: m.loaded ?? 0, total: m.total })
        let l = 0, t = 0
        p.files.forEach((f) => { l += f.loaded; t += f.total })
        p.onProgress?.(t ? l / t : 0)
      }
      return
    }
    pending.delete(m.reqId)
    if (m.type === 'error') p.reject(new Error(m.error))
    else {
      try { localStorage.setItem(LS_WHISPER, '1') } catch { /* ignore */ }
      p.resolve(m)
    }
  }
  worker.onerror = (e) => {
    pending.forEach((p) => p.reject(new Error(e.message || 'whisper_worker_error')))
    pending.clear()
    worker = null
  }
  return worker
}

function sendWhisper<T>(msg: Record<string, unknown>, onProgress?: (f: number) => void, transfer?: Transferable[]) {
  const reqId = ++reqSeq
  return new Promise<T>((resolve, reject) => {
    pending.set(reqId, { resolve: resolve as (v: unknown) => void, reject, onProgress, files: new Map() })
    getWorker().postMessage({ ...msg, reqId }, transfer ?? [])
  })
}

/** Baixa/carrega o Whisper em segundo plano (para a primeira leitura não esperar). */
export function preloadWhisper(onProgress?: (f: number) => void) {
  return sendWhisper<void>({ type: 'load' }, onProgress)
}

/** Converte a gravação em PCM mono 16 kHz, o formato que o Whisper espera. */
async function blobTo16kMono(blob: Blob): Promise<Float32Array> {
  const buf = await blob.arrayBuffer()
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  try {
    const decoded = await ctx.decodeAudioData(buf)
    const frames = Math.ceil(decoded.duration * 16000)
    const off = new OfflineAudioContext(1, Math.max(1, frames), 16000)
    const src = off.createBufferSource()
    src.buffer = decoded
    src.connect(off.destination)
    src.start()
    const rendered = await off.startRendering()
    return rendered.getChannelData(0).slice()
  } finally {
    void ctx.close()
  }
}

function createWhisper(cb: RecognizerCallbacks): Recognizer {
  if (!isWhisperAvailable()) throw new EngineUnavailableError('whisper_unavailable')
  let stream: MediaStream | null = null
  let recorder: MediaRecorder | null = null
  const chunks: Blob[] = []
  let aborted = false

  return {
    engine: 'whisper',
    async start() {
      // começa a baixar o modelo enquanto o aluno lê
      preloadWhisper(cb.onModelProgress).catch(() => {})
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } })
      } catch (e) {
        throw new MicPermissionError(e instanceof Error ? e.message : String(e))
      }
      recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
      recorder.start(1000)
      cb.onPhase?.('recording')
    },
    async stop() {
      const rec = recorder
      if (!rec) throw new Error('not_started')
      await new Promise<void>((res) => { rec.onstop = () => res(); rec.stop() })
      stream?.getTracks().forEach((t) => t.stop())
      const audio = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
      cb.onPhase?.(isWhisperModelCached() ? 'transcribing' : 'loading')
      await preloadWhisper(cb.onModelProgress)
      if (aborted) throw new Error('aborted')
      cb.onPhase?.('transcribing')
      const pcm = await blobTo16kMono(audio)
      const out = await sendWhisper<{ text: string; words: TimedWord[] }>({ type: 'transcribe', audio: pcm }, undefined, [pcm.buffer])
      return { text: out.text, words: out.words, audio }
    },
    abort() {
      aborted = true
      try { recorder?.stop() } catch { /* ignore */ }
      stream?.getTracks().forEach((t) => t.stop())
    },
  }
}

/** Separa as palavras com tempo do Whisper na mesma regra do alinhamento ("21" → twenty one). */
export function tokenizeForTimings(words: TimedWord[]): TimedWord[] {
  const out: TimedWord[] = []
  for (const w of words) for (const t of tokenizeTranscript(w.text)) out.push({ text: t, start: w.start, end: w.end })
  return out
}

export function createRecognizer(engine: EngineId, cb: RecognizerCallbacks): Recognizer {
  return engine === 'webspeech' ? createWebSpeech(cb) : createWhisper(cb)
}

/** Motor padrão: Web Speech se existir (ao vivo, sem download); senão, Whisper local. */
export function defaultEngine(preferPrivate: boolean): EngineId | null {
  if (!preferPrivate && isWebSpeechAvailable()) return 'webspeech'
  if (isWhisperAvailable()) return 'whisper'
  if (isWebSpeechAvailable()) return 'webspeech'
  return null
}
