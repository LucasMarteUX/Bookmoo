// Gera 4 capas numa só imagem (grade 2x2 em 1024x1536, cada célula 512x768 = 2:3) e recorta cada uma.
// Qualidade média e 1 chamada para 4 livros: cerca de 1/12 do custo de 4 capas em qualidade alta.
//   npx tsx scripts/classics/covers-grid.mts <arquivo-spec.json> [--dry]
// spec.json: [{ "n": 105, "title": "...", "author": "...", "style": "...", "scene": "...", "lettering": "..." } x até 4]
// Saída: content/epubs/<livro>/cover-art.jpg (recorte 600x900) + folha em content/epubs/_work/grid-<ts>.jpg para conferir.
// Depois: `covers.mts gen <n>` compõe a capa final e `covers.mts apply <n> --run` grava (depois de conferir a grafia).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { ROOT } from './lib.mts'

type Spec = { n: number; title: string; author: string; style: string; scene: string; lettering: string }
const specs: Spec[] = JSON.parse(readFileSync(process.argv[2], 'utf8'))
if (specs.length < 1 || specs.length > 4) throw new Error('use de 1 a 4 livros por imagem')
const POS = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
const key = (readFileSync(join(ROOT, '.env.local'), 'utf8').match(/^OPENAI_API_KEY=(.+)$/m)?.[1] ?? '').trim().replace(/^["']|["']$/g, '')

const cells = specs.map((s, i) => `${POS[i]} quarter — a complete portrait book cover for "${s.title}" by ${s.author}. Style: ${s.style}. Scene: ${s.scene}. Title lettering: ${s.lettering}; the title "${s.title}" is large and legible and the author "${s.author}" smaller below it.`).join('\n')
const prompt = `A single image divided into a 2x2 grid of FOUR SEPARATE portrait book covers, each cover filling exactly one quarter of the image edge to edge, with no gaps, no borders between them, no overlap and no shared elements. Each cover is a different book with its own scene, palette and lettering. Original artwork for public-domain classic books, wholesome, no film or brand imagery, no real people.\n${cells}\nSpell every title and author name EXACTLY as written, letter by letter, and add no other text. Clean, polished, crisp rendering; no grain, no noise, not washed-out.`
if (process.argv.includes('--dry')) { console.log(prompt); process.exit(0) }

const r = await fetch('https://api.openai.com/v1/images/generations', {
  method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'gpt-image-2', prompt, size: '1024x1536', quality: 'medium', output_format: 'jpeg', n: 1 }), signal: AbortSignal.timeout(400_000),
})
const j: any = await r.json()
if (!r.ok) throw new Error(`OpenAI ${r.status}: ${String(j?.error?.message ?? '').slice(0, 200)}`)
const raw = Buffer.from(j.data[0].b64_json, 'base64')
const stamp = Date.now()
writeFileSync(join(ROOT, 'content', 'epubs', '_work', `grid-${stamp}-raw.jpg`), raw)
const dirs = readdirSync(join(ROOT, 'content', 'epubs'))
const W = 512, H = 768, INSET = 4
for (let i = 0; i < specs.length; i++) {
  const left = (i % 2) * W + INSET, top = Math.floor(i / 2) * H + INSET
  const dir = dirs.find(d => d.startsWith(`${String(specs[i].n).padStart(2, '0')}-`))
  if (!dir) { console.log('pasta ausente para', specs[i].n); continue }
  const crop = await sharp(raw).extract({ left, top, width: W - 2 * INSET, height: H - 2 * INSET }).resize(600, 900, { fit: 'cover' }).jpeg({ quality: 92 }).toBuffer()
  writeFileSync(join(ROOT, 'content', 'epubs', dir, 'cover-art.jpg'), crop)
  console.log('✓ recorte', specs[i].n, specs[i].title)
}
console.log('Confira a grafia em content/epubs/_work/grid-' + stamp + '-raw.jpg antes de gravar.')
