// Folha de contato das capas geradas (para conferir a grafia): npx tsx scripts/classics/sheet.mts <n1,n2,...> <saida.jpg>
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { ROOT } from './lib.mts'
const ns = process.argv[2].split(',').map(Number); const out = process.argv[3]
const dir = join(ROOT, 'content', 'epubs'); const dirs = readdirSync(dir)
const W = 330, H = 495, cols = 4, rows = Math.ceil(ns.length / cols)
const layers = await Promise.all(ns.map(async (n, i) => ({ input: await sharp(join(dir, dirs.find(d => d.startsWith(String(n).padStart(2, '0') + '-'))!, 'cover-ai.jpg')).resize(W, H).toBuffer(), left: (i % cols) * W, top: Math.floor(i / cols) * H })))
await sharp({ create: { width: W * cols, height: H * rows, channels: 3, background: '#222' } }).composite(layers).jpeg({ quality: 88 }).toFile(out)
