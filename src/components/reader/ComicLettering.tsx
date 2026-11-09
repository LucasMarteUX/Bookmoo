import type { EditorialLayout, Point, Rect } from '../../../supabase/functions/_shared/comicEditorial'
import { pageRect, tailGeometry, tailTip, thoughtDots } from '@/lib/comicLettering'
import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { LetteringTheme } from '@/lib/comicThemes'
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
function FitText({ html, text, font, style, inert }: { html?: string; text: string; font: number; style: CSSProperties; inert?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => { setScale(1) }, [html, text, font])
  useLayoutEffect(() => {
    const el = ref.current
    if (el && el.scrollHeight > el.clientHeight + 1 && scale > 0.7) setScale(s => Math.max(0.7, s - 0.06))
  }, [scale, html, text, font])
  return <div ref={ref} className="comic-lettered-text" style={{ ...style, fontSize: font * scale }}>
    {html !== undefined
      ? <span style={{ pointerEvents: inert ? 'none' : 'auto' }} dangerouslySetInnerHTML={{ __html: html }} />
      : <span style={{ pointerEvents: inert ? 'none' : 'auto' }}>{text}</span>}
  </div>
}

export function ComicLettering({ layout, width, height, wordsHtml, sourceText, editor, theme, moveMode = false }: {
  layout: EditorialLayout; width: number; height: number
  sourceText: string
  wordsHtml: (from: number, to: number) => string
  editor?: ReturnType<typeof useComicBalloonEditor>
  theme: LetteringTheme
  /** Whole balloon (text included) becomes a drag handle. */
  moveMode?: boolean
}) {
  const ink = theme.ink
  const strokeWidth = Math.max(1.2, width * theme.stroke)
  const shadow = width * theme.shadow
  const uid = useId().replace(/:/g, '')
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
    {layout.balloons.map(line => {
      const panel = (layout.reflow?.panels ?? layout.panels).find(p => p.panelId === line.panelId)
      if (!panel || !line.box) return null
      const { bounds } = panel
      const toPixels = (box: Rect) => {
        const r = pageRect(bounds, box)
        return { x: r.x * width, y: r.y * height, w: r.w * width, h: r.h * height }
      }
      const parts = line.sourceParts ?? [{ start: line.charStart, end: line.charEnd }]
      const matchesSource = parts.every(part => part.start >= 0)
        && parts.map(part => sourceText.slice(part.start, part.end)).join(' ') === line.text
      const box = toPixels(line.box)
      const anchor = line.targetAnchor
      const anchorInside = anchor && anchor.x > line.box.x && anchor.x < line.box.x + line.box.w
        && anchor.y > line.box.y && anchor.y < line.box.y + line.box.h
      const tip = anchor && !anchorInside && width > 0
        ? tailTip(line.box, anchor, bounds.w, bounds.h * height / width) : null
      const project = (p: Point) => ({
        x: (bounds.x + p.x * bounds.w) * width,
        y: (bounds.y + p.y * bounds.h) * height,
      })
      const caption = line.balloonType === 'caption', thought = line.balloonType === 'thought'
      const pad = caption ? Math.max(8, box.w * 0.05) : box.w * 0.13
      const dots = thought && tip ? thoughtDots(line.box, tip, bounds.w, bounds.h * height / width) : []
      const shape = caption
        ? <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={width * theme.caption.radius} />
        : <path d={thought ? cloudPath(box) : balloonPath(line.box, tip, line.balloonType === 'expressive', project)} />
      const isSelected = editor?.selected?.id === line.id
      const accent = 'var(--theme-accent, #7756c6)'
      return <g key={line.id} data-balloon-hit>
        {/* Sombra dura deslocada, como no lettering impresso */}
        {shadow > 0 && <g transform={`translate(${shadow} ${shadow})`} fill={theme.shadowColor} stroke="none">
          {shape}
          {dots.map((dot, i) => { const c = project(dot); return <circle key={i} cx={c.x} cy={c.y} r={dot.rx * bounds.w * width} /> })}
        </g>}
        <g stroke={caption ? theme.caption.border : theme.speech.border} strokeWidth={strokeWidth} strokeLinejoin="round" fill={`url(#${uid}-${caption ? 'caption' : 'speech'})`}>
          {dots.map((dot, i) => { const c = project(dot); return <circle key={i} cx={c.x} cy={c.y} r={dot.rx * bounds.w * width} /> })}
          {shape}
        </g>
        {caption && theme.caption.inner && <rect x={box.x + strokeWidth * 1.8} y={box.y + strokeWidth * 1.8} width={Math.max(0, box.w - strokeWidth * 3.6)}
          height={Math.max(0, box.h - strokeWidth * 3.6)} rx={width * theme.caption.radius * 0.6} fill="none" stroke={theme.caption.inner} strokeWidth={1} />}
        {/* Área de arrasto: fica por baixo do texto (clicar numa palavra continua abrindo as opções dela).
            A borda larga e transparente em volta facilita pegar o balão. No modo "Mover balões" o texto também arrasta. */}
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
          <FitText font={line.font * width} text={line.text} inert={moveMode}
            html={matchesSource ? parts.map(part => wordsHtml(part.start, part.end)).join(' ') : undefined}
            style={{
              display: 'grid', placeItems: caption ? 'center start' : 'center', height: '100%', boxSizing: 'border-box',
              padding: '0.28em 0.14em', lineHeight: 1.22, fontFamily: theme.font, fontWeight: theme.weight, letterSpacing: theme.uppercase ? '0.04em' : '0.01em', textTransform: theme.uppercase ? 'uppercase' : undefined,
              textAlign: caption ? 'left' : 'center', color: caption ? theme.caption.text : theme.speech.text,
              overflowWrap: 'anywhere', whiteSpace: 'normal', pointerEvents: 'none', overflow: 'visible',
            }} />
        </foreignObject>
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
  </svg>
}
