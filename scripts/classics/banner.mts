// Banner horizontal de coleção (arte gerada com gpt-image-2, qualidade alta). Uso: npx tsx scripts/classics/banner.mts sherlock-holmes
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { ROOT } from './lib.mts'

const slug = process.argv[2]
const PROMPTS: Record<string, string> = {
  'sherlock-holmes': `Wide horizontal editorial banner artwork for a premium literary collection of Victorian detective stories. Foggy Victorian London street at night in the Baker Street style, old gas street lamps casting warm amber light, wet cobblestones with reflections, brick townhouse facades with lit windows. On the RIGHT third: the elegant silhouette of a detective in a deerstalker cap and long cape holding a pipe, walking under a lamp post, seen from the side. The LEFT half must be calm, dark and uncluttered (deep charcoal and midnight-blue fog with only soft distant lamps) so a title can be placed over it. Palette: black, charcoal gray, midnight blue, warm lamp light, subtle aged gold accents. Clean, polished, professional commercial book-art rendering with crisp edges and smooth gradients; no film grain, no noise, no texture overlay, not washed-out. Original artwork, no film or TV adaptation imagery, no real person likeness. Absolutely no text, no letters, no numbers, no logos, no watermark.`,
}
PROMPTS['classics'] = `Wide horizontal editorial banner artwork for a premium collection of timeless literary classics. An elegant old library interior seen from the right: tall wooden shelves full of leather-bound books with gold spines, a reading desk with an open book, a quill pen, a brass lamp casting warm amber light and a tall arched window with soft evening light. The LEFT half must be calm, dark and uncluttered (deep walnut brown and charcoal shadows, soft bokeh) so a title can be placed over it. Palette: deep burgundy, walnut brown, charcoal, warm amber candle light, subtle aged gold accents. Clean, polished, professional commercial book-art rendering with crisp edges and smooth gradients; no film grain, no noise, no texture overlay, not washed-out. Original artwork, no real person likeness. Absolutely no text, no letters, no numbers, no logos, no watermark.`

// Banners das demais coleções: cena à direita, metade esquerda calma e escura para o título (texto vem da interface).
const TAIL = ' The LEFT half must be calm, dark and uncluttered (soft shadows and gentle gradients) so a title can be placed over it. Clean, polished, professional commercial book-art rendering with crisp edges and smooth gradients; no film grain, no noise, no texture overlay, not washed-out. Original artwork, no film, TV or game imagery, no real person likeness. Absolutely no text, no letters, no numbers, no logos, no watermark.'
const SCENES: Record<string, string> = {
  'gothic-horror-classics': 'Wide horizontal editorial banner artwork for a premium collection of gothic horror classics. An ancient gothic castle with pointed towers on a cliff under a huge pale moon on the RIGHT, bats, drifting mist, a twisted tree and a distant lit window. Palette: black, charcoal gray, deep blood red and bone white.',
  'h-g-wells-science-fiction': 'Wide horizontal editorial banner artwork for a premium collection of classic Victorian science fiction. On the RIGHT: a brass-and-glass time machine, a distant tripod war machine on a hill, a starry sky with a large moon and a small round spaceship. Palette: copper, bronze, deep teal blue and warm amber glow.',
  'wonderful-world-of-oz': 'Wide horizontal editorial banner artwork for a premium collection of the Oz fantasy books. On the RIGHT: a winding yellow brick road leading to a glittering emerald-green city with towers, poppy fields, a scarecrow silhouette and a rainbow. Palette: emerald green, gold, warm sky blue; whimsical storybook look.',
  'anne-of-green-gables': 'Wide horizontal editorial banner artwork for a premium collection of the Anne of Green Gables books. On the RIGHT: a white farmhouse with green gables among blooming cherry trees on green rolling Prince Edward Island fields, a dirt lane and the sea beyond, soft golden light. Palette: soft greens, white blossoms, warm gold and sky blue.',
  'edgar-allan-poe': 'Wide horizontal editorial banner artwork for a premium collection of gothic tales of mystery and horror. On the RIGHT: a raven perched on a stone bust beside an old gothic window, a candle, a crumbling mansion in the mist. Palette: black, deep wine red, charcoal and pale moonlight.',
  'barsoom': 'Wide horizontal editorial banner artwork for a premium collection of Martian planetary adventure. On the RIGHT: the red deserts of Mars with two moons, towering ancient alien cities, a flying airship and a swordsman silhouette. Palette: burnt orange, sand, deep red and violet sky.',
  'pellucidar': 'Wide horizontal editorial banner artwork for a premium collection about a hollow lost world inside the Earth. On the RIGHT: a lush prehistoric jungle with giant ferns, a glowing never-setting sun in the center of the sky, a pterodactyl and a distant dinosaur silhouette. Palette: deep greens, amber and teal.',
  'arsene-lupin': 'Wide horizontal editorial banner artwork for a premium collection about a gentleman thief in belle-époque Paris. On the RIGHT: elegant Paris rooftops and a lit mansion window at night, a silhouette in a top hat and cape, a monocle and a glowing jewel. Palette: dark navy blue, gold and warm lamplight.',
  'jules-verne': 'Wide horizontal editorial banner artwork for a premium collection of extraordinary voyages. On the RIGHT: an old brass submarine, a hot air balloon, antique maps, a globe and a compass in sepia and deep navy tones with bronze machinery.',
  'lovecraft': 'Wide horizontal editorial banner artwork for a premium collection of cosmic horror. On the RIGHT: a vast dark ocean under an unearthly sky, enormous impossible cyclopean architecture rising from the water, tiny lighthouse light, tentacle-like clouds (atmospheric, not gory). Palette: deep green, black and pale sickly teal.',
}
for (const [k, v] of Object.entries(SCENES)) PROMPTS[k] = v + TAIL
const key = (readFileSync(join(ROOT, '.env.local'), 'utf8').match(/^OPENAI_API_KEY=(.+)$/m)?.[1] ?? '').trim().replace(/^["']|["']$/g, '')
if (!PROMPTS[slug]) throw new Error('sem prompt para ' + slug)
mkdirSync(join(ROOT, 'content', 'collections', slug), { recursive: true })
const r = await fetch('https://api.openai.com/v1/images/generations', {
  method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'gpt-image-2', prompt: PROMPTS[slug], size: '1536x1024', quality: 'high', output_format: 'jpeg', n: 1 }), signal: AbortSignal.timeout(300_000),
})
const j: any = await r.json()
if (!r.ok) throw new Error(`OpenAI ${r.status}: ${String(j?.error?.message ?? '').slice(0, 200)}`)
const raw = Buffer.from(j.data[0].b64_json, 'base64')
const dir = join(ROOT, 'content', 'collections', slug)
writeFileSync(join(dir, 'banner-art.jpg'), raw)
// referência 1440x600 (2,4:1), recortando o centro vertical
const webp = await sharp(raw).resize(1440, 600, { fit: 'cover', position: 'centre' }).webp({ quality: 84 }).toBuffer()
writeFileSync(join(dir, 'banner.webp'), webp)
console.log('✓ banner', (webp.length / 1024).toFixed(0), 'KB')
