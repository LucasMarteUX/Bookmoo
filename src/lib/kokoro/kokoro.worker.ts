/// <reference lib="webworker" />
// Roda o Kokoro-82M (Apache-2.0) 100% no navegador do aluno, fora da thread da UI.
// O modelo é baixado uma vez do Hugging Face e fica no Cache Storage do navegador.
import { KokoroTTS } from 'kokoro-js'
import { env } from '@huggingface/transformers'

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

type GenMsg = { type: 'generate'; reqId: number; text: string; voice: string; speed: number; priority?: 'high' | 'low' }
type InMsg = { type: 'load'; reqId: number } | GenMsg | { type: 'cancelLow' }

let ttsPromise: Promise<KokoroTTS> | null = null

// WebGPU + fp32: qualidade total e geração rápida (recomendação do kokoro-js).
// Sem WebGPU: WASM + q8 (menor, porém com perda de qualidade e mais lento).
async function pickBackend(): Promise<{ device: 'webgpu' | 'wasm'; dtype: 'fp32' | 'q8' }> {
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

// O ONNX Runtime (principalmente em WebGPU) não suporta inferências simultâneas na mesma sessão:
// chamadas concorrentes travam ou corrompem o áudio. Geramos uma frase por vez, com prioridade
// para a frase que vai tocar agora ('high') sobre os pré-carregamentos ('low').
const queue: GenMsg[] = []
let busy = false

async function pump() {
  if (busy) return
  const next = queue.shift()
  if (!next) return
  busy = true
  try {
    const tts = await load(next.reqId)
    instrument(tts)
    captured = null
    const t0 = performance.now()
    const audio = await tts.generate(next.text, { voice: next.voice as never, speed: next.speed })
    const blob: Blob = audio.toBlob()
    const words = captured ? wordTimings(tts, captured) : null
    self.postMessage({ type: 'audio', reqId: next.reqId, blob, words, ms: Math.round(performance.now() - t0) })
  } catch (e) {
    self.postMessage({ type: 'error', reqId: next.reqId, error: String((e as Error)?.message ?? e) })
  } finally {
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
    queue.push(msg)
  }
  void pump()
}
