// Guarda os pacotes npm de voz e escuta, nas versões exatas do package-lock, em content/npm-backup.
// Se o npm ou o GitHub sumirem com algum, `npm install content/npm-backup/<arquivo>.tgz` recupera.
//   npx tsx scripts/models/backup-npm.mts
import { readFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')).packages as Record<string, { version: string }>
const names = ['kokoro-js', '@huggingface/transformers', '@huggingface/jinja', 'phonemizer', 'onnxruntime-web', 'onnxruntime-common']
const out = join(process.cwd(), 'content', 'npm-backup'); mkdirSync(out, { recursive: true })
for (const name of names) {
  const v = lock[`node_modules/${name}`]?.version
  if (!v) { console.log('· fora do lock:', name); continue }
  const r = spawnSync('npm', ['pack', `${name}@${v}`, '--pack-destination', out], { encoding: 'utf8' })
  console.log(r.status === 0 ? `✓ ${name}@${v}` : `✗ ${name}@${v} ${r.stderr.slice(0, 120)}`)
}
