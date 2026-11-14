// Guarda uma cópia local dos modelos de voz e escuta usados pelo app (licenças Apache-2.0 e MIT permitem),
// na mesma estrutura do Hugging Face, para subir num espelho próprio (VITE_MODEL_HOST) se a fonte sair do ar.
//   npx tsx scripts/models/backup-models.mts   ->  content/models-backup/<repo>/resolve/main/<arquivo>
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const OUT = join(process.cwd(), 'content', 'models-backup')
const REPOS: { repo: string; keep: (path: string) => boolean }[] = [
  // Kokoro com tempos por palavra: fp32 (WebGPU) e q8 (WASM/celular)
  { repo: 'onnx-community/Kokoro-82M-v1.0-ONNX-timestamped', keep: p => !p.startsWith('onnx/') || p === 'onnx/model.onnx' || p === 'onnx/model_quantized.onnx' },
  // Vozes que o kokoro-js baixa direto deste repositório
  { repo: 'onnx-community/Kokoro-82M-v1.0-ONNX', keep: p => p.startsWith('voices/') },
  // Whisper base.en com tempos por palavra, q8
  { repo: 'onnx-community/whisper-base.en_timestamped', keep: p => !p.startsWith('onnx/') || /_quantized\.onnx$/.test(p) },
]
for (const { repo, keep } of REPOS) {
  const tree = await (await fetch(`https://huggingface.co/api/models/${repo}/tree/main?recursive=1`)).json() as { type: string; path: string; size: number }[]
  const files = tree.filter(f => f.type === 'file' && keep(f.path) && !/^\.git|README|\.md$/.test(f.path))
  console.log(`${repo}: ${files.length} arquivos, ${(files.reduce((s, f) => s + f.size, 0) / 1e6).toFixed(0)} MB`)
  for (const f of files) {
    const dest = join(OUT, repo, 'resolve', 'main', f.path)
    if (existsSync(dest) && statSync(dest).size === f.size) continue
    mkdirSync(dirname(dest), { recursive: true })
    const res = await fetch(`https://huggingface.co/${repo}/resolve/main/${f.path}`)
    if (!res.ok || !res.body) { console.log('  ✗', f.path, res.status); continue }
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest))
    console.log('  ✓', f.path)
  }
}
// Manifesto com SHA-256 de cada arquivo: serve para conferir a cópia e o espelho depois.
import { readdirSync } from 'node:fs'
const manifest: Record<string, string> = {}
const walk = async (dir: string) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) { await walk(full); continue }
    if (e.name === 'MANIFEST.json') continue
    const h = createHash('sha256'); await pipeline(createReadStream(full), h)
    manifest[full.slice(OUT.length + 1)] = h.digest('hex')
  }
}
await walk(OUT)
writeFileSync(join(OUT, 'MANIFEST.json'), JSON.stringify(manifest, null, 2))
console.log('Pronto em content/models-backup (MANIFEST.json com SHA-256)')
