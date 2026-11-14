// Copia o runtime ONNX (wasm) do pacote npm para public/ort, para o app não depender de CDN externo.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const from = join('node_modules', '@huggingface', 'transformers', 'dist')
const to = join('public', 'ort')
if (!existsSync(from)) { console.log('copy-ort: pacote ausente, ignorando'); process.exit(0) }
mkdirSync(to, { recursive: true })
for (const f of ['ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm']) copyFileSync(join(from, f), join(to, f))
console.log('copy-ort: runtime ONNX copiado para public/ort')
