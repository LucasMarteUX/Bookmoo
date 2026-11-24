// Home como história visual (referência: claude.com/product/overview). Nada toca e nada pede para operar:
// só representação, movimento suave e frases curtas. Cada capítulo leva à página da função.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { ArrowRight, Check, RotateCcw, Star, Volume2 } from 'lucide-react'
import { COVERS, coverSrc } from '../covers'
import { TUTORS, tutorImg } from '../content'
import { BreathingTutor, LiveTutor } from '../LiveTutor'
import { Btn } from '../ui'
import './story.css'

const EASE = [0.2, 0.8, 0.2, 1] as const

/* ================================================================ Hero: campo de capas em movimento */

const FIELD = COVERS.filter(c => c.slug !== 'edgar-allan-poe')

function Column({ items, speed, offset, reverse }: { items: typeof COVERS; speed: number; offset: number; reverse?: boolean }) {
  return (
    <div className="st-col" style={{ marginTop: offset }}>
      <div className="st-col-track" style={{ animationDuration: `${speed}s`, animationDirection: reverse ? 'reverse' : 'normal' }}>
        {[...items, ...items].map((c, i) => (
          <figure key={c.slug + i} className="st-tile">
            <img src={coverSrc(c.slug)} alt="" draggable={false} loading={i < 4 ? 'eager' : 'lazy'} />
          </figure>
        ))}
      </div>
    </div>
  )
}

export function HeroField() {
  const reduce = useReducedMotion()
  const cols = 8
  const per = Math.ceil(FIELD.length / cols)
  const columns = Array.from({ length: cols }, (_, k) => FIELD.slice(k * per, k * per + per).concat(FIELD.slice(0, Math.max(0, per - FIELD.slice(k * per, k * per + per).length))))
  const a = (d: number) => ({ initial: reduce ? { opacity: 0 } : { opacity: 0, y: 18, filter: 'blur(8px)' }, animate: { opacity: 1, y: 0, filter: 'blur(0px)' }, transition: { duration: 1.1, ease: EASE, delay: d } })
  return (
    <section className="st-hero">
      <motion.div className="st-field" aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.6, ease: EASE }}>
        {columns.map((items, k) => <Column key={k} items={items} speed={70 + (k % 3) * 14} offset={[-40, 120, 10, 200, -90, 150, 40, 90][k]} reverse={k % 2 === 1} />)}
      </motion.div>
      <div className="st-hero-veil" aria-hidden />
      <div className="st-hero-copy">
        <motion.p {...a(0.15)} className="st-kicker">Leia em inglês do seu jeito</motion.p>
        <motion.h1 {...a(0.25)} className="st-display">
          <span>Aprenda inglês lendo</span> <span>as histórias que</span> <span>você <i>ama</i>.</span>
        </motion.h1>
        <motion.p {...a(0.38)} className="st-lead">Clássicos com áudio, cada palavra explicada, páginas que viram ilustração e tutores para conversar. Um livro de presente para começar.</motion.p>
        <motion.div {...a(0.48)} className="st-actions">
          <Btn to="/signup" arrow>Começar grátis</Btn>
          <Btn to="/recursos" variant="white">Conhecer o Upoonly</Btn>
        </motion.div>
      </div>
    </section>
  )
}

/* ================================================================ Peças comuns */

export function Kicker({ children }: { children: ReactNode }) { return <p className="st-kicker">{children}</p> }

function In({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div className={className} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, filter: 'blur(6px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-10%' }} transition={{ duration: 1, ease: EASE, delay }}>
      {children}
    </motion.div>
  )
}

/** Abertura de capítulo, centralizada, com frase de impacto. */
export function ChapterHead({ kicker, title, text, to, cta }: { kicker: string; title: ReactNode; text: ReactNode; to?: string; cta?: string }) {
  return (
    <div className="st-head">
      <In><Kicker>{kicker}</Kicker></In>
      <In delay={0.05}><h2 className="st-title">{title}</h2></In>
      <In delay={0.1}><p className="st-text">{text}</p></In>
      {to && <In delay={0.15}><Link to={to} className="st-link">{cta ?? 'Saiba mais'}<ArrowRight size={16} /></Link></In>}
    </div>
  )
}

/* ================================================================ Visual: a página que ensina */

