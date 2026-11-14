// Sobe a cópia dos modelos (content/models-backup) para o bucket público "voice-models" do Supabase,
// na estrutura do Hugging Face. Depois, defina VITE_MODEL_HOST=<SUPABASE_URL>/storage/v1/object/public/voice-models
// no Vercel: o app passa a baixar do seu espelho e só cai no Hugging Face se o espelho falhar.
//   1) npx tsx scripts/models/backup-models.mts      (se ainda não tiver a cópia local)
//   2) SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/models/upload-models.mts
// Arquivos grandes (o modelo completo tem ~310 MB) exigem limite de upload alto no projeto (Settings → Storage).
import { createClient } from '@supabase/supabase-js'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const db = createClient(url, key, { auth: { persistSession: false } })
const ROOT = join(process.cwd(), 'content', 'models-backup')
const BUCKET = 'voice-models'

const files: string[] = []
const walk = (dir: string) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const f = join(dir, e.name); e.isDirectory() ? walk(f) : files.push(f) } }
walk(ROOT)

let ok = 0, skipped = 0, failed = 0
for (const file of files) {
  const path = relative(ROOT, file).replace(/\\/g, '/')
  const { data: existing } = await db.storage.from(BUCKET).list(path.split('/').slice(0, -1).join('/'), { search: path.split('/').pop() })
  if (existing?.some(e => e.name === path.split('/').pop() && Number((e.metadata as { size?: number } | null)?.size) === statSync(file).size)) { skipped++; continue }
  const type = path.endsWith('.json') ? 'application/json' : 'application/octet-stream'
  const { error } = await db.storage.from(BUCKET).upload(path, readFileSync(file), { upsert: true, contentType: type, cacheControl: '31536000' })
  if (error) { failed++; console.log('  ✗', path, error.message) } else { ok++; console.log('  ✓', path) }
}
console.log(`Pronto: ${ok} enviados, ${skipped} já estavam lá, ${failed} com erro.`)
