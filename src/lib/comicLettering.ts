import type { BalloonType, ComicInspection, ComicReflow, Dialogue, PanelInspection, PlacedDialogue, Point, Rect } from '../../supabase/functions/_shared/comicEditorial'

export const LETTERING_FONTS = {
  serif: 'Georgia, serif',
  sans: 'Arial, sans-serif',
  humanist: '"Comic Neue", "Trebuchet MS", sans-serif',
  comic: '"Comic Neue", "Trebuchet MS", sans-serif',
} as const

export function letteringFont(value?: string) {
  return LETTERING_FONTS[value as keyof typeof LETTERING_FONTS] ?? LETTERING_FONTS.humanist
}

const MARGIN = 0.035
const FONT = 0.020
const MIN_FONT = 0.016
const DENSE_FONT = 0.014
const MIN_COMPACT_FONT = 0.013
const PAD = 0.022

export function overlaps(a: Rect, b: Rect, gap = 0) {
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y
}

const inRect = (r: Rect, p: Point) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h
const middle = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

export function pageRect(panel: Rect, box: Rect): Rect {
  return { x: panel.x + box.x * panel.w, y: panel.y + box.y * panel.h, w: box.w * panel.w, h: box.h * panel.h }
}

export function speakerTarget(line: Dialogue, panel: PanelInspection, box: Rect): Point | null {
  if (line.balloonType === 'caption') return null
  if (line.attribution === 'off-panel') {
    const center = middle(box)
    return { x: center.x < 0.5 ? 0.005 : 0.995, y: center.y }
  }
  const matches = panel.faces.filter(face => face.speakerId === line.speakerId)
  if (line.attribution !== 'confirmed' || matches.length !== 1) return null
  const face = matches[0].face
  const center = middle(box)
  const at = middle(face)
  const dx = center.x - at.x, dy = center.y - at.y
  const reach = Math.min((face.w / 2 + 0.008) / Math.abs(dx), (face.h / 2 + 0.008) / Math.abs(dy))
  if (!Number.isFinite(reach)) return null
  return { x: Math.max(0, Math.min(1, at.x + dx * reach)), y: Math.max(0, Math.min(1, at.y + dy * reach)) }
}

/** Candidate routing uses the same quadratic curves as the SVG renderer. */
export function tailGeometry(box: Rect, target: Point) {
  const center = middle(box)
  const rx = box.w / 2, ry = box.h / 2
  const angle = Math.atan2((target.y - center.y) / ry, (target.x - center.x) / rx)
  const edge = (theta: number) => ({ x: center.x + rx * Math.cos(theta), y: center.y + ry * Math.sin(theta) })
  const a = edge(angle - 0.21), b = edge(angle + 0.21)
  const control = (p: Point) => ({
    x: p.x * 0.36 + target.x * 0.64 + (p.y - target.y) * 0.09,
    y: p.y * 0.36 + target.y * 0.64 - (p.x - target.x) * 0.09,
  })
  return { a, b, ca: control(a), cb: control(b), angle }
}

/** Keep the tip on the sightline to the face, within a short distance of the outline. */
export function tailTip(box: Rect, anchor: Point, scaleX: number, scaleY: number): Point {
  const center = middle(box)
  const dx = anchor.x - center.x, dy = anchor.y - center.y
  const boundary = 1 / Math.hypot(dx / (box.w / 2), dy / (box.h / 2))
  if (!Number.isFinite(boundary) || boundary >= 1) return anchor
  const distance = Math.hypot(dx * scaleX, dy * scaleY)
  const t = Math.min(1, boundary + 0.036 / distance)
  return { x: center.x + dx * t, y: center.y + dy * t }
}

export function thoughtDots(box: Rect, target: Point, scaleX: number, scaleY: number) {
  const center = middle(box)
  const dx = target.x - center.x, dy = target.y - center.y
  const edge = 0.91 / Math.hypot(dx / (box.w / 2), dy / (box.h / 2))
  return [0.32, 0.62, 0.89].map((fraction, i) => {
    const t = edge + (1 - edge) * fraction
    const radius = 0.005 - i * 0.0011
    return { x: center.x + dx * t, y: center.y + dy * t, rx: radius / scaleX, ry: radius / scaleY }
  })
}

