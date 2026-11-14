// Independência de terceiros para voz (Kokoro) e escuta (Whisper):
// - o runtime ONNX (wasm) é servido pelo próprio app em /ort/ (copiado do pacote npm), sem CDN externo;
// - os modelos podem vir de um espelho próprio (VITE_MODEL_HOST) com a mesma estrutura de pastas do
//   Hugging Face (<repo>/resolve/main/<arquivo>). Sem a variável, usa o Hugging Face como hoje.
//   Cópia dos modelos: scripts/models/backup-models.mts -> content/models-backup/ (subir para o espelho).
type OnnxEnv = { remoteHost?: string; backends?: { onnx?: { wasm?: { wasmPaths?: unknown } } } }

export const MODEL_HOST = ((import.meta.env.VITE_MODEL_HOST as string | undefined) ?? '').replace(/\/+$/, '')
const HF = 'https://huggingface.co/'

export function configureModelEnv(env: OnnxEnv) {
  if (MODEL_HOST) env.remoteHost = `${MODEL_HOST}/`
  const wasm = env.backends?.onnx?.wasm
  if (wasm) wasm.wasmPaths = `${self.location.origin}/ort/`
}

/** Dentro do worker: troca downloads diretos do Hugging Face (ex.: vozes do kokoro-js) pelo espelho. */
export function redirectHuggingFaceFetch() {
  if (!MODEL_HOST) return
  const original = self.fetch.bind(self)
  self.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    return original(url.startsWith(HF) ? `${MODEL_HOST}/${url.slice(HF.length)}` : input, init)
  }) as typeof fetch
}
