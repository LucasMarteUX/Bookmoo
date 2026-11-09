/// <reference lib="dom" />
import { strict as assert } from 'node:assert'
import { composeRows, planPrompt, resolvePlan, type ModelPlan } from './storyboard.ts'
import { analyzeComicArtwork } from '../comic-layout/inspect.ts'
import { matchesComposition } from '../comic-layout/composition.ts'
import { imagePrompt } from './imagePrompt.ts'
import { loadReferences } from './references.ts'
import { generateImage } from '../_shared/ai.ts'
import { sentenceSpans } from '../_shared/comic.ts'
import { fullComicText } from '../_shared/comicText.ts'
import type { ComicInspection, Dialogue } from '../_shared/comicEditorial.ts'
import { headRect, letteringConflicts, overlaps, placeCompleteComic, placeDialogue, placePanelBoxes, tailTip } from '../../../src/lib/comicLettering.ts'

const excerpt = '“I know,” said Alice. “Then leave,” said Benoît. Silence filled the hall.'
const model: ModelPlan = {
  style: { artStyle: 'Thin ink and pale watercolor', palette: 'ivory and lilac' },
  context: { confirmed: 'Prologue, 1789', inferred: 'Linen daywear', unknown: 'Exact county', continuity: 'Reunion' },
  characters: [
    { name: 'Alice', visualDescription: 'Dark eyes' },
    { name: 'Benoît', visualDescription: 'Sharp jaw' },
  ],
  beats: [
    { from: 0, to: 1, action: 'They argue', period: '1789', expression: 'Tense brows', cast: ['Alice', 'Benoît'], dialogue: [
      { text: 'I know,', speaker: 'Alice', sourceSentenceIds: [0], balloonType: 'speech', position: 'top-left' },
      { text: 'Then leave,', speaker: 'Benoît', sourceSentenceIds: [1], balloonType: 'expressive', position: 'top-right' },
    ] },
    { from: 2, to: 2, action: 'She turns away', framing: 'Close-up', importance: 'high', dialogue: [] },
  ],
}

const resolve = (raw = model, previous: typeof model.characters = [], style = {}) =>
  resolvePlan(raw, style, previous!, sentenceSpans(excerpt), excerpt, 0)

Deno.test('historical direction and time survive a silent dramatic beat and subsequent pages', () => {
  const first = resolve()
  const second = resolve({ ...model, style: { artStyle: 'Studio photo' } }, first.cast, first.style)
  assert.equal(first.context.confirmed, 'Prologue, 1789')
  assert.equal(first.beats[0].period, '1789')
  assert.equal(first.beats[1].framing, 'Close-up')
  assert.deepEqual(first.beats[1].dialogue, [])
  assert.ok(composeRows(first.beats)[1].h > composeRows(first.beats)[0].h)
  assert.equal(second.style.artStyle, 'Thin ink and pale watercolor')
  assert.equal(second.style.palette, first.style.palette)
  assert.equal(second.style.revision, first.style.revision)
  assert.deepEqual(second.cast, first.cast)
  assert.match(planPrompt('Title', '', {}, [], [], ''), /flashback/)
})

Deno.test('verbatim dialogue and attribution are independently validated', () => {
  const raw = structuredClone(model)
  raw.beats![0].dialogue![0].text = 'Invented line'
  assert.throws(() => resolve(raw), /could not be found/)
  raw.beats![0].dialogue![0].text = 'I know,'
  raw.beats![0].dialogue![0].speaker = 'Unknown'
  assert.equal(resolve(raw).beats[0].dialogue[0].attribution, 'ambiguous')
  assert.equal(resolve(raw).beats[0].dialogue[0].speakerId, null)
  raw.beats![0].dialogue!.pop()
  assert.throws(() => resolve(raw), /was omitted or shortened/)
})

