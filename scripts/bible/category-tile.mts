// Ícone da categoria "Histórias Bíblicas": enquadra a arte (360x360, mesmo padrão das outras categorias) e gera a versão escura.
//   npx tsx scripts/bible/category-tile.mts <arquivo-da-arte>
import { copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
const ROOT = '/Users/lucasmarte/Desktop/BOOKMOO'
const src = process.argv[2]; if (!src) throw new Error('informe o arquivo da arte')
const raw = join(ROOT, 'content/bible/covers'); mkdirSync(raw, { recursive: true }); copyFileSync(src, join(raw, 'category-raw.webp'))
const dir = join(ROOT, 'public/categories')

// Mesmo enquadramento de scripts/classics/tiles.mts: corta pelo contorno do desenho e centra num retângulo fixo de 300x252.
const SIZE = 360, BOX = { x: 30, y: 16, w: 300, h: 252 }
const base = sharp(src).removeAlpha()
const { data, info } = await base.clone().raw().toBuffer({ resolveWithObject: true })
const px = (x: number, y: number) => [0, 1, 2].map(c => data[(y * info.width + x) * info.channels + c])
const corners = [px(2, 2), px(info.width - 3, 2), px(2, info.height - 3), px(info.width - 3, info.height - 3)]
const bg = corners[0].map((_, c) => Math.round(corners.reduce((s, k) => s + k[c], 0) / corners.length))
const color = `rgb(${bg[0]},${bg[1]},${bg[2]})`
const trimmed = await base.clone().trim({ background: color, threshold: 38 }).toBuffer()
const content = await sharp(trimmed).resize(BOX.w, BOX.h, { fit: 'inside' }).toBuffer({ resolveWithObject: true })
const left = BOX.x + Math.round((BOX.w - content.info.width) / 2), top = BOX.y + Math.round((BOX.h - content.info.height) / 2)
const light = await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: color } }).composite([{ input: content.data, left, top }]).webp({ quality: 88 }).toBuffer()
await sharp(light).toFile(join(dir, 'bible-stories.webp'))
console.log('✓ bible-stories.webp')

// Versão escura (como scripts/classics/tiles-dark.mts): fundo vira o tom escuro e o traço, cinza-claro.
const LINE = [204, 204, 204], DARK = [0x2a, 0x28, 0x20]
const L = await sharp(light).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const lum = (i: number) => 0.299 * L.data[i] + 0.587 * L.data[i + 1] + 0.114 * L.data[i + 2]
const bgLum = lum(0), out = Buffer.alloc(L.data.length)
for (let i = 0; i < L.data.length; i += 3) {
  const t = Math.max(0, Math.min(1, lum(i) / bgLum))
  for (let c = 0; c < 3; c++) out[i + c] = Math.round(LINE[c] + (DARK[c] - LINE[c]) * t)
}
await sharp(out, { raw: { width: L.info.width, height: L.info.height, channels: 3 } }).webp({ quality: 88 }).toFile(join(dir, 'bible-stories-dark.webp'))
console.log('✓ bible-stories-dark.webp')
