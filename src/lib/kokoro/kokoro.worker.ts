/// <reference lib="webworker" />
// Roda o Kokoro-82M (Apache-2.0) 100% no navegador do aluno, fora da thread da UI.
// O modelo é baixado uma vez do Hugging Face e fica no Cache Storage do navegador.
import { KokoroTTS } from 'kokoro-js'
import { deEss, pitchUp, type DeEssOptions } from './deEsser'
import { env } from '@huggingface/transformers'
import { configureModelEnv, redirectHuggingFaceFetch } from '../modelHost'

configureModelEnv(env as never)
redirectHuggingFaceFetch()

// Variante "timestamped": mesmo Kokoro v1.0 (Apache-2.0), mas também devolve a duração de cada
// fonema gerado. Com isso sabemos o instante real em que cada palavra começa no áudio.
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX-timestamped'
const OLD_MODEL_KEY = 'Kokoro-82M-v1.0-ONNX_resolve' // modelo anterior (sem tempos): apagar do OPFS

// ---------------------------------------------------------------------------
// Cache do modelo no OPFS (sistema de arquivos privado do navegador).
// O Cache Storage padrão falha ao gravar arquivos de ~330 MB ("Unexpected internal error"),
// então o modelo fp32 era baixado de novo a cada visita. O OPFS foi feito para arquivos grandes.
// Um arquivo ".ok" com o tamanho esperado só é gravado após a escrita completa: se o
// download for interrompido, o arquivo parcial é ignorado e baixado de novo.
// ---------------------------------------------------------------------------
const toKey = (req: string | Request) => (typeof req === 'string' ? req : req.url).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-180)

async function modelsDir() {
  const root = await navigator.storage.getDirectory()
  return root.getDirectoryHandle('kokoro-models', { create: true })
}

async function writeFile(dir: FileSystemDirectoryHandle, name: string, data: ArrayBuffer | string) {
  const fh = await dir.getFileHandle(name, { create: true })
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
  if ('createWritable' in fh) {
    const w = await (fh as FileSystemFileHandle & { createWritable(): Promise<FileSystemWritableFileStream> }).createWritable()
    await w.write(bytes)
    await w.close()
  } else {
    // Safari em workers: só tem o acesso síncrono.
    const h = await (fh as FileSystemFileHandle & { createSyncAccessHandle(): Promise<{ truncate(n: number): void; write(b: Uint8Array, o: { at: number }): number; flush(): void; close(): void }> }).createSyncAccessHandle()
    h.truncate(0)
    h.write(bytes, { at: 0 })
    h.flush()
    h.close()
  }
}

const opfsCache = {
  async match(req: string | Request): Promise<Response | undefined> {
    try {
      const dir = await modelsDir()
      const name = toKey(req)
      const ok = await (await (await dir.getFileHandle(name + '.ok')).getFile()).text()
      const file = await (await dir.getFileHandle(name)).getFile()
      if (String(file.size) !== ok.trim()) return undefined
      return new Response(file, { headers: { 'content-length': String(file.size) } })
    } catch {
      return undefined
    }
  },
  async put(req: string | Request, response: Response) {
    try {
      const dir = await modelsDir()
      const name = toKey(req)
      const buf = await response.arrayBuffer()
      await writeFile(dir, name, buf)
      await writeFile(dir, name + '.ok', String(buf.byteLength))
    } catch (e) {
      console.warn('[kokoro] não foi possível salvar no OPFS:', e)
    }
  },
}

async function removeOldModelFiles() {
  try {
    const dir = await modelsDir()
    const names: string[] = []
    for await (const [name] of (dir as unknown as { entries(): AsyncIterable<[string, unknown]> }).entries()) names.push(name)
    for (const n of names) if (n.includes(OLD_MODEL_KEY)) await dir.removeEntry(n)
  } catch { /* ignore */ }
}

if (typeof navigator !== 'undefined' && navigator.storage?.getDirectory) {
  void removeOldModelFiles()
  env.useBrowserCache = false
  env.useCustomCache = true
  env.customCache = opfsCache
}

// Celular: um único fio do WASM (menos memória) para caber junto com o personagem animado.
if (typeof navigator !== 'undefined' && smallDeviceEarly() && env.backends?.onnx?.wasm) env.backends.onnx.wasm.numThreads = 1
else if (typeof navigator !== 'undefined' && env.backends?.onnx?.wasm) env.backends.onnx.wasm.numThreads = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 2))
function smallDeviceEarly() { return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) }

