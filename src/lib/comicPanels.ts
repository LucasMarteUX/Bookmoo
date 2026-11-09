// Localiza os quadros de uma página de quadrinho no próprio navegador (sem IA, sem custo):
// as páginas são geradas com quadros retangulares separados por calhas brancas, então basta
// procurar linhas/colunas quase totalmente brancas. Se a detecção não bater com a grade
// pedida, usa a grade teórica como reserva.

export type PanelRect = { x: number; y: number; w: number; h: number }
/** Linha da diagramação: h = fração da altura útil; cols = frações da largura de cada quadro. */
export type LayoutRow = { h: number; cols: number[] }
export type CaptionAnchor = 'tl' | 'tr' | 'bl' | 'br' | 'tc' | 'bc'

const WORK_W = 360
const GUTTER_FRAC = 0.94 // fração de pixels claros para considerar a linha/coluna uma calha
const MIN_BAND = 0.05 // altura mínima de uma linha de quadros (fração da página)
const MIN_COL = 0.08 // largura mínima de um quadro (fração da página)

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image_load_failed'))
    img.src = url
  })
}

/** Trechos contínuos onde `isContent[i]` é verdadeiro, com tamanho mínimo. */
function runs(isContent: boolean[], minLen: number): [number, number][] {
  const out: [number, number][] = []
  let start = -1
  for (let i = 0; i <= isContent.length; i++) {
    const c = i < isContent.length && isContent[i]
    if (c && start < 0) start = i
    if (!c && start >= 0) { if (i - start >= minLen) out.push([start, i]); start = -1 }
  }
  return out
}

async function scanPage(imageUrl: string) {
  const img = await loadImage(imageUrl)
  const width = WORK_W
  const height = Math.round(img.naturalHeight / img.naturalWidth * width)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('image_scan_failed')
  context.drawImage(img, 0, 0, width, height)
  const { data } = context.getImageData(0, 0, width, height)
  const light = new Uint8Array(width * height)
  const rowContent: boolean[] = []
  for (let y = 0; y < height; y++) {
    let bright = 0
    for (let x = 0; x < width; x++) {
      const pixel = y * width + x
      const i = pixel * 4
      const max = Math.max(data[i], data[i + 1], data[i + 2])
      const min = Math.min(data[i], data[i + 1], data[i + 2])
      light[pixel] = max > 228 && max - min < 28 ? 1 : 0
      bright += light[pixel]
    }
    rowContent.push(bright / width < GUTTER_FRAC)
  }
  return { width, height, light, bands: runs(rowContent, Math.round(height * MIN_BAND)) }
}

/** Linhas iguais a partir de uma grade simples (quadros por linha). */
export function rowsFromGrid(grid: number[]): LayoutRow[] {
  return grid.map((n) => ({ h: 1 / grid.length, cols: Array(n).fill(1 / n) }))
}

/** Diagramação teórica (margem e calhas uniformes, proporções pedidas), usada quando a detecção falha. */
export function templatePanels(rows: LayoutRow[]): PanelRect[] {
  const m = 0.035, g = 0.015
  const usableH = 1 - 2 * m - g * (rows.length - 1)
  const out: PanelRect[] = []
  let y = m
  rows.forEach((row) => {
    const h = usableH * row.h
    const usableW = 1 - 2 * m - g * (row.cols.length - 1)
    let x = m
    row.cols.forEach((cw) => { const w = usableW * cw; out.push({ x, y, w, h }); x += w + g })
    y += h + g
  })
  return out
}

export async function detectPanels(imageUrl: string, gridOrRows: number[] | LayoutRow[], strict = false): Promise<{ panels: PanelRect[]; detected: boolean }> {
  const rows: LayoutRow[] = typeof gridOrRows[0] === 'number' ? rowsFromGrid(gridOrRows as number[]) : (gridOrRows as LayoutRow[])
  const grid = rows.map((r) => r.cols.length)
  const expected = grid.reduce((a, b) => a + b, 0)
  try {
    const { width: W, height: H, light, bands } = await scanPage(imageUrl)
    if (bands.length !== grid.length) throw new Error(`bands ${bands.length}≠${grid.length}`)

    const panels: PanelRect[] = []
    bands.forEach(([y0, y1], r) => {
      const colContent: boolean[] = []
      for (let x = 0; x < W; x++) {
        let s = 0
        for (let y = y0; y < y1; y++) s += light[y * W + x]
        colContent.push(s / (y1 - y0) < GUTTER_FRAC)
      }
      let cols = runs(colContent, Math.round(W * MIN_COL))
      if (cols.length !== grid[r]) {
        if (strict) throw new Error('column count mismatch')
        // Divide a faixa nas proporções pedidas, dentro dos limites detectados.
        const left = cols[0]?.[0] ?? Math.round(W * 0.035)
        const right = cols[cols.length - 1]?.[1] ?? Math.round(W * 0.965)
        const n = grid[r], gap = Math.round(W * 0.015)
        const usable = right - left - gap * (n - 1)
        let x = left
        cols = rows[r].cols.map((f) => { const a = Math.round(x); x += usable * f; const z = Math.round(x); x += gap; return [a, z] as [number, number] })
      }
      for (const [x0, x1] of cols) panels.push({ x: x0 / W, y: y0 / H, w: (x1 - x0) / W, h: (y1 - y0) / H })
    })
    if (panels.length !== expected) throw new Error('count mismatch')
    return { panels, detected: true }
  } catch (e) {
    console.info('[comic] detecção de quadros usou a grade teórica:', (e as Error).message)
    return { panels: templatePanels(rows), detected: false }
  }
}

