// Ilustrações quadradas das categorias da galeria, no estilo das ilustrações do próprio app
// (personagem em linha preta com óculos redondos, de public/illustrations) -> public/categories/<id>.webp (360x360).
// Usa gpt-image-2 (qualidade alta) com 3 ilustrações do app como referência de estilo.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { ROOT } from './lib.mts'

const SCENE: Record<string, [string, string]> = {
  classic: ['the character sitting and reading a thick antique book, a quill pen in an inkwell and a short stack of leather-bound books beside them', '#EFE9DD'],
  children: ['a girl with long wavy hair or a high ponytail, round glasses and a small smile (same line-art style as the reference character) holding an open picture book out of which a small paper boat, a crescent moon and a few stars float up; keep the whole drawing compact and well inside the frame', '#FBEFC9'],
  adventure: ['the character with a backpack holding a compass and a rolled treasure map, with a small sailing ship and a mountain behind', '#DDEFE3'],
  fantasy: ['the character in a pointed wizard hat holding a wand with sparkles, a small castle on a cloud and stars around', '#E7E1F5'],
  mystery: ['the character in a detective cap holding a large magnifying glass, with footprints and a street lamp', '#DFE6EE'],
  romance: ['a girl with long wavy hair or a high ponytail, round glasses and a small smile (same line-art style as the reference character) holding a heart-shaped sealed letter against her chest, with a rose and small floating hearts', '#F8E1E4'],
  short: ['a girl with long wavy hair or a high ponytail, round glasses and a small smile (same line-art style as the reference character) holding several small open booklets and a tiny lantern, with small paper pages floating around', '#FBE5D3'],
  poetry: ['a girl with long wavy hair or a high ponytail, round glasses and a small smile (same line-art style as the reference character) holding a quill, with a falling leaf, a crescent moon and a small flower', '#E1E8F7'],
  nonfiction: ['the character looking through a small telescope next to an antique globe and a stack of notebooks', '#E6EBD9'],
  biography: ['a girl with long wavy hair or a high ponytail, round glasses and a small smile (same line-art style as the reference character) holding an oval picture frame with a plain silhouette inside, and a ribbon medal', '#ECE7DF'],
}
/**
 * Padrão de enquadramento: corta o desenho pelo contorno do conteúdo (fundo liso) e o reposiciona num
 * retângulo fixo (300x252 px, centrado, acima do rodapé de 30%), no mesmo fundo. Assim todas as categorias
 * têm o mesmo tamanho e posição, não importa como o modelo compôs a cena.
 */
async function fit(input: Buffer): Promise<Buffer> {
  const SIZE = 360, BOX = { x: 30, y: 16, w: 300, h: 252 }
  const base = sharp(input).removeAlpha()
  const { data, info } = await base.clone().raw().toBuffer({ resolveWithObject: true })
  const px = (x: number, y: number) => [data[(y * info.width + x) * info.channels], data[(y * info.width + x) * info.channels + 1], data[(y * info.width + x) * info.channels + 2]]
  const corners = [px(2, 2), px(info.width - 3, 2), px(2, info.height - 3), px(info.width - 3, info.height - 3)]
  const bg = corners[0].map((_, c) => Math.round(corners.reduce((sum, k) => sum + k[c], 0) / corners.length))
  const color = `rgb(${bg[0]},${bg[1]},${bg[2]})`
  const trimmed = await base.clone().trim({ background: color, threshold: 38 }).toBuffer({ resolveWithObject: true })
  const content = await sharp(trimmed.data).resize(BOX.w, BOX.h, { fit: 'inside' }).toBuffer({ resolveWithObject: true })
  const left = BOX.x + Math.round((BOX.w - content.info.width) / 2)
  const top = BOX.y + Math.round((BOX.h - content.info.height) / 2)
  return sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: color } }).composite([{ input: content.data, left, top }]).webp({ quality: 88 }).toBuffer()
}
const rawDir = join(ROOT, 'content', 'epubs', '_work', 'tiles-raw'); mkdirSync(rawDir, { recursive: true })
const out0 = join(ROOT, 'public', 'categories')
if (process.argv.includes('--fit')) {
  // Reenquadra todas (do original em alta, se existir; senão do próprio arquivo atual).
  for (const id of Object.keys(SCENE)) {
    const rawFile = join(rawDir, `${id}.jpg`)
    const src = existsSync(rawFile) ? readFileSync(rawFile) : readFileSync(join(out0, `${id}.webp`))
    writeFileSync(join(out0, `${id}.webp`), await fit(src)); console.log('✓ enquadrada', id)
  }
  process.exit(0)
}
const key = (readFileSync(join(ROOT, '.env.local'), 'utf8').match(/^OPENAI_API_KEY=(.+)$/m)?.[1] ?? '').trim().replace(/^["']|["']$/g, '')
const refs = ['reading', 'hiking', 'chatting'].map(n => join(ROOT, 'content', 'epubs', '_work', 'ill', `${n}.png`))
const out = join(ROOT, 'public', 'categories'); mkdirSync(out, { recursive: true })
for (const [id, [scene, bg]] of Object.entries(SCENE)) {
  const only = process.argv.find(a => a.startsWith('--only='))?.slice(7).split(',')
  if (only && !only.includes(id)) continue
  if (existsSync(join(out, `${id}.webp`)) && !process.argv.includes('--force')) { console.log('= ' + id); continue }
  const prompt = `Create a new square illustration in EXACTLY the same style as the reference images: minimalist black line art with solid black fills (hair, clothes), a friendly character with round glasses and a small smile, thin consistent outlines, no shading, no color except the background. Scene: ${scene}. Background: one flat solid pastel color ${bg}, nothing else (no gradient, no texture). Composition: the character and props must fit inside the central 70% of the square, centered slightly above the middle, with wide empty margins on every side and the bottom 30% completely empty (a caption will be placed there). Clean, crisp, high contrast. No text, no letters, no logos, no watermark.`
  const form = new FormData()
  form.append('model', 'gpt-image-2'); form.append('prompt', prompt); form.append('size', '1024x1024'); form.append('quality', 'high'); form.append('output_format', 'jpeg')
  refs.forEach((f, i) => form.append('image[]', new Blob([readFileSync(f)], { type: 'image/png' }), `ref${i}.png`))
  let r!: Response, j: any
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(400_000) })
      j = await r.json()
      if (r.status !== 429 && r.status < 500) break
    } catch (e: any) { console.log('  tentativa', attempt + 1, 'falhou:', e?.cause?.code ?? e?.message) }
    await new Promise(res => setTimeout(res, 8000 * (attempt + 1)))
  }
  if (!r || !j) { console.log('✗', id, 'sem resposta'); continue }
  if (!r.ok) { console.log('✗', id, r.status, String(j?.error?.message ?? '').slice(0, 140)); continue }
  const rawBuf = Buffer.from(j.data[0].b64_json, 'base64'); writeFileSync(join(rawDir, `${id}.jpg`), rawBuf)
  const webp = await fit(rawBuf)
  writeFileSync(join(out, `${id}.webp`), webp); console.log('✓', id, (webp.length / 1024).toFixed(0) + ' KB')
}