type GenMsg = { type: 'generate'; reqId: number; text: string; voice: string; speed: number; priority?: 'high' | 'low'; deEss?: DeEssOptions; pitch?: number }
type InMsg = { type: 'load'; reqId: number } | GenMsg | { type: 'cancelLow' }

let ttsPromise: Promise<KokoroTTS> | null = null

// WebGPU + fp32: qualidade total e geração rápida (recomendação do kokoro-js).
// Sem WebGPU: WASM + q8 (menor, porém com perda de qualidade e mais lento).
function smallDevice() {
  const nav = navigator as Navigator & { deviceMemory?: number }
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0 && nav.deviceMemory <= 4) return true
  return /Android|iPhone|iPad|Mobile/i.test(nav.userAgent)
}

async function pickBackend(): Promise<{ device: 'webgpu' | 'wasm'; dtype: 'fp32' | 'q8' }> {
  // No celular a voz completa (centenas de MB) fecha a página do Chrome. A versão leve cabe e fica salva.
  if (smallDevice()) return { device: 'wasm', dtype: 'q8' }
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
    if (gpu && (await gpu.requestAdapter())) return { device: 'webgpu', dtype: 'fp32' }
  } catch { /* sem WebGPU */ }
  return { device: 'wasm', dtype: 'q8' }
}

function load(reqId: number) {
  if (!ttsPromise) {
    ttsPromise = pickBackend().then((b) => {
      self.postMessage({ type: 'backend', reqId, ...b })
      return KokoroTTS.from_pretrained(MODEL_ID, {
        ...b,
        progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
          if (p.status === 'progress') {
            self.postMessage({ type: 'progress', reqId, file: p.file, loaded: p.loaded, total: p.total })
          }
        },
      })
    }).catch((e) => {
      ttsPromise = null
      throw e
    })
  }
  return ttsPromise
}

// ---------------------------------------------------------------------------
// Tempos por palavra. O kokoro-js descarta a saída "durations" do modelo; interceptamos a chamada
// ao modelo para capturar os ids de fonema e a duração de cada um. Fonemas são agrupados em
// palavras pelos espaços; a fração de início de cada palavra é relativa à duração total do áudio.
// ---------------------------------------------------------------------------
type Captured = { ids: ArrayLike<number | bigint>; durations: ArrayLike<number | bigint> }
let captured: Captured | null = null

function instrument(tts: KokoroTTS) {
  const t = tts as unknown as { model: (i: Record<string, { data: ArrayLike<number | bigint> }>) => Promise<Record<string, { data: ArrayLike<number | bigint> }>>; __wrapped?: boolean }
  if (t.__wrapped) return
  const orig = t.model
  t.model = async (inputs) => {
    const out = await orig(inputs)
    if (out.durations) captured = { ids: inputs.input_ids.data, durations: out.durations.data }
    return out
  }
  t.__wrapped = true
}

