import type { EditorialLayout, Point, Rect } from '../../../supabase/functions/_shared/comicEditorial'
import { headRect, pageRect, tailGeometry, tailTip, thoughtDots } from '@/lib/comicLettering'
import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { LetteringTheme } from '@/lib/comicThemes'
import type { Dialogue } from '../../../supabase/functions/_shared/comicEditorial'
import type { BalloonHandle, useComicBalloonEditor } from './useComicBalloonEditor'

function balloonPath(box: Rect, target: Point | null, expressive: boolean, project: (p: Point) => Point) {
  const center = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
  const xy = (point: Point) => { const p = project(point); return `${p.x} ${p.y}` }
  const edge = (angle: number, inset = 1) => ({
    x: center.x + Math.cos(angle) * box.w * inset / 2,
    y: center.y + Math.sin(angle) * box.h * inset / 2,
  })
  const tail = target ? tailGeometry(box, target) : null
  const begin = tail ? tail.angle + 0.21 : 0
  const sweep = Math.PI * 2 - (tail ? 0.42 : 0)
  const start = edge(begin)
  const end = edge(begin + sweep)
  const p0 = project({ x: box.x, y: box.y })
  const p1 = project({ x: box.x + box.w, y: box.y + box.h })
  const radius = `${(p1.x - p0.x) / 2} ${(p1.y - p0.y) / 2}`
  const body = expressive
    ? Array.from({ length: 26 }, (_, i) => `L${xy(edge(begin + sweep * (i + 1) / 26, i % 2 ? 1 : 0.9))}`).join(' ')
    : tail ? `A${radius} 0 1 1 ${xy(end)}`
      : `A${radius} 0 1 1 ${xy(edge(Math.PI))} A${radius} 0 1 1 ${xy(start)}`
  const pointer = tail && target ? `Q${xy(tail.ca)} ${xy(target)} Q${xy(tail.cb)} ${xy(tail.b)}` : ''
  return `M${xy(start)} ${body} ${pointer} Z`
}

/** Uma caixa fixa por quadro: layouts antigos têm caixas diferentes por fala, e a caixa "pulava"
 *  (às vezes para cima de um rosto). Usa a posição mais comum entre as falas, com a altura da maior. */
function panelBox(lines: { box?: Rect | null }[], editing: { box?: Rect | null } | null, covers?: (box: Rect) => number): Rect | null {
  if (editing?.box) return editing.box
  const boxes = lines.flatMap(line => line.box ? [line.box] : [])
  if (!boxes.length) return null
  const maxH = Math.min(0.96, Math.max(...boxes.map(b => b.h)))
  const votes = new Map<string, { box: Rect; n: number }>()
  for (const box of boxes) {
    const key = `${box.x.toFixed(2)}:${box.y.toFixed(2)}`
    const entry = votes.get(key)
    if (entry) entry.n++
    else votes.set(key, { box: { ...box, h: maxH, y: Math.min(box.y, 0.98 - maxH) }, n: 1 })
  }
  // Menos rosto/pele coberta vence; votos só desempatam.
  const score = (e: { box: Rect; n: number }) => (covers ? covers(e.box) * 10 : 0) - e.n * 0.05
  return [...votes.values()].reduce((a, b) => score(b) < score(a) ? b : a).box
}

function cloudPath(box: Rect) {
  const center = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
  const points = Array.from({ length: 11 }, (_, i) => {
    const angle = i * Math.PI * 2 / 11
    return { x: center.x + Math.cos(angle) * box.w * 0.45, y: center.y + Math.sin(angle) * box.h * 0.45 }
  })
  return `M${points[0].x} ${points[0].y} ${points.map((a, i) => {
    const b = points[(i + 1) % points.length]
    return `Q${center.x + ((a.x + b.x) / 2 - center.x) * 1.23} ${center.y + ((a.y + b.y) / 2 - center.y) * 1.23} ${b.x} ${b.y}`
  }).join(' ')} Z`
}

