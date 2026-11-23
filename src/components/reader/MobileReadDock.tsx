// Controle do leitor no celular: uma pílula pequena que flutua embaixo, por cima do texto.
// "Ler" (livro) deixa só o texto; "Ouvir" (fone) estende a mesma pílula para os lados com o player:
// voltar página, tocar/pausar, avançar página e velocidade. Discreto, ao alcance do polegar.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { BookOpen, ChevronLeft, ChevronRight, Headphones, Loader2, Pause, Play } from 'lucide-react'
import { haptics } from '@/lib/haptics'

export interface MobileReadDockProps {
  listening: boolean
  playing: boolean
  loading: boolean
  rate: number
  speeds: readonly number[]
  page: number
  total: number
  pt: boolean
  onRead: () => void
  onListen: () => void
  onToggle: () => void
  onPrev: () => void
  onNext: () => void
  onRate: (rate: number) => void
}

const glass = {
  backgroundColor: 'color-mix(in srgb, var(--theme-card-bg) 88%, transparent)',
  borderColor: 'var(--theme-border)',
  backdropFilter: 'blur(16px) saturate(1.4)',
  WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
  boxShadow: '0 1px 2px rgba(15,15,15,0.05), 0 8px 24px -10px rgba(15,15,15,0.28)',
} as const

function fmtRate(r: number) {
  return `${Math.round(r * 100) / 100}x`
}

const icon = 'pressable w-9 h-9 rounded-full grid place-items-center shrink-0 transition-colors disabled:opacity-30'

export function MobileReadDock(p: MobileReadDockProps) {
  const reduce = useReducedMotion()
  const nextRate = () => {
    const i = p.speeds.findIndex(s => Math.abs(s - p.rate) < 0.01)
    p.onRate(p.speeds[(i + 1) % p.speeds.length] ?? 1)
  }
  const on = { backgroundColor: 'var(--theme-text)', color: 'var(--theme-bg)' }
  const off = { color: 'var(--theme-text-secondary)' }

  return (
    <div data-reader-dock className="fixed inset-x-0 z-40 flex justify-center pointer-events-none"
      style={{ bottom: 'calc(var(--safe-b, 0px) + 0.75rem)' }}>
      <motion.div layout={!reduce} transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        className="pointer-events-auto flex items-center gap-0.5 p-1 rounded-full border" style={glass}>
        <div role="radiogroup" aria-label={p.pt ? 'Como ler' : 'How to read'} className="flex items-center gap-0.5">
          <button type="button" role="radio" aria-checked={!p.listening} aria-label={p.pt ? 'Ler' : 'Read'}
            onClick={() => { haptics.selection(); p.onRead() }} className={icon} style={!p.listening ? on : off}>
            <BookOpen className="w-[17px] h-[17px]" strokeWidth={2} />
          </button>
          <button type="button" role="radio" aria-checked={p.listening} aria-label={p.pt ? 'Ouvir' : 'Listen'}
            onClick={() => { haptics.selection(); p.onListen() }} className={icon} style={p.listening ? on : off}>
            <Headphones className="w-[17px] h-[17px]" strokeWidth={2} />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {p.listening && (
            <motion.div key="player" role="group" aria-label={p.pt ? 'Player da leitura' : 'Reading player'}
              initial={reduce ? { opacity: 0 } : { opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, width: 0 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex items-center gap-0.5 overflow-hidden">
              <span aria-hidden className="mx-1 h-5 w-px shrink-0" style={{ backgroundColor: 'var(--theme-border)' }} />
              <button type="button" onClick={() => { haptics.selection(); p.onPrev() }} disabled={p.page <= 0}
                className={icon} style={{ color: 'var(--theme-text)' }} aria-label={p.pt ? 'Página anterior' : 'Previous page'}>
                <ChevronLeft className="w-[18px] h-[18px]" />
              </button>
              <button type="button" onClick={() => { haptics.selection(); p.onToggle() }} className={icon}
                style={{ color: 'var(--theme-text)' }} aria-label={p.playing ? (p.pt ? 'Pausar' : 'Pause') : (p.pt ? 'Tocar' : 'Play')}>
                {p.loading ? <Loader2 className="w-[17px] h-[17px] animate-spin" /> : p.playing ? <Pause className="w-[17px] h-[17px]" fill="currentColor" /> : <Play className="w-[17px] h-[17px] ml-0.5" fill="currentColor" />}
              </button>
              <button type="button" onClick={() => { haptics.selection(); p.onNext() }} disabled={p.page >= p.total - 1}
                className={icon} style={{ color: 'var(--theme-text)' }} aria-label={p.pt ? 'Próxima página' : 'Next page'}>
                <ChevronRight className="w-[18px] h-[18px]" />
              </button>
              <button type="button" onClick={() => { haptics.selection(); nextRate() }}
                className="pressable h-9 min-w-9 px-2 rounded-full text-[12.5px] font-semibold tabular-nums shrink-0" style={{ color: 'var(--theme-text)' }}
                aria-label={p.pt ? `Velocidade ${fmtRate(p.rate)}. Tocar para trocar` : `Speed ${fmtRate(p.rate)}. Tap to change`}>
                {fmtRate(p.rate)}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