export function ReaderVisual() {
  return (
    <div className="st-reader">
      <motion.div className="st-page" initial={{ opacity: 0, y: 40, rotate: -1.5 }} whileInView={{ opacity: 1, y: 0, rotate: -1.5 }} viewport={{ once: true, margin: '-10%' }} transition={{ duration: 1.2, ease: EASE }}>
        <img src="/site/reader/peter-rabbit-page.webp" alt="Página ilustrada de The Tale of Peter Rabbit no Upoonly" />
        <div className="st-caption" lang="en">Once upon a time there were four little <mark>Rabbits</mark>, and their names were Flopsy, Mopsy, Cotton-tail, and Peter.</div>
      </motion.div>
      <motion.div className="st-word" initial={{ opacity: 0, y: 30, scale: 0.96 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: '-10%' }} transition={{ duration: 1, ease: EASE, delay: 0.45 }}>
        <div className="st-word-top"><span lang="en">Rabbits</span><Volume2 size={15} /></div>
        <p className="st-word-ipa">/ˈræb.ɪts/ · substantivo, plural</p>
        <p className="st-word-def"><b>coelhos.</b> A narradora apresenta os quatro filhotes da família.</p>
        <div className="st-word-chips"><span data-k="g"><Check size={12} />Aprendi</span><span data-k="a"><RotateCcw size={12} />Revisar</span><span data-k="s"><Star size={12} />Importante</span></div>
      </motion.div>
      <motion.div className="st-voice" initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-10%' }} transition={{ duration: 1, ease: EASE, delay: 0.7 }}>
        <span className="st-wave">{[5, 11, 7, 14, 9, 12, 6, 10, 4].map((h, i) => <i key={i} style={{ height: h, animationDelay: `${i * 0.09}s` }} />)}</span>
        Narração com karaokê
      </motion.div>
    </div>
  )
}

/* ================================================================ Visual: estilos de ilustração */

const STYLE_FAN = [['aquarela-nanquim', 'Aquarela'], ['manga-tradicional', 'Mangá'], ['fantasia-epica', 'Fantasia épica'], ['hq-europeia', 'HQ europeia'], ['noir-misterio', 'Noir']]

export function StylesVisual() {
  return (
    <div className="st-fan">
      {STYLE_FAN.map(([id, name], i) => {
        const off = i - 2
        return (
          <motion.figure key={id} style={{ zIndex: 10 - Math.abs(off) }}
            initial={{ opacity: 0, y: 60, rotate: 0, x: 0 }} whileInView={{ opacity: 1, y: Math.abs(off) * 18, rotate: off * 7, x: `${off * 62}%` }}
            viewport={{ once: true, margin: '-10%' }} transition={{ duration: 1.2, ease: EASE, delay: 0.08 * Math.abs(off) }}>
            <img src={`/styles/${id}.webp`} alt={`Página no estilo ${name}`} />
            <figcaption>{name}</figcaption>
          </motion.figure>
        )
      })}
    </div>
  )
}

/* ================================================================ Tutores: um de cada vez, trocando com a rolagem */