Deno.test('alternating speakers get separate targets, in reading order, without overlapping faces', () => {
  const plan = resolve()
  const lines = plan.beats[0].dialogue
  const faces = [
    { speakerId: lines[0].speakerId!, face: { x: 0.20, y: 0.48, w: 0.12, h: 0.20 } },
    { speakerId: lines[1].speakerId!, face: { x: 0.72, y: 0.48, w: 0.12, h: 0.20 } },
  ]
  const inspection: ComicInspection = { aspect: 2 / 3, issues: [], panels: [{
    panelId: 'panel-1', bounds: { x: 0.03, y: 0.03, w: 0.94, h: 0.37 },
    faces, free: [{ x: 0.03, y: 0.03, w: 0.94, h: 0.39 }],
  }] }
  const result = placeDialogue(inspection, lines, (text, size) => text.length * size * 0.52)
  const [left, right] = result.balloons
  assert.deepEqual(result.issues, [])
  assert.ok(left.box!.x < right.box!.x)
  assert.ok(left.targetAnchor!.x < 0.5 && right.targetAnchor!.x > 0.5)
  assert.ok(!overlaps(left.box!, right.box!))
  assert.ok(faces.every(({ face }) => !overlaps(left.box!, face) && !overlaps(right.box!, face)))
})

Deno.test('narration has no tail and lettering overflow keeps all source text for review', () => {
  const line: Dialogue = { ...resolve().beats[0].dialogue[0], balloonType: 'caption', attribution: 'narration' }
  const inspection: ComicInspection = { aspect: 2 / 3, issues: [], panels: [{
    panelId: 'panel-1', bounds: { x: 0.03, y: 0.03, w: 0.94, h: 0.37 }, faces: [], free: [],
  }] }
  const measure = (text: string, size: number) => text.length * size * 0.52
  const caption = placeDialogue(inspection, [line], measure).balloons[0]
  assert.ok(caption.box)
  assert.equal(caption.targetAnchor, null)
  const long = { ...line, text: 'Narrative detail '.repeat(200) }
  const overflow = placeDialogue(inspection, [long], measure)
  assert.equal(overflow.balloons[0].text, long.text)
  assert.equal(overflow.balloons[0].box, null)
  assert.deepEqual(overflow.issues, ['lettering_overflow:panel-1'])
})

Deno.test('OpenAI receives the actual references in order as multipart files', async () => {
  const before = globalThis.fetch
  try {
    globalThis.fetch = async (url, opts) => {
      assert.equal(url, 'https://api.openai.com/v1/images/edits')
      const form = opts!.body as FormData
      assert.equal(form.get('model'), 'gpt-image-2')
      assert.equal(form.get('prompt'), 'ordered reference roles')
      const files = form.getAll('image[]') as File[]
      assert.deepEqual(files.map(file => [file.name, file.type]), [['ref0.png', 'image/png'], ['ref1.webp', 'image/webp']])
      assert.deepEqual(await Promise.all(files.map(file => file.text())), ['png fixture', 'webp fixture'])
      return Response.json({ data: [{ b64_json: btoa('result') }] })
    }
    const image = await generateImage('openai', 'fixture', 'ordered reference roles', [
      { mime: 'image/png', blob: new Blob(['png fixture'], { type: 'image/png' }) },
      { mime: 'image/webp', blob: new Blob(['webp fixture'], { type: 'image/webp' }) },
    ])
    assert.equal(new TextDecoder().decode(image.bytes), 'result')
  } finally { globalThis.fetch = before }
})


Deno.test('visual references are read from the owner’s book folder and inaccessible files stop generation', async () => {
  const file = '33333333-3333-4333-8333-333333333333.png'
  const calls: string[] = []
  let accessible = true
  const fakeStorage = { storage: { from: (bucket: string) => ({
    download: (path: string) => {
      calls.push(`${bucket}/${path}`)
      return accessible
        ? { data: new Blob(['fixture'], { type: 'image/png' }), error: null }
        : { data: null, error: new Error('forbidden') }
    },
  }) } } as unknown as Parameters<typeof loadReferences>[0]
  const style = { references: [{ id: 'ref', name: 'Ink guide', file, type: 'style' as const, instructions: '' }] }
  const result = await loadReferences(fakeStorage, 'owner', 'book', style)
  assert.deepEqual(calls, [`comic-references/owner/book/${file}`])
  assert.equal(await result.images[0].blob.text(), 'fixture')
  accessible = false
  await assert.rejects(loadReferences(fakeStorage, 'owner', 'book', style), /Could not access reference: Ink guide/)
  await assert.rejects(loadReferences(fakeStorage, 'owner', 'book', {
    references: [{ ...style.references[0], file: '../other-book/ref.png' }],
  }), /Invalid visual reference/)
})


