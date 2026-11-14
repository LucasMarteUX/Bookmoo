/// <reference lib="webworker" />
// Whisper (OpenAI, licença MIT) rodando 100% no navegador do aluno, fora da thread da UI.
// O áudio nunca sai do aparelho. O modelo (~77 MB, int8) é baixado uma vez do Hugging Face
// e fica no Cache Storage do navegador.
//
// Variante "_timestamped": mesmo whisper-base.en, exportado com as atenções cruzadas que o
// transformers.js usa para calcular o instante de cada palavra (return_timestamps: 'word').
import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
import { configureModelEnv, redirectHuggingFaceFetch } from '../modelHost'

configureModelEnv(env as never)
redirectHuggingFaceFetch()

const MODEL_ID = 'onnx-community/whisper-base.en_timestamped'

type InMsg = { type: 'load'; reqId: number } | { type: 'transcribe'; reqId: number; audio: Float32Array }

let asrPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null

function load(reqId: number) {
  if (!asrPromise) {
    // (cast: a assinatura genérica de `pipeline` estoura o limite de tipos do TypeScript)
    const create = pipeline as unknown as (task: string, model: string, opts: object) => Promise<AutomaticSpeechRecognitionPipeline>
    asrPromise = create('automatic-speech-recognition', MODEL_ID, {
      // WASM + int8: funciona em qualquer navegador moderno (inclusive Firefox) e é o
      // menor download. WebGPU exigiria pesos fp32/q4 (~200 MB) para pouca diferença aqui.
      device: 'wasm',
      dtype: 'q8',
      progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status === 'progress') self.postMessage({ type: 'progress', reqId, file: p.file, loaded: p.loaded, total: p.total })
      },
    })
    asrPromise.catch(() => { asrPromise = null })
  }
  return asrPromise
}

self.onmessage = async (ev: MessageEvent<InMsg>) => {
  const msg = ev.data
  try {
    const asr = await load(msg.reqId)
    if (msg.type === 'load') {
      self.postMessage({ type: 'loaded', reqId: msg.reqId })
      return
    }
    const t0 = performance.now()
    const out = (await asr(msg.audio, {
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
    })) as { text: string; chunks?: Array<{ text: string; timestamp: [number, number | null] }> }
    self.postMessage({
      type: 'result',
      reqId: msg.reqId,
      text: out.text,
      words: (out.chunks ?? []).map((c) => ({ text: c.text.trim(), start: c.timestamp[0], end: c.timestamp[1] ?? c.timestamp[0] })),
      ms: Math.round(performance.now() - t0),
    })
  } catch (e) {
    self.postMessage({ type: 'error', reqId: msg.reqId, error: e instanceof Error ? e.message : String(e) })
  }
}
