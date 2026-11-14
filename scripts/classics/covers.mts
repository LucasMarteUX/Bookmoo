// Capas dos EPUBs originais: arte gerada com a API de imagens da OpenAI (chave de .env.local, nunca impressa),
// no estilo definido para cada livro (catalog_books.style_id), com título e autor compostos por cima (texto exato, sem erro de grafia).
//   npx tsx scripts/classics/covers.mts gen <n>            gera a arte e a capa final em content/epubs/<livro>/cover-ai.jpg
//   npx tsx scripts/classics/covers.mts apply <n> [--run]  grava cover_data/cover_thumb do livro (só esses dois campos)
//   npx tsx scripts/classics/covers.mts all [de [até]] [--run]  lote sequencial, com checkpoint em status.json (coverAi)
import { readFileSync, writeFileSync, existsSync, readdirSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'
import { ROOT, SUPABASE_REF } from './lib.mts'

const OUT = join(ROOT, 'content', 'epubs')
const log = (...a: unknown[]) => console.log(...a)
const envKey = () => {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY
  const m = readFileSync(join(ROOT, '.env.local'), 'utf8').match(/^OPENAI_API_KEY=(.+)$/m)
  if (!m) throw new Error('OPENAI_API_KEY ausente em .env.local')
  return m[1].trim().replace(/^["']|["']$/g, '')
}
const MODEL = 'gpt-image-2' // fixo: nada de variável de ambiente trocando o modelo

const STYLE: Record<string, string> = {
  'aquarela-nanquim': 'handmade watercolor and pen-and-ink illustration, soft translucent washes, expressive imperfect ink linework, warm and timeless',
  'fantasia-epica': 'detailed epic fantasy painting, rich saturated colors, heroic grand scale, luminous light',
  'terror-gotico': 'gothic horror engraving-style illustration, expressive deep shadows, heavy black ink, muted cold palette with a single accent color',
  'ficcao-cientifica': 'science-fiction concept art, vast technological and cosmic settings, cinematic lighting',
  'romance-aquarela': 'delicate editorial watercolor illustration, romantic soft light, refined period elegance',
  'pintura-historica': 'polished classic period illustration in the manner of a clean digital painting, smooth blended brushwork, rich earthy tones, dramatic natural light',
  'noir-misterio': 'cinematic black-and-white noir illustration with deep contrast, fog and gaslight, one subtle red accent',
  'hq-americana': 'American comic-book art, bold ink outlines and flat saturated colors, dynamic action composition',
  'hq-europeia': 'European comic art in the clear-line (ligne claire) tradition, clean outlines, controlled flat colors',
  'infantil-guache': "children's picture-book gouache painting, playful rounded shapes, opaque matte paint, bright friendly colors",
  'realismo-magico': 'surreal magical-realism painting, poetic dreamlike atmosphere, symbolic imagery, rich textures',
}

const MOTIF: Record<number, string> = {
  4: 'a young girl in a blue gingham dress with a yellow hen, walking beside a clockwork copper man toward a distant emerald-green royal palace across golden sands',
  8: 'a white farmhouse with green gables at the end of a country lane lined with blooming white cherry trees, a straw hat and a wicker carpetbag resting on a garden gate, soft spring light',
  9: 'a young red-haired schoolteacher with an armful of books walking through autumn orchards toward a small village schoolhouse',
  10: 'a mole, a water rat, a badger and a toad gathered by a river bank with a small rowing boat under willow trees',
  11: 'a girl with long hair in a blue dress peering down a deep rabbit hole, a white rabbit with a pocket watch and playing cards floating around her',
  12: 'a tall ornate mirror opening like a doorway into a giant chessboard landscape with living chess pieces, a blue dress and white apron on a Victorian doll in the foreground, a red queen and white knight',
  13: 'a young elephant with a long stretched trunk beside a wide river, a crocodile, and whimsical African savanna animals',
  14: 'a boy in a loincloth sitting in a moonlit jungle with a black panther, a big bear and a wolf pack among hanging vines',
  15: 'a barefoot boy in a straw hat with a fishing pole on a raft on the great Mississippi River, a whitewashed fence on the shore',
  16: 'two identical boys facing each other, one in royal Tudor velvet and one in ragged clothes, a Tudor London street and palace behind them',
  17: 'a powerful sled dog standing in deep snow under shimmering northern lights, a pack team and a distant gold-rush trail',
  18: 'a wolf-dog standing on a ridge of a snowy pine forest at dusk, breath steaming, wild and watchful',
  19: 'an old wooden pirate ship approaching a tropical island, a boy with a spyglass in the foreground, a treasure chest and an old map',
  20: 'a young man in an 18th-century coat and a kilted Highlander with a sword crossing a stormy heather moor in the Scottish Highlands',
  21: 'explorers in pith helmets on a jungle plateau looking up at dinosaurs and a pterodactyl flying overhead',
  22: 'the red deserts of Mars under two moons, a warrior with a sword and a princess before a strange ancient alien city',
  23: 'a Victorian detective silhouette with a magnifying glass on a foggy London street at night, gaslight, a scarlet ribbon drifting',
  24: 'a steam launch chasing along the Thames at night, an old ornate treasure chest and lantern light, Victorian London skyline',
  25: 'a Baker Street sitting room seen from the street at night: a lit window with the silhouette of a tall man and a violin on a table, gaslamps and fog outside',
  26: 'a large dark hound shape on a misty moor hill under a full moon, a lonely manor house far below, atmospheric and mysterious but not gory',
  27: 'a detective standing at the edge of a roaring waterfall in a rocky gorge, mist and a narrow cliff path',
  28: 'a glowing yellow diamond shining on the forehead of an Indian moon god statue, a Victorian country house at night in the background',
  29: 'a lone woman in a white dress and veil standing on a moonlit country road beside an old gate in the dark night',
  30: 'a gleaming brass-and-crystal time machine with glowing dials in a far-future landscape with a giant white sphinx statue and a strange sun',
  31: 'a man with a fully bandaged face, dark goggles, a hat and a long coat in a snowy village street at night, footprints in the snow',
  32: 'a towering tripod Martian war machine with a heat ray over a burning Victorian English town under a red sky',
  33: 'a round spacecraft on the cratered lunar surface, strange glowing plants, a large blue Earth rising in the black sky',
  34: 'geometric beings (a square, triangles, a hexagon, a circle) living on a flat luminous plane with a floating sphere piercing it, abstract and elegant',
  35: 'a stormy laboratory with lightning, a tall stitched creature in shadow, Alpine mountains and a dark lake outside the window',
  36: 'a Transylvanian castle on a cliff under a full moon, a swarm of bats, mist in the pine valley below',
  37: 'a gaslit foggy London street, a man whose face is half refined gentleman and half shadowy beast, chemistry vials on a table',
  38: 'an ornate gilded portrait frame containing a decaying aged version of a handsome young man, a dim attic, a candle, a red velvet curtain',
  39: 'a Regency couple dancing in a ballroom with a grand Georgian country house seen through tall windows, elegant ladies in the background',
  40: 'two sisters in Regency dresses walking on green hills toward a thatched country cottage, one calm, one dreamy with a book',
  41: 'a young governess in a plain gray dress standing before a dark stone manor with one lit window on a windswept moor at dusk',
  42: 'a wild windswept moor with heather, a lonely old stone farmhouse, a figure at an open window in a gathering storm',
  43: 'four sisters in 1860s dresses gathered in a cozy New England parlor with books, a sewing basket, a piano and a warm hearth at Christmas',
  44: 'a snowy Victorian London street with a lit lamp post, a kindly old man in a nightcap holding a candle, and a friendly translucent ghostly figure in the air above, warm festive mood',
  45: 'a boy on misty marshes at dawn with a hunted convict in the distance, a decaying mansion with a cobwebbed wedding table behind',
  46: 'a lone green light at the end of a dock across a dark bay, a lit mansion with a glittering 1920s party and art-deco patterns',
  47: 'two elegant Victorian gentlemen at a drawing-room tea table with cucumber sandwiches, a comic leather handbag and a bouquet',
  48: 'a whaling ship and a tiny whaleboat with harpooner, an enormous white whale breaching from a stormy sea',
  49: 'a river steamboat on a dark jungle river at dusk, thick mist, vast black forest walls on both banks',
  50: 'Dublin in 1904: a round Martello tower by the sea at sunrise, a bridge over the Liffey river, a man with a hat walking',
}

// Direção de lettering por livro: o título é desenhado pelo modelo dentro da arte, como numa capa impressa.
const LETTER: Record<number, string> = {
  36: 'tall condensed gothic blackletter-inspired title lettering in smooth bone-white with a clean blood-red inner shadow and sharp pointed serifs, crisp and polished, like a premium Victorian horror edition',
}
LETTER[19] = 'bold swashbuckling pirate-era title lettering, smooth glossy polished gold letters with a clean dark brown outline and soft highlight, on a clean smooth dark wooden signboard with a tidy rope edge, plus a clean parchment banner for the author'
MOTIF[51] = 'a detective silhouette in a deerstalker emerging from the fog toward a warmly lit Baker Street window, a brick wall with a few simple chalk marks'
MOTIF[52] = 'a dark mountain valley with a coal-mining town, a manor house with a moat and drawbridge at night, a mysterious folded cipher letter in the foreground'
MOTIF[53] = 'an elderly white-haired detective and a doctor on a seaside cliff at dusk looking over stormy waves, a vintage 1914 car with lamps behind them'
MOTIF[54] = 'a vintage case-file desk with a magnifying glass, a pipe, a violin, a Persian slipper and a mysterious ring under a green banker lamp, Victorian'
const L = (n: number, t: string) => { LETTER[n] = t }
L(4, 'whimsical rounded storybook lettering in emerald green and gold with a tiny crown on the O, smooth and glossy')
L(8, 'warm hand-painted romantic script title lettering with flowing swashes in deep forest green and cream, sprigs of white blossoms woven around the letters')
L(9, 'elegant autumn-toned serif title lettering with small flourishes in burnt orange and cream, small falling leaves')
L(10, 'friendly Edwardian storybook lettering with gentle curves in river blue and cream, little reeds and a leaf accent')
L(11, 'whimsical Victorian fantasy lettering with curly swirls and playing-card motifs in rich blue and gold, smooth and glossy')
L(12, 'mirror-symmetric elegant Victorian chess-themed lettering in black and silver with a reflected shimmer, smooth and clean')
L(13, 'playful hand-drawn folk lettering in warm ochre, terracotta and black with small animal-pattern ornaments, smooth')
L(14, 'bold jungle lettering with vines weaving through thick letters in rich green and golden yellow, clean and polished')
L(15, 'folksy Americana woodtype lettering in cream with red outline, like a painted riverboat sign, clean and smooth')
L(16, 'Tudor-era blackletter-inspired royal lettering in gold with a deep crimson shadow and a tiny crown, polished')
L(17, 'rugged bold condensed lettering in icy white with a deep blue outline and frost highlights, clean')
L(18, 'strong rugged condensed lettering in white with slate-blue shadow and frosty highlights, clean and polished')
L(20, 'adventurous Scottish-romantic lettering with a Celtic knotwork touch in tartan red and gold on dark, polished')
L(21, 'bold explorer-expedition poster lettering in cream and jungle green with clean outline and small fern accents')
L(22, 'retro pulp sci-fi lettering in glowing copper-orange with a red-planet gradient, clean and metallic')
L(23, 'Victorian detective serif lettering in cream with a scarlet red accent line and a magnifying-glass motif, clean')
L(24, 'ornate Victorian sensation-novel lettering with four small ornamental stars, in cream and deep red, clean')
L(25, 'classic Victorian newspaper-style bold serif lettering in cream, with subtle gold flourishes, clean')
L(26, 'eerie sharp serif lettering in pale glowing green-white with fog fading into the letters, clean')
L(27, 'dramatic Victorian engraved serif lettering in cream with cold blue shadow like waterfall mist, clean')
L(28, 'exotic jeweled lettering in glowing yellow-gold with diamond sparkles and an Indian-inspired ornamental touch, polished')
L(29, 'elegant ghostly Victorian script lettering in pure white with a soft pale-blue glow, clean')
L(30, 'sleek retro-futuristic Victorian brass-and-glass lettering with gear accents in brass gold on deep teal, clean and metallic')
L(31, 'bandage-white condensed lettering with a faint translucent invisible fade on the lower half of the letters, clean')
L(32, 'bold retro sci-fi lettering in fiery orange with a red glow and tripod-leg serifs, clean and metallic')
L(33, 'vintage Edwardian adventure-sci-fi lettering in silver with a lunar blue glow and small crater accents, clean')
L(34, 'minimal geometric lettering built from perfect straight lines, triangles and squares, in white and teal, ultra clean')
L(35, 'tall jagged gothic lettering with electric-blue lightning glow running through the letters, clean and polished')
L(37, 'split dual-nature Victorian serif lettering: left half refined gold, right half dark and jagged, clean and polished')
L(38, 'decadent Art-Nouveau aesthetic lettering in gold leaf with emerald green and a sensual flourish, clean and polished')
L(39, 'refined Regency calligraphic script lettering in dusty rose and gold with delicate flourishes, clean')
L(40, 'graceful Regency calligraphic lettering in sage green and cream with two intertwined flourishes, clean')
L(41, 'dramatic Victorian gothic-romance serif lettering in cream with deep burgundy shadow, clean')
L(42, 'wild windswept lettering with letters leaning like heather in the wind, in stormy lilac and cream, clean')
L(43, 'warm homespun 1860s lettering in cream and rose with a stitched-embroidery feel and small flower accents, clean and smooth')
L(44, 'festive Victorian Christmas lettering in cream and holly red and green with snowflakes and a candle motif, clean')
L(45, 'refined Victorian engraved serif lettering in cream with a muted gold underline and lace flourishes, clean')
L(46, 'glamorous Art Deco geometric lettering in gold on deep teal-black with a green glow, clean and metallic')
L(47, 'witty Victorian comedy-of-manners serif lettering in cream and gold with a playful flourish, clean')
L(48, 'bold nautical lettering in cream like carved scrimshaw on deep ocean blue with a wave swirl, clean and polished')
L(49, 'stark narrow serif lettering in pale bone-white with a thin smoky edge on a near-black jungle, clean')
L(50, 'inventive stream-of-consciousness Irish-modernist lettering in emerald green and cream with a playful oversized initial, clean')
const letterOf =(n: number) => LETTER[n] ?? 'hand-drawn title lettering with strong personality that matches the story, genre and era'

const dirs = readdirSync(OUT).filter(d => /^\d\d-/.test(d))
const dirOf = (n: number) => { const d = dirs.find(x => x.startsWith(String(n).padStart(2, '0') + '-')); if (!d) throw new Error('pasta ausente: ' + n); return join(OUT, d) }
const statusOf = (n: number) => JSON.parse(readFileSync(join(dirOf(n), 'status.json'), 'utf8'))
const saveStatus = (n: number, patch: Record<string, unknown>) => writeFileSync(join(dirOf(n), 'status.json'), JSON.stringify({ ...statusOf(n), ...patch, updatedAt: new Date().toISOString() }, null, 2) + '\n')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function wrap(text: string, max: number) {
  const lines: string[] = []; let cur = ''
  for (const w of text.split(/\s+/)) { if ((cur + ' ' + w).trim().length > max) { lines.push(cur); cur = w } else cur = (cur + ' ' + w).trim() }
  if (cur) lines.push(cur)
  return lines
}

async function art(n: number): Promise<Buffer> {
  const st = statusOf(n); const style = STYLE[st.style_id]; const motif = MOTIF[n]
  if (!style || !motif) throw new Error('sem estilo/motivo para ' + n)
  const prompt = `Context: this is original cover artwork for a public-domain classic of world literature (the author died more than 70 years ago and the book is free of copyright), wholesome and suitable for all ages, a reader-app edition for English learners. It is NOT based on any film, TV series, game, brand, trademark or modern edition, and it depicts no real person. Portrait book-cover illustration (2:3) for the classic novel "${st.title}" by ${st.author}. Art style: ${style}. Scene: ${motif}. Design it as a real, professionally designed printed book cover where the lettering is part of the artwork: the title "${st.epubTitle ?? st.title}" is drawn as custom hand-made display lettering (${letterOf(n)}), large, dominant, perfectly legible, integrated with the scene, and the author name "${st.epubAuthor ?? st.author}" appears smaller in a complementary lettering. Spell both texts EXACTLY as given, letter by letter, and include no other text of any kind. No logos, no watermark, no store borders, no barcode. Rendering quality: crisp, sharp, richly detailed and high-contrast, with deep saturated colors and clean edges. CLEAN FINISH: smooth, polished, professional commercial book-cover rendering with clean crisp edges and smooth gradients; absolutely no canvas texture, no paper texture, no craquelure or cracked paint, no film grain, no noise, no dirty or smudged look, no distressed or weathered effects on the lettering. Not washed-out, not faded, not hazy, not blurry, not low-contrast, no grain overlay, no yellow filter.`
  const simple = `Book cover illustration for the classic novel "${st.epubTitle ?? st.title}" by ${st.epubAuthor ?? st.author}. Style: ${style}. Scene: ${motif}. The title is drawn as elegant custom lettering (${letterOf(n)}), large and legible, and the author's name appears smaller below it. Spell both texts exactly as given and add no other text. Clean, polished, high-contrast rendering.`
  const finalPrompt = process.env.SIMPLE_PROMPT ? simple : prompt
  const key = envKey()
  let last = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, prompt: finalPrompt, size: '1024x1536', quality: 'high', output_format: 'jpeg', n: 1 }), signal: AbortSignal.timeout(240_000),
      })
      const j: any = await r.json().catch(() => ({}))
      if (r.status === 429 || r.status >= 500) { last = `HTTP ${r.status}`; await sleep(8000 * 2 ** attempt); continue }
      if (!r.ok) throw new Error(`OpenAI ${r.status}: ${String(j?.error?.message ?? '').slice(0, 200)}`)
      const b64 = j.data?.[0]?.b64_json
      if (!b64) throw new Error('sem imagem na resposta')
      return Buffer.from(b64, 'base64')
    } catch (e: any) { last = e.message; if (/OpenAI 4\d\d/.test(last)) throw e; await sleep(5000 * 2 ** attempt) }
  }
  throw new Error('geração falhou: ' + last)
}

