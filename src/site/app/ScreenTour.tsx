// Tour de uma tela do app: a seção fica fixa enquanto a rolagem passa pelos capítulos. A interface aparece em tamanho
// real (uma por vez, na largura toda) e muda de estado com transição suave. O texto do capítulo fica no cabeçalho.
import { useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { Window, type MockTheme } from './Frame'
import { Eyebrow } from '../ui'

export type TourStep = { label: string; title: string; desc: string }

type Props = {
  id?: string
  eyebrow: string
  title: ReactNode
  steps: TourStep[]
  /** Desenha a tela para o capítulo ativo; `progress` vai de 0 a 1 ao longo da seção inteira. */
  render: (step: number, progress: MotionValue<number>) => ReactNode
  theme: MockTheme
  url?: string
  /** Altura da tela em px de desenho (largura sempre 1280). */
  height?: number
  dark?: boolean
  /** Entrada inclinada (como a janela "deitando" na mesa). */
  tilt?: boolean
  /** Controles extras no cabeçalho (ex.: troca de tema). */
  extra?: ReactNode
}

const EASE = [0.2, 0.8, 0.2, 1] as const

export function ScreenTour({ id, eyebrow, title, steps, render, theme, url, height = 660, dark, tilt, extra }: Props) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLElement>(null)
  const [step, setStep] = useState(0)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  useMotionValueEvent(scrollYProgress, 'change', v => setStep(Math.min(steps.length - 1, Math.max(0, Math.floor(v * steps.length * 0.999)))))
  const { scrollYProgress: enter } = useScroll({ target: ref, offset: ['start end', 'start start'] })
  const rotateX = useTransform(enter, [0, 1], [tilt ? 20 : 0, 0])
  const scale = useTransform(enter, [0, 1], [tilt ? 0.9 : 0.97, 1])
  const fill = useTransform(scrollYProgress, v => `${Math.min(100, Math.max(0, (v * steps.length - step) * 100))}%`)

  const go = (i: number) => {
    const el = ref.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY
    const span = el.offsetHeight - window.innerHeight
    window.scrollTo({ top: top + span * ((i + 0.02) / steps.length), behavior: 'smooth' })
  }

  const ink = dark ? 'var(--site-dark-text)' : 'var(--site-ink)'
  const muted = dark ? 'var(--site-dark-muted)' : 'var(--site-muted)'
  const line = dark ? 'rgba(255,255,255,.12)' : 'var(--site-line)'
  const s = steps[step]

  return (
    <section ref={ref} id={id} className={`relative ${dark ? 's-dark-grad' : ''}`} style={{ height: reduce ? 'auto' : `${steps.length * 72 + 50}vh`, color: ink }}>
      <div className={reduce ? 'py-20' : 'sticky top-0 h-[100dvh] flex flex-col pt-[92px] pb-6'}>
        <div className="s-wide w-full flex flex-col flex-1 min-h-0">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4 mb-5">
            <div className="min-w-0 flex-1">
              <Eyebrow>{eyebrow}</Eyebrow>
              <h2 className="s-serif s-h2 mt-3">{title}</h2>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {extra}
              <div className="flex items-center gap-1" role="tablist" aria-label="Capítulos">
                {steps.map((st, i) => (
                  <button key={st.label} type="button" role="tab" aria-selected={i === step} onClick={() => go(i)}
                    className="relative overflow-hidden h-9 px-3.5 rounded-full text-[13px] s-head transition-colors duration-300"
                    style={{ color: i === step ? ink : muted, background: i === step ? (dark ? 'rgba(255,255,255,.08)' : 'var(--site-card)') : 'transparent', boxShadow: i === step ? `inset 0 0 0 1px ${line}` : 'none' }}>
                    <span className="relative">{st.label}</span>
                    {i === step && !reduce && <motion.span className="absolute left-3 right-3 bottom-1 h-px origin-left" style={{ background: ink, width: fill }} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="relative h-[52px] mb-5 max-w-[1040px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={step} className="absolute inset-0"
                initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
                transition={{ duration: 0.38, ease: EASE }}>
                <p className="s-card-title">{s.title}</p>
                <p className="s-small">{s.desc}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex-1 min-h-0 flex items-start justify-center" style={{ perspective: 1800 }}>
            <motion.div className="w-full" style={{ maxWidth: reduce ? '100%' : `min(100%, calc((100dvh - 320px) * 1280 / ${height + 38}))`, rotateX: reduce ? 0 : rotateX, scale: reduce ? 1 : scale, transformOrigin: '50% 0%' }}>
              <Window theme={theme} height={height} url={url}>{render(step, scrollYProgress)}</Window>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Troca de telas com transição suave: todas montadas, só a ativa visível (sem piscar ao trocar). */
export function Crossfade({ active, children }: { active: number; children: ReactNode[] }) {
  return (
    <div className="relative flex-1 min-w-0 flex">
      {children.map((c, i) => (
        <motion.div key={i} className="absolute inset-0 flex" aria-hidden={i !== active}
          initial={false}
          animate={{ opacity: i === active ? 1 : 0, scale: i === active ? 1 : 0.985, filter: i === active ? 'blur(0px)' : 'blur(8px)' }}
          transition={{ duration: 0.55, ease: EASE }}
          style={{ pointerEvents: i === active ? 'auto' : 'none', zIndex: i === active ? 1 : 0 }}>
          {c}
        </motion.div>
      ))}
    </div>
  )
}
