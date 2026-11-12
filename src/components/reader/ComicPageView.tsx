import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronLeft, ChevronRight, Columns2, Loader2, X, MessageSquareQuote, Move, MoreVertical, Maximize2, Minimize2, MoreHorizontal, RectangleVertical, RefreshCw, Trash2, Wand2, ZoomIn, ZoomOut } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ComicLayout, ComicPanel } from '@/lib/ai'
import { ComicLettering } from './ComicLettering'
import { useComicBalloonEditor } from './useComicBalloonEditor'
import { chooseCaptionAnchors, skinMap, type CaptionAnchor, type SkinMap } from '@/lib/comicPanels'
import { browserMeasure, pageRect, placePanelBoxes } from '@/lib/comicLettering'
import { BalloonToolbar } from './BalloonToolbar'
import { resolveSpeakers } from '@/lib/speakerResolution'
import type { LetteringTheme, LetteringThemeId } from '@/lib/comicThemes'
import { LetteringThemePicker } from './LetteringThemePicker'
import { MenuItem, MenuSection, ToolButton, ToolGroup } from '@/components/ui/toolbar'
import { createPortal } from 'react-dom'
import { fullComicText } from '../../../supabase/functions/_shared/comicText'
import type { Character, EditorialLayout, Rect } from '../../../supabase/functions/_shared/comicEditorial'

export type ComicStage = 'prepare' | 'image' | 'layout' | null

interface Props {
  pageIndex: number
  imageUrl: string | null
  layout?: ComicLayout
  locale: string
  /** HTML das palavras de um trecho do texto da página (mesmas classes/índices do modo texto). */
  sourceText: string
  wordsHtml: (charStart: number, charEnd: number) => string
  onContentClick: (e: React.MouseEvent) => void
  pinMode?: boolean
  comicPins?: { id: string; x: number; y: number; note: string }[]
  onPlacePin?: (x: number, y: number) => void
  onOpenPin?: (id: string) => void
  stage: ComicStage
  error?: string
  onGenerate: () => void
  onDelete: () => void
  onSaveLettering: (layout: EditorialLayout) => Promise<void>
  /** Localiza os rostos de novo e refaz o encaixe dos balões (sem gerar outra imagem). */
  onRelayout: () => void
  /** Personagens do livro (para descobrir quem fala nas falas ambíguas). */
  characters?: Character[]
  /** Caractere da palavra sendo lida agora (anima o selo de quem fala). */
  currentChar?: number | null
  /** Toca a partir do início da fala de um personagem. */
  onPlayLine?: (charStart: number) => void
  /** Lettering look (font, boxes, highlight) for this book. */
  letteringTheme: LetteringTheme
  /** null = automatic (detected from the art direction). */
  letteringChoice: LetteringThemeId | null
  onLetteringThemeChange: (id: LetteringThemeId | null) => void
  letteringDetected: LetteringThemeId
  /** Where the comic tools render (the reader header row, next to Text/Comic). */
  toolbarSlot?: HTMLElement | null
  onPrev: () => void
  onNext: () => void
  /** Elemento que entra em tela cheia (inclui a barra de controles flutuante do leitor). */
  fullscreenTarget: () => HTMLElement | null
  labels: {
    generate: string; regenerate: string; delete: string; preparingArt: string; generatingImage: string
    generatingLayout: string; empty: string; fitWidth: string; fitPage: string
  }
}

const MIN_ZOOM = 1
const MAX_ZOOM = 3
const FONT_RATIO = 0.0185 // tamanho da letra relativo à largura da página

