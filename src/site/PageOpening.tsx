// Abertura das páginas internas no padrão da home: rótulo em caixa alta, título serifado grande à esquerda,
// texto e ações à direita, e a imagem (quando há) em largura cheia logo abaixo, como a seção "No computador".
import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

const EASE = [0.2, 0.8, 0.2, 1] as const

export function PageOpening({ kicker, title, text, actions, children }: { kicker: string; title: ReactNode; text: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  const reduce = useReducedMotion()
  const a = (d: number) => ({ initial: reduce ? { opacity: 0 } : { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.9, ease: EASE, delay: d } })
  return (
    <section className="page-opening" data-media={children ? 'y' : undefined}>
      <div className="page-opening-head">
        <div>
          <motion.p {...a(0.05)} className="journey-label">{kicker}</motion.p>
          <motion.h1 {...a(0.12)} className="journey-title">{title}</motion.h1>
        </div>
        <motion.div {...a(0.22)} className="page-opening-side">
          <p>{text}</p>
          {actions && <div className="chapter-options">{actions}</div>}
        </motion.div>
      </div>
      {children && <motion.div className="page-opening-media" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, ease: EASE, delay: 0.35 }}>{children}</motion.div>}
    </section>
  )
}