async function compose(raw: Buffer, title: string, author: string) {
  const lines = wrap(title, 18).length > 3 ? wrap(title, 24) : wrap(title, 18)
  const longest = Math.max(...lines.map(l => l.length))
  const size = Math.min(110, Math.floor(900 / (longest * 0.58)))
  const lh = size + 10
  const h = 1536
  const authorSize = Math.min(40, Math.floor(880 / (author.length * 0.8)))
  const blockTop = 1420 - lines.length * lh - 60
  const t = lines.map((l, i) => `<text x="512" y="${blockTop + (i + 1) * lh}" font-size="${size}" font-weight="700" text-anchor="middle" fill="#fff8ea" font-family="Georgia, 'Times New Roman', serif" stroke="#000" stroke-opacity=".35" stroke-width="2" paint-order="stroke">${esc(l)}</text>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".82"/></linearGradient></defs>
<rect x="0" y="${blockTop - 150}" width="1024" height="${h - blockTop + 150}" fill="url(#g)"/>
${t}<line x1="352" y1="1436" x2="672" y2="1436" stroke="#fff8ea" stroke-opacity=".8" stroke-width="3"/>
<text x="512" y="1486" font-size="${authorSize}" letter-spacing="5" text-anchor="middle" fill="#fff8ea" font-family="Georgia, serif">${esc(author.toUpperCase())}</text></svg>`
  const jpg = await sharp(raw).resize(1024, 1536, { fit: 'cover' }).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).jpeg({ quality: 86, mozjpeg: true }).toBuffer()
  const thumb = await sharp(jpg).resize(320).webp({ quality: 72 }).toBuffer()
  return { jpg, thumb }
}