export function TutorScroll() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const [i, setI] = useState(0)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const stageVisible = useInView(ref, { margin: '350px 0px' })
  const portraitScale = useTransform(scrollYProgress, [0, .5, 1], [.94, 1, 1.04])
  // No celular os tutores ficam empilhados e se trocam pelo sumário; o scroll fixo só no computador.
  const [compact, setCompact] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(max-width: 768px)').matches)
  useEffect(() => {
    const mq = matchMedia('(max-width: 768px)')
    const on = () => setCompact(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const pinned = !reduce && !compact
  useMotionValueEvent(scrollYProgress, 'change', v => pinned && setI(Math.min(TUTORS.length - 1, Math.max(0, Math.floor(v * TUTORS.length * 0.999)))))
  function selectTutor(index: number) {
    const section = ref.current
    if (pinned && section) {
      const top = window.scrollY + section.getBoundingClientRect().top
      window.scrollTo({top: top + (section.offsetHeight - window.innerHeight) * (index + .5) / TUTORS.length, behavior: 'instant'})
    }
    setI(index)
  }
  const t = TUTORS[i]
  // Tutor que o palco animado vai carregar: só muda quando a rolagem para por um instante.
  const [settled, setSettled] = useState(t.id)
  useEffect(() => {
    const d = window.setTimeout(() => setSettled(t.id), 260)
    return () => window.clearTimeout(d)
  }, [t.id])
  return (
    <section ref={ref} className="st-tutors" data-pinned={pinned} style={{ height: pinned ? `${TUTORS.length * 90 + 40}vh` : 'auto' }}>
      <div className="st-tutors-pin">
        <div className="st-tutors-grid">
          <figure className="st-tutor-plate">
            <div className="st-tutor-stage" style={{ background: t.tint }}>
              {stageVisible && <motion.div className="absolute inset-0" style={pinned ? { scale: portraitScale } : undefined}>
                {/* O retrato pintado acompanha a rolagem na hora; o tutor animado entra por cima quando
                    o personagem do momento termina de carregar (e some se a pessoa já passou para o próximo). */}
                {TUTORS.map((x, k) => (
                  <motion.div key={x.id} className="absolute inset-0 flex items-end justify-center pointer-events-none"
                    initial={false} animate={{ opacity: k === i ? 1 : 0 }} transition={{ duration: 0.35, ease: EASE }}>
                    <BreathingTutor id={x.id} className="h-[84%]" />
                  </motion.div>
                ))}
                <motion.div className="absolute inset-0" initial={false}
                  animate={{ opacity: settled === t.id ? 1 : 0 }} transition={{ duration: 0.3, ease: EASE }}>
                  <LiveTutor id={settled} portrait={false} bubble="head" name={t.name} />
                </motion.div>
              </motion.div>}
            </div>
            <figcaption><i>{t.name}</i><span>{t.role}</span><span aria-hidden>{String(i + 1).padStart(2, '0')} / {String(TUTORS.length).padStart(2, '0')}</span></figcaption>
          </figure>
          <div className="st-tutor-copy">
            <p className="journey-label">Tutores</p>
            <h2 className="journey-title">Converse com quem tem <i>paciência.</i></h2>
            <div className="st-tutor-index" role="group" aria-label="Escolher tutor">
              {TUTORS.map((x, k) => <button type="button" key={x.id} aria-pressed={k === i} onClick={() => selectTutor(k)}><small>{String(k + 1).padStart(2, '0')}</small>{x.name}</button>)}
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={t.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.5, ease: EASE }}>
                <p className="st-tutor-about">{t.about}</p>
              </motion.div>
            </AnimatePresence>
            <Btn to="/tutores" arrow>Conhecer os tutores</Btn>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ================================================================ Visual: prática (fala e ditado) */

const SAID: [string, 'g' | 'a' | 'r' | 'x'][] = [['Once', 'g'], ['upon', 'g'], ['a', 'g'], ['time', 'g'], ['there', 'g'], ['were', 'a'], ['four', 'g'], ['little', 'g'], ['Rabbits,', 'g'], ['Flopsy,', 'g'], ['Mopsy,', 'r'], ['and', 'x'], ['Peter.', 'g']]

export function PracticeVisual() {
  return (
    <div className="st-practice">
      <motion.div className="st-card st-speak" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-10%' }} transition={{ duration: 1, ease: EASE }}>
        <p className="st-card-k">Leia em voz alta</p>
        <p className="st-said" lang="en">
          {SAID.map(([w, k], n) => (
            <motion.span key={n} data-k={k} initial={{ opacity: 0.25 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: 0.5 + n * 0.12 }}>{w} </motion.span>
          ))}
        </p>
        <div className="st-score"><motion.b initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 2.2 }}>85%</motion.b><span>de acerto · Mopsy e fir-tree para treinar</span></div>
      </motion.div>
      <motion.div className="st-card st-dict" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-10%' }} transition={{ duration: 1, ease: EASE, delay: 0.25 }}>
        <p className="st-card-k">Ditado</p>
        <p className="st-dict-line" lang="en">Peter was most <s>dredfully</s> <mark>dreadfully</mark> frightened.</p>
        <p className="st-dict-note">Nota da página <b>8,2</b></p>
      </motion.div>
    </div>
  )
}

/* ================================================================ Visual: evolução (Raio-X ilustrado) */

const SKILLS: [string, number][] = [['Fala', 81], ['Conversa', 74], ['Vocabulário', 68], ['Ditado', 59], ['Constância', 90]]

export function GrowthVisual() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.9', 'center 0.55'] })
  const draw = useTransform(scrollYProgress, [0, 1], [0, 1])
  const R = [150, 126, 102, 78, 54]
  return (
    <div ref={ref} className="st-growth">
      <svg viewBox="-180 -180 360 360" className="st-rings" aria-label="Raio-X: cinco habilidades em anéis">
        {SKILLS.map(([, v], k) => {
          const r = R[k], c = 2 * Math.PI * r
          return (
            <g key={k} transform="rotate(-90)">
              <circle r={r} fill="none" stroke="var(--st-ring-bg)" strokeWidth="14" />
              <motion.circle r={r} fill="none" stroke={`var(--st-ring-${k})`} strokeWidth="14" strokeLinecap="round" strokeDasharray={c}
                style={{ strokeDashoffset: useTransform(draw, d => c * (1 - d * v / 100)) }} />
            </g>
          )
        })}
        <text x="0" y="6" textAnchor="middle" className="st-rings-num">74</text>
        <text x="0" y="26" textAnchor="middle" className="st-rings-sub">de 100</text>
      </svg>
      <div className="st-legend">
        {SKILLS.map(([n, v], k) => <p key={n}><i style={{ background: `var(--st-ring-${k})` }} />{n}<b>{v}</b></p>)}
        <motion.div className="st-level" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE, delay: 0.6 }}>
          <span>B1</span><ArrowRight size={14} /><span data-next>B2</span><small>a 6 pontos do próximo nível</small>
        </motion.div>
      </div>
    </div>
  )
}