function ComicArtFrame({ imageUrl, source, bounds, art, width, height }: {
  imageUrl: string; source: Rect; bounds: Rect; art: Rect; width: number; height: number
}) {
  const frameW = bounds.w * width, frameH = bounds.h * height
  const artW = art.w * frameW, artH = art.h * frameH
  const crop = (w: number, h: number) => <img src={imageUrl} alt="" draggable={false} referrerPolicy="no-referrer"
    className="absolute max-w-none" style={{ width: w / source.w, height: h / source.h, left: -source.x * w / source.w, top: -source.y * h / source.h }} />
  const bleed = Math.max(frameW / artW, frameH / artH)
  return <div className="absolute overflow-hidden pointer-events-none border border-[#26211e] bg-[#eae5da]"
    style={{ left: bounds.x * width, top: bounds.y * height, width: frameW, height: frameH }}>
    {(art.w < 1 || art.h < 1) && <div className="absolute overflow-hidden opacity-35 blur-2xl"
      style={{ width: artW * bleed, height: artH * bleed, left: (frameW - artW * bleed) / 2, top: (frameH - artH * bleed) / 2 }}>
      {crop(artW * bleed, artH * bleed)}
    </div>}
    <div className="absolute overflow-hidden" style={{ left: art.x * frameW, top: art.y * frameH, width: artW, height: artH }}>
      {crop(artW, artH)}
    </div>
  </div>
}

/** Legenda desenhada pelo app dentro do quadro. A caixa cresce com o texto; se passar de metade
 *  da altura do quadro, a letra diminui até caber — nada é cortado. */
