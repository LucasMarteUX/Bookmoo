// Localiza os rostos de cada quadro, um recorte por quadro (o app recorta e reduz no navegador).
// Com o quadro isolado, a visão acerta muito mais a posição do rosto e quem é quem — e não
// depende de acertar quantos quadros a página tem. É o que permite apontar o rabicho do balão.
import { AiError, llmJson, pickProvider } from '../_shared/ai.ts'
import { cleanText, rect, type Rect } from '../_shared/comicEditorial.ts'

type CastIn = { id: string; name: string; visualDescription?: string }
type PanelIn = { image: string; cast: CastIn[]; speakers?: string[] }
type FaceOut = { speakerId: string; face: Rect }

const MAX_PANELS = 9
const MAX_IMAGE = 450_000 // base64 de um recorte reduzido (~640px)

export async function locateFaces(userId: string, input: Record<string, unknown>) {
  const panels = input.panels as PanelIn[]
  if (!Array.isArray(panels) || !panels.length || panels.length > MAX_PANELS || !panels.every(p =>
    typeof p?.image === 'string' && p.image.length < MAX_IMAGE && /^[a-z0-9+/]+={0,2}$/i.test(p.image)
    && Array.isArray(p.cast) && p.cast.length <= 8 && p.cast.every(c => typeof c?.id === 'string' && typeof c?.name === 'string'))) {
    throw new AiError('Invalid face request', 400, 'invalid_target')
  }
  const { provider, key } = await pickProvider(userId, ['gemini', 'openai'])
  const roster = panels.map((p, i) => ({
    image: i + 1,
    characters: p.cast.map((c, k) => ({
      label: `C${k + 1}`, name: cleanText(c.name, 80), looks: cleanText(c.visualDescription, 220),
      speaks: Array.isArray(p.speakers) && p.speakers.includes(c.id),
    })),
  }))
  const result = await llmJson<{ panels?: { image?: number; faces?: { label?: string; box?: unknown }[] }[] }>(provider, key, {
    images: panels.map(p => ({ mime: 'image/jpeg', data: p.image })),
    prompt: `Each image is ONE panel of a comic page, in order (image 1 = first panel).
For every image, find the visible heads of people. For each head return a tight box from the top of the hair to the chin, normalized 0–1 relative to THAT image ({x,y,w,h}, top-left origin).
Identify who each person is using the character list for that image (appearance, clothing, age, gender, and who is speaking in the scene). Use the label (C1, C2…) when you are reasonably sure, otherwise "unknown". Never give the same label to two heads in one image. Ignore people in paintings or tiny background crowds.
Character lists: ${JSON.stringify(roster).slice(0, 9000)}
Return JSON only: {"panels":[{"image":1,"faces":[{"label":"C1","box":{"x":0.1,"y":0.2,"w":0.2,"h":0.3}}]}]}`,
  })
  const out: FaceOut[][] = panels.map(() => [])
  for (const entry of Array.isArray(result?.panels) ? result.panels : []) {
    const index = Number(entry?.image) - 1
    if (!Number.isInteger(index) || !out[index]) continue
    const used = new Set<string>()
    for (const f of Array.isArray(entry.faces) ? entry.faces : []) {
      const face = rect(f?.box)
      if (!face || face.w * face.h > 0.8) continue
      const label = cleanText(f?.label, 10).toUpperCase()
      const k = /^C(\d+)$/.exec(label)?.[1]
      const character = k ? panels[index].cast[Number(k) - 1] : undefined
      const speakerId = character && !used.has(character.id) ? character.id : 'unknown'
      if (speakerId !== 'unknown') used.add(speakerId)
      out[index].push({ speakerId, face })
    }
  }
  return { faces: out }
}