function tailCrosses(box: Rect, anchor: Point, type: BalloonType, scaleX: number, scaleY: number, obstacles: Rect[]) {
  if (type === 'caption') return false
  const target = tailTip(box, anchor, scaleX, scaleY)
  if (type === 'thought') return thoughtDots(box, target, scaleX, scaleY).some(dot =>
    obstacles.some(r => overlaps(r, { x: dot.x - dot.rx, y: dot.y - dot.ry, w: 2 * dot.rx, h: 2 * dot.ry })))
  const { a, b, ca, cb } = tailGeometry(box, target)
  return [[a, ca], [b, cb], [middle({ x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }), { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 }]]
    .some(([from, control]) => Array.from({ length: 33 }, (_, i) => i / 32).some(t => {
      const u = 1 - t
      return obstacles.some(r => inRect(r, {
        x: u * u * from.x + 2 * u * t * control.x + t * t * target.x,
        y: u * u * from.y + 2 * u * t * control.y + t * t * target.y,
      }))
    }))
}

function lineCount(text: string, width: number, measure: (text: string) => number, breakWords = false) {
  let lines = 1
  let current = ''
  for (const word of text.split(/\s+/u)) {
    const wordWidth = measure(word)
    if (wordWidth > width) {
      if (!breakWords) return Infinity
      if (current) lines++
      lines += Math.ceil(wordWidth / width) - 1
      current = word
      continue
    }
    const next = current ? `${current} ${word}` : word
    if (measure(next) > width) { lines++; current = word }
    else current = next
  }
  return lines
}

export type Measure = (text: string, font: number) => number

export function browserMeasure(fontFamily: string): Measure {
  const ctx = document.createElement('canvas').getContext('2d')
  return (text, font) => {
    if (!ctx) return text.length * font * 0.62
    ctx.font = `700 ${font * 1000}px ${fontFamily}`
    return ctx.measureText(text).width / 1000
  }
}

export function lineFits(line: PlacedDialogue, panel: PanelInspection, aspect: number, measure: Measure) {
  if (!line.box || !line.text.trim()) return false
  const width = panel.bounds.w * line.box.w * (line.balloonType === 'caption' ? 0.92 : 0.72)
  const count = lineCount(line.text, width, text => measure(text, line.font))
  return count * line.font * 1.24 + PAD <= panel.bounds.h * line.box.h / aspect + 0.00001
}

export function adjustComicBalloon(line: PlacedDialogue, box: Rect, panel: Rect, aspect: number, font: number, measure: Measure) {
  const w = Math.min(0.99, Math.max(0.08, box.w))
  const caption = line.balloonType === 'caption'
  const textWidth = panel.w * w * (caption ? 0.92 : 0.72)
  const count = lineCount(line.text, textWidth, text => measure(text, font), true)
  const required = (count * font * 1.24 + 0.01) / (panel.h / aspect)
  if (required > 0.99) return line
  const h = Math.max(required, Math.min(0.99, Math.max(0.04, box.h)))
  const x = Math.min(1 - w, Math.max(0, box.x))
  const y = Math.min(1 - h, Math.max(0, box.y))
  return { ...line, box: { x, y, w, h }, font }
}

export function letteringConflicts(panels: PanelInspection[], balloons: PlacedDialogue[], aspect: number) {
  return panels.some(panel => {
    const lines = balloons.filter(line => line.panelId === panel.panelId).sort((a, b) => a.readingOrder - b.readingOrder)
    const faces = panel.faces.map(face => face.face)
    return lines.some((line, index) => {
      const { box, targetAnchor } = line
      if (!box || box.x < 0 || box.y < 0 || box.x + box.w > 1.000001 || box.y + box.h > 1.000001) return true
      const previous = lines[index - 1]?.box
      if (previous && !follows(previous, box)) return true
      const others = lines.flatMap(other => other.id !== line.id && other.box ? [other.box] : [])
      const obstacles = [...faces, ...others]
      if (obstacles.some(rect => overlaps(box, rect))) return true
      if (!targetAnchor || line.balloonType === 'caption') return false
      if (line.attribution === 'confirmed') {
        const visible = panel.faces.filter(face => face.speakerId === line.speakerId)
        if (visible.length === 1) {
          const face = visible[0].face
          const margin = 0.025
          if (!inRect({ x: face.x - margin, y: face.y - margin, w: face.w + 2 * margin, h: face.h + 2 * margin }, targetAnchor)) return true
        }
      }
      return inRect(box, targetAnchor) || tailCrosses(box, targetAnchor, line.balloonType,
        panel.bounds.w, panel.bounds.h / aspect, obstacles)
    })
  })
}

