// Confete leve (só transform/opacity), respeita "reduzir movimento".
import { useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'

const COLORS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#a855f7', '#ec4899']

export function Confetti({ pieces = 60 }: { pieces?: number }) {
  const reduce = useReducedMotion()
  const items = useMemo(() => Array.from({ length: pieces }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 900,
    y: 300 + Math.random() * 500,
    r: Math.random() * 720 - 360,
    delay: Math.random() * 0.25,
    size: 6 + Math.random() * 7,
    color: COLORS[i % COLORS.length],
    round: Math.random() > 0.6,
  })), [pieces])
  if (reduce) return null
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
      {items.map(p => (
        <motion.span key={p.id} className="absolute left-1/2 top-1/3"
          style={{ width: p.size, height: p.round ? p.size : p.size * 0.45, backgroundColor: p.color, borderRadius: p.round ? 999 : 2 }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: p.x, y: p.y, rotate: p.r, opacity: 0 }}
          transition={{ duration: 1.8 + Math.random(), delay: p.delay, ease: [0.2, 0.6, 0.4, 1] }} />
      ))}
    </div>
  )
}