Deno.test('the tail points to a distant speaker without becoming a long pointer', () => {
  const box = { x: 0.1, y: 0.1, w: 0.4, h: 0.12 }
  const anchor = { x: 0.3, y: 0.85 }
  const tip = tailTip(box, anchor, 1, 1.5)
  assert.ok(Math.abs(tip.x - anchor.x) < 0.00001)
  assert.ok(tip.y > box.y + box.h)
  assert.ok((tip.y - box.y - box.h) * 1.5 <= 0.037)
  assert.ok(tip.y < anchor.y)
})

Deno.test('manual lettering cannot cover a face or invert reading order', () => {
  const panel = {
    panelId: 'panel-1', bounds: { x: 0, y: 0, w: 1, h: 1 },
    faces: [{ speakerId: 'a', face: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 } }],
    free: [],
  }
  const spans = sentenceSpans(excerpt)
  const plan = resolvePlan(model, {}, [], spans, excerpt, 0)
  const lines = plan.beats.flatMap(beat => beat.dialogue).slice(0, 2)
  const balloons = lines.map((line, index) => ({
    ...line, panelId: panel.panelId, font: 0.02, targetAnchor: null,
    box: { x: 0.1 + index * 0.4, y: 0.1, w: 0.2, h: 0.12 },
  }))
  assert.equal(balloons.length, 2)
  assert.equal(letteringConflicts([panel], balloons, 2 / 3), false)
  assert.equal(letteringConflicts([panel], [{ ...balloons[0], box: panel.faces[0].face }, balloons[1]], 2 / 3), true)
  assert.equal(letteringConflicts([panel], [
    { ...balloons[0], box: balloons[1].box }, { ...balloons[1], box: balloons[0].box },
  ], 2 / 3), true)
})

Deno.test('a retry restores an omitted quotation verbatim without inventing a speaker', () => {
  const raw = structuredClone(model)
  const beat = raw.beats!.find(beat => beat.dialogue?.length)!
  const omitted = beat.dialogue!.shift()!.text!
  const plan = resolvePlan(raw, {}, [], sentenceSpans(excerpt), excerpt, 0, true)
  const restored = plan.beats.flatMap(beat => beat.dialogue).find(line => line.attribution === 'ambiguous')
  assert.ok(restored)
  assert.equal(excerpt.slice(restored.charStart, restored.charEnd), restored.text)
  assert.ok(restored.text.includes(omitted))
  assert.equal(restored.speakerId, null)
})

Deno.test('the planner records model exclusions for editorial review', () => {
  const raw = structuredClone(model)
  raw.beats!.find(beat => beat.dialogue?.length)!.dialogue!.shift()
  raw.nonDialogueQuotes = [{ id: 0, reason: 'Claimed typographic emphasis' }]
  const plan = resolvePlan(raw, {}, [], sentenceSpans(excerpt), excerpt, 0)
  assert.match(plan.editorialIssues[0], /quotation_review:.*Claimed typographic emphasis/)
})


Deno.test('the image prompt translates lettering reservations into painted scenery', () => {
  const raw = structuredClone(model)
  raw.beats![0].reservation = 'Draw a speech balloon placeholder here'
  raw.style!.lettering = 'A custom lettering treatment'
  const plan = resolvePlan(raw, {}, [], sentenceSpans(excerpt), excerpt, 0)
  const prompt = imagePrompt(plan, composeRows(plan.beats), [], 0)
  assert.match(prompt, /painted scenery/)
  assert.match(prompt, /Paint the entire scene, including the quieter areas/)
  assert.match(prompt, /Avoid blank patches/)
  assert.doesNotMatch(prompt, /Draw a speech balloon placeholder|A custom lettering treatment|I know,/)
})

Deno.test('composition supports side-by-side frames and a tall frame beside stacked panels', () => {
  const plan = resolvePlan(model, {}, [], sentenceSpans(excerpt), excerpt, 0)
  const compact = { ...plan.beats[0], dialogue: [], importance: 'normal' }
  assert.equal(composeRows([compact, compact])[0].cols.length, 2)
  const beats = [{ ...compact, framing: 'emotional close-up', importance: 'high' }, compact, compact]
  const rows = composeRows(beats)
  assert.equal(rows[0].rightStack, true)
  assert.match(imagePrompt({ ...plan, beats }, rows, [], 0), /tall left panel, then top right, then bottom right/)
})


