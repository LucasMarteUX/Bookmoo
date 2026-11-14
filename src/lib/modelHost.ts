// Independência de terceiros para voz (Kokoro) e escuta (Whisper):
// - o runtime ONNX (wasm) é servido pelo próprio app em /ort/ (copiado do pacote npm), sem CDN externo;
// - os modelos podem vir de um espelho próprio (VITE_MODEL_HOST) com a mesma estrutura de pastas do
//   Hugging Face (<repo>/resolve/main/<arquivo>). Sem a variável, usa o Hugging Face como hoje.
//   Cópia dos modelos: scripts/models/backup-models.mts -> content/models-backup/ (subir para o espelho).
type OnnxEnv = { remoteHost?: string; backends?: { onnx?: { wasm?: { wasmPaths?: unknown } } } }

export const MODEL_HOST = ((import.meta.env.VITE_MODEL_HOST as string | undefined) ?? '').replace(/\/+$/, '')
const HF = 'https://huggingface.co/'

export function configureModelEnv(env: OnnxEnv) {
  // Os downloads continuam apontando para o Hugging Face; o espelho entra por redirectHuggingFaceFetch (com fallback nos dois sentidos).
  void env
  const wasm = (env as OnnxEnv).backends?.onnx?.wasm
  if (wasm) wasm.wasmPaths = `${self.location.origin}/ort/`
}

/** Dentro do worker: com espelho próprio, tenta o espelho primeiro e cai no Hugging Face se falhar (e vice-versa). */
export function redirectHuggingFaceFetch() {
  if (!MODEL_HOST) return
  const original = self.fetch.bind(self)
  self.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.startsWith(HF)) return original(input, init)
    const mirror = `${MODEL_HOST}/${url.slice(HF.length)}`
    try {
      const res = await original(mirror, init)
      if (res.ok || res.status === 206) return res
    } catch { /* espelho fora do ar */ }
    return original(input, init)
  }) as typeof fetch
}