const PUNCT = /^[\s.,!?;:…—–\-"“”'‘’()[\]«»¡¿]+$/

/** [{ f: fração de início (0–1), n: nº de fonemas }] por palavra falada, na ordem. */
function wordTimings(tts: KokoroTTS, c: Captured): { f: number; n: number }[] | null {
  const tok = (tts as unknown as { tokenizer: { model?: { vocab?: string[] }; decode(ids: number[]): string } }).tokenizer
  const vocab = Array.isArray(tok.model?.vocab) ? tok.model!.vocab! : null
  const ids = Array.from(c.ids, Number)
  const dur = Array.from(c.durations, Number)
  if (ids.length !== dur.length) return null
  const total = dur.reduce((a, b) => a + b, 0)
  if (!total) return null
  const groups: { f: number; n: number }[] = []
  let cur: { f: number; n: number } | null = null
  let cum = 0
  for (let i = 0; i < ids.length; i++) {
    const start = cum
    cum += dur[i]
    if (ids[i] === 0) { cur = null; continue } // pad no início/fim
    const piece = vocab ? vocab[ids[i]] ?? '' : tok.decode([ids[i]])
    if (piece === ' ' || piece === '') { cur = null; continue }
    if (PUNCT.test(piece)) continue
    if (!cur) { cur = { f: start / total, n: 0 }; groups.push(cur) }
    cur.n++
  }
  return groups
}

/** Cada fonema com início e fim (fração do áudio): a boca dos personagens segue estes tempos. Pausas ficam de fora. */
function phoneTimings(tts: KokoroTTS, c: Captured): { p: string; f: number; e: number }[] | null {
  const tok = (tts as unknown as { tokenizer: { model?: { vocab?: string[] }; decode(ids: number[]): string } }).tokenizer
  const vocab = Array.isArray(tok.model?.vocab) ? tok.model!.vocab! : null
  const ids = Array.from(c.ids, Number)
  const dur = Array.from(c.durations, Number)
  if (ids.length !== dur.length) return null
  const total = dur.reduce((a, b) => a + b, 0)
  if (!total) return null
  const out: { p: string; f: number; e: number }[] = []
  let cum = 0
  for (let i = 0; i < ids.length; i++) {
    const start = cum
    cum += dur[i]
    if (ids[i] === 0) continue
    const piece = vocab ? vocab[ids[i]] ?? '' : tok.decode([ids[i]])
    if (!piece.trim() || PUNCT.test(piece)) continue
    out.push({ p: piece, f: start / total, e: cum / total })
  }
  return out
}

/**
 * Acerta os fonemas no som de verdade. Os tempos do Kokoro são a previsão do modelo e escorregam (fim de frase arrastado,
 * fala rápida atrasando). Pelo áudio gerado acha os trechos com voz (silêncios de 80 ms ou mais separam) e encaixa cada grupo
 * de fonemas (separados por pausa) no trecho de voz correspondente, esticando dentro dele. Se a contagem não bater, encaixa só
 * o começo e o fim da frase inteira. Tudo em fração do áudio (sem o respiro inicial).
 */
function alignPhones(phones: { p: string; f: number; e: number }[], audio: Float32Array, rate: number) {
  if (!phones.length) return phones
  const hop = Math.round(rate * 0.01), N = Math.floor(audio.length / hop)
  const env = new Float32Array(N)
  let mx = 0
  for (let i = 0; i < N; i++) { let s2 = 0; for (let k = i * hop; k < (i + 1) * hop; k++) s2 += audio[k] * audio[k]; env[i] = Math.sqrt(s2 / hop); if (env[i] > mx) mx = env[i] }
  if (!mx) return phones
  const segs: [number, number][] = []
  let st = -1, quiet = 0
  for (let i = 0; i < N; i++) {
    const v = env[i] > mx * 0.05
    if (v) { if (st < 0) st = i; quiet = 0 } else if (st >= 0 && ++quiet >= 8) { segs.push([st, i - quiet + 1]); st = -1; quiet = 0 }
  }
  if (st >= 0) segs.push([st, N - quiet])
  if (!segs.length) return phones
  const total = audio.length / rate
  // Cada silêncio do áudio corta a fila de fonemas na fronteira mais próxima no tempo (de preferência onde havia pontuação
  // ou espaço, que aparece como um vão entre fonemas). Assim há sempre um grupo de fonemas por trecho de voz.
  const cuts: number[] = []
  let from = 1
  for (let k = 0; k + 1 < segs.length; k++) {
    const c = ((segs[k][1] + segs[k + 1][0]) / 2) * hop / audio.length
    let best = -1, bestCost = Infinity
    for (let i = from; i < phones.length - (segs.length - 2 - k); i++) {
      const t = (phones[i - 1].e + phones[i].f) / 2
      const gap = (phones[i].f - phones[i - 1].e) * total
      const cost = Math.abs(t - c) * total - (gap > 0.005 ? 0.12 : 0)
      if (cost < bestCost) { bestCost = cost; best = i }
    }
    if (best < 0) break
    cuts.push(best); from = best + 1
  }
  const runs: [number, number][] = []
  let r0 = 0
  for (const c of cuts) { runs.push([r0, c - 1]); r0 = c }
  runs.push([r0, phones.length - 1])
  const toF = (frame: number) => (frame * hop) / audio.length
  const remap = (from: [number, number], a: number, b: number) => {
    const f0 = phones[from[0]].f, e0 = phones[from[1]].e, span = Math.max(1e-6, e0 - f0)
    for (let i = from[0]; i <= from[1]; i++) {
      phones[i] = { ...phones[i], f: a + ((phones[i].f - f0) / span) * (b - a), e: a + ((phones[i].e - f0) / span) * (b - a) }
    }
  }
  phones = phones.map(x => ({ ...x }))
  if (runs.length === segs.length) runs.forEach((run, k) => remap(run, toF(segs[k][0]), toF(segs[k][1])))
  else remap([0, phones.length - 1], toF(segs[0][0]), toF(segs[segs.length - 1][1]))
  return phones
}

// O ONNX Runtime (principalmente em WebGPU) não suporta inferências simultâneas na mesma sessão:
// chamadas concorrentes travam ou corrompem o áudio. Geramos uma frase por vez, com prioridade
// para a frase que vai tocar agora ('high') sobre os pré-carregamentos ('low').
const LEAD_SILENCE_S = 0.25

/** WAV mono de 16 bits. */
function wavBlob(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) { const s = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true) }
  return new Blob([buf], { type: 'audio/wav' })
}