Deno.test('a correct panel count does not pass when the illustrated topology is wrong', () => {
  const rows = [{ h: 1, cols: [0.56, 0.44], rightStack: true as const }]
  const left = { x: 0.01, y: 0.01, w: 0.54, h: 0.98 }
  const right = { x: 0.57, y: 0.01, w: 0.42, h: 0.48 }
  const lower = { ...right, y: 0.51 }
  assert.equal(matchesComposition([left, right, lower], rows), true)
  assert.equal(matchesComposition([0.01, 0.34, 0.67].map(y => ({ x: 0.01, y, w: 0.98, h: 0.31 })), rows), false)
})

Deno.test('a completely imported EPUB starts at zero and only finishes at the last page', async () => {
  const { readingProgress } = await import('../../../src/lib/utils.ts')
  assert.equal(readingProgress(0, 295, 295), 0)
  assert.equal(readingProgress(1, 295, 295), 0)
  assert.equal(readingProgress(147, 295, 295), 50)
  assert.equal(readingProgress(293, 295, 295), 99)
  assert.equal(readingProgress(294, 295, 295), 100)
})

Deno.test('a discontinuous storyboard is repaired without losing speech that crosses panel boundaries', () => {
  const text = 'Dedication. “Stay here. I will return,” said Alice. The door closed.'
  const spans = sentenceSpans(text)
  const raw: ModelPlan = {
    beats: [
      { from: 1, to: 1, action: 'Alice pauses', dialogue: [{ text: 'Stay here.', balloonType: 'speech' }] },
      { from: 3, to: 3, action: 'The door closes', dialogue: [{ text: 'I’ll return', balloonType: 'speech' }] },
    ],
  }
  assert.throws(() => resolvePlan(raw, {}, [], spans, text, 0), /Non-contiguous/)
  const result = resolvePlan(raw, {}, [], spans, text, 0, true)
  assert.deepEqual(result.beats.flatMap(beat => beat.sourceSentenceIds), spans.map((_, index) => index))
  const lines = result.beats.flatMap(beat => beat.dialogue)
  assert.deepEqual(lines.map(line => line.text), ['Stay here.', 'I will return,'])
  assert.ok(lines.every(line => text.slice(line.charStart, line.charEnd) === line.text))
  assert.ok(result.editorialIssues.includes('dialogue_source_review:panel-2'))
})

Deno.test('opening author notes produce a bookplate instead of borrowing scenes from the following page', () => {
  const text = "To my readers.\n\nAuthor's Note\n\nThank you for reading."
  const plan = resolvePlan(model, {}, [], sentenceSpans(text), text, 0)
  assert.equal(plan.context.pageKind, 'front-matter')
  assert.equal(plan.beats.length, 1)
  assert.deepEqual(plan.beats[0].dialogue, [])
  assert.deepEqual(plan.beats[0].cast, [])
  assert.doesNotMatch(imagePrompt(plan, composeRows(plan.beats), [], 0), /They argue/)
})

Deno.test('a speaker attribution inside one sentence does not create two balloons', () => {
  const text = '"This," the baker said to the blacksmith, "is no ordinary baby."'
  const plan = resolvePlan({
    characters: [{ name: 'Baker', visualDescription: 'White cap' }],
    beats: [{ from: 0, to: 0, action: 'The baker points', dialogue: [
      { text: 'This,', speaker: 'Baker', balloonType: 'speech' },
      { text: 'is no ordinary baby.', speaker: 'Baker', balloonType: 'speech' },
    ] }],
  }, {}, [], sentenceSpans(text), text, 1)
  const [line] = plan.beats[0].dialogue
  assert.equal(plan.beats[0].dialogue.length, 1)
  assert.equal(line.text, 'This is no ordinary baby.')
  assert.equal(line.sourceParts?.map(part => text.slice(part.start, part.end)).join(' '), line.text)
  assert.equal(line.speakerName, 'Baker')
})

Deno.test('speech and narration remain inside the artwork even when a speaker cannot be located', () => {
  const line = resolve().beats[0].dialogue[0]
  const inspection: ComicInspection = { aspect: 2 / 3, issues: [], panels: [{
    panelId: line.panelId, bounds: { x: 0.03, y: 0.03, w: 0.94, h: 0.37 }, faces: [],
    free: [{ x: 0.03, y: 0.03, w: 0.94, h: 0.39 }],
  }] }
  // Sem rosto localizado a fala ainda é encaixada (sem rabicho; o leitor mostra o nome de quem fala).
  const [placed] = placeDialogue(inspection, [line], (text, font) => text.length * font * 0.52).balloons
  assert.ok(placed.box)
  assert.equal(placed.targetAnchor, null)
  assert.equal(placed.text, line.text)
  const [inArt] = placeCompleteComic(inspection, [line], (text, font) => text.length * font * 0.52).balloons
  assert.ok(inArt.box)
  assert.equal(inArt.targetAnchor, null)
  assert.equal(inArt.text, line.text)
})

