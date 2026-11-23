// Número que "carrega" até o valor (preços, economia). Respeita "reduzir movimento".
import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'motion/react'

export function CountUp({ value, format, duration = 0.9 }: { value: number; format: (n: number) => string; duration?: number }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    if (reduce) { setShown(value); from.current = value; return }
    const controls = animate(from.current, value, {
      duration, ease: [0.2, 0.8, 0.2, 1],
      onUpdate: v => setShown(v),
      onComplete: () => { from.current = value },
    })
    return () => { from.current = value; controls.stop() }
  }, [value, reduce, duration])
  return <span className="tabular-nums">{format(Math.round(shown))}</span>
}
