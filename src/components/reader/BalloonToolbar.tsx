import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { BalloonType } from '../../../supabase/functions/_shared/comicEditorial'

const KINDS: { id: BalloonType; pt: string; en: string; glyph: string }[] = [
  { id: 'speech', pt: 'Fala', en: 'Speech', glyph: 'M3 7a7 5 0 1 1 4 4.6L5 14l.4-3.1A5 5 0 0 1 3 7Z' },
  { id: 'thought', pt: 'Pensamento', en: 'Thought', glyph: 'M5 9a3 3 0 0 1 1-5.6A3.5 3.5 0 0 1 12.5 4 3 3 0 0 1 13 10H6a3 3 0 0 1-1-1Zm-1 4a1 1 0 1 0 0 .1ZM2 15.5a.6.6 0 1 0 0 .1Z' },
  { id: 'caption', pt: 'Narração', en: 'Narration', glyph: 'M2 4h14v9H2Z' },
  { id: 'expressive', pt: 'Grito', en: 'Shout', glyph: 'M9 1l1.6 3.4L14 3l-1 3.6L17 8l-3.6 1.4L15 13l-3.6-1.2L9 15l-1.6-3.2L4 13l1.2-3.6L1 8l4-1.4L4 3l3.4 1.4Z' },
]

function Glyph({ d }: { d: string }) {
  return <svg viewBox="0 0 18 17" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round"><path d={d} /></svg>
}

/**
 * Floating tools for the selected balloon, anchored under it (or above when there is no room).
 * Coordinates are page pixels inside the comic page container.
 */
export function BalloonToolbar({ box, pageW, pageH, type, saving, pt, onFont, onType, onClose }: {
  box: { x: number; y: number; w: number; h: number }
  pageW: number; pageH: number
  type: BalloonType; saving: boolean; pt: boolean
  onFont: (factor: number) => void
  onType: (type: BalloonType) => void
  onClose: () => void
}) {
  const [typesOpen, setTypesOpen] = useState(false)
  const W = 150
  const below = box.y + box.h + 72 < pageH
  const left = Math.max(8, Math.min(pageW - W - 8, box.x + box.w / 2 - W / 2))
  const top = below ? box.y + box.h + 20 : Math.max(8, box.y - (typesOpen ? 104 : 64))
  const arrowX = Math.max(14, Math.min(W - 14, box.x + box.w / 2 - left))
  const current = KINDS.find(k => k.id === type) ?? KINDS[0]
  const btn = 'h-8 px-2.5 rounded-lg text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors hover:bg-white/10 disabled:opacity-40'
  return (
    <div data-balloon-toolbar role="toolbar" aria-label={pt ? 'Editar caixa de texto' : 'Edit text box'}
      className="absolute z-40 rounded-xl border shadow-2xl text-white select-none"
      style={{ left, top, width: W, backgroundColor: 'rgba(22,22,26,0.96)', borderColor: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
      onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
      <span aria-hidden className="absolute w-3 h-3 rotate-45"
        style={{ left: arrowX - 6, [below ? 'top' : 'bottom']: -6.5, backgroundColor: 'rgb(22,22,26)', borderColor: 'rgba(255,255,255,0.12)',
          borderStyle: 'solid', borderWidth: below ? '1px 0 0 1px' : '0 1px 1px 0' }} />
      <div className="relative flex items-center gap-0.5 p-1">
        <button type="button" className={btn} disabled={saving} onClick={() => onFont(1 / 1.1)} title={pt ? 'Texto menor' : 'Smaller text'}>
          <span className="text-[11px]">A</span><span className="opacity-60">−</span>
        </button>
        <button type="button" className={btn} disabled={saving} onClick={() => onFont(1.1)} title={pt ? 'Texto maior' : 'Larger text'}>
          <span className="text-[15px]">A</span><span className="opacity-60">+</span>
        </button>
        <span className="mx-1 h-5 w-px bg-white/15" />
        <button type="button" className={btn} onClick={onClose} title={pt ? 'Concluir' : 'Done'} aria-label={pt ? 'Concluir' : 'Done'}>
          {saving ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Check className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
