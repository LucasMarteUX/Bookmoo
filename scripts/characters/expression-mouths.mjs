// Bocas próprias de cada expressão da Bia (surpresa, triste, brava, tímida).
//
// O rig aprovado só tinha olhos e sobrancelhas nas expressões: a boca era sempre o sorriso fechado (surpresa sorrindo).
// Aqui acrescentamos, como o próprio LivLiv faz, uma camada "expr" por expressão que traz a boca dela:
//   texture = retalho de pele do rosto base (cobre o sorriso) + a boca da expressão por cima;
//   talk    = imagem transparente. Falando, a camada some e a boca da fala (visemas) aparece por cima de tudo.
//
// Uso: node scripts/characters/expression-mouths.mjs [pasta-dos-desenhos]
//   pasta-dos-desenhos (padrão /Users/lucasmarte/Desktop/Personagens/mulher): precisa de 12_bocas.png e alinhamento.json.
// Escreve em public/characters/bookmoo/mulher/textures/ e acrescenta as camadas em model.json (idempotente).
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const SRC = process.argv[2] ?? '/Users/lucasmarte/Desktop/Personagens/mulher'
const RIG = path.resolve('public/characters/bookmoo/mulher')
const BOX = { x: 444, y: 453, w: 164, h: 126 } // a mesma caixa da camada "mouth"
const PAD = 8 // transparência ao redor da peça, em px do rig (16 px na folha a 2x)

// Qual boca da folha 12_bocas cada expressão usa (a célula é a ordem da folha: 1 fechada ... 8 decidida).
const MOUTHS = {
  surprised: { cell: 4, why: 'O (redonda)' },
  sad: { cell: 7, why: 'triste' },
  angry: { cell: 8, why: 'decidida (apertada)' },
  shy: { cell: 2, why: 'entreaberta, pequena', scale: 0.82, dy: 3 },
}

const align = JSON.parse(fs.readFileSync(path.join(SRC, 'alinhamento.json'), 'utf8'))
const pieces = align.folhas['12_bocas'].pecas
const sheet = path.join(SRC, '12_bocas.png')
const emptyBox = () => sharp({ create: { width: BOX.w, height: BOX.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })

/** Uma boca da folha (2x) reduzida a 1x e posta na caixa da camada, na posição exata do master. */
async function lips(cell, { scale = 1, dy = 0 } = {}) {
  const p = pieces.find(x => x.celula === cell)
  const [rx, ry, rw, rh] = p.rect_folha
  const m2 = PAD * 2
  const crop = await sharp(sheet).extract({ left: rx - m2, top: ry - m2, width: rw + 2 * m2, height: rh + 2 * m2 }).toBuffer()
  const w1 = Math.round((rw + 2 * m2) / 2), h1 = Math.round((rh + 2 * m2) / 2)
  const sw = Math.max(1, Math.round(w1 * scale)), sh = Math.max(1, Math.round(h1 * scale))
  const small = await sharp(crop).resize(sw, sh, { kernel: 'lanczos3' }).png().toBuffer()
  // posição do canto da peça no master -> na caixa; a escala menor mantém o centro da boca no lugar
  const cx = p.origem_master[0] - BOX.x + rw / 4, cy = p.origem_master[1] - BOX.y + rh / 4
  const left = Math.round(cx - sw / 2), top = Math.round(cy - sh / 2 + dy)
  return emptyBox().composite([{ input: small, left, top }]).png().toBuffer()
}

/** Retalho de pele do rosto base, com a borda esfumaçada (a pele é a mesma de baixo: a emenda não aparece). */
async function skinPatch() {
  const face = await sharp(path.join(RIG, 'textures/face.png')).extract({ left: BOX.x, top: BOX.y, width: BOX.w, height: BOX.h }).ensureAlpha().toBuffer()
  const mask = await sharp(Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BOX.w}" height="${BOX.h}"><defs><filter id="b"><feGaussianBlur stdDeviation="5"/></filter></defs>` +
    `<ellipse cx="${BOX.w / 2}" cy="52" rx="66" ry="36" fill="#fff" filter="url(#b)"/></svg>`)).png().toBuffer()
  const m = await sharp(mask).ensureAlpha().extractChannel(0).raw().toBuffer()
  const raw = await sharp(face).raw().toBuffer({ resolveWithObject: true })
  const px = raw.data
  for (let i = 0; i < BOX.w * BOX.h; i++) px[i * 4 + 3] = Math.round(px[i * 4 + 3] * (m[i] / 255))
  return sharp(px, { raw: { width: BOX.w, height: BOX.h, channels: 4 } }).png().toBuffer()
}

// Conferência do método: a boca "entreaberta" refeita a partir da folha precisa bater com a que já está no rig.
{
  const a = await sharp(await lips(2)).raw().toBuffer()
  const b = await sharp(path.join(RIG, 'textures/final_mouth_f1.png')).ensureAlpha().raw().toBuffer()
  let d = 0, n = 0
  for (let i = 3; i < a.length; i += 4) { d += Math.abs(a[i] - b[i]); n++ }
  console.log(`conferência (alfa da boca entreaberta refeita x do rig): diferença média ${(d / n).toFixed(2)} de 255`)
}

const skin = await skinPatch()
const talk = await emptyBox().png().toBuffer()
fs.writeFileSync(path.join(RIG, 'textures/final_exprmouth_talk.png'), talk)
const layers = []
for (const [expression, cfg] of Object.entries(MOUTHS)) {
  const out = await sharp(skin).composite([{ input: await lips(cfg.cell, cfg), blend: 'over' }]).png().toBuffer()
  fs.writeFileSync(path.join(RIG, `textures/final_exprmouth_${expression}.png`), out)
  layers.push({
    id: `expr_mouth_${expression}`,
    texture: `textures/final_exprmouth_${expression}.png`,
    talk: 'textures/final_exprmouth_talk.png',
    x: BOX.x, y: BOX.y, w: BOX.w, h: BOX.h,
    group: 'head', depth: 0, role: 'expr', expression,
  })
  console.log(`boca ${expression}: célula ${cfg.cell} (${cfg.why})`)
}

const modelPath = path.join(RIG, 'model.json')
const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'))
model.layers = model.layers.filter(l => !String(l.id).startsWith('expr_mouth_'))
const at = model.layers.findIndex(l => l.id === 'expr_x_wink')
model.layers.splice(at + 1, 0, ...layers)
fs.writeFileSync(modelPath, JSON.stringify(model, null, 2) + '\n')
console.log(`model.json: ${layers.length} camadas de boca de expressão depois de expr_x_wink`)