async function gen(n: number) {
  const dir = dirOf(n); const st = statusOf(n)
  if (!existsSync(join(dir, 'cover-se.jpg')) && existsSync(join(dir, 'cover.jpg'))) copyFileSync(join(dir, 'cover.jpg'), join(dir, 'cover-se.jpg')) // guarda a capa original do EPUB
  let raw: Buffer
  if (existsSync(join(dir, 'cover-art.jpg'))) raw = readFileSync(join(dir, 'cover-art.jpg'))
  else { raw = await art(n); writeFileSync(join(dir, 'cover-art.jpg'), raw) }
  const jpg = await sharp(raw).resize(600, 900, { fit: 'cover' }).jpeg({ quality: 90, mozjpeg: true }).toBuffer()
  const thumb = await sharp(jpg).resize(320).webp({ quality: 72 }).toBuffer()
  writeFileSync(join(dir, 'cover-ai.jpg'), jpg); writeFileSync(join(dir, 'cover-ai-thumb.webp'), thumb)
  saveStatus(n, { coverAi: { ...(st.coverAi ?? {}), generated: true, model: MODEL, style: st.style_id, at: new Date().toISOString() } })
  log(`✓ capa ${n} "${st.title}" [${st.style_id}] ${(jpg.length / 1024).toFixed(0)} KB`)
}

