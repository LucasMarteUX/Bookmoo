import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react'
import { Award, Check, Heart, MessageCircle, Mic, Pause, RotateCcw, Sparkles, Star, Volume2 } from 'lucide-react'
import { coverSrc } from './covers'
import { tutorAvatar } from './content'

const EASE = [0.2, 0.8, 0.2, 1] as const
const SHADOW = '0 0 0 1px var(--site-line), 0 4px 12px -6px rgba(25,25,25,.16)'
const ui = { fontFamily: '"Inter Variable", Inter, system-ui, sans-serif', color: '#15171C' } as const
const display = { fontFamily: '"Literata Variable", Literata, Georgia, serif', letterSpacing: '-0.015em' } as const
const muted = '#636874'
const G = { bg: '#E3F1E7', fg: '#2D6040' }, A = { bg: '#FBEEDB', fg: '#7A5121' }, R = { bg: '#F8E4E1', fg: '#8A3C33' }, S = { bg: '#F1EDE4', fg: '#5A5040' }

/** Cartão de interface usado nas amostras do produto. */
export function UiCard({ children, className = '', style, float = true, delay = 0 }: { children: ReactNode; className?: string; style?: React.CSSProperties; float?: boolean; delay?: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.div className={`rounded-xl ${className}`} style={{ ...ui, backgroundColor: 'var(--site-card)', boxShadow: SHADOW, ...style }}
      initial={reduce ? false : { opacity: 0.6, y: float ? 8 : 0 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.32, ease: EASE, delay }}>
      {children}
    </motion.div>
  )
}

function useLoop(n: number, ms: number) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.3 })
  const reduce = useReducedMotion()
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!inView || reduce) return
    const t = window.setInterval(() => setI(v => (v + 1) % n), ms)
    return () => window.clearInterval(t)
  }, [inView, reduce, n, ms])
  return { ref, i }
}

/* ---------------------------------------------------------------- Leitura com karaokê */

const LINE = 'Once upon a time there were four little Rabbits, and their names were Flopsy, Mopsy, Cottontail, and Peter.'.split(' ')