function follows(previous: Rect, box: Rect) {
  return Math.abs(box.y - previous.y) < 0.10 ? box.x > previous.x : box.y > previous.y
}

export function placeDialogue(inspection: ComicInspection, dialogue: Dialogue[], measure: Measure) {
  const issues = [...inspection.issues]
  const balloons: PlacedDialogue[] = []
  for (const panel of inspection.panels) {
    const lines = dialogue.filter(line => line.panelId === panel.panelId).sort((a, b) => a.readingOrder - b.readingOrder)
    const protectedArt = [...panel.faces.map(face => face.face), ...(panel.focus ?? [])]
    const placed: PlacedDialogue[] = []
    const panelW = panel.bounds.w, panelH = panel.bounds.h / inspection.aspect
    const letterCandidates = lines.map(line => {
      const right = line.preferredPosition.endsWith('right'), bottom = line.preferredPosition.startsWith('bottom')
      const preferred = { x: right ? 0.92 : 0.08, y: bottom ? 0.88 : 0.12 }
      const candidates: { box: Rect; font: number; targetAnchor: Point | null; cost: number }[] = []
      const caption = line.balloonType === 'caption'
      for (const font of caption ? [FONT, MIN_FONT, DENSE_FONT] : [FONT, MIN_FONT]) {
        for (const w of [0.16, 0.22, 0.28, 0.34, 0.46, 0.58, 0.72, 0.9]) {
          const textWidth = panelW * w * (line.balloonType === 'caption' ? 0.92 : 0.72)
          const count = lineCount(line.text, textWidth, text => measure(text, font))
          const h = Math.max(count * font * 1.24 + PAD, line.balloonType === 'caption' ? 0 : panelW * w / 3.4) / panelH
          if (!Number.isFinite(h) || h > (caption ? 0.93 : 0.72)) continue
          const steps = [0, 0.2, 0.4, 0.6, 0.8, 1]
          const xs = steps.map(t => MARGIN + t * (1 - 2 * MARGIN - w))
          const ys = steps.map(t => MARGIN + t * (1 - 2 * MARGIN - h))
          for (const x of xs) for (const y of ys) {
            const box = { x, y, w, h }
            if (protectedArt.some(region => overlaps(box, region, 0.025))) continue
            const center = middle(box)
            const targetAnchor = speakerTarget(line, panel, box)
            if (targetAnchor && (inRect(box, targetAnchor) || tailCrosses(box, targetAnchor, line.balloonType, panelW, panelH, protectedArt))) continue
            const quiet = panel.free.some(r => x >= r.x && y >= r.y && x + w <= r.x + r.w && y + h <= r.y + r.h)
            if (line.attribution === 'confirmed' && !targetAnchor) continue
            if (!panel.faces.length && !quiet && line.balloonType !== 'caption') continue
            const reach = targetAnchor ? Math.hypot(center.x - targetAnchor.x, center.y - targetAnchor.y) : 0
            const cost = Math.hypot(center.x - preferred.x, center.y - preferred.y) + reach * 1.25 + w * h * 2 + w * 0.5
              + (quiet ? 0 : 0.45) + (FONT - font) * 140
              + (caption && line.text.length < 450 ? Math.max(0, h - 0.5) * 2 : 0)
            candidates.push({ box, font, targetAnchor, cost })
          }
        }
      }
      return candidates.sort((a, b) => a.cost - b.cost)
    })

    // Search a bounded number of alternatives when a locally good slot blocks later lines.
    let attempts = 0
    const fit = (index: number): boolean => {
      if (index === lines.length) return true
      const line = lines[index]
      for (const candidate of letterCandidates[index]) {
        if (++attempts > 16000) return false
        const { box, font, targetAnchor } = candidate
        const previous = placed.at(-1)?.box
        if (previous && !follows(previous, box)) continue
        if (placed.some(other => {
          const r = other.box!
          return overlaps(r, box, 0.018)
            || (targetAnchor && tailCrosses(box, targetAnchor, line.balloonType, panelW, panelH, [r]))
            || (other.targetAnchor && tailCrosses(r, other.targetAnchor, other.balloonType, panelW, panelH, [box]))
        })) continue
        placed.push({ ...line, box, font, targetAnchor })
        if (fit(index + 1)) return true
        placed.pop()
      }
      return false
    }
    if (!fit(0)) {
      issues.push(`lettering_overflow:${panel.panelId}`)
      balloons.push(...lines.map(line => ({ ...line, box: null, font: FONT, targetAnchor: null })))
    } else {
      balloons.push(...placed)
      for (const line of placed) {
        if (line.attribution === 'ambiguous') issues.push(`speaker_ambiguous:${line.id}`)
        if (line.attribution === 'confirmed' && !line.targetAnchor) issues.push(`speaker_unlocated:${line.id}`)
      }
    }
  }
  return { balloons, issues }
}