/**
 * Escolhe, para cada quadro, o canto onde a legenda menos atrapalha: mede o "detalhe" (bordas)
 * e a quantidade de tons de pele (rostos) em cada posição candidata e fica com a mais calma.
 * Roda no navegador, sem IA. `chars` = tamanho do texto de cada legenda; `aspect` = largura/altura.
 */
export async function chooseCaptionAnchors(imageUrl: string, panels: PanelRect[], chars: number[], aspect: number, preferred?: CaptionAnchor[]): Promise<CaptionAnchor[]> {
  try {
    const img = await loadImage(imageUrl)
    const W = WORK_W
    const H = Math.round((img.naturalHeight / img.naturalWidth) * W)
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0, W, H)
    const { data } = ctx.getImageData(0, 0, W, H)
    const lum = new Float32Array(W * H)
    const skin = new Uint8Array(W * H)
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const r = data[i], g = data[i + 1], b = data[i + 2]
      lum[p] = 0.299 * r + 0.587 * g + 0.114 * b
      // Tons de pele (regra RGB clássica, cobre peles claras e escuras em ilustração).
      skin[p] = r > 95 && g > 40 && b > 20 && r > g && r > b && r - Math.min(g, b) > 15 && Math.abs(r - g) > 12 ? 1 : 0
    }
    // Integrais para somar áreas rapidamente.
    const edgeI = new Float64Array((W + 1) * (H + 1))
    const skinI = new Float64Array((W + 1) * (H + 1))
    for (let y = 0; y < H; y++) {
      let rowE = 0, rowS = 0
      for (let x = 0; x < W; x++) {
        const p = y * W + x
        const gx = x + 1 < W ? Math.abs(lum[p + 1] - lum[p]) : 0
        const gy = y + 1 < H ? Math.abs(lum[p + W] - lum[p]) : 0
        rowE += gx + gy
        rowS += skin[p]
        edgeI[(y + 1) * (W + 1) + x + 1] = edgeI[y * (W + 1) + x + 1] + rowE
        skinI[(y + 1) * (W + 1) + x + 1] = skinI[y * (W + 1) + x + 1] + rowS
      }
    }
    const sum = (I: Float64Array, x0: number, y0: number, x1: number, y1: number) => {
      const a = Math.max(0, Math.min(W, Math.round(x0))), b = Math.max(0, Math.min(H, Math.round(y0)))
      const c = Math.max(0, Math.min(W, Math.round(x1))), d = Math.max(0, Math.min(H, Math.round(y1)))
      const area = Math.max(1, (c - a) * (d - b))
      return (I[d * (W + 1) + c] - I[b * (W + 1) + c] - I[d * (W + 1) + a] + I[b * (W + 1) + a]) / area
    }
    const FONT = 0.0185 // mesma proporção usada para desenhar a legenda
    return panels.map((p, i) => {
      // Tamanho estimado da legenda (frações da página).
      const words = chars[i] / 5.5
      const bw = p.w * (words > 26 ? 0.9 : words > 12 ? 0.72 : 0.6)
      const lines = Math.max(1, Math.ceil((chars[i] * 0.5 * FONT) / Math.max(0.05, bw - 0.02)))
      const bh = Math.min(p.h * 0.55, (lines * 1.16 * FONT + 0.022) * aspect)
      const inset = 0.012
      const cand: Record<CaptionAnchor, [number, number]> = {
        tl: [p.x + inset, p.y + inset * aspect],
        tr: [p.x + p.w - bw - inset, p.y + inset * aspect],
        bl: [p.x + inset, p.y + p.h - bh - inset * aspect],
        br: [p.x + p.w - bw - inset, p.y + p.h - bh - inset * aspect],
        tc: [p.x + (p.w - bw) / 2, p.y + inset * aspect],
        bc: [p.x + (p.w - bw) / 2, p.y + p.h - bh - inset * aspect],
      }
      let best: CaptionAnchor = preferred?.[i] ?? 'tl'
      let bestScore = Infinity
      for (const [k, [x, y]] of Object.entries(cand) as [CaptionAnchor, [number, number]][]) {
        const x0 = x * W, y0 = y * H, x1 = (x + bw) * W, y1 = (y + bh) * H
        const edge = sum(edgeI, x0, y0, x1, y1) // detalhe médio
        const sk = sum(skinI, x0, y0, x1, y1) // fração de pele (rostos)
        // Centro do quadro costuma ter o foco; cantos ganham leve preferência.
        const centerPenalty = k === 'tc' || k === 'bc' ? 4 : 0
        const prefBonus = preferred?.[i] === k ? -3 : 0
        const score = edge + sk * 120 + centerPenalty + prefBonus
        if (score < bestScore) { bestScore = score; best = k }
      }
      return best
    })
  } catch {
    return panels.map((_, i) => preferred?.[i] ?? 'tl')
  }
}