const HANDLES: { mode: BalloonHandle; fx: number; fy: number; cursor: string }[] = [
  { mode: 'nw', fx: 0, fy: 0, cursor: 'nwse-resize' }, { mode: 'ne', fx: 1, fy: 0, cursor: 'nesw-resize' },
  { mode: 'sw', fx: 0, fy: 1, cursor: 'nesw-resize' }, { mode: 'se', fx: 1, fy: 1, cursor: 'nwse-resize' },
  { mode: 'n', fx: 0.5, fy: 0, cursor: 'ns-resize' }, { mode: 's', fx: 0.5, fy: 1, cursor: 'ns-resize' },
  { mode: 'w', fx: 0, fy: 0.5, cursor: 'ew-resize' }, { mode: 'e', fx: 1, fy: 0.5, cursor: 'ew-resize' },
]

/** Text that shrinks (down to 70%) when a theme font is wider than the one used for placement. */
const escapeHtml = (value: string) => value.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!))

function FitText({ html, text, font, style, inert, onHeight }: { html?: string; text: string; font: number; style: CSSProperties; inert?: boolean; onHeight?: (px: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  // Maior tamanho (até `font`) que cabe na caixa com folga: busca binária medindo o texto de verdade.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // Texto centralizado estoura para cima e para baixo (o scrollHeight não vê); mede o próprio conteúdo.
    const inner = el.firstElementChild as HTMLElement | null
    const fits = (s: number) => {
      el.style.fontSize = `${font * s}px`
      const cs = getComputedStyle(el)
      const room = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      return (inner ? inner.offsetHeight : el.scrollHeight) <= room + 0.5 && el.scrollWidth <= el.clientWidth + 1
    }
    let best = 0.25
    if (fits(1)) best = 1
    else {
      let lo = 0.25, hi = 1
      for (let i = 0; i < 9; i++) {
        const mid = (lo + hi) / 2
        if (fits(mid)) { lo = mid; best = mid } else hi = mid
      }
    }
    el.style.fontSize = `${font * best}px`
    setScale(best)
    // Altura de que o texto precisa (com o padding): a caixa "abraça" o texto na vertical.
    if (onHeight && inner) {
      const cs = getComputedStyle(el)
      onHeight(inner.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom))
    }
  }, [html, text, font, style.height, style.width])
  return <div ref={ref} className="comic-lettered-text" style={{ ...style, fontSize: font * scale }}>
    {html !== undefined
      ? <span style={{ display: 'block', pointerEvents: inert ? 'none' : 'auto' }} dangerouslySetInnerHTML={{ __html: html }} />
      : <span style={{ display: 'block', pointerEvents: inert ? 'none' : 'auto' }}>{text}</span>}
  </div>
}

