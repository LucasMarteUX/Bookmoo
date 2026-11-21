// Seções principais da Home: hero com capas, tours do app em tamanho real (home, leitor, depois da leitura) e a estante.
import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react'
import { Coffee, Moon, Sun } from 'lucide-react'
import { Btn, Eyebrow, Reveal, SectionHead, SPRING } from '../ui'
import { COVERS, coverSrc } from '../covers'
import { Sidebar, type MockTheme } from '../app/Frame'
import { MockDashboard } from '../app/MockDashboard'
import { ScreenTour } from '../app/ScreenTour'
import { ChapterHead } from '../story/Story'

/* ---------------------------------------------------------------- Hero */

const LEFT = ['alices-adventures-in-wonderland', 'pride-and-prejudice', 'the-adventures-of-sherlock-holmes', 'dracula']
const RIGHT = ['the-wonderful-wizard-of-oz', 'treasure-island', 'the-secret-garden', 'little-women']
const SLOTS = [{ x: 10, y: 0, r: -7, w: 150 }, { x: 128, y: 168, r: 5, w: 124 }, { x: 0, y: 330, r: -3, w: 118 }, { x: 118, y: 470, r: 8, w: 104 }]

/** Capa flutuando na lateral do hero (só em telas largas, nunca atrás do texto). */
function FloatingCover({ slug, i, side, progress }: { slug: string; i: number; side: 'l' | 'r'; progress: MotionValue<number> }) {
  const reduce = useReducedMotion()
  const pos = SLOTS[i]
  const y = useTransform(progress, [0, 1], [0, -(60 + i * 50)])
  return (
    <motion.div className="absolute" style={{ [side === 'l' ? 'left' : 'right']: pos.x, top: pos.y, width: pos.w, y: reduce ? 0 : y }}
      initial={{ opacity: 0, y: 30, rotate: 0 }} animate={{ opacity: 1, y: 0, rotate: pos.r * (side === 'l' ? 1 : -1) }}
      transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1], delay: 0.45 + i * 0.08 }}>
      <motion.img src={coverSrc(slug)} alt="" draggable={false} className="w-full rounded-[6px] block"
        style={{ boxShadow: '0 30px 50px -22px rgba(60,40,20,.45), 0 8px 16px -8px rgba(60,40,20,.25)' }}
        animate={reduce ? undefined : { y: [0, -7, 0] }} transition={{ duration: 6 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }} />
    </motion.div>
  )
}

const HERO_POINTS = ['Leitura com áudio e karaokê', 'Cada palavra explicada', 'Páginas ilustradas', 'Tutores que conversam', 'Raio-X do seu inglês']

