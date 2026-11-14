// Versões escuras dos tiles de categoria (sem gerar nada na API): o fundo pastel vira o tom escuro da paleta do modo escuro
// e o traço preto vira cinza-claro, como nos cards "Pratique hoje".  npx tsx scripts/classics/tiles-dark.mts
import { join } from 'node:path'
import sharp from 'sharp'
import { ROOT } from './lib.mts'
export const DARK: Record<string, string> = {
  classic: '#2b2823', children: '#302b1c', adventure: '#1f2e2a', fantasy: '#2a2438', mystery: '#212c3b',
  romance: '#33242b', short: '#33271f', poetry: '#232a3d', nonfiction: '#28301f', biography: '#2d2a26',
}
const LINE = [204, 204, 204] // cinza-claro do traço
const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const dir = join(ROOT, 'public', 'categories')
for (const [id, bgHex] of Object.entries(DARK)) {
  const { data, info } = await sharp(join(dir, `${id}.webp`)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const lum = (i: number) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  const bgLum = lum(0) // canto: fundo liso
  const bg = hex(bgHex), out = Buffer.alloc(data.length)
  for (let i = 0; i < data.length; i += 3) {
    const t = Math.max(0, Math.min(1, lum(i) / bgLum)) // 0 = traço, 1 = fundo
    for (let c = 0; c < 3; c++) out[i + c] = Math.round(LINE[c] + (bg[c] - LINE[c]) * t)
  }
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } }).webp({ quality: 88 }).toFile(join(dir, `${id}-dark.webp`))
  console.log('✓', id)
}
