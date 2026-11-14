// Folhas de contato numeradas das imagens externas (para mapear qual é qual e conferir a grafia).
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
const [dir, outPrefix, per = '8', cols = '4', w = '330', h = '495'] = process.argv.slice(2)
const files = readdirSync(dir).filter(f => /\.(webp|jpe?g|png)$/i.test(f)).sort()
const W = Number(w), H = Number(h), C = Number(cols), P = Number(per)
for (let s = 0; s * P < files.length; s++) {
  const chunk = files.slice(s * P, s * P + P)
  const layers = await Promise.all(chunk.map(async (f, i) => ({ input: await sharp(join(dir, f)).resize(W, H, { fit: 'cover' }).toBuffer(), left: (i % C) * W, top: Math.floor(i / C) * H })))
  await sharp({ create: { width: W * C, height: H * Math.ceil(chunk.length / C), channels: 3, background: '#222' } }).composite(layers).jpeg({ quality: 88 }).toFile(`${outPrefix}-${s + 1}.jpg`)
  console.log(`folha ${s + 1}:`, chunk.map((f, i) => `${i + 1}=${f.replace(/\.webp$/, '')}`).join(' | '))
}
console.log('total', files.length)
const meta = await Promise.all(files.slice(0, 3).map(async f => { const m = await sharp(join(dir, f)).metadata(); return `${m.width}x${m.height}` }))
console.log('dimensões (amostra):', meta.join(', '))
