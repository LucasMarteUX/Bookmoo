import type { ComicRow, Rect } from '../_shared/comicEditorial.ts'

/** Check topology with a small tolerance for the vision model's measured borders. */
export function matchesComposition(bounds: Rect[], rows: ComicRow[]) {
  const tolerance = 0.035
  let index = 0
  let bottom = 0
  for (const row of rows) {
    const count = row.rightStack ? 3 : row.cols.length
    const band = bounds.slice(index, index + count)
    const [left, right, lower] = band
    if (!left || band.length !== count || Math.min(...band.map(panel => panel.y)) < bottom - tolerance) return false
    if (right && (left.x + left.w > right.x + tolerance || Math.abs(left.y - right.y) > tolerance)) return false
    if (row.rightStack && (!lower || Math.abs(right.x - lower.x) > tolerance
      || right.y + right.h > lower.y + tolerance || lower.y < left.y + left.h * 0.25
      || Math.abs(left.y + left.h - lower.y - lower.h) > tolerance)) return false
    bottom = Math.max(...band.map(panel => panel.y + panel.h))
    index += count
  }
  return index === bounds.length
}

/** Panel rectangles implied by the planned rows, used when vision cannot read the borders. */
export function templateBounds(rows: ComicRow[], gutter = 0.014): Rect[] {
  const out: Rect[] = []
  const usable = 1 - gutter * (rows.length + 1)
  const total = rows.reduce((sum, row) => sum + row.h, 0) || 1
  let y = gutter
  for (const row of rows) {
    const h = (row.h / total) * usable
    const widths = 1 - gutter * (row.cols.length + 1)
    let x = gutter
    row.cols.forEach((col, i) => {
      const w = col * widths
      if (row.rightStack && i === 1) {
        const half = (h - gutter) / 2
        out.push({ x, y, w, h: half }, { x, y: y + half + gutter, w, h: half })
      } else out.push({ x, y, w, h })
      x += w + gutter
    })
    y += h + gutter
  }
  return out
}

/** Even horizontal strips as the last resort. */
export function stripBounds(count: number, gutter = 0.014): Rect[] {
  const h = (1 - gutter * (count + 1)) / count
  return Array.from({ length: count }, (_, i) => ({ x: gutter, y: gutter + i * (h + gutter), w: 1 - 2 * gutter, h }))
}