export function HeroPremium() {
  const reduce = useReducedMotion()
  const item = (d: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 24, filter: 'blur(10px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.9, ease: [0.2, 0.8, 0.2, 1] as const, delay: d },
  })
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  return (
    <section ref={ref} className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(70% 60% at 50% 0%, #FFFCF8 0%, transparent 70%)' }} />
      <div aria-hidden className="hidden xl:block absolute left-[max(24px,calc(50%-680px))] top-14 w-[280px] h-[600px]">
        {LEFT.map((c, i) => <FloatingCover key={c} slug={c} i={i} side="l" progress={scrollYProgress} />)}
      </div>
      <div aria-hidden className="hidden xl:block absolute right-[max(24px,calc(50%-680px))] top-14 w-[280px] h-[600px]">
        {RIGHT.map((c, i) => <FloatingCover key={c} slug={c} i={i} side="r" progress={scrollYProgress} />)}
      </div>
      <div className="relative s-container pt-20 md:pt-32 pb-16 md:pb-20 flex flex-col items-center text-center">
        <motion.div {...item(0.1)}><Eyebrow>Leia em inglês do seu jeito</Eyebrow></motion.div>
        <motion.h1 {...item(0.18)} className="s-serif mt-8 text-[clamp(44px,6.6vw,96px)] leading-[0.98]">
          <span className="sm:whitespace-nowrap">Aprenda inglês</span><br className="hidden sm:block" />{' '}
          <span className="sm:whitespace-nowrap">lendo as histórias</span><br className="hidden sm:block" />{' '}
          <span className="whitespace-nowrap">que você <span className="italic">ama</span>.</span>
        </motion.h1>
        <motion.p {...item(0.3)} className="mt-8 text-[18px] md:text-[20px] leading-relaxed max-w-[600px]" style={{ color: 'var(--site-muted)' }}>
          Um leitor completo de clássicos em inglês: você ouve, entende cada palavra, vê a página virar ilustração, pratica e conversa com tutores. Tudo no mesmo lugar.
        </motion.p>
        <motion.div {...item(0.4)} className="mt-10 flex flex-wrap justify-center gap-2">
          <Btn to="/signup" arrow>Começar grátis</Btn>
          <Btn to="#interface" variant="white">Ver o app por dentro</Btn>
        </motion.div>
        <motion.ul {...item(0.5)} className="mt-12 flex flex-wrap justify-center gap-x-7 gap-y-2 text-[14px]" style={{ color: 'var(--site-muted)' }}>
          {HERO_POINTS.map(t => <li key={t} className="flex items-center gap-2"><span className="w-1 h-1 rounded-full" style={{ background: 'var(--site-ink)' }} />{t}</li>)}
        </motion.ul>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- Tours (telas do app em tamanho real) */

const THEMES: { id: MockTheme; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Dia', icon: Sun }, { id: 'sepia', label: 'Tarde', icon: Coffee }, { id: 'dark', label: 'Noite', icon: Moon },
]

function ThemeSwitch({ value, onChange }: { value: MockTheme; onChange: (t: MockTheme) => void }) {
  return (
    <div role="radiogroup" aria-label="Tema do app" className="flex p-1 rounded-full" style={{ background: 'var(--site-surface)' }}>
      {THEMES.map(t => (
        <button key={t.id} type="button" role="radio" aria-checked={value === t.id} onClick={() => onChange(t.id)} className="relative flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[13px] s-head">
          {value === t.id && <motion.span layoutId="mk-theme" className="absolute inset-0 rounded-full" style={{ background: 'var(--site-card)', boxShadow: '0 1px 3px rgba(25,25,25,.1)' }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
          <t.icon size={14} className="relative" /><span className="relative">{t.label}</span>
        </button>
      ))}
    </div>
  )
}

/** Conteúdo da home rolando dentro da janela, ligado à rolagem da página. */
function DashboardScrolling({ progress, theme }: { progress: MotionValue<number>; theme: MockTheme }) {
  const box = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState(900)
  useEffect(() => {
    const measure = () => { const el = box.current?.querySelector<HTMLElement>('[data-dash-content]'); if (el) setRange(Math.max(0, el.offsetHeight - 660)) }
    measure(); const t = window.setTimeout(measure, 900); return () => window.clearTimeout(t)
  }, [])
  const raw = useTransform(progress, [0.06, 0.94], [0, -range])
  const y = useSpring(raw, { stiffness: 120, damping: 26, mass: 0.7 })
  return <div ref={box} className="flex-1 min-w-0 flex"><Sidebar active="home" /><MockDashboard scroll={y} dark={theme === 'dark'} /></div>
}

export function HomeTour() {
  const [theme, setTheme] = useState<MockTheme>('light')
  return (
    <ScreenTour id="interface" eyebrow="A interface" title={<>A home do Upoonly, <span className="italic">por inteiro</span>.</>} theme={theme} tilt
      extra={<ThemeSwitch value={theme} onChange={setTheme} />}
      steps={[
        { label: 'Continuar', title: 'Continue de onde parou', desc: 'O livro da vez abre na página exata, com o progresso e um atalho para praticar a fala.' },
        { label: 'Meta do dia', title: 'Meta, sequência e pontos', desc: 'Minutos lidos hoje, dias seguidos, pontos e palavras aprendidas, sempre à vista.' },
        { label: 'Tutores', title: 'Tutores a um toque', desc: 'Bia, Luck, Yuno e Yuri esperam por você para conversar em inglês.' },
        { label: 'Estante', title: 'Prática do dia e sua estante', desc: 'Revisão, fala e ditado prontos para hoje, e todos os seus livros com o progresso de cada um.' },
      ]}
      render={(_s, p) => <DashboardScrolling progress={p} theme={theme} />} />
  )
}

/* ---------------------------------------------------------------- Estante */

function ShelfRow({ list, reverse, speed }: { list: typeof COVERS; reverse?: boolean; speed: number }) {
  return (
    <div className="s-marquee">
      <div className="s-marquee-track !gap-5 py-4" style={{ animationDuration: `${speed}s`, animationDirection: reverse ? 'reverse' : 'normal' }}>
        {[...list, ...list].map((c, i) => (
          <figure key={c.slug + i} className="w-[150px] md:w-[170px] shrink-0 group">
            <div className="relative rounded-[6px] overflow-hidden transition-transform duration-500 group-hover:-translate-y-2 group-hover:rotate-[-1deg]" style={{ boxShadow: '0 24px 40px -22px rgba(60,40,20,.6), 0 2px 6px -2px rgba(60,40,20,.2)' }}>
              <img src={coverSrc(c.slug)} alt={`Capa de ${c.title}`} className="w-full aspect-[2/3] object-cover block" loading="lazy" />
              <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10.5px] s-head font-medium bg-white/90">{c.level}</span>
            </div>
            <figcaption className="mt-3 px-0.5">
              <p className="s-head text-[13.5px] font-medium leading-tight truncate">{c.title}</p>
              <p className="text-[12px] truncate" style={{ color: 'var(--site-muted)' }}>{c.author}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

export function LibraryWall({ head = true }: { head?: boolean } = {}) {
  const a = COVERS.slice(0, 14), b = COVERS.slice(14, 27), c = COVERS.slice(27)
  return (
    <section id="biblioteca" className="pt-8 pb-10 md:pt-12 overflow-hidden scroll-mt-24">
      {head && <div className="px-5 mb-14 md:mb-16">
        <ChapterHead kicker="Biblioteca" title={<>Mais de 100 clássicos, <i>prontos para ler</i>.</>}
          text="Contos de fadas para quem está começando, Sherlock e Austen para quem quer ir longe. Cada livro com capa nova e nível indicado, do A1 ao C2." />
      </div>}
      <div className="flex flex-col gap-2">
        <ShelfRow list={a} speed={70} />
        <ShelfRow list={b} speed={80} reverse />
        <ShelfRow list={c} speed={64} />
      </div>
      <Reveal className="mt-12 s-container flex flex-wrap justify-center gap-3">
        <Btn to="/biblioteca" variant="white" arrow>Ver a biblioteca</Btn>
      </Reveal>
    </section>
  )
}