export function VReader() {
  const { ref, i } = useLoop(LINE.length + 4, 300)
  return (
    <div ref={ref} className="w-[420px]">
      <UiCard className="p-6">
        <p className="text-[11px] tracking-[.1em]" style={{ color: muted }}>THE TALE OF PETER RABBIT</p>
        <p className="text-[19px] leading-[1.7] mt-3" style={{ fontFamily: '"Literata Variable", Literata, Georgia, serif' }}>
          {LINE.map((w, k) => <span key={k}><span className="rounded-[4px] px-[2px] -mx-[2px] transition-colors duration-200" style={k === i ? { background: '#15171C', color: '#fff' } : k < i ? undefined : { color: '#A5A9B2' }}>{w}</span> </span>)}
        </p>
        <div className="mt-5 flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: '#F3F4F6' }}>
          <img src={tutorAvatar('bia')} alt="" className="w-7 h-7 rounded-full" style={{ background: 'var(--site-surface)' }} />
          <span className="w-7 h-7 rounded-full grid place-items-center text-white" style={{ background: '#15171C' }}><Pause size={12} /></span>
          <div className="flex-1 h-1 rounded-full" style={{ background: '#E3E6EB' }}><div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.min(100, (i / LINE.length) * 100)}%`, background: '#15171C' }} /></div>
          <span className="text-[11.5px] tabular-nums" style={{ color: muted }}>0,9×</span>
        </div>
      </UiCard>
    </div>
  )
}

/* ---------------------------------------------------------------- Palavra */

export function VWord() {
  return (
    <div className="relative w-[420px]">
      <UiCard className="p-6" float={false}>
        <p className="text-[18px] leading-[1.7]" style={{ fontFamily: '"Literata Variable", Literata, Georgia, serif', color: '#A5A9B2' }}>
          …once or twice she had <span className="rounded px-0.5" style={{ background: '#F5C451', color: '#15171C', boxShadow: '0 0 0 2px #B07B12' }}>peeped</span> into the book her sister was reading…
        </p>
      </UiCard>
      <UiCard className="p-4 absolute left-[18%] right-[-6%] top-[78%]" delay={0.2}>
        <div className="flex items-baseline gap-2"><span className="text-[24px]" style={display}>peeped</span><span className="text-[12px]" style={{ color: muted }}>/piːpt/</span><Volume2 size={14} className="ml-auto" style={{ color: muted }} /></div>
        <p className="text-[13px] mt-1 leading-snug"><b className="font-semibold">espiou</b><span style={{ color: muted }}> · deu uma olhadinha rápida e meio escondida.</span></p>
        <div className="flex gap-1.5 mt-3 text-[11.5px] font-medium">
          <span className="px-2.5 h-7 rounded-lg flex items-center gap-1" style={{ background: G.bg, color: G.fg }}><Check size={11} />Aprendi</span>
          <span className="px-2.5 h-7 rounded-lg flex items-center gap-1" style={{ background: A.bg, color: A.fg, boxShadow: `inset 0 0 0 1.5px ${A.fg}` }}><RotateCcw size={11} />Revisar</span>
          <span className="px-2.5 h-7 rounded-lg flex items-center gap-1" style={{ background: S.bg, color: S.fg }}><Star size={11} />Importante</span>
        </div>
      </UiCard>
    </div>
  )
}

/* ---------------------------------------------------------------- Capas em leque */

export function VCovers({ slugs = ['the-secret-garden', 'alices-adventures-in-wonderland', 'pride-and-prejudice', 'treasure-island', 'the-wonderful-wizard-of-oz'] }: { slugs?: string[] }) {
  const lv = ['B1', 'B2', 'C1', 'B2', 'A2']
  return (
    <div className="relative h-[230px] w-[420px]">
      {slugs.map((s, i) => {
        const off = i - (slugs.length - 1) / 2
        return (
          <motion.div key={s} className="absolute left-1/2 bottom-0 w-[118px]" style={{ marginLeft: -59, zIndex: 10 - Math.abs(off) }}
            initial={{ opacity: 0, y: 30, rotate: 0, x: 0 }} whileInView={{ opacity: 1, y: Math.abs(off) * 12, rotate: off * 8, x: off * 66 }} viewport={{ once: true }}
            whileHover={{ y: Math.abs(off) * 12 - 10 }} transition={{ duration: 1, ease: EASE, delay: 0.08 * Math.abs(off) }}>
            <img src={coverSrc(s)} alt="" className="w-full rounded-[5px] block" style={{ boxShadow: '0 18px 30px -14px rgba(60,30,10,.5)' }} />
            <span className="absolute top-1.5 left-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/95" style={ui}>{lv[i]}</span>
          </motion.div>
        )
      })}
    </div>
  )
}

/* ---------------------------------------------------------------- Tutor conversando */

export function VTutorChat({ tutor = 'bia', lines = ['Why do you think Alice was bored?', 'Because the book had no pictures.', 'Exactly! Just “pictures”, plural. 👏'] }: { tutor?: string; lines?: string[] }) {
  return (
    <div className="w-[400px] flex flex-col gap-2.5" style={ui}>
      {lines.map((t, k) => {
        const me = k % 2 === 1
        return (
          <motion.div key={k} className={`flex items-end gap-2 ${me ? 'justify-end' : ''}`} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: EASE, delay: 0.25 + k * 0.45 }}>
            {!me && <img src={tutorAvatar(tutor)} alt="" className="w-8 h-8 rounded-full shrink-0" style={{ background: 'var(--site-surface)', boxShadow: '0 0 0 2px #fff' }} />}
            <div className="rounded-2xl px-4 py-2.5 text-[14px] leading-snug max-w-[80%]" style={me ? { background: '#15171C', color: '#fff', borderBottomRightRadius: 6, boxShadow: SHADOW } : { background: '#fff', borderBottomLeftRadius: 6, boxShadow: SHADOW }}>{t}</div>
          </motion.div>
        )
      })}
      <motion.div className="mt-2 self-center flex items-center gap-2 h-10 px-4 rounded-full text-[13px] font-medium" style={{ background: '#fff', boxShadow: SHADOW }}
        initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 1.8 }}>
        <span className="relative flex w-2 h-2"><span className="absolute inset-0 rounded-full animate-ping bg-[#3AC77A] opacity-60" /><span className="relative w-2 h-2 rounded-full bg-[#3AC77A]" /></span><Mic size={14} />Ouvindo você…
      </motion.div>
    </div>
  )
}

/* ---------------------------------------------------------------- Vocabulário */

export function VVocab() {
  const rows: [string, string, typeof G][] = [['peeped', 'espiou', A], ['sandbank', 'banco de areia', G], ['mischief', 'travessura', S], ['wretched', 'miserável', G]]
  return (
    <UiCard className="w-[400px] p-2">
      {rows.map(([w, d, c], i) => (
        <div key={w} className="flex items-center gap-3 px-4 py-3" style={i ? { borderTop: '1px solid #EEF0F3' } : undefined}>
          <div className="flex-1"><p className="text-[17px]" style={display}>{w}</p><p className="text-[12.5px]" style={{ color: muted }}>{d}</p></div>
          <span className="text-[11px] font-medium px-2 py-1 rounded-md" style={{ background: c.bg, color: c.fg }}>{c === A ? 'Revisar' : c === G ? 'Aprendido' : 'Importante'}</span>
        </div>
      ))}
      <div className="m-2 h-10 rounded-xl grid place-items-center text-[13px] font-medium text-white" style={{ background: '#15171C' }}>Revisar agora · 18</div>
    </UiCard>
  )
}

/* ---------------------------------------------------------------- Níveis */

export function VLevels({ current = 2 }: { current?: number }) {
  const lv = [['A1', 'Iniciante'], ['A2', 'Básico'], ['B1', 'Intermediário'], ['B2', 'Independente'], ['C1', 'Avançado'], ['C2', 'Proficiente']]
  return (
    <div className="w-[440px] flex items-end gap-2" style={ui}>
      {lv.map(([c, n], i) => (
        <motion.div key={c} className="flex-1 rounded-xl p-2.5 flex flex-col justify-end" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE, delay: i * 0.06 }}
          style={{ height: 70 + i * 22, background: i === current ? '#15171C' : '#fff', color: i === current ? '#fff' : '#15171C', boxShadow: SHADOW }}>
          <span className="text-[19px] leading-none" style={display}>{c}</span><span className="text-[9.5px] mt-1 opacity-70">{n}</span>
        </motion.div>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- Página ilustrada + estilos */

export function VComic() {
  const styles = [['aquarela-nanquim', 'Aquarela'], ['manga-tradicional', 'Mangá'], ['hq-europeia', 'HQ europeia'], ['noir-misterio', 'Noir']]
  const { ref, i } = useLoop(styles.length, 2200)
  return (
    <div ref={ref} className="relative w-[460px]">
      <UiCard className="p-2.5" float={false}>
        <div className="relative rounded-xl overflow-hidden aspect-[4/3]">
          <img src="/site/reader/peter-rabbit-page.webp" alt="Página ilustrada de Peter Rabbit" className="absolute inset-0 w-full h-full object-cover object-top" />
          <div className="absolute left-3 top-3 max-w-[64%] rounded-[3px] px-3 py-2 text-[12px] leading-snug font-semibold" style={{ background: '#FBF3D5', color: '#1d1a14', boxShadow: '0 0 0 1.5px #2b261c' }}>
            Once upon a time there were four little Rabbits…
          </div>
        </div>
      </UiCard>
      <UiCard className="absolute -right-6 -bottom-8 p-2 w-[170px]" delay={0.2}>
        <p className="text-[11px] px-1.5 pt-1 pb-1.5 flex items-center gap-1" style={{ color: muted }}><Sparkles size={11} />Estilo</p>
        {styles.map(([id, n], k) => (
          <div key={id} className="flex items-center gap-2 px-1.5 py-1.5 rounded-lg text-[12.5px] transition-colors duration-300" style={k === i ? { background: '#15171C', color: '#fff' } : undefined}>
            <img src={`/styles/${id}.webp`} alt="" className="w-6 h-6 rounded-md object-cover" />{n}
          </div>
        ))}
      </UiCard>
    </div>
  )
}

/* ---------------------------------------------------------------- Falar */

const SAY: [string, typeof G | null][] = [['Once', G], ['upon', G], ['a', G], ['time', G], ['there', G], ['were', A], ['four', G], ['little', G], ['Rabbits,', G], ['Flopsy,', G], ['Mopsy,', R], ['and', null], ['Peter.', G]]

export function VSpeak() {
  const { ref, i } = useLoop(SAY.length + 6, 260)
  const n = Math.min(i, SAY.length)
  return (
    <div ref={ref} className="w-[420px]">
      <UiCard className="p-6">
        <p className="text-[11px] tracking-[.1em]" style={{ color: muted }}>LEIA EM VOZ ALTA</p>
        <p className="text-[19px] leading-[1.75] mt-3" style={{ fontFamily: '"Literata Variable", Literata, Georgia, serif' }}>
          {SAY.map(([w, c], k) => <span key={k}><span className="rounded-[5px] px-[3px] -mx-[3px] transition-all duration-200" style={k >= n ? { color: '#A5A9B2' } : c ? { background: c.bg, color: c.fg } : { textDecoration: 'line-through', color: '#A5A9B2' }}>{w}</span> </span>)}
        </p>
        <div className="mt-5 flex items-center gap-4">
          <span className="w-11 h-11 rounded-full grid place-items-center text-white" style={{ background: '#15171C' }}><Mic size={18} /></span>
          <div className="flex items-end gap-[3px] h-7">{Array.from({ length: 22 }, (_, k) => <motion.span key={k} className="w-[3px] rounded-full bg-[#15171C]/60" animate={{ height: [4, 8 + ((k * 37) % 18), 5] }} transition={{ duration: 0.7, repeat: Infinity, repeatType: 'mirror', delay: (k % 6) * 0.07 }} />)}</div>
          <span className="ml-auto text-[28px] font-semibold tabular-nums">{n ? Math.round((SAY.slice(0, n).filter(([, c]) => c === G).length / n) * 100) : 0}<span className="text-[14px]">%</span></span>
        </div>
      </UiCard>
    </div>
  )
}

/* ---------------------------------------------------------------- Raio-X */

export function VRaioX() {
  const ref = useRef<HTMLDivElement>(null)
  const on = useInView(ref, { once: true, amount: 0.4 })
  const bars: [string, number][] = [['Fala', 81], ['Conversa', 74], ['Vocabulário', 68], ['Ditado', 59], ['Constância', 90]]
  return (
    <div ref={ref} className="w-[400px]">
      <UiCard className="p-6">
        <p className="text-[11px] tracking-[.1em]" style={{ color: muted }}>RAIO-X · ESTA SEMANA</p>
        <p className="mt-2"><span className="text-[46px] font-semibold leading-none">74</span><span style={{ color: muted }}> / 100</span><span className="ml-2 text-[11.5px] px-2 py-0.5 rounded-md align-middle" style={{ background: G.bg, color: G.fg }}>+8</span></p>
        <div className="mt-4 flex flex-col gap-2.5">
          {bars.map(([l, v], k) => (
            <div key={l} className="grid grid-cols-[86px_1fr_26px] items-center gap-3 text-[12.5px]"><span>{l}</span>
              <div className="h-1.5 rounded-full" style={{ background: '#EEF0F4' }}><motion.div className="h-full rounded-full bg-[#15171C]" initial={{ width: 0 }} animate={{ width: on ? `${v}%` : 0 }} transition={{ duration: 1.2, ease: EASE, delay: 0.2 + k * 0.08 }} /></div>
              <span className="text-right tabular-nums">{v}</span></div>
          ))}
        </div>
      </UiCard>
    </div>
  )
}

/* ---------------------------------------------------------------- Prova */

export function VProva() {
  const rows: [string, number][] = [['Reading', 4.5], ['Listening', 4], ['Writing', 3.5], ['Speaking', 4]]
  return (
    <UiCard className="w-[380px] p-6">
      <div className="flex items-center gap-4">
        <svg width="78" height="48" viewBox="0 0 96 60" aria-hidden><path d="M8 54 A40 40 0 0 1 88 54" fill="none" stroke="#EEF0F4" strokeWidth="9" strokeLinecap="round" /><path d="M8 54 A40 40 0 0 1 78 28" fill="none" stroke="#15171C" strokeWidth="9" strokeLinecap="round" /></svg>
        <div><p className="text-[11.5px]" style={{ color: muted }}>Faixa geral</p><p className="text-[30px] font-semibold leading-none">4,0</p></div>
        <span className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-semibold" style={{ boxShadow: 'inset 0 0 0 1px #E3E6EB' }}><Award size={12} />B2</span>
      </div>
      {rows.map(([l, v]) => (
        <div key={l} className="mt-3 text-[12.5px]"><div className="flex justify-between"><span>{l}</span><span>{String(v).replace('.', ',')}</span></div><div className="h-1.5 rounded-full mt-1" style={{ background: '#EEF0F4' }}><div className="h-full rounded-full bg-[#15171C]" style={{ width: `${(v / 6) * 100}%` }} /></div></div>
      ))}
    </UiCard>
  )
}

/* ---------------------------------------------------------------- Comunidade */

export function VPost() {
  return (
    <UiCard className="w-[400px] p-5">
      <div className="flex items-center gap-3"><span className="w-9 h-9 rounded-full grid place-items-center text-[12px] font-semibold" style={{ background: '#E9D7C5', color: '#5A3A1F' }}>AL</span><div><p className="text-[13.5px] font-medium">Ana Lima</p><p className="text-[11.5px]" style={{ color: muted }}>há 2 h · Momento de leitura</p></div></div>
      <p className="text-[14px] leading-relaxed mt-3">Terminei o primeiro capítulo de Pride and Prejudice sem traduzir nenhuma frase inteira 😍</p>
      <div className="mt-3 rounded-xl p-2.5 flex items-center gap-3" style={{ background: '#F3F4F6' }}><img src={coverSrc('pride-and-prejudice')} alt="" className="w-9 rounded" /><div className="text-[12px]"><p className="font-medium">Pride and Prejudice</p><p style={{ color: muted }}>Jane Austen · C1</p></div></div>
      <div className="flex gap-4 mt-3 text-[12px]" style={{ color: muted }}><span className="flex items-center gap-1"><Heart size={13} />48</span><span className="flex items-center gap-1"><MessageCircle size={13} />12</span></div>
    </UiCard>
  )
}

/* ---------------------------------------------------------------- Ditado */

export function VDictation() {
  return (
    <UiCard className="w-[420px] p-6">
      <p className="text-[11px] tracking-[.1em]" style={{ color: muted }}>DITADO · FRASE 4 DE 9</p>
      <p className="text-[18px] leading-[2] mt-3" style={{ fontFamily: '"Literata Variable", Literata, Georgia, serif' }}>
        Peter was most <span className="relative inline-block"><span className="absolute -top-3.5 left-0 text-[11px] line-through" style={{ ...ui, color: R.fg }}>dredfully</span><span className="rounded px-1" style={{ background: G.bg, color: G.fg }}>dreadfully</span></span> frightened; he <span className="relative inline-block"><span className="absolute -top-3.5 left-0 text-[11px] line-through" style={{ ...ui, color: R.fg }}>rushd</span><span className="rounded px-1" style={{ background: G.bg, color: G.fg }}>rushed</span></span> all over the garden.
      </p>
      <div className="mt-4 flex items-center justify-between text-[12.5px]"><span style={{ color: muted }}>Nota da página</span><span className="text-[22px] font-semibold">8,2</span></div>
    </UiCard>
  )
}

/* ---------------------------------------------------------------- Abas que se revezam (hero) */

export function useAutoTabs(n: number, ms = 4200) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const t = window.setTimeout(() => setI(v => (v + 1) % n), ms)
    return () => window.clearTimeout(t)
  }, [i, paused, n, ms])
  return { i, setI, setPaused }
}

export function Swap({ k, children }: { k: string | number; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div key={k} className="w-full flex justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