const queue: GenMsg[] = []
let busy = false

let lastHighAt = 0
let pumpTimer: ReturnType<typeof setTimeout> | null = null
async function pump() {
  if (busy) return
  // Pré-carregar a próxima frase disputava o processador com a frase que acabou de começar a tocar e o áudio picotava nos
  // primeiros segundos: as frases futuras ('low') esperam a atual engrenar.
  if (queue[0] && queue[0].priority !== 'high') {
    const wait = 3500 - (performance.now() - lastHighAt)
    if (wait > 0) { if (!pumpTimer) pumpTimer = setTimeout(() => { pumpTimer = null; void pump() }, wait); return }
  }
  const next = queue.shift()
  if (!next) return
  busy = true
  try {
    const tts = await load(next.reqId)
    instrument(tts)
    captured = null
    const t0 = performance.now()
    const audio = await tts.generate(next.text, { voice: next.voice as never, speed: next.speed })
    // Um respiro de silêncio antes da primeira palavra: sem ele o começo da fala era comido (principalmente quando o áudio toca
    // mais devagar ou mais agudo, porque o navegador estica/encurta o som e perde os primeiros milissegundos).
    const raw = audio as unknown as { audio?: Float32Array; sampling_rate?: number }
    let blob: Blob
    let words = captured ? wordTimings(tts, captured) : null
    let phones = captured ? phoneTimings(tts, captured) : null
    if (raw.audio && raw.sampling_rate) {
      // Personagem: de-esser nas sibilantes e o tom aplicado no próprio áudio (ver pitchUp).
      let voice = next.deEss ? deEss(raw.audio, raw.sampling_rate, next.deEss) : raw.audio
      if (next.pitch && next.pitch > 1.001) voice = pitchUp(voice, raw.sampling_rate, next.pitch)
      const pad = Math.round(raw.sampling_rate * LEAD_SILENCE_S)
      const samples = new Float32Array(pad + voice.length)
      // Yuno e Yuri: de-esser nas sibilantes (o tom mais agudo deixava S/SH/F/Z estridentes). Mesma duração, sem atraso.
      samples.set(voice, pad)
      blob = wavBlob(samples, raw.sampling_rate)
      if (words) { const k = voice.length / samples.length; const o = pad / samples.length; words = words.map((w) => ({ ...w, f: o + w.f * k })) }
      if (phones) phones = alignPhones(phones, voice, raw.sampling_rate)
      if (phones) { const k = voice.length / samples.length; const o = pad / samples.length; phones = phones.map((x) => ({ ...x, f: o + x.f * k, e: o + x.e * k })) }
    } else blob = audio.toBlob()
    self.postMessage({ type: 'audio', reqId: next.reqId, blob, words, phones, ms: Math.round(performance.now() - t0) })
  } catch (e) {
    self.postMessage({ type: 'error', reqId: next.reqId, error: String((e as Error)?.message ?? e) })
  } finally {
    if (next.priority === 'high') lastHighAt = performance.now()
    busy = false
    void pump()
  }
}

self.onmessage = async (ev: MessageEvent<InMsg>) => {
  const msg = ev.data
  if (msg.type === 'cancelLow') {
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].priority !== 'high') {
        self.postMessage({ type: 'error', reqId: queue[i].reqId, error: 'cancelled' })
        queue.splice(i, 1)
      }
    }
    return
  }
  if (msg.type === 'load') {
    try {
      await load(msg.reqId)
      self.postMessage({ type: 'loaded', reqId: msg.reqId })
    } catch (e) {
      self.postMessage({ type: 'error', reqId: msg.reqId, error: String((e as Error)?.message ?? e) })
    }
    return
  }
  if (msg.priority === 'high') {
    // Fura a fila: entra depois de outras 'high' já pendentes, antes de qualquer 'low'.
    const idx = queue.findIndex((q) => q.priority !== 'high')
    if (idx === -1) queue.push(msg)
    else queue.splice(idx, 0, msg)
  } else {
    // Celular: prepara só UMA frase à frente (a próxima fica pronta enquanto a atual toca, sem buraco entre elas). Mais que
    // isso pesa na memória e na bateria; os pedidos a mais são recusados e geram na hora em que forem tocar.
    if (smallDeviceEarly() && queue.some(q => q.priority !== 'high')) { self.postMessage({ type: 'error', reqId: msg.reqId, error: 'cancelled' }); return }
    queue.push(msg)
  }
  void pump()
}
