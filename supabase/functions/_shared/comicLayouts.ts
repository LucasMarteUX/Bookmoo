// Diagramação da página como composição de HQ, não como pilha de faixas iguais.
// Cada modelo é desenhado numa grade de 12 × 12 módulos (grade modular): quadros de tamanhos e formatos diferentes,
// quadro dominante, panorâmico, verticais, quadro alto ocupando duas linhas, quadro sobreposto (inset), borda diagonal
// e personagem saindo da moldura. O roteiro diz o formato que cada momento pede (largo, alto, quadrado, detalhe,
// dominante); aqui escolhemos o modelo que melhor atende e devolvemos a posição exata de cada quadro na página.
// A ordem de leitura é sempre a ocidental (esquerda para a direita, de cima para baixo), porque o texto é em inglês.
import type { ComicRow, Rect, VisualBeat } from './comicEditorial.ts'

export type FrameRole = 'splash' | 'dominant' | 'wide' | 'tall' | 'square' | 'small' | 'inset'
export type Frame = Rect & {
  role: FrameRole
  /** Quadro sobreposto: índice do quadro sobre o qual ele é desenhado. */
  over?: number
  /** Borda de baixo inclinada: quanto o lado direito desce (positivo) ou sobe (negativo), em fração da página. */
  slantBottom?: number
  /** Borda de cima inclinada (espelha a de baixo do quadro acima). */
  slantTop?: number
  /** O personagem ou objeto principal pode sair da moldura. */
  breakout?: boolean
}
export type PageLayout = { id: string; frames: Frame[]; rows?: ComicRow[] }

type Cell = [number, number, number, number] // c0, r0, c1, r1 em módulos (fim exclusivo)
type Template = { id: string; cells: Cell[]; insets?: { over: number; cell: Cell }[] }