export function ComicLettering({ layout, width, height, wordsHtml, sourceText, editor, theme, moveMode = false, currentChar, onPlayLine, onMoveChip, skinAt }: {
  layout: EditorialLayout; width: number; height: number
  sourceText: string
  wordsHtml: (from: number, to: number) => string
  editor?: ReturnType<typeof useComicBalloonEditor>
  theme: LetteringTheme
  /** Whole balloon (text included) becomes a drag handle. */
  moveMode?: boolean
  /** Posição (caractere) da palavra sendo lida agora — anima o selo de quem está falando. */
  currentChar?: number | null
  /** Toca a partir deste caractere (início da fala de um personagem no quadro). */
  onPlayLine?: (charStart: number) => void
  /** Salva a posição do selo de quem fala (relativa ao quadro). */
  onMoveChip?: (key: string, position: Point) => void
  /** Fração de pele num retângulo (0–1 da página): evita pôr o selo sobre rostos. */
  skinAt?: (x: number, y: number, w: number, h: number) => number
}) {
  const ink = theme.ink
  const strokeWidth = Math.max(1.2, width * theme.stroke)
  const shadow = width * theme.shadow
  const uid = useId().replace(/:/g, '')
  // Uma caixa por quadro: as linhas do quadro, na ordem de leitura (a 1ª guarda posição e letra).
  const groups = [...layout.balloons.reduce((map, line) => {
    map.set(line.panelId, [...(map.get(line.panelId) ?? []), line])
    return map
  }, new Map<string, typeof layout.balloons>())].map(([panelId, lines]) => ({ panelId, lines: [...lines].sort((a, b) => a.readingOrder - b.readingOrder) }))
  const [manual, setManual] = useState<Record<string, number>>({})
  const [hug, setHug] = useState<Record<string, number>>({})
  // Arrastar o selo de quem fala: só vira arraste depois de alguns pixels (senão é clique = tocar a fala).
  const chipDrag = useRef<{ key: string; pointer: number; x0: number; y0: number; left: number; top: number; moved: boolean } | null>(null)
  const [chipDraft, setChipDraft] = useState<{ key: string; x: number; y: number } | null>(null)
  const partsOf = (line: Dialogue) => line.sourceParts?.length ? line.sourceParts : [{ start: line.charStart, end: line.charEnd }]
  /** Uma fala por vez: a que está sendo lida; fora da leitura, a escolhida nas setas. */
  const shownIndex = (panelId: string, lines: Dialogue[]) => {
    const reading = currentChar != null ? lines.findIndex(line => partsOf(line).some(part => currentChar >= part.start && currentChar < part.end)) : -1
    const passed = currentChar != null ? lines.reduce((last, line, i) => partsOf(line)[0].start <= currentChar ? i : last, -1) : -1
    return reading >= 0 ? reading : currentChar != null ? Math.max(0, passed) : Math.min(manual[panelId] ?? 0, lines.length - 1)
  }
  // Rostos salvos podem estar deslocados (detecção grosseira em páginas antigas). Com o mapa de pele,
  // procura na coluna do personagem a janela do tamanho de um rosto com mais pele e corrige a posição.
  const facesOf = <F extends { face: Rect }>(panel: { bounds: Rect; faces?: F[] }): F[] => {
    const faces = panel.faces ?? []
    if (!skinAt || !width || !height) return faces
    const skinIn = (q: Rect) => { const r = pageRect(panel.bounds, q); return skinAt(r.x, r.y, r.w, r.h) }
    return faces.map(f => {
      const w = Math.min(f.face.w, 0.4)
      const h = Math.min(0.9, w * 1.25 * (panel.bounds.w * width) / Math.max(1, panel.bounds.h * height))
      let best = { q: f.face, v: skinIn({ ...f.face, h: Math.min(f.face.h, h) }) - f.face.y * 0.12 }
      for (const dx of [-0.6, -0.3, 0, 0.3, 0.6]) for (let y = 0; y <= 1 - h; y += 0.025) {
        const q = { x: Math.max(0, Math.min(1 - w, f.face.x + dx * w)), y, w, h }
        const v = skinIn(q) - Math.abs(dx) * 0.08 - y * 0.12 // rosto costuma ficar acima das mãos
        if (v > best.v) best = { q, v }
      }
      return best.v > 0.2 && best.q !== f.face ? { ...f, face: best.q } : f
    })
  }
  // Quanto uma caixa (coordenadas do quadro) cobre rostos: pele na imagem + rostos detectados.
  const coverage = (panel: { bounds: Rect; faces?: { face: Rect }[] }) => (q: Rect) => {
    const r = pageRect(panel.bounds, q)
    const skin = skinAt ? skinAt(r.x, r.y, r.w, r.h) : 0
    const faces = facesOf(panel).reduce((sum, f) => {
      const h = headRect(f.face)
      const ix = Math.max(0, Math.min(q.x + q.w, h.x + h.w) - Math.max(q.x, h.x)), iy = Math.max(0, Math.min(q.y + q.h, h.y + h.h) - Math.max(q.y, h.y))
      return sum + ix * iy / Math.max(1e-6, h.w * h.h)
    }, 0)
    return skin + faces * (skinAt ? 0.15 : 0.5)
  }
  const vars = { '--comic-hl-bg': theme.highlight.bg, '--comic-hl-ring': theme.highlight.ring, '--comic-hl-text': theme.highlight.text ?? 'inherit' } as CSSProperties
  return <svg className="absolute inset-0 overflow-visible pointer-events-none" width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={vars}
    onPointerMove={editor?.move} onPointerUp={editor?.end} onPointerCancel={editor ? event => editor.end(event, true) : undefined}>
    <defs>
      <linearGradient id={`${uid}-caption`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={theme.caption.top} />
        <stop offset="1" stopColor={theme.caption.bottom} />
      </linearGradient>
      <radialGradient id={`${uid}-speech`} cx="0.42" cy="0.32" r="0.8">
        <stop offset="0" stopColor={theme.speech.center} />
        <stop offset="1" stopColor={theme.speech.edge} />
      </radialGradient>
    </defs>
    {groups.map(({ panelId, lines }) => {
      const panel = (layout.reflow?.panels ?? layout.panels).find(p => p.panelId === panelId)
      if (!panel) return null
      const { bounds } = panel
      const index = shownIndex(panelId, lines)
      const shown = lines[index]
      const fixed = panelBox(lines, editor?.draft?.panelId === panelId ? editor.draft : null, coverage(panel))
      if (!shown || !fixed) return null
      // Fonte do quadro: a maior entre as falas (o FitText reduz quando o texto não cabe).
      const line = { ...shown, box: fixed, font: editor?.draft?.panelId === panelId ? shown.font : Math.max(...lines.map(l => l.font ?? 0), shown.font ?? 0) }
      const r = pageRect(bounds, fixed)
      const box = { x: r.x * width, y: r.y * height, w: r.w * width, h: r.h * height }
      const pad = Math.max(8, box.w * 0.05)
      // Altura abraçando o texto da fala atual; a borda mais perto da beira do quadro fica parada.
      // Editando (caixa selecionada / mover), mostra a caixa inteira para redimensionar.
      const hugKey = `${line.id}:${Math.round(line.font * width)}:${Math.round(box.w)}:${Math.round(box.h)}`
      const hugged = hug[hugKey]
      const editingBox = moveMode || editor?.selected?.panelId === panelId
      if (hugged && !editingBox && hugged < box.h) {
        const panelMid = (bounds.y + bounds.h / 2) * height
        if (box.y + box.h / 2 > panelMid) box.y += box.h - hugged
        box.h = hugged
      }
      const parts = partsOf(line)
      const matches = parts.every(part => part.start >= 0) && parts.map(part => sourceText.slice(part.start, part.end)).join(' ') === line.text
      const words = matches ? parts.map(part => wordsHtml(part.start, part.end)).join(' ') : escapeHtml(line.text)
      const speech = line.balloonType !== 'caption'
      // Se o personagem tem selo perto do rosto, a caixa não repete o nome.
      const hasChip = !layout.reflow && !!line.speakerId && !!line.speakerName
      const html = speech
        ? `<p class="comic-line comic-line--speech">${line.speakerName && !hasChip ? `<span class="comic-speaker">${escapeHtml(line.speakerName)}</span>` : ''}<span class="comic-quote">“${words}”</span></p>`
        : `<p class="comic-line">${words}</p>`
      const isSelected = editor?.selected?.id === line.id
      const accent = 'var(--theme-accent, #7756c6)'
      const rect = <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={width * theme.caption.radius} />
      // Setas: fora da leitura trocam a fala mostrada; durante a leitura, a narração pula para ela.
      const step = (delta: number) => {
        const target = Math.max(0, Math.min(lines.length - 1, index + delta))
        if (currentChar != null) onPlayLine?.(partsOf(lines[target])[0].start)
        else setManual(prev => ({ ...prev, [panelId]: target }))
      }
      const navSize = Math.max(18, Math.min(24, width * 0.026))
      return <g key={line.id} data-balloon-hit className="comic-box-in">
        {shadow > 0 && <g transform={`translate(${shadow} ${shadow})`} fill={theme.shadowColor} stroke="none">{rect}</g>}
        <g stroke={theme.caption.border} strokeWidth={strokeWidth} strokeLinejoin="round" fill={`url(#${uid}-caption)`}>{rect}</g>
        {theme.caption.inner && <rect x={box.x + strokeWidth * 1.8} y={box.y + strokeWidth * 1.8} width={Math.max(0, box.w - strokeWidth * 3.6)}
          height={Math.max(0, box.h - strokeWidth * 3.6)} rx={width * theme.caption.radius * 0.6} fill="none" stroke={theme.caption.inner} strokeWidth={1} />}
        {editor && <>
          <rect x={box.x - 5} y={box.y - 5} width={box.w + 10} height={box.h + 10} rx={8}
            className={`balloon-hover-ring ${moveMode || isSelected ? 'is-visible' : ''}`} fill="none" stroke={accent}
            strokeWidth={1.5} strokeDasharray="6 4" style={{ pointerEvents: 'none' }} />
          <rect x={box.x - 7} y={box.y - 7} width={box.w + 14} height={box.h + 14} rx={10} fill="none" stroke="transparent" strokeWidth={14}
            className={`pointer-events-auto touch-none ${moveMode || isSelected ? 'cursor-move' : 'cursor-grab'}`} data-balloon-handle
            onPointerDown={event => editor.start(event, line, bounds, 'move')} />
          <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="transparent" stroke="none"
            className={`pointer-events-auto touch-none ${moveMode || isSelected ? 'cursor-move' : 'cursor-grab'}`}
            role="button" tabIndex={0} aria-label={line.text.slice(0, 70)} data-balloon-handle
            onFocus={() => editor.select(line.id)} onKeyDown={event => editor.keyboard(event, line, bounds)}
            onPointerDown={event => editor.start(event, line, bounds, 'move')} />
        </>}
        <foreignObject x={box.x + pad} y={box.y} width={Math.max(0, box.w - 2 * pad)} height={box.h} style={{ pointerEvents: 'none', overflow: 'visible' }}>
          <FitText font={line.font * width} text={line.text} inert={moveMode} html={html}
            onHeight={px => setHug(prev => prev[hugKey] && Math.abs(prev[hugKey] - px) < 1 ? prev : { ...prev, [hugKey]: Math.ceil(px) + 2 })}
            style={{
              display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', boxSizing: 'border-box',
              padding: `0.5em 0.1em calc(0.5em + ${navSize * 0.45}px)`, lineHeight: 1.28, fontFamily: theme.font, fontWeight: theme.weight,
              letterSpacing: theme.uppercase ? '0.04em' : '0.01em', textTransform: theme.uppercase ? 'uppercase' : undefined,
              textAlign: 'left', color: theme.caption.text, overflowWrap: 'anywhere', whiteSpace: 'normal', pointerEvents: 'none', overflow: 'visible',
              ['--comic-badge-bg' as string]: theme.caption.border, ['--comic-badge-fg' as string]: theme.caption.top,
            }} />
        </foreignObject>
        {/* Setas: posição da fala no quadro (sempre visível); passam para a fala anterior/seguinte. */}
        {lines.length > 1 && (
          <foreignObject x={box.x + box.w - navSize * 3.4 - 6} y={box.y + box.h - navSize * 0.55} width={navSize * 3.4} height={navSize} style={{ overflow: 'visible' }}>
            <div data-speaker-chip className="comic-box-nav" style={{ height: navSize, fontSize: navSize * 0.5, ['--chip-bg' as string]: theme.caption.border, ['--chip-fg' as string]: theme.caption.top }}
              onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
              <button type="button" disabled={index === 0} onClick={() => step(-1)} aria-label="Previous line">‹</button>
              <span>{index + 1}/{lines.length}</span>
              <button type="button" disabled={index === lines.length - 1} onClick={() => step(1)} aria-label="Next line">›</button>
            </div>
          </foreignObject>
        )}
        {editor && isSelected && <>
          {HANDLES.map(({ mode, fx, fy, cursor }) => {
            const cx = box.x - 5 + fx * (box.w + 10), cy = box.y - 5 + fy * (box.h + 10)
            const corner = mode.length === 2
            return corner
              ? <circle key={mode} cx={cx} cy={cy} r={7} fill="#fff" stroke={accent} strokeWidth={2.5} data-balloon-handle
                className="pointer-events-auto touch-none" style={{ cursor }} onPointerDown={event => editor.start(event, line, bounds, mode)} />
              : <rect key={mode} x={cx - (fy === 0.5 ? 4 : 10)} y={cy - (fy === 0.5 ? 10 : 4)} width={fy === 0.5 ? 8 : 20} height={fy === 0.5 ? 20 : 8}
                rx={4} fill="#fff" stroke={accent} strokeWidth={2} data-balloon-handle
                className="pointer-events-auto touch-none" style={{ cursor }} onPointerDown={event => editor.start(event, line, bounds, mode)} />
          })}
        </>}
      </g>
    })}
    {/* Quem fala: selo com o nome perto da cabeça, sem cobrir rosto, a caixa ou outro selo.
        O som anima enquanto a fala dele toca; clicar toca a fala dele neste quadro. */}
    {!layout.reflow && groups.flatMap(({ panelId, lines }) => {
      const panel = layout.panels.find(p => p.panelId === panelId)
      if (!panel) return []
      const { bounds } = panel
      const toPx = (q: Rect) => ({ x: (bounds.x + q.x * bounds.w) * width, y: (bounds.y + q.y * bounds.h) * height, w: q.w * bounds.w * width, h: q.h * bounds.h * height })
      const panelFaces = facesOf(panel)
      const heads = panelFaces.map(f => toPx(headRect(f.face)))
      const activeLine = lines.find(line => line.box) // caixa visível pode variar; protege todas as caixas do quadro
      const fixedBox = panelBox(lines, null, coverage(panel))
      const boxes = fixedBox ? [toPx(fixedBox)] : []
      void activeLine
      const placed: { x: number; y: number; w: number; h: number }[] = []
      const speakers = new Map<string, Dialogue[]>()
      for (const line of lines) {
        if (line.balloonType === 'caption' || !line.speakerId || !line.speakerName) continue
        speakers.set(line.speakerId, [...(speakers.get(line.speakerId) ?? []), line])
      }
      const panelPx = toPx({ x: 0, y: 0, w: 1, h: 1 })
      const hit = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
        a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
      return [...speakers].flatMap(([speakerId, spoken]) => {
        // Sem rosto localizado: o selo fica colado na caixa de texto (acima dela; se não couber, abaixo).
        const located = panelFaces.find(f => f.speakerId === speakerId)?.face
        const boxOf = lines.find(l => l.box)?.box
        const face = located ?? (boxOf ? { x: boxOf.x, y: boxOf.y, w: Math.min(boxOf.w, 0.25), h: 0.001 } : { x: 0.03, y: 0.06, w: 0.2, h: 0.001 })
        const head = toPx(headRect(face))
        // Rosto (testa ao queixo, com pequena margem) é intocável; cabelo/chapéu podem receber o selo.
        // Rosto detectado alto demais (ex.: da testa ao peito) é impreciso: usa só a parte de cima,
        // na proporção de um rosto (altura ≈ 1,4 × largura).
        const rawFace = toPx({ x: face.x - face.w * 0.06, y: face.y - face.h * 0.04, w: face.w * 1.12, h: face.h * 1.08 })
        const faceBox = { ...rawFace, h: Math.min(rawFace.h, rawFace.w * 1.4) }
        const active = currentChar != null && spoken.some(line => partsOf(line).some(part => currentChar >= part.start && currentChar < part.end))
        // Quem tem a fala na caixa agora (lendo ou escolhida nas setas) ganha destaque.
        const shownLine = lines[shownIndex(panelId, lines)]
        const current = shownLine?.balloonType !== 'caption' && shownLine?.speakerId === speakerId
        // Só o selo de quem tem a fala na caixa agora (narração não mostra selo).
        if (!current && chipDrag.current?.key !== `${panelId}:${speakerId}`) return []
        const chipH = Math.max(26, Math.min(36, width * 0.038))
        const name = spoken[0].speakerName!
        const chipW = Math.min(bounds.w * width * 0.6, chipH * 1.9 + name.length * chipH * 0.36)
        const gap = 5
        const cx = faceBox.x + faceBox.w / 2, cy = faceBox.y + faceBox.h / 2
        // Preferência: logo acima da testa (sobre o cabelo), ao lado do rosto, abaixo do queixo.
        const candidates = [
          { x: cx - chipW / 2, y: faceBox.y - chipH - gap },
          { x: faceBox.x + faceBox.w + gap, y: cy - chipH / 2 },
          { x: faceBox.x - chipW - gap, y: cy - chipH / 2 },
          { x: cx - chipW / 2, y: faceBox.y + faceBox.h + gap },
          { x: faceBox.x + faceBox.w + gap, y: faceBox.y },
          { x: faceBox.x - chipW - gap, y: faceBox.y },
        ].map(c => ({ ...c, x: Math.max(panelPx.x + 4, Math.min(panelPx.x + panelPx.w - chipW - 4, c.x)), w: chipW, h: chipH }))
          .filter(c => c.y >= panelPx.y + 4 && c.y + chipH <= panelPx.y + panelPx.h - 4)
        void located
        const facesPx = panelFaces.map(f => { const q = toPx({ x: f.face.x - f.face.w * 0.06, y: f.face.y - f.face.h * 0.04, w: f.face.w * 1.12, h: f.face.h * 1.08 }); return { ...q, h: Math.min(q.h, q.w * 1.4) } })
        const blockers = [...facesPx, ...boxes, ...placed]
        // Entre as posições livres, a mais perto da própria cabeça — e nunca mais perto de outra pessoa.
        const center = (q: { x: number; y: number; w: number; h: number }) => ({ x: q.x + q.w / 2, y: q.y + q.h / 2 })
        void head
        const own = center(faceBox)
        const others = facesPx.filter(h => Math.abs(h.x - faceBox.x) > 1 || Math.abs(h.y - faceBox.y) > 1).map(center)
        const score = (c: typeof candidates[number], i: number) => {
          const m = center(c)
          const d = Math.hypot(m.x - own.x, m.y - own.y)
          const closerToOther = others.some(o => Math.hypot(m.x - o.x, m.y - o.y) < d)
          return d + (closerToOther ? 10_000 : 0) + i * 4
        }
        const ranked = candidates.map((c, i) => ({ c, s: score(c, i) })).sort((a, b) => a.s - b.s).map(x => x.c)
        const key = `${panelId}:${speakerId}`
        const saved = layout.speakerChips?.[key]
        const draftHere = chipDraft?.key === key ? chipDraft : null
        // Checagem na própria imagem: posição com muita pele (rosto/mão) é descartada, mesmo que o
        // retângulo do rosto detectado esteja errado.
        const onSkin = (c: { x: number; y: number; w: number; h: number }) => !!skinAt && skinAt(c.x / width, c.y / height, c.w / width, c.h / height) > 0.12
        const free = (c: { x: number; y: number; w: number; h: number }) => !blockers.some(b => hit(c, b)) && !onSkin(c)
        // Último recurso: o lugar com menos pele (nunca o primeiro da lista às cegas).
        const leastSkin = <T extends { x: number; y: number; w: number; h: number }>(list: T[]) => !skinAt ? list[0]
          : list.map(c => ({ c, f: skinAt(c.x / width, c.y / height, c.w / width, c.h / height) })).sort((a, b) => a.f - b.f)[0]?.c
        // Grade de reserva (perto da cabeça) quando as posições preferidas estão ocupadas ou sobre pele.
        const grid = [-1.4, -0.7, 0, 0.7, 1.4].flatMap(dx => [-1.6, -0.6, 0.6, 1.8].map(dy => ({
          x: Math.max(panelPx.x + 4, Math.min(panelPx.x + panelPx.w - chipW - 4, cx - chipW / 2 + dx * chipW)),
          y: Math.max(panelPx.y + 4, Math.min(panelPx.y + panelPx.h - chipH - 4, cy - chipH / 2 + dy * faceBox.h)),
          w: chipW, h: chipH,
        }))).sort((a, b) => Math.hypot(a.x + chipW / 2 - cx, a.y + chipH / 2 - cy) - Math.hypot(b.x + chipW / 2 - cx, b.y + chipH / 2 - cy))
        const spot = draftHere ? { x: draftHere.x, y: draftHere.y, w: chipW, h: chipH }
          : saved ? { x: panelPx.x + saved.x * panelPx.w, y: panelPx.y + saved.y * panelPx.h, w: chipW, h: chipH }
          : (located ? ranked.find(free) ?? grid.find(free) ?? leastSkin([...ranked, ...grid].filter(c => !boxes.some(b => hit(c, b)))) : ranked.find(c => !onSkin(c)) ?? leastSkin(ranked))
            ?? { x: panelPx.x + 8, y: panelPx.y + 8, w: chipW, h: chipH }
        placed.push(spot)
        const first = shownLine?.speakerId === speakerId ? shownLine : spoken[0]
        const start = partsOf(first)[0].start
        return [<foreignObject key={`${panelId}-${speakerId}`} x={spot.x} y={spot.y} width={chipW} height={chipH} style={{ overflow: 'visible' }}>
          <button type="button" data-speaker-chip
            className={`comic-speaker-chip ${current ? 'is-current' : ''} ${active ? 'is-speaking' : ''}`}
            style={{ height: chipH, fontSize: chipH * 0.42, fontFamily: theme.font, ['--chip-bg' as string]: theme.caption.border, ['--chip-fg' as string]: theme.caption.top,
              ['--chip-hl' as string]: theme.highlight.bg, ['--chip-hl-fg' as string]: theme.highlight.text ?? '#1d1a16', ['--chip-ring' as string]: theme.caption.border }}
            title={`${name}: ${first.text} — clique para ouvir, arraste para mover`} aria-label={`${name}: ${first.text}`}
            onPointerDown={e => {
              e.stopPropagation()
              e.currentTarget.setPointerCapture(e.pointerId)
              chipDrag.current = { key, pointer: e.pointerId, x0: e.clientX, y0: e.clientY, left: spot.x, top: spot.y, moved: false }
            }}
            onPointerMove={e => {
              const d = chipDrag.current
              if (!d || d.pointer !== e.pointerId || d.key !== key) return
              const dx = e.clientX - d.x0, dy = e.clientY - d.y0
              if (!d.moved && Math.hypot(dx, dy) < 5) return
              d.moved = true
              setChipDraft({
                key,
                x: Math.max(panelPx.x, Math.min(panelPx.x + panelPx.w - chipW, d.left + dx)),
                y: Math.max(panelPx.y, Math.min(panelPx.y + panelPx.h - chipH, d.top + dy)),
              })
            }}
            onPointerUp={e => {
              const d = chipDrag.current
              chipDrag.current = null
              if (!d || d.pointer !== e.pointerId) return
              if (!d.moved) { onPlayLine?.(start); return }
              const final = chipDraft?.key === key ? chipDraft : null
              if (final) onMoveChip?.(key, { x: (final.x - panelPx.x) / panelPx.w, y: (final.y - panelPx.y) / panelPx.h })
              setTimeout(() => setChipDraft(null), 400)
            }}
            onPointerCancel={() => { chipDrag.current = null; setChipDraft(null) }}
            onClick={e => e.stopPropagation()}>
            <span className="comic-speaker-chip__icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="1.3em" height="1.3em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" />
                <path className="wave wave-1" d="M15.5 9.5a3.5 3.5 0 0 1 0 5" />
                <path className="wave wave-2" d="M18.5 7a7 7 0 0 1 0 10" />
              </svg>
            </span>
            <span className="comic-speaker-chip__name">{name}</span>
          </button>
        </foreignObject>]
      })
    })}
  </svg>
}
