import { BookOpenText, Pin, Plus } from 'lucide-react'

/** Barra que aparece sobre uma frase marcada: salvar, anotar ou pedir explicação. */
export function FloatingAction({
  rect, pt, onSave, onNote, onExplain, touch,
}: {
  rect: DOMRect
  pt: boolean
  /** Celular: alvos de 44 pt e, perto do topo, a barra vai para baixo da frase. */
  touch?: boolean
  onSave: () => void
  onNote: () => void
  onExplain: () => void
}) {
  const stop = (e: React.MouseEvent, fn: () => void) => {
    e.preventDefault()
    e.stopPropagation()
    fn()
  }
  const item = touch
    ? 'h-11 px-3 inline-flex items-center gap-1.5 rounded-xl text-[14px] font-medium whitespace-nowrap active:bg-[var(--ui-hover)]'
    : 'h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium hover:bg-[var(--ui-hover)]'
  const below = !!touch && rect.top < 120
  // No celular a barra fica dentro da tela mesmo quando a frase encosta na borda.
  const left = touch ? Math.max(150, Math.min(window.innerWidth - 150, rect.left + rect.width / 2)) : rect.left + rect.width / 2
  return (
    <div
      className={`fixed z-50 -translate-x-1/2 ${below ? 'pt-2' : '-translate-y-full pb-2'}`}
      style={{ left, top: below ? rect.bottom + 6 : rect.top - 6 }}
      data-no-gesture
    >
      <div className="elevated flex items-center gap-0.5 rounded-xl p-1" style={{ color: 'var(--theme-text)' }}>
        <button type="button" className={item} onMouseDown={e => stop(e, onSave)}>
          <Plus className="w-3.5 h-3.5" />{pt ? 'Salvar frase' : 'Save phrase'}
        </button>
        <button type="button" className={item} onMouseDown={e => stop(e, onNote)}>
          <Pin className="w-3.5 h-3.5" />{pt ? 'Nota' : 'Note'}
        </button>
        <button type="button" className={`${item} px-3`} style={{ backgroundColor: 'var(--theme-pastel-2)', color: 'var(--theme-pastel-text)' }} onMouseDown={e => stop(e, onExplain)}>
          <BookOpenText className="w-3.5 h-3.5" />{pt ? 'Explicar' : 'Explain'}
        </button>
      </div>
    </div>
  )
}