/** Keep overflow in the artwork as a stack of caption boxes and balloons. */
export function placeCompleteComic(inspection: ComicInspection, dialogue: Dialogue[], measure: Measure): {
  balloons: PlacedDialogue[]; issues: string[]; reflow?: ComicReflow
} {
  const result = placeDialogue(inspection, dialogue, measure)
  const needsSpace = new Set<string>()
  const balloons = inspection.panels.flatMap(panel => {
    const lines = result.balloons.filter(line => line.panelId === panel.panelId)
    if (lines.every(line => line.box)) return lines

    const panelWidth = panel.bounds.w, panelHeight = panel.bounds.h / inspection.aspect
    const protectedArt = [...panel.faces.map(face => face.face), ...(panel.focus ?? [])]
    const candidates: { balloons: PlacedDialogue[]; score: number; faceOverlap: number }[] = []
    for (const w of [0.34, 0.42, 0.46, 0.58, 0.7, 0.93]) {
      let font = FONT
      const gap = Math.min(0.02, 0.13 / lines.length)
      const boxHeights = () => lines.map(line => {
        const caption = line.balloonType === 'caption'
        const width = panelWidth * w * (caption ? 0.92 : 0.72)
        // Allow a single long word to wrap the same way it does in the rendered balloon.
        const count = lineCount(line.text, width, text => measure(text, font), true)
        return (count * font * 1.24 + Math.min(PAD, font)) / panelHeight
      })
      let heights = boxHeights()
      let total = heights.reduce((sum, h) => sum + h, gap * (lines.length - 1))
      while (total > 1 - 2 * MARGIN && font > MIN_COMPACT_FONT) {
        font = Math.max(MIN_COMPACT_FONT, font * 0.87)
        heights = boxHeights()
        total = heights.reduce((sum, h) => sum + h, gap * (lines.length - 1))
      }
      if (total > 1 - 2 * MARGIN) continue
      for (const x of [MARGIN, 1 - MARGIN - w]) for (const top of [MARGIN, 1 - MARGIN - total]) {
        let y = top
        const boxes = heights.map(h => {
          const box = { x, y, w, h }
          y += h + gap
          return box
        })
        const placed = lines.map((line, index) => {
          const box = boxes[index]
          const target = speakerTarget(line, panel, box)
          const targetAnchor = target && !inRect(box, target) && !tailCrosses(box, target, line.balloonType,
            panelWidth, panelHeight, [...protectedArt, ...boxes.filter((_, i) => i !== index)]) ? target : null
          return { ...line, box, font, targetAnchor }
        })
        const faceOverlap = boxes.reduce((sum, box) => sum + protectedArt.filter(region => overlaps(box, region, 0.015)).length, 0)
        const missingTail = placed.filter(line => line.attribution === 'confirmed' && !line.targetAnchor).length
        candidates.push({ balloons: placed, faceOverlap, score: missingTail * 2 + w * total + (FONT - font) * 100 })
      }
    }
    candidates.sort((a, b) => a.faceOverlap - b.faceOverlap || a.score - b.score)
    const best = candidates[0]
    if (!best || best.faceOverlap) {
      needsSpace.add(panel.panelId)
      return lines
    }
    return best.balloons
  })
  const issues = result.issues.filter(issue => !issue.startsWith('lettering_overflow:'))
  if (!needsSpace.size) return { balloons, issues }
  return { ...expandComicFrames(inspection, balloons, needsSpace, measure), issues }
}