Deno.test('complete lettering preserves the source narration and dialogue tags without duplicating words', () => {
  const text = 'Church bells rang. “This,” the baker said, “is no ordinary baby.”\n\nThe feast continued.'
  const [first, second] = [text.indexOf('This'), text.indexOf('is no ordinary')]
  const line = { ...resolve().beats[0].dialogue[0], text: 'This is no ordinary baby.', charStart: first, charEnd: second + 20,
    sourceParts: [{ start: first, end: first + 4 }, { start: second, end: second + 20 }] }
  const all = fullComicText(text, [{ id: line.panelId, sourceSentenceIds: sentenceSpans(text).map((_, i) => i), dialogue: [line] }])
  assert.equal(all.filter(item => item.balloonType === 'speech').length, 1)
  const parts = all.flatMap(item => item.sourceParts ?? [{ start: item.charStart, end: item.charEnd }]).sort((a, b) => a.start - b.start)
  const words = (value: string) => value.match(/[\p{L}\p{N}]+/gu)
  assert.deepEqual(words(parts.map(({ start, end }) => text.slice(start, end)).join(' ')), words(text))
})

Deno.test('dense lettering stays inside the frame over the art and keeps every original word', () => {
  const beat = resolve().beats[0]
  const text = 'The lantern lit the narrow hall while the footsteps drew nearer. '.repeat(28).trim()
  const [caption] = fullComicText(text, [{ ...beat, dialogue: [] }])
  const inspection: ComicInspection = { aspect: 2 / 3, issues: [], panels: [{
    panelId: beat.id, bounds: { x: 0.02, y: 0.02, w: 0.96, h: 0.2 },
    faces: [{ speakerId: 'close-up', face: { x: 0.05, y: 0.03, w: 0.9, h: 0.94 } }], free: [],
  }] }
  const measure = (value: string, font: number) => value.length * font * 0.54
  const result = placeCompleteComic(inspection, [caption], measure)
  const [line] = result.balloons
  // Nunca mais encolhe a arte numa faixa lateral.
  assert.equal(result.reflow, undefined)
  assert.ok(line.box)
  assert.ok(line.box.x >= 0 && line.box.y >= 0 && line.box.x + line.box.w <= 1.0001 && line.box.y + line.box.h <= 1.0001)
  assert.ok(line.font >= 0.010)
  assert.equal(line.text, text)
  assert.equal(text.slice(line.charStart, line.charEnd), text)
})

Deno.test('a cinematic-looking historical image is kept but flagged for review', async () => {
  const originalFetch = globalThis.fetch
  const image = { mime: 'image/png', data: 'aW1hZ2U=' }
  globalThis.fetch = () => Promise.resolve(Response.json({ choices: [{ message: {
    content: JSON.stringify({ panelCount: 1, styleMatches: true, visiblyDrawn: true, cleanPastelInk: false, textFree: true,
      panels: [{ panelId: 'panel-1', bounds: { x: 0, y: 0, w: 1, h: 1 }, faces: [] }] }),
  } }] }))
  try {
    const flagged = await analyzeComicArtwork({
      provider: 'openai', key: 'test', expected: [{ panelId: 'panel-1', cast: [], action: 'A conversation' }],
      aspect: 2 / 3, images: [image], referenceRoles: [], style: { styleName: 'Historical Romance', realism: 'illustrated' },
    })
    assert.ok(flagged.issues.includes('art_style_mismatch'))
    const realistic = await analyzeComicArtwork({
      provider: 'openai', key: 'test', expected: [{ panelId: 'panel-1', cast: [], action: 'A conversation' }],
      aspect: 2 / 3, images: [image], referenceRoles: [], style: { styleName: 'Historical Romance', realism: 'realistic' },
    })
    assert.equal(realistic.panels.length, 1)
    assert.ok(!realistic.issues.includes('art_style_mismatch'))
  } finally { globalThis.fetch = originalFetch }
})