// Modelos por quantidade de quadros, em ordem de leitura. Insets entram logo depois do quadro onde ficam.
const TEMPLATES: Record<number, Template[]> = {
  1: [{ id: 'splash', cells: [[0, 0, 12, 12]] }],
  2: [
    { id: 'big-top', cells: [[0, 0, 12, 8], [0, 8, 12, 12]] },
    { id: 'big-bottom', cells: [[0, 0, 12, 4], [0, 4, 12, 12]] },
    { id: 'two-tall', cells: [[0, 0, 7, 12], [7, 0, 12, 12]] },
    { id: 'splash-inset', cells: [[0, 0, 12, 12]], insets: [{ over: 0, cell: [7, 8, 12, 12] }] },
  ],
  3: [
    { id: 'pano-two', cells: [[0, 0, 12, 5], [0, 5, 5, 12], [5, 5, 12, 12]] },
    { id: 'tall-stack', cells: [[0, 0, 7, 12], [7, 0, 12, 6], [7, 6, 12, 12]] },
    { id: 'two-pano', cells: [[0, 0, 7, 6], [7, 0, 12, 6], [0, 6, 12, 12]] },
    { id: 'stack-tall', cells: [[0, 0, 6, 6], [0, 6, 6, 12], [6, 0, 12, 12]] },
    { id: 'thin-big-thin', cells: [[0, 0, 12, 3], [0, 3, 12, 9], [0, 9, 12, 12]] },
    { id: 'dominant-inset', cells: [[0, 0, 12, 8], [0, 8, 12, 12]], insets: [{ over: 0, cell: [0, 5, 4, 8] }] },
  ],
  4: [
    { id: 'pano-three-tall', cells: [[0, 0, 12, 5], [0, 5, 4, 12], [4, 5, 8, 12], [8, 5, 12, 12]] },
    { id: 'l-tall', cells: [[0, 0, 5, 8], [5, 0, 12, 4], [5, 4, 12, 8], [0, 8, 12, 12]] },
    { id: 'modular', cells: [[0, 0, 8, 5], [8, 0, 12, 5], [0, 5, 4, 12], [4, 5, 12, 12]] },
    { id: 'dominant-center', cells: [[0, 0, 12, 3], [0, 3, 12, 9], [0, 9, 6, 12], [6, 9, 12, 12]] },
    { id: 'two-dominant-inset', cells: [[0, 0, 6, 4], [6, 0, 12, 4], [0, 4, 12, 12]], insets: [{ over: 2, cell: [8, 8, 12, 12] }] },
    { id: 'tall-right', cells: [[0, 0, 7, 4], [0, 4, 7, 8], [7, 0, 12, 8], [0, 8, 12, 12]] },
    { id: 'build-up', cells: [[0, 0, 12, 3], [0, 3, 6, 6], [6, 3, 12, 6], [0, 6, 12, 12]] },
    { id: 'wide-tall-dominant-inset', cells: [[0, 0, 12, 3], [0, 3, 4, 12], [4, 3, 12, 12]], insets: [{ over: 2, cell: [8, 9, 12, 12] }] },
  ],
  5: [
    { id: 'guide-5', cells: [[0, 0, 7, 4], [7, 0, 12, 4], [0, 4, 12, 7], [0, 7, 5, 12], [5, 7, 12, 12]] },
    { id: 'pano-mod', cells: [[0, 0, 12, 4], [0, 4, 5, 8], [5, 4, 12, 8], [0, 8, 8, 12], [8, 8, 12, 12]] },
    { id: 'tall-left-stack', cells: [[0, 0, 12, 3], [0, 3, 5, 12], [5, 3, 12, 6], [5, 6, 12, 9], [5, 9, 12, 12]] },
    { id: 'dominant-four', cells: [[0, 0, 6, 3], [6, 0, 12, 3], [0, 3, 12, 9], [0, 9, 6, 12], [6, 9, 12, 12]] },
    { id: 'build-up-5', cells: [[0, 0, 6, 3], [6, 0, 12, 3], [0, 3, 4, 6], [4, 3, 12, 6], [0, 6, 12, 12]] },
    { id: 'pano-inset', cells: [[0, 0, 12, 6], [0, 6, 4, 12], [4, 6, 8, 12], [8, 6, 12, 12]], insets: [{ over: 0, cell: [8, 0, 12, 3] }] },
  ],
  6: [
    { id: 'guide-6', cells: [[0, 0, 7, 4], [7, 0, 12, 4], [0, 4, 12, 7], [0, 7, 5, 12], [5, 7, 12, 9.5], [5, 9.5, 12, 12]] },
    { id: 'six-uneven', cells: [[0, 0, 7, 4], [7, 0, 12, 4], [0, 4, 4, 8], [4, 4, 12, 8], [0, 8, 8, 12], [8, 8, 12, 12]] },
    { id: 'pano-five', cells: [[0, 0, 12, 4], [0, 4, 6, 8], [6, 4, 12, 8], [0, 8, 4, 12], [4, 8, 8, 12], [8, 8, 12, 12]] },
    { id: 'dominant-mid-6', cells: [[0, 0, 6, 3], [6, 0, 12, 3], [0, 3, 12, 8], [0, 8, 4, 12], [4, 8, 8, 12], [8, 8, 12, 12]] },
    { id: 'tall-left-six', cells: [[0, 0, 12, 3], [0, 3, 5, 9], [5, 3, 12, 6], [5, 6, 12, 9], [0, 9, 7, 12], [7, 9, 12, 12]] },
  ],
  7: [
    { id: 'seven-a', cells: [[0, 0, 12, 3], [0, 3, 6, 6], [6, 3, 12, 6], [0, 6, 4, 12], [4, 6, 12, 9], [4, 9, 8, 12], [8, 9, 12, 12]] },
    { id: 'seven-b', cells: [[0, 0, 5, 4], [5, 0, 12, 4], [0, 4, 12, 7], [0, 7, 4, 12], [4, 7, 8, 12], [8, 7, 12, 9.5], [8, 9.5, 12, 12]] },
  ],
  8: [
    { id: 'eight-a', cells: [[0, 0, 7, 3], [7, 0, 12, 3], [0, 3, 5, 6], [5, 3, 12, 6], [0, 6, 8, 9], [8, 6, 12, 9], [0, 9, 4, 12], [4, 9, 12, 12]] },
    { id: 'eight-b', cells: [[0, 0, 12, 3], [0, 3, 4, 6], [4, 3, 8, 6], [8, 3, 12, 6], [0, 6, 5, 12], [5, 6, 12, 9], [5, 9, 8.5, 12], [8.5, 9, 12, 12]] },
  ],
  9: [
    { id: 'nine-a', cells: [[0, 0, 12, 3], [0, 3, 4, 6], [4, 3, 8, 6], [8, 3, 12, 6], [0, 6, 6, 9], [6, 6, 12, 9], [0, 9, 4, 12], [4, 9, 8, 12], [8, 9, 12, 12]] },
    { id: 'nine-b', cells: [[0, 0, 5, 3], [5, 0, 12, 3], [0, 3, 3.5, 6], [3.5, 3, 8, 6], [8, 3, 12, 6], [0, 6, 12, 8.5], [0, 8.5, 4, 12], [4, 8.5, 8, 12], [8, 8.5, 12, 12]] },
  ],
}

// Página 2:3. Margens e calhas iguais em pixels: no eixo vertical valem 2/3 do horizontal.
const MX = 0.028, MY = MX * 2 / 3, GX = 0.022, GY = GX * 2 / 3

