import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { adjustComicBalloon, browserMeasure } from '@/lib/comicLettering'
import type { BalloonType, EditorialLayout, PlacedDialogue, Rect } from '../../../supabase/functions/_shared/comicEditorial'

/** move: drag the body · n/s/e/w: resize one side (text re-wraps) · corners: scale box and font together. */
export type BalloonHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'
type Gesture = { line: PlacedDialogue & { box: Rect }; panel: Rect; x: number; y: number; pointer: number; mode: BalloonHandle }

const MIN_FONT = 0.008
const MAX_FONT = 0.06
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

/** Direct manipulation of balloons: click selects (handles appear), drag moves or resizes, and the result is saved. */
export function useComicBalloonEditor(layout: EditorialLayout | null, pageKey: string, width: number, height: number,
  save: (layout: EditorialLayout) => Promise<void>, fontFamily: string) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<PlacedDialogue | null>(null)
  const [saving, setSaving] = useState(false)
  const gesture = useRef<Gesture | null>(null)
  const draftRef = useRef<PlacedDialogue | null>(null)
  const savingRef = useRef(false)
  const lastGesture = useRef(0)
  useEffect(() => { measure.current = null }, [fontFamily])
  useEffect(() => {
    setSelectedId(null)
    setDraft(null)
    draftRef.current = null
    gesture.current = null
  }, [pageKey])

  const selected = draft ?? layout?.balloons.find(line => line.id === selectedId) ?? null
  const frame = (id: string) => (layout?.reflow?.panels ?? layout?.panels)?.find(panel => panel.panelId === id)?.bounds
  const measure = useRef<ReturnType<typeof browserMeasure> | null>(null)
  const adjust = (line: PlacedDialogue, box: Rect, panel: Rect, font: number) => {
    measure.current ??= browserMeasure(fontFamily)
    return adjustComicBalloon(line, box, panel, width / height, font, measure.current)
  }
  const commit = async (line: PlacedDialogue | null) => {
    if (!layout || !line || savingRef.current) return
    const original = layout.balloons.find(item => item.id === line.id)
    if (!line.box || (original?.font === line.font && JSON.stringify(original.box) === JSON.stringify(line.box))) {
      setDraft(null)
      draftRef.current = null
      return
    }
    savingRef.current = true
    setSaving(true)
    setDraft(line)
    try {
      // Só posição e tamanho/letra vêm do editor (na caixa única o texto exibido junta várias linhas).
      // A caixa do quadro é uma só para todas as falas: mover/redimensionar vale para o quadro inteiro.
      await save({ ...layout, lettering: 'lines', balloons: layout.balloons.map(item => item.panelId === line.panelId ? { ...item, box: line.box, font: line.font } : item) })
    } catch {
      // The reader reports the save error and restores its last saved layout.
    } finally {
      draftRef.current = null
      setDraft(null)
      savingRef.current = false
      setSaving(false)
    }
  }
  const start = (event: PointerEvent<SVGElement>, line: PlacedDialogue, panel: Rect, mode: BalloonHandle) => {
    if (event.button !== 0 || savingRef.current || !line.box) return
    event.stopPropagation()
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedId(line.id)
    lastGesture.current = Date.now()
    gesture.current = { line: { ...line, box: line.box }, panel, mode, x: event.clientX, y: event.clientY, pointer: event.pointerId }
  }
  const move = (event: PointerEvent<SVGSVGElement>) => {
    const action = gesture.current
    if (!action || event.pointerId !== action.pointer) return
    const { line, panel, mode } = action
    const b = line.box
    const dx = (event.clientX - action.x) / (width * panel.w)
    const dy = (event.clientY - action.y) / (height * panel.h)
    let next: Rect = b
    let font = line.font
    if (mode === 'move') next = { ...b, x: b.x + dx, y: b.y + dy }
    else if (mode === 'e') next = { ...b, w: Math.max(0.08, b.w + dx) }
    else if (mode === 'w') { const w = Math.max(0.08, b.w - dx); next = { ...b, x: b.x + b.w - w, w } }
    else if (mode === 's') next = { ...b, h: Math.max(0.04, b.h + dy) }
    else if (mode === 'n') { const h = Math.max(0.04, b.h - dy); next = { ...b, y: b.y + b.h - h, h } }
    else {
      // Corner: proportional scale anchored at the opposite corner; the font follows.
      const sx = (b.w + (mode.includes('e') ? dx : -dx)) / b.w
      const sy = (b.h + (mode.includes('s') ? dy : -dy)) / b.h
      const s = clamp((sx + sy) / 2, MIN_FONT / line.font, MAX_FONT / line.font)
      const w = b.w * s, h = b.h * s
      next = { x: mode.includes('w') ? b.x + b.w - w : b.x, y: mode.includes('n') ? b.y + b.h - h : b.y, w, h }
      font = line.font * s
    }
    const updated = adjust(line, next, panel, font)
    draftRef.current = updated
    setDraft(updated)
  }
  const end = (event: PointerEvent<SVGSVGElement>, cancelled = false) => {
    if (gesture.current?.pointer !== event.pointerId) return
    gesture.current = null
    lastGesture.current = Date.now()
    if (!cancelled && draftRef.current) void commit(draftRef.current)
    else { draftRef.current = null; setDraft(null) }
  }
  const keyboard = (event: KeyboardEvent<SVGElement>, line: PlacedDialogue, panel: Rect) => {
    if (event.key === 'Escape') { setSelectedId(null); return }
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
    if (!delta || !line.box || savingRef.current) return
    event.preventDefault()
    event.stopPropagation()
    setSelectedId(line.id)
    const [x, y] = delta.map(step => step * 0.015)
    const box = event.shiftKey ? { ...line.box, w: line.box.w + x, h: line.box.h + y }
      : { ...line.box, x: line.box.x + x, y: line.box.y + y }
    void commit(adjust(line, box, panel, line.font))
  }
  const changeFont = (factor: number) => {
    if (!selected?.box || savingRef.current) return
    const panel = frame(selected.panelId)
    if (!panel) return
    void commit(adjust(selected, selected.box, panel, clamp(selected.font * factor, MIN_FONT, MAX_FONT)))
  }
  const changeType = (balloonType: BalloonType) => {
    if (!selected?.box || savingRef.current || selected.balloonType === balloonType) return
    const panel = frame(selected.panelId)
    if (!panel) return
    // Narration has no tail; re-fit the box because captions use a wider text column.
    void commit(adjust({ ...selected, balloonType }, selected.box, panel, selected.font))
  }

  return {
    selected, saving, draft, start, move, end, keyboard, changeFont, changeType,
    select: setSelectedId,
    /** True during a drag and right after it, so the click that follows does not deselect. */
    isGesturing: () => gesture.current !== null || Date.now() - lastGesture.current < 400,
  }
}