Deno.test('a wrong panel count from vision falls back to the planned composition instead of failing', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => Promise.resolve(Response.json({ choices: [{ message: {
    content: JSON.stringify({ panelCount: 2, styleMatches: true, visiblyDrawn: true, textFree: true,
      panels: [{ panelId: 'panel-1', bounds: { x: 0, y: 0, w: 1, h: 0.5 } }, { panelId: 'panel-2', bounds: { x: 0, y: 0.5, w: 1, h: 0.5 } }] }),
  } }] }))
  try {
    const expected = [1, 2, 3].map(i => ({ panelId: `panel-${i}`, cast: [], action: 'Scene' }))
    const result = await analyzeComicArtwork({
      provider: 'openai', key: 'test', expected, aspect: 2 / 3, images: [{ mime: 'image/png', data: 'aW1hZ2U=' }], referenceRoles: [],
      composition: [{ h: 0.5, cols: [0.5, 0.5] }, { h: 0.5, cols: [1] }],
    })
    assert.equal(result.panels.length, 3)
    assert.ok(result.issues.includes('panel_detection_fallback'))
    assert.ok(result.panels[0].bounds.x < result.panels[1].bounds.x)
    assert.ok(result.panels[2].bounds.y > result.panels[0].bounds.y)
  } finally { globalThis.fetch = originalFetch }
})


Deno.test('each line gets its own text box that keeps the text and stays off the whole head', () => {
  const beat = resolve().beats[0]
  const text = 'The duke frowned. “He’s two. Shouldn’t he be speaking?” Nurse nodded.'
  const lines = fullComicText(text, [{ ...beat, dialogue: [] }]).map((line, i) => ({ ...line, readingOrder: i }))
  const face = { x: 0.55, y: 0.25, w: 0.2, h: 0.35 }
  const inspection: ComicInspection = { aspect: 2 / 3, issues: [], panels: [{
    panelId: beat.id, bounds: { x: 0.02, y: 0.02, w: 0.96, h: 0.3 }, faces: [{ speakerId: 'duke', face }], free: [],
  }] }
  const { balloons } = placePanelBoxes(inspection, lines, (value, font) => value.length * font * 0.5)
  assert.equal(balloons.length, lines.length)
  for (const line of balloons) {
    assert.ok(line.box)
    assert.equal(overlaps(line.box, headRect(face)), false)
  }
  assert.deepEqual(balloons.map(line => line.text), lines.map(line => line.text))
})

Deno.test('ambiguous lines get a speaker from dialogue tags, split quotes, single cast and alternation', async () => {
  const { resolveSpeakers } = await import('../../../src/lib/speakerResolution.ts')
  const duke = { id: 'duke', name: 'Duke of Hastings', visualDescription: 'tall man' }
  const nurse = { id: 'nurse', name: 'Nurse Hopkins', visualDescription: 'older woman' }
  const text = '“He will be.” “Maybe,” she suggested, “he just doesn’t talk.” “I don’t know,” Nurse answered, wringing her hands. “What have you done to him?” “I haven’t done anything!”'
  const quote = (q: string, panelId: string, i: number) => {
    const start = text.indexOf(q)
    return { id: `l${i}`, panelId, text: q, balloonType: 'speech' as const, attribution: 'ambiguous' as const, speakerId: null, speakerName: null,
      emotion: '', delivery: '', charStart: start, charEnd: start + q.length, sourceSentenceIds: [], targetAnchor: null, preferredPosition: 'top-left' as const, readingOrder: i }
  }
  const lines = [quote('He will be.', 'p1', 0), quote('Maybe,', 'p2', 1), quote('he just doesn’t talk.', 'p2', 2),
    { ...quote('I don’t know,', 'p3', 3), attribution: 'confirmed' as const, speakerId: 'nurse', speakerName: 'Nurse Hopkins' },
    quote('What have you done to him?', 'p3', 4), quote('I haven’t done anything!', 'p3', 5)]
  const beats = [{ id: 'p1', cast: ['duke'] }, { id: 'p2', cast: ['duke', 'nurse'] }, { id: 'p3', cast: ['duke', 'nurse'] }]
  const out = resolveSpeakers(lines, beats, [duke, nurse], text)
  assert.deepEqual(out.map(l => l.speakerId), ['duke', 'nurse', 'nurse', 'nurse', 'duke', 'nurse'])
})