function cellRect([c0, r0, c1, r1]: Cell): Rect {
  const cw = (1 - 2 * MX) / 12, ch = (1 - 2 * MY) / 12
  const x0 = MX + c0 * cw + (c0 > 0 ? GX / 2 : 0)
  const x1 = MX + c1 * cw - (c1 < 12 ? GX / 2 : 0)
  const y0 = MY + r0 * ch + (r0 > 0 ? GY / 2 : 0)
  const y1 = MY + r1 * ch - (r1 < 12 ? GY / 2 : 0)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** Proporção visual (largura/altura em pixels) de um quadro numa página 2:3. */
export const visualAspect = (r: Rect) => (r.w * 2) / (r.h * 3)

function roleOf(r: Rect, total: number, all: Rect[]): FrameRole {
  if (total === 1) return 'splash'
  const area = r.w * r.h
  const largest = Math.max(...all.map(a => a.w * a.h))
  const a = visualAspect(r)
  if (area === largest && area > 0.3) return 'dominant'
  if (a >= 1.5) return 'wide'
  if (a <= 0.75) return 'tall'
  if (area < 0.07) return 'small'
  return 'square'
}

function build(t: Template): Frame[] {
  const rects = t.cells.map(cellRect)
  const frames: Frame[] = []
  t.cells.forEach((_, i) => {
    frames.push({ ...rects[i], role: roleOf(rects[i], t.cells.length + (t.insets?.length ?? 0), rects) })
    for (const inset of t.insets ?? []) {
      if (inset.over !== i) continue
      // Inset: um pouco para dentro do quadro de baixo, com moldura própria.
      const base = cellRect(inset.cell)
      const pad = 0.018
      const parent = rects[i]
      const x = Math.max(parent.x + pad, Math.min(base.x, parent.x + parent.w - base.w - pad))
      const y = Math.max(parent.y + pad * 2 / 3, Math.min(base.y, parent.y + parent.h - base.h - pad * 2 / 3))
      const w = Math.min(base.w, parent.w * 0.42), h = Math.min(base.h, parent.h * 0.42)
      frames.push({ x: x + (base.w - w), y: y + (base.h - h), w, h, role: 'inset', over: frames.length - 1 })
    }
  })
  return frames
}

/** Modelo equivalente às faixas antigas (para páginas e testes antigos). */
export function framesFromRows(rows: ComicRow[]): Frame[] {
  const out: Frame[] = []
  const total = rows.reduce((sum, row) => sum + row.h, 0) || 1
  let r = 0
  for (const row of rows) {
    const h = (row.h / total) * 12
    let c = 0
    row.cols.forEach((col, i) => {
      const w = col * 12
      if (row.rightStack && i === 1) {
        out.push({ ...cellRect([c, r, c + w, r + h / 2]), role: 'square' }, { ...cellRect([c, r + h / 2, c + w, r + h]), role: 'square' })
      } else out.push({ ...cellRect([c, r, c + w, r + h]), role: 'square' })
      c += w
    })
    r += h
  }
  return out.map((f, _i, all) => ({ ...f, role: roleOf(f, all.length, all) }))
}

const WANT: Record<string, (f: Frame) => number> = {
  wide: f => visualAspect(f) >= 1.4 ? 0 : visualAspect(f) >= 1 ? 1 : 3,
  tall: f => visualAspect(f) <= 0.8 ? 0 : visualAspect(f) <= 1.1 ? 1.5 : 3,
  square: f => Math.abs(Math.log(visualAspect(f))) < 0.35 ? 0 : 1.2,
  small: f => f.w * f.h < 0.09 || f.role === 'inset' ? 0 : 1,
  dominant: f => f.role === 'dominant' || f.role === 'splash' ? 0 : f.w * f.h > 0.25 ? 1.5 : 4,
}

/** Cortes horizontais que atravessam a página inteira (onde uma borda diagonal pode entrar sem quebrar a leitura). */
function fullWidthCuts(t: Template) {
  const rows = new Set(t.cells.flatMap(([, r0, , r1]) => [r0, r1]).filter(r => r > 0 && r < 12))
  return [...rows].filter(r => t.cells.every(([, r0, , r1]) => !(r0 < r && r < r1))).sort((a, b) => a - b)
}

/**
 * Escolhe a diagramação da página pelo que cada momento pede. Varia entre páginas (nunca repete a da página anterior
 * quando há alternativa) e, em página dinâmica (ação, perigo, perseguição), inclina uma borda e libera a saída de moldura.
 */
export function chooseLayout(beats: VisualBeat[], page: number, opts: { rhythm?: string; previousId?: string | null; nextId?: string | null } = {}): PageLayout {
  const n = Math.max(1, Math.min(9, beats.length))
  const options = TEMPLATES[n]
  const textOf = (b: VisualBeat) => b.dialogue.reduce((sum, line) => sum + line.text.length, 0)
  const scored = options.map((t, index) => {
    const frames = build(t)
    let cost = 0
    frames.forEach((f, i) => {
      const beat = beats[i]
      if (!beat) return
      const shape = (beat.shape ?? '').toLowerCase()
      if (WANT[shape]) cost += WANT[shape](f)
      if (beat.importance === 'high' && f.w * f.h < 0.12) cost += 1.5
      // O texto precisa caber com letra confortável: ~0,0011 da página por letra (com folga para a arte).
      const need = textOf(beat) * 0.0011
      const area = f.w * f.h
      if (need > area * 0.45) cost += (need / (area * 0.45) - 1) * 4
      if (f.role === 'inset' && textOf(beat) > 120) cost += 3
    })
    // Variedade: troca de modelo entre páginas, com rotação estável pela página.
    // Não repete a diagramação das páginas vizinhas (a anterior e a seguinte, quando já existem).
    if ((opts.previousId === t.id || opts.nextId === t.id) && options.length > 1) cost += 6
    cost += ((index + page) % options.length) * 0.15
    return { t, frames, cost }
  }).sort((a, b) => a.cost - b.cost)
  const { t, frames } = scored[0]
  const dynamic = /dynamic|action|tense/i.test(opts.rhythm ?? '')
  if (dynamic) {
    const cuts = fullWidthCuts(t)
    if (cuts.length) {
      // Uma borda diagonal no corte mais próximo do meio da página.
      const cut = cuts.reduce((best, r) => Math.abs(r - 6) < Math.abs(best - 6) ? r : best)
      const slant = (page % 2 ? -1 : 1) * 0.035
      t.cells.forEach(([, r0, , r1], i) => {
        if (r1 === cut) frames[i].slantBottom = slant
        if (r0 === cut) frames[i].slantTop = slant
      })
    }
  }
  beats.forEach((beat, i) => {
    if (frames[i] && /^(yes|true)$/i.test(beat.breakout ?? '') && frames[i].role !== 'inset') frames[i].breakout = true
  })
  // Só uma saída de moldura por página.
  let seen = false
  for (const f of frames) { if (f.breakout) { if (seen) delete f.breakout; seen = true } }
  return { id: t.id, frames }
}

/** Área segura (retângulo) de um quadro com borda inclinada: onde balões e rostos podem ficar sem invadir o vizinho. */
export function safeRect(f: Frame): Rect {
  const top = f.slantTop ? Math.abs(f.slantTop) : 0
  const bottom = f.slantBottom ? Math.abs(f.slantBottom) : 0
  return { x: f.x, y: f.y + top, w: f.w, h: Math.max(0.05, f.h - top - bottom) }
}

const pct = (v: number) => `${Math.round(v * 100)}%`

/** Descrição da geometria de um quadro para o pedido de imagem. */
export function describeFrame(f: Frame, index: number, frames: Frame[]) {
  const shape = { splash: 'full-page splash', dominant: 'dominant panel', wide: 'wide horizontal panel', tall: 'tall vertical panel', square: 'square-ish panel', small: 'small detail panel', inset: 'inset panel' }[f.role]
  const parts = [`Panel ${index + 1} (${shape}): left edge ${pct(f.x)}, right edge ${pct(f.x + f.w)} of the page width; top edge ${pct(f.y)}, bottom edge ${pct(f.y + f.h)} of the page height.`]
  if (f.over != null) parts.push(`It is drawn ON TOP of Panel ${f.over + 1}, overlapping it, with its own dark border and a thin white outline around it; Panel ${f.over + 1}'s art continues underneath.`)
  if (f.slantTop) parts.push(`Its top border is a straight diagonal: ${pct(f.y + (f.slantTop < 0 ? Math.abs(f.slantTop) : 0))} at the left side to ${pct(f.y + (f.slantTop > 0 ? f.slantTop : 0))} at the right side.`)
  if (f.slantBottom) parts.push(`Its bottom border is a straight diagonal: ${pct(f.y + f.h - (f.slantBottom > 0 ? f.slantBottom : 0))} at the left side to ${pct(f.y + f.h - (f.slantBottom < 0 ? Math.abs(f.slantBottom) : 0))} at the right side.`)
  if (f.breakout) parts.push('The main character, hand, weapon or vehicle of this panel breaks out over its border into the gutter for impact, without covering any other panel\'s main subject or text area.')
  void frames
  return parts.join(' ')
}