function Caption({ panel, html, pageW, pageH, index, anchor }: { panel: ComicPanel; html: string; pageW: number; pageH: number; index: number; anchor: CaptionAnchor }) {
  const ref = useRef<HTMLDivElement>(null)
  const words = (html.match(/data-word-index/g) ?? []).length
  const base = pageW * FONT_RATIO
  const inset = pageW * 0.012
  const maxW = panel.w * pageW * (words > 26 ? 0.9 : words > 12 ? 0.72 : 0.6)
  const speech = panel.kind === 'speech'

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !pageW) return
    let size = base
    el.style.fontSize = `${size}px`
    const maxH = panel.h * pageH * 0.55
    for (let i = 0; i < 12 && el.offsetHeight > maxH && size > base * 0.55; i++) {
      size *= 0.92
      el.style.fontSize = `${size}px`
    }
  }, [base, pageW, pageH, panel.h, html.length])

  // Posição pelo canto escolhido (o mais calmo do quadro, longe de rostos e do foco da cena).
  const px = panel.x * pageW, py = panel.y * pageH, pw = panel.w * pageW, ph = panel.h * pageH
  const pos: React.CSSProperties = { position: 'absolute', maxWidth: maxW, fontSize: base }
  if (anchor === 'tl' || anchor === 'bl') pos.left = px + inset
  if (anchor === 'tr' || anchor === 'br') pos.right = pageW - (px + pw) + inset
  if (anchor === 'tc' || anchor === 'bc') { pos.left = px + pw / 2; pos.transform = 'translateX(-50%)' }
  if (anchor === 'tl' || anchor === 'tr' || anchor === 'tc') pos.top = py + inset
  else pos.bottom = pageH - (py + ph) + inset
  const bottom = anchor === 'bl' || anchor === 'br' || anchor === 'bc'
  return (
    <div
      ref={ref}
      data-caption={index}
      className={`comic-caption ${speech ? `comic-caption--speech ${bottom ? 'comic-caption--tail-top' : ''}` : ''}`}
      style={pos}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export const ComicPageView = forwardRef<HTMLDivElement, Props>(function ComicPageView(props, wordsRef) {
  const { pageIndex, imageUrl, layout, sourceText, wordsHtml, onContentClick, stage, onGenerate, onDelete, onPrev, onNext, fullscreenTarget, labels } = props
  const reduceMotion = useReducedMotion()
  const viewportRef = useRef<HTMLDivElement>(null)
  const [aspect, setAspect] = useState(2 / 3)
  const [zoom, setZoom] = useState(1)
  const [fit, setFit] = useState<'width' | 'page'>('width')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [box, setBox] = useState({ w: 800, h: 800 })
  const prevPage = useRef(pageIndex)
  const direction = pageIndex >= prevPage.current ? 1 : -1
  useEffect(() => { prevPage.current = pageIndex }, [pageIndex])

  const panels: ComicPanel[] = layout && layout.v === 2 ? layout.panels : []
  const [autoAnchors, setAutoAnchors] = useState<{ key: string; anchors: CaptionAnchor[] } | null>(null)
  const anchorKey = `${imageUrl}|${panels.length}`
  useEffect(() => {
    if (!imageUrl || !panels.length || panels.every((p) => p.anchor)) return
    let alive = true
    chooseCaptionAnchors(imageUrl, panels, panels.map((p) => p.charEnd - p.charStart), aspect)
      .then((anchors) => { if (alive) setAutoAnchors({ key: anchorKey, anchors }) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorKey, aspect])
  const anchorFor = (i: number): CaptionAnchor => panels[i]?.anchor ?? (autoAnchors?.key === anchorKey ? autoAnchors.anchors[i] : undefined) ?? 'tl'
  const pt = props.locale === 'pt-BR'
  const editorial = useMemo(() => {
    if (layout?.v !== 3) return null
    const beats = layout.panels.map(panel => layout.beats.find(beat => beat.id === panel.panelId)
      ?? { id: panel.panelId, sourceSentenceIds: [], dialogue: [] })
    // Quem fala nas falas "ambíguas": marcação de diálogo, fala partida, cena com um só personagem, alternância.
    const dialogue = resolveSpeakers(fullComicText(sourceText, beats), layout.beats, props.characters ?? [], sourceText)
    const savedBox = new Map<string, { box: NonNullable<(typeof layout.balloons)[number]['box']>; font?: number }>()
    for (const balloon of layout.balloons) {
      if (balloon.box && !savedBox.has(balloon.panelId)) savedBox.set(balloon.panelId, { box: balloon.box, font: balloon.font })
    }
    // Caixa já gravada fica. Recalcular só quando a página nunca teve posição salva
    // (formato antigo ou faixa lateral). Um texto ou falante diferente não apaga o lugar.
    if (!layout.reflow && layout.lettering === 'lines' && savedBox.size > 0) {
      const missing = dialogue.filter(line => !savedBox.has(line.panelId))
      const placed = missing.length
        ? placePanelBoxes({ panels: layout.panels, aspect, issues: [] }, missing, browserMeasure(props.letteringTheme.font)).balloons
        : []
      const placedBox = new Map(placed.filter(line => line.box).map(line => [line.panelId, { box: line.box!, font: line.font }]))
      const balloons = dialogue.map(line => {
        const saved = layout.balloons.find(item => item.id === line.id)
        const box = savedBox.get(line.panelId) ?? placedBox.get(line.panelId)
        return { ...line, box: box?.box ?? null, font: saved?.font ?? box?.font ?? 0.021, targetAnchor: saved?.targetAnchor ?? line.targetAnchor }
      })
      return { ...layout, balloons, lettering: 'lines' as const }
    }
    const { balloons } = placePanelBoxes({ panels: layout.panels, aspect, issues: [] }, dialogue,
      browserMeasure(props.letteringTheme.font))
    const { reflow: _reflow, ...rest } = layout
    return { ...rest, balloons, lettering: 'lines' as const }
  }, [layout, sourceText, aspect, props.letteringTheme.font, props.characters])

  // Tamanho disponível (largura do leitor e altura da janela, descontando as barras).
  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const measure = () => {
      // Tela cheia: altura toda menos a faixa da barra de play (que flutua embaixo).
      // Tela cheia: respiro de 24px no topo e a faixa da barra de play embaixo.
      const next = { w: el.clientWidth, h: window.innerHeight - (isFullscreen ? 84 + 24 : 230) }
      setBox(prev => (prev.w === next.w && prev.h === next.h ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [isFullscreen, imageUrl])

  const displayAspect = editorial?.reflow?.aspect ?? aspect
  // Tela cheia: corta a margem branca da arte (fora dos quadros), para a página encher a tela.
  const crop = (() => {
    const panels = isFullscreen && !editorial?.reflow ? editorial?.panels : undefined
    if (!panels?.length) return null
    const x0 = Math.min(...panels.map(p => p.bounds.x)), y0 = Math.min(...panels.map(p => p.bounds.y))
    const x1 = Math.max(...panels.map(p => p.bounds.x + p.bounds.w)), y1 = Math.max(...panels.map(p => p.bounds.y + p.bounds.h))
    if (x1 - x0 < 0.6 || y1 - y0 < 0.6) return null
    // Folga para dentro: o contorno detectado costuma incluir um fio da margem branca.
    const ix = 0.006, iy = 0.006 * displayAspect
    return { x: x0 + ix, y: y0 + iy, w: x1 - x0 - 2 * ix, h: y1 - y0 - 2 * iy }
  })()
  const fitAspect = crop ? displayAspect * crop.w / crop.h : displayAspect
  const baseW = fit === 'width' ? box.w : Math.min(box.w, Math.max(320, box.h) * fitAspect) / (crop?.w ?? 1)
  const pageW = Math.round(baseW * zoom)
  const pageH = Math.round(pageW / displayAspect)
  const editor = useComicBalloonEditor(editorial, `${pageIndex}|${imageUrl}`, pageW, pageH, props.onSaveLettering, props.letteringTheme.font)
  const [moveMode, setMoveMode] = useState(false)
  // Mapa de pele da arte: o selo de quem fala não pode cair sobre um rosto.
  const [skin, setSkin] = useState<SkinMap | null>(null)
  useEffect(() => {
    setSkin(null)
    if (!imageUrl) return
    let alive = true
    skinMap(imageUrl).then(map => { if (alive) setSkin(map) }).catch(() => {})
    return () => { alive = false }
  }, [imageUrl])
  // Clicar fora do balão (e da barra dele) fecha a barra.
  const selectedId = editor.selected?.id
  useEffect(() => {
    if (!selectedId) return
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.('[data-balloon-handle], [data-balloon-toolbar]')) return
      editor.select(null)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])
  const toolbarSlot = props.toolbarSlot
  useEffect(() => { setMoveMode(false) }, [pageIndex])
  useEffect(() => {
    if (!moveMode) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMoveMode(false); editor.select(null) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveMode])
  const draft = editor.draft
  const displayedLettering = editorial && draft
    ? { ...editorial, balloons: editorial.balloons.map(line => line.panelId === draft.panelId ? { ...line, box: draft.box, font: draft.font } : line) }
    : editorial

  useEffect(() => { setZoom(1); viewportRef.current?.scrollTo({ left: 0, top: 0 }) }, [pageIndex])

  const setZoomClamped = useCallback((z: number) => setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z))), [])

  // Pinça (o navegador marca como Ctrl) aproxima. Listener passivo: a rolagem
  // normal não espera o JavaScript, então a página não trava.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * (e.deltaY < 0 ? 1.1 : 1 / 1.1))))
    }
    el.addEventListener('wheel', onWheel, { passive: true })
    return () => el.removeEventListener('wheel', onWheel)
  }, [imageUrl])

  // Setas do teclado viram a página.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t?.closest?.('input, textarea, select, button, [contenteditable="true"]')) return
      if (e.key === 'ArrowRight') onNext()
      else if (e.key === 'ArrowLeft') onPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onNext, onPrev])

  // Arrastar com o mouse para mover quando há zoom; toque: pinça e deslizar para virar a página.
  const drag = useRef<{ x: number; y: number; sl: number; st: number; moved: boolean } | null>(null)
  const pinch = useRef<{ d: number; z: number } | null>(null)
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null)
  const suppressClick = useRef(false)

  const onPointerDown = (e: React.PointerEvent) => {
    suppressClick.current = false
    if (e.button !== 0 || e.pointerType !== 'mouse' || zoom <= 1 || !viewportRef.current) return
    drag.current = { x: e.clientX, y: e.clientY, sl: viewportRef.current.scrollLeft, st: viewportRef.current.scrollTop, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current, el = viewportRef.current
    if (!d || !el) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true
    el.scrollLeft = d.sl - dx
    el.scrollTop = d.st - dy
  }
  const endDrag = () => { if (drag.current?.moved) suppressClick.current = true; drag.current = null }

  const onTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest?.('[data-balloon-handle], [data-balloon-toolbar]')) return
    suppressClick.current = false
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]]
      pinch.current = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: zoom }
      swipe.current = null
    } else if (e.touches.length === 1) {
      swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
    }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (pinch.current && e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]]
      setZoomClamped(pinch.current.z * (Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.current.d))
    }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (pinch.current && e.touches.length < 2) { pinch.current = null; return }
    const s = swipe.current
    swipe.current = null
    if (!s || zoom > 1) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x, dy = t.clientY - s.y
    if (Date.now() - s.t < 600 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      suppressClick.current = true
      if (dx < 0) onNext(); else onPrev()
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as Element
    if (target.closest('[data-story-pin]')) return
    // Clique no corpo do balão só seleciona (alças); fora dele, desmarca.
    if (target.closest('[data-balloon-handle], [data-balloon-toolbar], [data-speaker-chip]') || editor.isGesturing()) return
    if (!target.closest('[data-word-index]')) editor.select(null)
    if (suppressClick.current) { suppressClick.current = false; return }
    if (props.pinMode && props.onPlacePin && !target.closest('[data-word-index]')) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      props.onPlacePin((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height)
      return
    }
    onContentClick(e)
  }
  const onDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-balloon-handle]')) return
    if ((e.target as HTMLElement).closest('[data-word-index]')) return
    setZoomClamped(zoom > 1 ? 1 : 2)
  }

  // Leitura imersiva: só a página, sobre fundo escuro, ocupando a tela. Funciona em qualquer
  // navegador (o iPhone não tem tela cheia de elemento); onde existir, também esconde a interface
  // do navegador. A barra de play continua por cima. Esc ou o X saem.
  void fullscreenTarget
  const toggleFullscreen = () => setIsFullscreen(on => !on)
  useEffect(() => {
    if (!isFullscreen) return
    setFit('page'); setZoom(1)
    const root = document.documentElement
    root.classList.add('comic-immersive')
    if (!document.fullscreenElement) root.requestFullscreen?.().catch(() => {})
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !moveMode) setIsFullscreen(false) }
    // Saiu da tela cheia do navegador (Esc nativo): sai do modo imersivo junto.
    let wasNative = false
    const onChange = () => { if (document.fullscreenElement) wasNative = true; else if (wasNative) setIsFullscreen(false) }
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      root.classList.remove('comic-immersive')
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onChange)
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen])

  const generating = stage !== null
  const stageLabel = stage === 'prepare' ? labels.preparingArt : stage === 'image' ? labels.generatingImage : labels.generatingLayout
  const btn = 'h-9 min-w-9 px-2 rounded-full flex items-center justify-center gap-1.5 text-xs font-semibold border transition-colors hover:bg-[var(--theme-nav-hover)] disabled:opacity-40'
  const btnStyle = { backgroundColor: 'var(--theme-nav-bg)', borderColor: 'var(--theme-border-subtle)', color: 'var(--theme-nav-text)' }

  // Barra flutuante do balão selecionado, em pixels da página (some durante o arrasto).
  const selectedRect = (() => {
    const line = editor.selected
    if (!line?.box || !editorial || editor.draft) return null
    const panel = (editorial.reflow?.panels ?? editorial.panels).find(p => p.panelId === line.panelId)
    if (!panel) return null
    const r = pageRect(panel.bounds, line.box)
    return { x: r.x * pageW, y: r.y * pageH, w: r.w * pageW, h: r.h * pageH }
  })()
  const turnEase = [0.32, 0.72, 0, 1] as const
  // Troca de página como slideshow: avançar → a atual sai pela esquerda e a nova entra pela direita;
  // voltar → o contrário. As duas deslizam juntas, dentro da moldura (nada é cortado de lado).
  const flipVariants = reduceMotion ? {
    under: { opacity: 0 }, shown: { opacity: 1, transition: { duration: 0.15 } }, turned: { opacity: 0, transition: { duration: 0.15 } },
  } : {
    under: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 1 }),
    shown: { x: 0, opacity: 1, transition: { duration: 0.42, ease: turnEase } },
    turned: (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 1, transition: { duration: 0.42, ease: turnEase } }),
  }

  const tools = (
    <>
        {/* Mover caixas fica no menu ⋮; enquanto ativo, aparece aqui o botão de concluir. */}
        {editorial && moveMode && <ToolButton icon={<Move className="w-4 h-4" />} label={pt ? 'Concluir' : 'Done'} compact active
          hint={pt ? 'Sair do modo de mover caixas (Esc)' : 'Leave move mode (Esc)'}
          onClick={() => { setMoveMode(false); editor.select(null) }} />}
        <ToolButton icon={<Maximize2 className="w-4 h-4" />}
          hint={pt ? 'Leitura imersiva: só a página, ocupando a tela. Esc para sair.' : 'Immersive reading: just the page, filling the screen. Esc to exit.'}
          onClick={toggleFullscreen} />
        {editorial && <LetteringThemePicker theme={props.letteringTheme} choice={props.letteringChoice}
          detected={props.letteringDetected} onChange={props.onLetteringThemeChange} pt={pt} />}
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <ToolButton icon={generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
              hint={pt ? 'Mais opções do quadrinho' : 'More comic options'} disabled={generating || editor.saving} />
          </PopoverTrigger>
          <PopoverContent className="w-72 p-1.5 rounded-2xl shadow-2xl border z-50" style={{ backgroundColor: 'var(--theme-nav-bg)', borderColor: 'var(--theme-border-subtle)' }} align="end">
            <MenuSection title={pt ? 'Visualização' : 'View'}>
              <MenuItem icon={fit === 'width' ? <RectangleVertical className="w-4 h-4" /> : <Columns2 className="w-4 h-4" />}
                label={fit === 'width' ? labels.fitPage : labels.fitWidth}
                description={fit === 'width' ? (pt ? 'Mostra a página inteira na tela' : 'Show the whole page on screen') : (pt ? 'Ocupa toda a largura do leitor' : 'Use the full reader width')}
                onClick={() => { setMenuOpen(false); setFit(fit === 'width' ? 'page' : 'width'); setZoom(1) }} />
              <MenuItem icon={zoom > 1 ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
                label={zoom > 1 ? (pt ? 'Tamanho original' : 'Actual size') : (pt ? 'Ampliar 2×' : 'Zoom 2×')}
                description={pt ? 'Também com Ctrl + roda do mouse ou pinça' : 'Also Ctrl + scroll wheel or pinch'}
                onClick={() => { setMenuOpen(false); setZoomClamped(zoom > 1 ? 1 : 2) }} />
              <MenuItem icon={isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                label={isFullscreen ? (pt ? 'Sair da tela cheia' : 'Exit full screen') : (pt ? 'Tela cheia' : 'Full screen')}
                onClick={() => { setMenuOpen(false); void toggleFullscreen() }} />
            </MenuSection>
            <div className="h-px mx-2" style={{ backgroundColor: 'var(--theme-border-subtle)' }} />
            <MenuSection title={pt ? 'Esta página' : 'This page'}>
              {editorial && <MenuItem icon={<Move className="w-4 h-4" />} label={pt ? 'Mover caixas de texto' : 'Move text boxes'}
                description={pt ? 'Arraste qualquer caixa, inclusive pelo texto. Esc para sair.' : 'Drag any box, even by its text. Esc to exit.'}
                onClick={() => { setMenuOpen(false); setMoveMode(true) }} />}
              {editorial && <MenuItem icon={<MessageSquareQuote className="w-4 h-4" />} label={pt ? 'Reposicionar texto' : 'Reposition text'}
                description={pt ? 'Localiza os rostos e reposiciona as caixas para não cobri-los. Não gera outra imagem.' : 'Finds the faces and moves the text boxes off them. No new image.'}
                onClick={() => { setMenuOpen(false); props.onRelayout() }} />}
              <MenuItem icon={<RefreshCw className="w-4 h-4" />} label={labels.regenerate}
                description={pt ? 'Desenha de novo, com outra composição. Usa sua chave de IA.' : 'Draws it again with a new composition. Uses your AI key.'}
                onClick={() => { setMenuOpen(false); onGenerate() }} />
              <MenuItem icon={<Trash2 className="w-4 h-4" />} label={labels.delete} tone="danger"
                description={pt ? 'Volta a página para o modo só texto' : 'Returns this page to text only'}
                onClick={() => { setMenuOpen(false); onDelete() }} />
            </MenuSection>
          </PopoverContent>
        </Popover>
    </>
  )
  // Dentro da barra do leitor (ao lado de Texto | Ilustrado) as ferramentas entram sem moldura própria.
  const toolbar = toolbarSlot
    ? <div className="flex items-center gap-0.5">{tools}</div>
    : <ToolGroup label={pt ? 'Ferramentas da página' : 'Page tools'}>{tools}</ToolGroup>

  // ---- Página sem quadrinho ---------------------------------------------------------------
  if (!imageUrl) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-4 rounded-3xl border p-10 min-h-[50vh]" style={{ backgroundColor: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-subtle)' }}>
        {props.error && <p role="alert" className="text-sm">{props.error}</p>}
        {generating ? (
          <>
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--theme-accent)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{stageLabel}</p>
          </>
        ) : (
          <>
            <Wand2 className="w-8 h-8" style={{ color: 'var(--theme-accent)' }} />
            <p className="text-sm max-w-sm" style={{ color: 'var(--theme-text-secondary)' }}>{labels.empty}</p>
            <button onClick={onGenerate} className="px-5 py-2.5 rounded-full text-sm font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
              {labels.generate}
            </button>
          </>
        )}
      </div>
    )
  }

  // ---- Página de quadrinho ----------------------------------------------------------------
  return (
    <div ref={wordsRef} className={isFullscreen ? 'comic-reader comic-immersive-stage fixed inset-0 z-[80] flex flex-col justify-start' : 'comic-reader w-full flex flex-col gap-3'}
      style={isFullscreen ? { backgroundColor: '#0d0c0b', paddingTop: zoom > 1 ? 'var(--safe-t, 0px)' : 'calc(var(--safe-t, 0px) + 24px)' } : undefined}>
      {!isFullscreen && (toolbarSlot ? createPortal(toolbar, toolbarSlot) : <div className="sticky top-2 z-30 flex justify-end">{toolbar}</div>)}
      {isFullscreen && <>
        <div className="absolute right-3 z-10 flex items-center gap-2" style={{ top: 'max(0.75rem, var(--safe-t, 0px))' }}>
          <button type="button" onClick={toggleFullscreen} aria-label={pt ? 'Sair da tela cheia' : 'Exit full screen'} title={pt ? 'Sair (Esc)' : 'Exit (Esc)'}
            className="w-9 h-9 grid place-items-center rounded-full transition-colors hover:bg-white/20" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <button type="button" onClick={onPrev} aria-label={pt ? 'Página anterior' : 'Previous page'}
          className="hidden md:grid absolute left-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 place-items-center rounded-full transition-colors hover:bg-white/20" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff' }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button type="button" onClick={onNext} aria-label={pt ? 'Próxima página' : 'Next page'}
          className="hidden md:grid absolute right-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 place-items-center rounded-full transition-colors hover:bg-white/20" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff' }}>
          <ChevronRight className="w-5 h-5" />
        </button>
      </>}

      {props.error && <p role="alert" className="text-sm">{props.error}</p>}
      {generating && (
        <div className="w-full text-xs rounded-xl px-3 py-2 flex items-center gap-2" style={{ backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-secondary)' }}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> {stageLabel}
        </div>
      )}

      {/* Área da página: com zoom, a página cresce e esta área rola (nada é cortado). */}
      <div
        ref={viewportRef}
        className="relative w-full overflow-auto rounded-xl select-none"
        style={{ maxHeight: fit === 'page' || zoom > 1 ? box.h + 40 : undefined, perspective: 2000, touchAction: zoom > 1 ? 'pan-x pan-y' : 'pan-y', cursor: zoom > 1 ? 'grab' : 'default' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => { swipe.current = null; pinch.current = null }}
        onDoubleClick={onDoubleClick}
      >
        {/* Troca de página em slideshow (ver flipVariants). */}
        <div className={`relative mx-auto overflow-hidden ${isFullscreen ? '' : 'rounded-sm shadow-2xl'}`}
          style={crop ? { width: Math.round(pageW * crop.w), height: Math.round(pageH * crop.h) } : { width: pageW, height: pageH }}>
        <div className="absolute" style={{ width: pageW, height: pageH, left: crop ? -crop.x * pageW : 0, top: crop ? -crop.y * pageH : 0 }}>
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={pageIndex}
            custom={direction}
            variants={flipVariants}
            initial="under"
            animate="shown"
            exit="turned"
            className="absolute inset-0 shadow-2xl bg-white"
            style={{ backfaceVisibility: 'hidden' }}
            onClick={handleClick}
          >
            <img src={imageUrl} alt="" draggable={false} referrerPolicy="no-referrer"
              className={`absolute inset-0 w-full h-full ${editorial?.reflow ? 'invisible' : ''}`}
              onLoad={(e) => {
                const img = e.currentTarget
                if (img.naturalWidth && img.naturalHeight) setAspect(img.naturalWidth / img.naturalHeight)
              }} />
            {/* Tela cheia: as calhas brancas entre os quadros viram fundo escuro (abaixo do texto). */}
            {crop && editorial && (
              <svg className="absolute inset-0 pointer-events-none" width={pageW} height={pageH} viewBox={`0 0 ${pageW} ${pageH}`}>
                <path fillRule="evenodd" fill="#0d0c0b" d={`M0 0H${pageW}V${pageH}H0Z ${editorial.panels.map(({ bounds: b }) => {
                  const ix = 0.004 * pageW, iy = 0.004 * pageW
                  const x = b.x * pageW + ix, y = b.y * pageH + iy, w = b.w * pageW - 2 * ix, h = b.h * pageH - 2 * iy
                  return `M${x} ${y}h${w}v${h}h${-w}Z`
                }).join(' ')}`} />
              </svg>
            )}
            {editorial?.reflow?.panels.map(frame => {
              const panel = editorial.panels.find(item => item.panelId === frame.panelId)
              if (!panel) return null
              return <ComicArtFrame key={frame.panelId} imageUrl={panel.replacement?.imageUrl ?? imageUrl} source={panel.bounds}
                bounds={frame.bounds} art={frame.art} width={pageW} height={pageH} />
            })}
            {!editorial?.reflow && editorial?.panels.map(({ panelId, replacement, bounds: r }) => replacement && (
              <div key={panelId} className="absolute overflow-hidden pointer-events-none"
                style={{ left: r.x * pageW, top: r.y * pageH, width: r.w * pageW, height: r.h * pageH }}>
                <img src={replacement.imageUrl} alt="" draggable={false} referrerPolicy="no-referrer" className="absolute max-w-none"
                  style={{ width: pageW, height: pageH, left: -r.x * pageW, top: -r.y * pageH }} />
              </div>
            ))}
            {displayedLettering && <ComicLettering layout={displayedLettering} width={pageW} height={pageH}
              wordsHtml={wordsHtml} sourceText={sourceText} editor={editor} theme={props.letteringTheme} moveMode={moveMode}
              currentChar={props.currentChar} onPlayLine={props.onPlayLine} skinAt={skin?.fraction}
              onMoveChip={(key, position) => { if (editorial) void props.onSaveLettering({ ...editorial, lettering: 'lines', speakerChips: { ...editorial.speakerChips, [key]: position } }).catch(() => {}) }} />}
            {selectedRect && editor.selected && (
              <BalloonToolbar box={selectedRect} pageW={pageW} pageH={pageH} type={editor.selected.balloonType}
                saving={editor.saving} pt={pt} onFont={editor.changeFont} onType={editor.changeType} onClose={() => editor.select(null)} />
            )}
            {(props.comicPins ?? []).map(pin => (
              <button key={pin.id} type="button" data-story-pin title={pin.note}
                className="absolute z-20 w-6 h-6 -translate-x-1/2 -translate-y-full rounded-full text-[13px] shadow"
                style={{ left: pin.x * pageW, top: pin.y * pageH, backgroundColor: 'var(--theme-pastel-3)', color: 'var(--theme-pastel-text)' }}
                onClick={event => { event.stopPropagation(); props.onOpenPin?.(pin.id) }}>
                📌
              </button>
            ))}
            {panels.map((p, i) => (
              <Caption key={i} index={i} panel={p} anchor={anchorFor(i)} html={wordsHtml(p.charStart, p.charEnd)} pageW={pageW} pageH={pageH} />
            ))}
          </motion.div>
        </AnimatePresence>
        </div>
        </div>
      </div>

    </div>
  )
})