function dbQuery(file: string) {
  const r = spawnSync('npx', ['-y', 'supabase@3.1.0', 'db', 'query', `--remote=${SUPABASE_REF}`, '--yes', '-f', file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, cwd: ROOT })
  const raw = (r.stdout ?? '') + (r.stderr ?? '')
  let json: any = null
  try { json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) } catch { /* */ }
  return { ok: r.status === 0 && !!json && !json.error, json, raw: raw.slice(0, 800) }
}

async function apply(n: number, run: boolean) {
  const dir = dirOf(n); const st = statusOf(n)
  if (st.status !== 'PUBLISHED' || !st.id) throw new Error('livro não publicado')
  if (!st.coverAi?.generated) throw new Error('capa não gerada')
  const cover = 'data:image/jpeg;base64,' + readFileSync(join(dir, 'cover-ai.jpg')).toString('base64')
  const thumb = 'data:image/webp;base64,' + readFileSync(join(dir, 'cover-ai-thumb.webp')).toString('base64')
  const sql = `update public.catalog_books set cover_data = $cv$${cover}$cv$, cover_thumb = $cv$${thumb}$cv$ where id = '${st.id}' returning id, title, (cover_data like 'data:image/jpeg%') as ok, length(cover_data) as len;\n`
  const file = join(dir, 'cover-update.sql'); writeFileSync(file, sql)
  if (!run) return log('dry-run: ' + file)
  const r = dbQuery(file)
  const row = r.json?.rows?.[0]
  if (!r.ok || !row?.ok) throw new Error('UPDATE falhou: ' + r.raw)
  saveStatus(n, { coverAi: { ...statusOf(n).coverAi, applied: true, appliedAt: new Date().toISOString(), bytes: row.len } })
  log(`✓ capa aplicada no banco: ${row.title}`)
}

const [cmd, a1, a2] = process.argv.slice(2)
const run = process.argv.includes('--run')
const num = (s?: string) => (s && /^\d+$/.test(s) ? Number(s) : undefined)
if (cmd === 'gen') await gen(Number(a1))
else if (cmd === 'apply') await apply(Number(a1), run)
else if (cmd === 'all') {
  for (let n = num(a1) ?? 4; n <= (num(a2) ?? 54); n++) {
    if (n === 19 || n === 36) continue // já aprovadas e gravadas
    if (!MOTIF[n]) continue
    try { if (!statusOf(n).coverAi?.applied) { await gen(n); await apply(n, run) } else log('= ' + n + ' já aplicada') } catch (e: any) { log('✗', n, e.message); saveStatus(n, { coverAi: { ...(statusOf(n).coverAi ?? {}), error: e.message } }) }
  }
} else { console.error('uso: covers.mts gen|apply <n> [--run] | all [de [até]] [--run]'); process.exit(1) }
