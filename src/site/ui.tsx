// Peças do site: botões, revelar ao rolar, texto que acende, contador, acordeão, marquee e cabeçalho de seção.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView, useScroll, useTransform, useReducedMotion, AnimatePresence, type MotionValue } from 'motion/react'
import { ArrowRight, Plus } from 'lucide-react'

/** Mola do template (stiffness 451, damping 30). */
export const SPRING = { type: 'spring', stiffness: 260, damping: 30, mass: 1 } as const

export function Reveal({ children, delay = 0, y = 12, className, as = 'div' }: { children: ReactNode; delay?: number; y?: number; className?: string; as?: 'div' | 'li' | 'section' }) {
  const reduce = useReducedMotion()
  const M = motion[as]
  return (
    <M
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 'some' }}
      transition={{ duration: reduce ? 0 : 0.36, ease: [0.2, 0.8, 0.2, 1], delay: reduce ? 0 : delay }}
    >
      {children}
    </M>
  )
}

export function Btn({ to, children, variant = 'dark', arrow, className = '', onClick }: { to?: string; children: ReactNode; variant?: 'dark' | 'light' | 'white'; arrow?: boolean; className?: string; onClick?: () => void }) {
  const cls = `s-btn s-btn-${variant} ${className}`
  const inner = <>{children}{arrow && <ArrowRight size={16} className="s-arrow" aria-hidden />}</>
  if (to?.startsWith('#') || to?.startsWith('mailto:')) return <a href={to} className={cls} onClick={onClick}>{inner}</a>
  if (to) return <Link to={to} className={cls} onClick={onClick}>{inner}</Link>
  return <button type="button" className={cls} onClick={onClick}>{inner}</button>
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="s-eyebrow"><i aria-hidden />{children}</span>
}

export function SectionHead({ eyebrow, title, text, center, className = '', width = 540 }: { eyebrow?: string; title: ReactNode; text?: ReactNode; center?: boolean; className?: string; width?: number }) {
  return (
    <div className={`flex flex-col gap-4 ${center ? 'items-center text-center mx-auto' : ''} ${className}`} style={{ maxWidth: width }}>
      {eyebrow && <Reveal><Eyebrow>{eyebrow}</Eyebrow></Reveal>}
      <Reveal delay={0.05}><h2 className="s-serif s-h2">{title}</h2></Reveal>
      {text && <Reveal delay={0.1}><p className="s-body" style={{ maxWidth: Math.min(width, 490) }}>{text}</p></Reveal>}
    </div>
  )
}

/** Parágrafo grande em que cada palavra acende conforme a rolagem. */
export function ScrollRevealText({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.45'] })
  const words = text.split(' ')
  if (reduce) return <p ref={ref} className={className}>{text}</p>
  return (
    <p ref={ref} className={className} aria-label={text}>
      {words.map((w, i) => <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>{w}</Word>)}
    </p>
  )
}

function Word({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.16, 1])
  return <motion.span aria-hidden style={{ opacity }}>{children} </motion.span>
}

export function Counter({ to, suffix = '', prefix = '', decimals = 0, start }: { to: number; suffix?: string; prefix?: string; decimals?: number; start?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const seen = useInView(ref, { once: true })
  const inView = start ?? seen
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!inView) return
    let raf = 0
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 1400)
      setV(to * (1 - Math.pow(1 - t, 3)))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [inView, to])
  return <span ref={ref}>{prefix}{v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>
}

export function Accordion({ items }: { items: { q: string; a: ReactNode }[] }) {
  const [open, setOpen] = useState<number | null>(0)
  const prefix = useId()
  const reduce = useReducedMotion()
  return (
    <div className="flex flex-col gap-3">
      {items.map((it, i) => {
        const isOpen = open === i
        return (
          <div key={it.q} className="s-card overflow-hidden" style={{ borderRadius: 14 }}>
            <button type="button" id={prefix + "-q" + i} onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} aria-controls={isOpen ? prefix + "-a" + i : undefined}
              className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 s-head text-[16px] font-medium">
              {it.q}
              <motion.span animate={{ rotate: isOpen ? 45 : 0 }} transition={SPRING} className="shrink-0 grid place-items-center w-7 h-7 rounded-lg" style={{ background: 'var(--site-surface)' }}>
                <Plus size={15} aria-hidden />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div id={prefix + "-a" + i} role="region" aria-labelledby={prefix + "-q" + i} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduce ? 0 : 0.22, ease: [0.2, 0.8, 0.2, 1] }}>
                  <div className="px-5 pb-5 text-[15px] leading-relaxed" style={{ color: 'var(--site-muted)' }}>{it.a}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

export function Marquee({ children }: { children: ReactNode }) {
  return (
    <div className="s-marquee">
      <div className="s-marquee-track">{children}{children}</div>
    </div>
  )
}

export function Check({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <li className="flex items-start gap-3 text-[15px] leading-snug">
      <span className="s-check mt-[1px]" style={dark ? { background: 'rgba(255,255,255,.12)', color: '#fff' } : undefined}>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M2 6.5 4.8 9 10 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <span>{children}</span>
    </li>
  )
}

/** Título e descrição da página (SEO básico do lado do cliente). */
export function useSeo(title: string, description: string) {
  useEffect(() => {
    const prevTitle = document.title
    document.title = title
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const created = !meta
    if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta) }
    const prevDesc = meta.content
    meta.content = description
    return () => { document.title = prevTitle; if (created) meta?.remove(); else if (meta) meta.content = prevDesc }
  }, [title, description])
}

/** Tela estreita (celular). Reage quando a janela muda de tamanho. */
export function useNarrow(px = 760) {
  const query = `(max-width: ${px}px)`
  const [narrow, setNarrow] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches)
  useEffect(() => {
    const mq = matchMedia(query)
    const on = () => setNarrow(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return narrow
}