/* ================================================================ Capítulo com visual (bloco padrão) */

export function Chapter({ id, kicker, title, text, to, cta, children, tone = 'paper' }: { id?: string; kicker: string; title: ReactNode; text: ReactNode; to?: string; cta?: string; children: ReactNode; tone?: 'paper' | 'warm' | 'sand' }) {
  return (
    <section id={id} className="st-chapter" data-tone={tone}>
      <ChapterHead kicker={kicker} title={title} text={text} to={to} cta={cta} />
      <div className="st-visual">{children}</div>
    </section>
  )
}

/* ================================================================ Índice de funções (estilo lista do Claude) */

export const INDEX: { group: string; to: string; items: [string, string][] }[] = [
  { group: 'Ler', to: '/leitor', items: [['Áudio com karaokê', 'A palavra acende enquanto a voz lê.'], ['Toque na palavra', 'Pronúncia, significado e exemplos.'], ['Decifrar a página', 'A gramática explicada em português.'], ['Leitura confortável', 'Dia, Tarde, Noite e sons ambientes.']] },
  { group: 'Ilustrar', to: '/ilustracoes', items: [['Páginas ilustradas', 'Cada página vira imagem ou quadrinho.'], ['16 estilos', 'Aquarela, mangá, HQ, noir e mais.'], ['Feito pela comunidade', 'O que já foi gerado é grátis.']] },
  { group: 'Conversar', to: '/tutores', items: [['Quatro tutores', 'Bia, Luck, Yuno e Yuri.'], ['Cenas do dia a dia', 'Café, aeroporto, entrevista.'], ['Eles lembram de você', 'A conversa continua de onde parou.']] },
  { group: 'Praticar', to: '/pratica', items: [['Falar', 'Certo, quase, errado ou pulou.'], ['Ditado', 'Ouça, escreva e receba a nota.'], ['Vocabulário', 'As palavras voltam na hora certa.']] },
  { group: 'Evoluir', to: '/evolucao', items: [['Raio-X', 'Nota por habilidade e diagnóstico.'], ['Meta e sequência', 'Um pouco por dia, todos os dias.'], ['Prova de proficiência', 'As 4 habilidades, com relatório.']] },
  { group: 'Biblioteca', to: '/biblioteca', items: [['Mais de 100 clássicos', 'Com capa nova e nível indicado.'], ['Seus EPUBs e PDFs', 'Importe e leia com tudo isso.'], ['Um livro de presente', 'Seu para sempre no Grátis.']] },
]

export function FeatureIndex() {
  return (
    <section className="st-index">
      <ChapterHead kicker="Tudo o que tem dentro" title="Um leitor completo, do primeiro livro à fluência." text="Escolha por onde começar. Cada parte do Upoonly tem a sua página." />
      <div className="st-index-grid">
        {INDEX.map((g, k) => (
          <In key={g.group} delay={(k % 3) * 0.06}>
            <Link to={g.to} className="st-index-group">
              <p className="st-index-name">{g.group}<ArrowRight size={16} /></p>
              <ul>{g.items.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}</ul>
            </Link>
          </In>
        ))}
      </div>
    </section>
  )
}

export { tutorImg }