/** Open a lettering lane within crowded illustrated frames, keeping the original art intact. */
function expandComicFrames(inspection: ComicInspection, balloons: PlacedDialogue[], needsSpace: Set<string>, measure: Measure) {
  const gutter = 0.012
  const frames = inspection.panels.map(panel => {
    const lines = balloons.filter(line => line.panelId === panel.panelId)
    const sourceHeight = panel.bounds.h / (panel.bounds.w * inspection.aspect)
    const expanded = needsSpace.has(panel.panelId)
    const artWidth = expanded ? 0.5 : Math.min(1, Math.max(panel.bounds.w, 0.85 / sourceHeight))
    const artHeight = sourceHeight * artWidth
    const laneX = artWidth + 0.025, laneWidth = 0.975 - laneX
    let cursor = 0.025
    const boxes = expanded ? lines.map(line => {
      const caption = line.balloonType === 'caption'
      const w = caption ? laneWidth : Math.min(laneWidth, Math.max(0.19, measure(line.text, DENSE_FONT) / 1.4))
      const textWidth = w * (caption ? 0.92 : 0.72)
      const count = lineCount(line.text, textWidth, text => measure(text, DENSE_FONT), true)
      const h = Math.max(count * DENSE_FONT * 1.24 + 0.018, caption ? 0 : w / 3.4)
      const box = { x: laneX, y: cursor, w, h }
      cursor += h + gutter
      return box
    }) : []
    const height = expanded ? Math.max(artHeight, cursor - gutter + 0.025) : artHeight
    const art = { x: expanded ? 0 : (1 - artWidth) / 2, y: (height - artHeight) / (2 * height), w: artWidth, h: artHeight / height }
    const faces = panel.faces.map(face => ({ ...face, face: pageRect(art, face.face) }))
    const placed = lines.map((line, index) => {
      if (!expanded) {
        const target = line.targetAnchor
        return { ...line, box: line.box && pageRect(art, line.box), targetAnchor: target && { x: art.x + target.x * art.w, y: art.y + target.y * art.h } }
      }
      const raw = boxes[index]
      const box = { ...raw, y: raw.y / height, h: raw.h / height }
      const target = speakerTarget(line, { ...panel, faces }, box)
      const targetAnchor = target && !inRect(box, target) && !tailCrosses(box, target, line.balloonType, 1, height, faces.map(face => face.face)) ? target : null
      return { ...line, box, font: DENSE_FONT, targetAnchor }
    })
    return { panelId: panel.panelId, height, art, placed }
  })
  const total = frames.reduce((sum, frame) => sum + frame.height + gutter, -gutter)
  let y = 0
  const panels = frames.map(({ panelId, height, art }) => {
    const bounds = { x: 0, y: y / total, w: 1, h: height / total }
    y += height + gutter
    return { panelId, bounds, art }
  })
  return { balloons: frames.flatMap(frame => frame.placed), reflow: { aspect: 1 / total, panels } }
}

export function createPanelMask(width: number, height: number, panel: Rect) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create panel mask')
  context.fillRect(0, 0, width, height)
  const margin = Math.max(2, Math.round(width * 0.003))
  context.clearRect(Math.round(panel.x * width) + margin, Math.round(panel.y * height) + margin,
    Math.round(panel.w * width) - 2 * margin, Math.round(panel.h * height) - 2 * margin)
  return canvas.toDataURL('image/png').split(',')[1]
}
