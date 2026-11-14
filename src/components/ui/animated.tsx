// Animações de entrada para números e barras (estatísticas): os números contam do zero até o valor
// e as barras crescem, com um leve escalonamento. Respeita "reduzir movimento".
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'

const ease = (t: number) => 1 - Math.pow(1 - t, 3)
const NUM = /\d+(?:[.,]\d+)*/g

/** Anima todos os números de um texto ("1h 20min", "1.234", "87%") a partir de zero. */
export function AnimatedValue({ value, duration = 900, delay = 0 }: { value: string | number; duration?: number; delay?: number }) {
  const reduce = useReducedMotion()
  const text = String(value)
  const [shown, setShown] = useState(() => (reduce ? text : text.replace(NUM, '0')))
  const from = useRef<string | null>(null)
  useEffect(() => {
    if (reduce) { setShown(text); return }
    const parts = text.match(NUM) ?? []
    if (!parts.length) { setShown(text); return }
    const sep = (m: string) => (m.includes('.') && m.includes(',') ? { thousands: m.indexOf('.') < m.indexOf(',') ? '.' : ',', decimal: m.indexOf('.') < m.indexOf(',') ? ',' : '.' } : null)
    const targets = parts.map(m => {
      const s = sep(m)
      const decimals = s ? (m.split(s.decimal)[1]?.length ?? 0) : /[.,]\d{1,2}$/.test(m) && !/[.,]\d{3}$/.test(m) ? m.split(/[.,]/).pop()!.length : 0
      const dec = s?.decimal ?? (decimals ? m[m.length - decimals - 1] : '')
      const thousands = s?.thousands ?? (!decimals && /[.,]/.test(m) ? m.replace(/\d/g, '')[0] : '')
      const n = Number(m.split(thousands || '\u0000').join('').replace(dec || '\u0000', '.'))
      return { n: Number.isFinite(n) ? n : 0, decimals, dec, thousands }
    })
    const format = (x: number, t: (typeof targets)[number]) => {
      const fixed = x.toFixed(t.decimals)
      const [int, frac] = fixed.split('.')
      const grouped = t.thousands ? int.replace(/\B(?=(\d{3})+(?!\d))/g, t.thousands) : int
      return frac ? `${grouped}${t.dec}${frac}` : grouped
    }
    let raf = 0
    let start = 0
    const wait = window.setTimeout(() => {
      const tick = (now: number) => {
        if (!start) start = now
        const k = ease(Math.min(1, (now - start) / duration))
        let i = 0
        setShown(text.replace(NUM, () => { const t = targets[i++]; return format(t.n * k, t) }))
        if (k < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, from.current === null ? delay : 0)
    from.current = text
    return () => { window.clearTimeout(wait); cancelAnimationFrame(raf) }
  }, [text, duration, delay, reduce])
  return <>{shown}</>
}

/** Barra que cresce ao aparecer (largura ou altura em %). */
export function GrowBar({ size, axis = 'x', delay = 0, className, style, title }: {
  size: number | string; axis?: 'x' | 'y'; delay?: number; className?: string; style?: CSSProperties; title?: string
}) {
  const reduce = useReducedMotion()
  const target = typeof size === 'number' ? `${size}%` : size
  const prop = axis === 'x' ? 'width' : 'height'
  return (
    <motion.div className={className} title={title} style={style}
      initial={reduce ? false : { [prop]: '0%' }} animate={{ [prop]: target }}
      transition={{ duration: 0.8, delay: reduce ? 0 : delay, ease: [0.22, 1, 0.36, 1] }} />
  )
}
