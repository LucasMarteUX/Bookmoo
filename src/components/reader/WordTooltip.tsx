import { AnimatePresence, motion } from 'motion/react'
import { BookOpenText, Check, Play, RotateCcw, SkipBack, Star } from 'lucide-react'
import type { VocabStatus } from '@/store/useVocabularyStore'

export interface WordTooltipState {
  idx: number
  text: string
  x: number
  y: number
  /** Topo da palavra na tela (para o "+1" saltar acima dela). */
  top: number
}

export interface ScoreBurst { key: number; x: number; y: number }

interface Props {
  state: WordTooltipState | null
  status: VocabStatus | null
  onStatus: (s: VocabStatus) => void
  onExplain: () => void
  onPlayFrom: () => void
  onBack: () => void
  labels: { learned: string; review: string; important: string; explain: string; playFrom: string; back: string }
  burst: ScoreBurst | null
}

const OPTIONS: { id: VocabStatus; icon: typeof Check }[] = [
  { id: 'learned', icon: Check },
  { id: 'review', icon: RotateCcw },
  { id: 'important', icon: Star },
]

/** Balão que abre ao clicar numa palavra: ouvir dali, voltar à frase, marcar status ou abrir a explicação. */
export function WordTooltip({ state, status, onStatus, onExplain, onPlayFrom, onBack, labels, burst }: Props) {
  return (
    <>
      <AnimatePresence>
        {state && (
          <motion.div
            key={state.idx}
            className="word-tooltip fixed z-[60]"
            // Acima da palavra; o padding inferior transparente faz a "ponte" até o balão.
            style={{ left: state.x, top: state.top, x: '-50%', y: '-100%', paddingBottom: 12, transformOrigin: 'bottom center' }}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 520, damping: 30 }}
            role="dialog"
            aria-label={state.text}
          >
            <div className="relative flex flex-col items-stretch gap-2 p-2 pb-3 rounded-2xl border shadow-2xl" style={{ backgroundColor: 'var(--theme-nav-bg)', borderColor: 'var(--theme-border-subtle)' }}>
              {/* setinha para baixo, apontando para a palavra */}
              <span
                aria-hidden
                className="absolute left-1/2 -bottom-[7px] w-3.5 h-3.5 -translate-x-1/2 rotate-45 border-r border-b"
                style={{ backgroundColor: 'var(--theme-nav-bg)', borderColor: 'var(--theme-border-subtle)' }}
              />
              <div className="flex items-center justify-center gap-2">
                <button type="button" onClick={onBack} className="btn-3d btn-3d--explain text-xs" title={labels.back}>
                  <SkipBack className="w-3.5 h-3.5" strokeWidth={2.5} /> {labels.back}
                </button>
                <button type="button" onClick={onPlayFrom} className="btn-3d btn-3d--learned text-xs" autoFocus>
                  <Play className="w-3.5 h-3.5" strokeWidth={2.5} fill="currentColor" /> {labels.playFrom}
                </button>
              </div>
              <div className="flex items-center gap-2">
              {OPTIONS.map(({ id, icon: Icon }) => (
                <button key={id} type="button" onClick={() => onStatus(id)} className={`btn-3d btn-3d--${id} text-xs`} aria-pressed={status === id}>
                  <Icon className="w-3.5 h-3.5" strokeWidth={3} /> {labels[id]}
                </button>
              ))}
              <button type="button" onClick={onExplain} className="btn-3d btn-3d--explain text-xs">
                <BookOpenText className="w-3.5 h-3.5" strokeWidth={2.5} /> {labels.explain}
              </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* "+1" em 3D saltando sobre a palavra aprendida */}
      <AnimatePresence>
        {burst && (
          <motion.div
            key={burst.key}
            className="score-burst fixed z-[70] pointer-events-none -translate-x-1/2"
            style={{ left: burst.x, top: burst.y }}
            initial={{ opacity: 0, y: 8, scale: 0.4, rotate: -12 }}
            animate={{ opacity: [0, 1, 1, 0], y: -46, scale: [0.4, 1.45, 1.1, 1], rotate: [-12, 6, 0, 0] }}
            transition={{ duration: 1.05, ease: 'easeOut', times: [0, 0.25, 0.6, 1] }}
          >
            +1
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
