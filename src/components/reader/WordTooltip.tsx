import { AnimatePresence, motion } from 'motion/react'
import { BookOpenText, Check, Images, Mic, Pin, RotateCcw, Star } from 'lucide-react'
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
  onNote: () => void
  onImage: () => void
  onSpeak: () => void
  speaking?: boolean
  labels: { learned: string; review: string; important: string; explain: string; note: string; image: string; listen: string }
  burst: ScoreBurst | null
}

const OPTIONS: { id: VocabStatus; icon: typeof Check }[] = [
  { id: 'learned', icon: Check },
  { id: 'review', icon: RotateCcw },
  { id: 'important', icon: Star },
]

/** Cartão que abre ao clicar numa palavra: a palavra, o microfone, explicação, nota
 *  e os mesmos botões coloridos do cartão de estudo. */
export function WordTooltip({ state, status, onStatus, onExplain, onNote, onImage, onSpeak, speaking, labels, burst }: Props) {
  const quiet = 'h-8 flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-medium cursor-pointer transition-colors hover:bg-[var(--ui-hover)]'
  return (
    <>
      <AnimatePresence>
        {state && (
          <motion.div
            key={state.idx}
            className="word-tooltip fixed z-[60]"
            // Acima da palavra; o padding inferior transparente faz a "ponte" até o cartão.
            style={{ left: state.x, top: state.top, x: '-50%', y: '-100%', paddingBottom: 10, transformOrigin: 'bottom center' }}
            initial={{ opacity: 0, y: '-96%', scale: 0.97 }}
            animate={{ opacity: 1, y: '-100%', scale: 1 }}
            exit={{ opacity: 0, y: '-96%', scale: 0.97 }}
            transition={{ duration: 0.14, ease: [0.2, 0.8, 0.2, 1] }}
            role="dialog"
            aria-label={state.text}
          >
            <div className="elevated relative w-[336px] max-w-[92vw] rounded-2xl px-3.5 pt-3.5 pb-2.5" style={{ color: 'var(--theme-text)' }}>
              <span aria-hidden className="absolute left-1/2 -bottom-[6px] w-3 h-3 -translate-x-1/2 rotate-45 border-r border-b"
                style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }} />

              <div className="flex items-center gap-2 pl-1 pr-0.5">
                <span className="font-display min-w-0 flex-1 truncate text-[22px] leading-none tracking-tight" title={state.text}>{state.text}</span>
                <button type="button" onClick={onSpeak} aria-label={labels.listen} title={labels.listen}
                  className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-full border cursor-pointer transition-colors hover:bg-[var(--ui-hover)]"
                  style={{ borderColor: 'var(--theme-border)' }}>
                  <Mic className={`w-3.5 h-3.5 ${speaking ? 'animate-pulse' : ''}`} />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1.5" role="group">
                {OPTIONS.map(({ id, icon: Icon }) => (
                  <button key={id} type="button" onClick={() => onStatus(id)} aria-pressed={status === id} className={`btn-3d btn-3d--${id} !w-full !px-0`}>
                    <Icon className="w-3.5 h-3.5" strokeWidth={2.4} fill={id === 'important' && status === id ? 'currentColor' : 'none'} />
                    {labels[id]}
                  </button>
                ))}
              </div>

              <div className="mt-1.5 grid grid-cols-3 gap-1 border-t pt-1.5" style={{ borderColor: 'var(--theme-border)' }}>
                <button type="button" onClick={onExplain} className={quiet}>
                  <BookOpenText className="w-3.5 h-3.5" />{labels.explain}
                </button>
                <button type="button" onClick={onNote} className={quiet}>
                  <Pin className="w-3.5 h-3.5" />{labels.note}
                </button>
                <button type="button" onClick={onImage} className={quiet}>
                  <Images className="w-3.5 h-3.5" />{labels.image}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* "+1" saltando sobre a palavra aprendida */}
      <AnimatePresence>
        {burst && (
          <motion.div
            key={burst.key}
            className="score-burst fixed z-[70] pointer-events-none -translate-x-1/2"
            style={{ left: burst.x, top: burst.y }}
            initial={{ opacity: 0, y: 6, scale: 0.6 }}
            animate={{ opacity: [0, 1, 1, 0], y: -40, scale: [0.6, 1.12, 1, 1] }}
            transition={{ duration: 1, ease: 'easeOut', times: [0, 0.25, 0.65, 1] }}
          >
            +1
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
