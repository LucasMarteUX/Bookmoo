import { AiError, bytesToB64, llmJson, pickProvider, type ImagePart, type Provider } from '../_shared/ai.ts'
import { adminClient } from '../_shared/tts.ts'
import { isHistoricalRomanceStyle } from '../_shared/comicStyle.ts'
import { matchesComposition, stripBounds, templateBounds } from './composition.ts'
import { loadReferences } from '../comic-generate/references.ts'
import { cleanText, rect, type ComicRow, type PanelInspection, type Rect, type StyleDocument } from '../_shared/comicEditorial.ts'

export type Expected = { panelId: string; cast: { id: string; name: string; visualDescription: string }[]; action: string; speakers?: string[] }
type Detection = { panelId: string; bounds: unknown; faces?: { speakerId?: string; face: unknown; body?: unknown }[]; free?: unknown[]; focus?: unknown[] }

export async function inspectComic(userId: string, input: Record<string, unknown>) {
  const prefix = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/comic-pages/`
  const imageUrl = cleanText(input.imageUrl)
  const path = imageUrl.startsWith(prefix) ? imageUrl.slice(prefix.length) : ''
  const expected = input.expected as Expected[]
  const aspect = Number(input.aspect)
  const ownedPath = path.startsWith(`${userId}/`) && /^[\da-f-]+\/\d+-[\da-f-]+\.(png|jpg|webp)$/i.test(path.slice(userId.length + 1))
  if (!ownedPath || !Array.isArray(expected) || !expected.length || expected.length > 9 || !expected.every((p, i) => p?.panelId === `panel-${i + 1}` && Array.isArray(p.cast)
      && p.cast.every(c => typeof c?.id === 'string')) || !Number.isFinite(aspect) || aspect < 0.4 || aspect > 1.5) {
    throw new AiError('Invalid inspection target', 400, 'invalid_target')
  }
  const sb = adminClient()
  const { data, error } = await sb.storage.from('comic-pages').download(path)
  if (error || !data || data.size > 12 * 1024 * 1024) throw new AiError('Cannot inspect image', 502, 'image_fetch_failed')
  const referenceIds = Array.isArray(input.referenceIds) ? input.referenceIds : []
  const bookId = path.split('/')[1]
  const images = [{ mime: data.type, data: bytesToB64(new Uint8Array(await data.arrayBuffer())) }]
  let referenceRoles: string[] = []
  if (referenceIds.length) {
    const { data: book } = await sb.from('books').select('comic_style_doc').eq('id', bookId).eq('user_id', userId).maybeSingle()
    const references = (book?.comic_style_doc as StyleDocument | undefined)?.references ?? []
    const selected = referenceIds.flatMap(id => references.filter(reference => reference.id === id))
    if (selected.length !== referenceIds.length) throw new AiError('Visual references changed', 409, 'comic_reference_failed')
    const loaded = await loadReferences(sb, userId, bookId, { references: selected })
    referenceRoles = selected.map(ref => `${ref.type}: ${cleanText(ref.instructions, 140)}`)
    images.push(...await Promise.all(loaded.images.map(async ref => ({
      mime: ref.mime, data: bytesToB64(new Uint8Array(await ref.blob.arrayBuffer())),
    }))))
  }
  const { provider, key } = await pickProvider(userId, referenceIds.length ? ['openai'] : ['gemini', 'openai'])
  const measured = Array.isArray(input.measuredBounds) && input.measuredBounds.length === expected.length
    ? input.measuredBounds.map(rect) : []
  const measuredBounds = measured.length && measured.every((bound): bound is Rect => bound !== null) ? measured : undefined
  return analyzeComicArtwork({ provider, key, expected, aspect, images, referenceRoles, measuredBounds, composition: input.composition, style: input.style })
}

export async function analyzeComicArtwork({ provider, key, expected, aspect, images, referenceRoles, composition, style, measuredBounds }: {
  provider: Provider; key: string; expected: Expected[]; aspect: number; images: ImagePart[]
  referenceRoles: string[]; composition?: unknown; style?: unknown; measuredBounds?: Rect[]
}) {
  // Give vision short, panel-local labels instead of asking it to copy UUIDs.
  const castLabels = expected.map(spec => spec.cast.map((character, index) => ({ ...character, label: `C${index + 1}` })))
  const storyboard = expected.map(({ cast: _cast, speakers, ...spec }, index) => ({
    ...spec,
    cast: castLabels[index].map(({ id, label, name, visualDescription }) => ({
      label, name, visualDescription, speaks: Array.isArray(speakers) && speakers.includes(id),
    })),
  }))
  const direction = (style ?? {}) as StyleDocument
  const historicalRomance = isHistoricalRomanceStyle(direction) && !referenceRoles.some(role => role.startsWith('style:'))
  type Verdict = { panels?: Detection[]; panelCount?: number; styleMatches?: boolean; visiblyDrawn?: boolean; cleanPastelInk?: boolean; flatCharacterColors?: boolean; lightSimplifiedBackgrounds?: boolean; textFree?: boolean; referencesMatch?: boolean; issues?: string[] }
  const result: Verdict | null = await llmJson<{ panels?: Detection[]; panelCount?: number; styleMatches?: boolean; visiblyDrawn?: boolean; cleanPastelInk?: boolean; flatCharacterColors?: boolean; lightSimplifiedBackgrounds?: boolean; textFree?: boolean; referencesMatch?: boolean; issues?: string[] }>(provider, key, {
    images,
    prompt: `Inspect this rendered comic artwork. Report the actual number of panels. Read bands from top to bottom. Within each band, read left to right. When a tall left panel is beside a right stack, read the tall panel first, then the top right panel, then the bottom right panel.
Requested composition (inspect the actual image, not the plan): ${JSON.stringify(composition ?? []).slice(0, 1200)}
Expected storyboard with panel-local cast labels: ${JSON.stringify(storyboard).slice(0, 11500)}
${measuredBounds ? `Panel borders already measured from pixels, in reading order: ${JSON.stringify(measuredBounds)}. Use these borders as the coordinate frame for face, body, and free areas in each panel.` : 'Read panel borders from pixels. Planned row proportions are not coordinates.'}
Expected art direction: ${JSON.stringify(style ?? {}).slice(0, 2400)}
${referenceRoles.length ? `The first image is the finished artwork. Remaining images are references, in order: ${JSON.stringify(referenceRoles)}. Compare the artwork with each reference only in its designated role. Set referencesMatch to true only if the relevant visual traits are recognizably represented.` : ''}
Set visiblyDrawn true only when faces, skin, hair and clothing are visibly constructed with deliberate illustrative shapes and drawn contours. A photo-like image or realistic cinematic digital painting with a few ink marks must be false.
${historicalRomance ? 'For historical romance judge the panels by these concrete tests. cleanPastelInk: foreground people are drawn with clearly stylized facial shapes, clean hair masses and legible ink silhouettes. flatCharacterColors: skin and clothing predominantly use a flat base color and one clean shadow shape, with minimal modeled gradients or painted fabric texture. lightSimplifiedBackgrounds: scenery is primarily pale, loose blocks of watercolor with fewer details than the people, without dark brown or sepia dominating. Evaluate these independently. A detailed realistic watercolor or digital painting does not count as flat character color.' : ''}
Return {panelCount, styleMatches, visiblyDrawn, cleanPastelInk, flatCharacterColors, lightSimplifiedBackgrounds, textFree, referencesMatch, issues, panels:[{panelId,bounds,faces:[{speakerId,face,body}],free:[],focus:[]}]}.
For each panel, identify one to three tight rectangles covering only the main subject, key gesture or story object. Return them in focus. Do not mark the whole scene. Free areas may contain drawn background details, furniture or landscape. Choose lower contrast areas that keep the main subject clear.
Every rectangle is {x,y,w,h}, top-left origin, normalized 0 to 1. Panel bounds are relative to the whole page. Face/body and free rectangles are relative to the actual panel. Use the visible head from crown to chin; include foreground faces even if the person's identity is uncertain, labeled "unknown". Never assign an ID based on expected position alone. Free rectangles must exclude faces and important action, even if that leaves a narrow area. Prioritize locating speaking characters. Use the short cast label such as C1 when identity is clear. Check style against the supplied direction and report missing characters and major scene mismatches. A detailed cinematic or realistic painted rendering fails styleMatches when the brief asks for visibly drawn simplified shapes and clean ink lines. For a style reference, assess facial construction and contour style as well as color. textFree means the art contains no lettering or balloons. Return JSON only.`,
  }).catch((e) => {
    if (e instanceof AiError && ['no_api_key', 'invalid_key', 'quota'].includes(e.code)) throw e
    return null
  })
  // Inspection never discards finished artwork: problems become review issues and the
  // lettering engine works from the best available panel geometry.
  const issues = Array.isArray(result?.issues) ? result!.issues!.map(issue => cleanText(issue, 160)).filter(Boolean).slice(0, 12) : []
  if (!result || result.visiblyDrawn !== true || (historicalRomance && (result.cleanPastelInk !== true || result.flatCharacterColors !== true || result.lightSimplifiedBackgrounds !== true))) {
    issues.push('art_style_mismatch')
  } else if (result.styleMatches !== true) issues.push('art_direction_mismatch')
  if (result && result.textFree === false) issues.push('art_has_text')
  if (referenceRoles.length && result?.referencesMatch !== true) issues.push('references_unverified')

  const rows = Array.isArray(composition) ? (composition as ComicRow[]).filter(row => row && Array.isArray(row.cols) && row.cols.length) : []
  const intersection = (a: Rect, b: Rect) =>
    Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
    * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  const overlapping = (list: Rect[]) => list.some((p, i) => list.slice(0, i).some(q =>
    intersection(p, q) > 0.05 * Math.min(p.w * p.h, q.w * q.h)))
  const visionPanels = Array.isArray(result?.panels) && result!.panels!.length === expected.length
    ? result!.panels! : null
  const visionBounds = visionPanels?.map(panel => rect(panel?.bounds))
  const visionUsable = !!visionBounds && visionBounds.every((b): b is Rect => b !== null) && !overlapping(visionBounds as Rect[])
    && (!rows.length || matchesComposition(visionBounds as Rect[], rows))
  const template = rows.length ? templateBounds(rows) : []
  const bounds: Rect[] = measuredBounds
    ?? (visionUsable ? visionBounds as Rect[] : template.length === expected.length ? template : stripBounds(expected.length))
  if (!measuredBounds && !visionUsable) issues.push('panel_detection_fallback')

  const panels: PanelInspection[] = expected.map((spec, i) => {
    // Panel-local detections only make sense when vision saw the same panel sequence.
    const found = visionPanels?.[i]
    const faces = (Array.isArray(found?.faces) ? found!.faces! : []).flatMap(entry => {
      const face = rect(entry?.face)
      if (!face) return []
      const identifier = cleanText(entry.speakerId, 120).toLowerCase()
      const character = castLabels[i].find(c => [c.label, c.id, c.name].some(value => value.toLowerCase() === identifier))
      return [{ speakerId: character?.id ?? 'unknown', face, body: rect(entry.body) ?? undefined }]
    }).slice(0, 20)
    for (const character of spec.cast) {
      if (spec.speakers?.includes(character.id) && !faces.some(f => f.speakerId === character.id)) issues.push(`character_unlocated:${spec.panelId}:${character.name}`)
    }
    const free = (Array.isArray(found?.free) ? found!.free! : []).flatMap(entry => rect(entry) ?? []).slice(0, 8)
    const focus = (Array.isArray(found?.focus) ? found!.focus! : []).flatMap(entry => rect(entry) ?? []).slice(0, 3)
    return { panelId: spec.panelId, bounds: bounds[i], faces, free, focus }
  })
  return { panels, aspect, issues }
}
