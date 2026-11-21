// Home: o Upoonly mostrado como ele é, um app de leitura no computador e no celular. As fotos têm a tela lisa e a
// interface real é desenhada por cima, em código (nítida em qualquer tela). Funções apresentadas em blocos editoriais.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { ArrowRight, ArrowUpRight, BookOpen, Check, ChevronLeft, Mic, Pause, RotateCcw, Sparkles, Star, Type, Volume2 } from 'lucide-react'
import { STYLES, tutorAvatar, tutorImg } from '../content'
import { COVERS, coverSrc } from '../covers'
import { Fit } from '../vignettes2'
import { VDictation, VProva, VRaioX, VReader, VSpeak, VVocab, VWord } from '../vignettes'
import { VGrammar } from '../vignettes2'
import './showcase.css'

const EASE = [0.2, 0.8, 0.2, 1] as const

export function In({ children, delay = 0, className, y = 24 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.div className={className} initial={reduce ? { opacity: 0 } : { opacity: 0, y, filter: 'blur(6px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-10%' }} transition={{ duration: 1, ease: EASE, delay }}>
      {children}
    </motion.div>
  )
}

/** Tela desenhada num tamanho fixo e reduzida para caber exatamente no retângulo da tela da foto. */
export function Screen({ box, w, h, radius = 0, children }: { box: [number, number, number, number]; w: number; h: number; radius?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [s, setS] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const m = () => setS(el.clientWidth / w)
    m()
    const o = new ResizeObserver(m)
    o.observe(el)
    return () => o.disconnect()
  }, [w])
  const [l, t, bw, bh] = box
  return (
    <div ref={ref} className="sc-screen" style={{ left: `${l}%`, top: `${t}%`, width: `${bw}%`, height: `${bh}%`, borderRadius: radius * s }}>
      <div style={{ width: w, height: h, transform: `scale(${s})`, transformOrigin: '0 0', visibility: s ? 'visible' : 'hidden' }}>{children}</div>
    </div>
  )
}

function useTick(n: number, ms: number, on = true) {
  const [i, setI] = useState(0)
  const reduce = useReducedMotion()
  useEffect(() => {
    if (!on || reduce) return
    const t = window.setInterval(() => setI(v => (v + 1) % n), ms)
    return () => window.clearInterval(t)
  }, [n, ms, on, reduce])
  return i
}

/* ================================================================ Tela do leitor (notebook) */

const PAGE = 'Once upon a time there were four little Rabbits, and their names were Flopsy, Mopsy, Cotton-tail, and Peter. They lived with their Mother in a sand-bank, underneath the root of a very big fir-tree.'.split(' ')

function ReaderScreen() {
  const i = useTick(PAGE.length + 8, 320)
  const showWord = i > 14 && i < PAGE.length + 6
  return (
    <div className="sc-reader">
      <div className="sc-reader-top">
        <span className="sc-reader-back"><ChevronLeft size={18} />The Tale of Peter Rabbit</span>
        <span className="sc-reader-chap">Capítulo 1 · página 3 de 24</span>
        <span className="sc-reader-tools"><Type size={17} /><Sparkles size={17} /><BookOpen size={17} /></span>
      </div>
      <div className="sc-reader-body">
        <div className="sc-reader-art"><img src="/site/reader/peter-rabbit-page.webp" alt="" /></div>
        <div className="sc-reader-text" lang="en">
          <p>
            {PAGE.map((w, k) => (
              <span key={k}>
                <span className={k === i ? 'is-now' : k < i ? 'is-read' : ''} data-word={w === 'sand-bank,' ? 'y' : undefined}>{w}</span>{' '}
              </span>
            ))}
          </p>
          <AnimatePresence>
            {showWord && (
              <motion.div className="sc-reader-pop" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.5, ease: EASE }}>
                <p><b>sand-bank</b><span>/ˈsænd bæŋk/</span><Volume2 size={15} /></p>
                <p className="sc-reader-pop-d"><b>banco de areia</b> · um monte de areia na margem de um rio.</p>
                <div><span data-k="g"><Check size={12} />Aprendi</span><span data-k="a"><RotateCcw size={12} />Revisar</span><span data-k="s"><Star size={12} />Importante</span></div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="sc-reader-bar">
        <img src={tutorAvatar('bia')} alt="" />
        <span className="sc-reader-play"><Pause size={14} /></span>
        <div className="sc-reader-prog"><i style={{ width: `${Math.min(100, (i / PAGE.length) * 100)}%` }} /></div>
        <span>0,9×</span>
      </div>
    </div>
  )
}

/* ================================================================ Tela do tutor (celular) */

const CHAT = [
  { me: false, t: 'Did you like Peter? He was very naughty! 😄' },
  { me: true, t: 'Yes! He ran into Mr. McGregor’s garden.' },
  { me: false, t: 'Great sentence! Just say “ran into”, perfect.' },
]

function TutorScreen() {
  const ref = useRef<HTMLDivElement>(null)
  const on = useInView(ref, { amount: 0.3 })
  const i = useTick(CHAT.length + 2, 1800, on)
  return (
    <div ref={ref} className="sc-phone">
      <div className="sc-phone-head"><span className="sc-dot" />Bia · conversando</div>
      <img className="sc-phone-tutor" src={tutorImg('bia', i % 2 === 0)} alt="" />
      <div className="sc-phone-chat">
        <AnimatePresence initial={false}>
          {CHAT.slice(0, Math.min(i + 1, CHAT.length)).map((c, k) => (
            <motion.p key={k} className={c.me ? 'is-me' : ''} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, ease: EASE }} lang="en">{c.t}</motion.p>
          ))}
        </AnimatePresence>
      </div>
      <div className="sc-phone-mic">
        <span className="sc-phone-wave">{Array.from({ length: 18 }, (_, k) => <motion.i key={k} animate={{ height: [4, 6 + ((k * 37) % 16), 4] }} transition={{ duration: 0.8, repeat: Infinity, repeatType: 'mirror', delay: (k % 6) * 0.08 }} />)}</span>
        <span className="sc-phone-btn"><Mic size={20} /></span>
      </div>
    </div>
  )
}

/* ================================================================ Hero */

export function HeroSetup() {
  const reduce = useReducedMotion()
  const a = (d: number) => ({ initial: reduce ? { opacity: 0 } : { opacity: 0, y: 20, filter: 'blur(8px)' }, animate: { opacity: 1, y: 0, filter: 'blur(0px)' }, transition: { duration: 1.2, ease: EASE, delay: d } })
  return (
    <section className="sc-hero">
      <div className="sc-hero-copy">
        <motion.p {...a(0.1)} className="sc-kicker">Leia em inglês do seu jeito</motion.p>
        <motion.h1 {...a(0.2)} className="sc-hero-title">Aprenda inglês lendo as histórias que você <i>ama</i>.</motion.h1>
        <motion.p {...a(0.32)} className="sc-hero-lead">Clássicos com narração, cada palavra explicada no contexto, páginas que viram ilustração e tutores para conversar sobre o que você leu.</motion.p>
        <motion.div {...a(0.44)} className="sc-hero-actions">
          <Link to="/signup" className="sc-btn sc-btn-dark">Começar grátis <ArrowRight size={16} /></Link>
          <Link to="/recursos" className="sc-btn sc-btn-line">Conhecer o Upoonly</Link>
        </motion.div>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.6, ease: EASE, delay: 0.5 }}><CoverArc /></motion.div>
      <motion.p className="sc-arc-line" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, ease: EASE, delay: 0.9 }}>
        Do <Mark delay={0.5}>primeiro conto</Mark> ao <Mark delay={0.75}>Sherlock Holmes</Mark>, cada história é <Mark delay={1}>uma aula</Mark> que você não quer que acabe.
      </motion.p>
    </section>
  )
}

/* ================================================================ Capas em arco, girando sem parar */

export function CoverArc() {
  const list = COVERS.slice(0, 30)
  return (
    <div className="sc-arc" aria-label="Alguns dos clássicos da biblioteca">
      <div className="sc-arc-wheel">
        {list.map((c, k) => (
          <div key={c.slug} className="sc-arc-item" style={{ ['--a' as string]: `${k * (360 / list.length)}deg` }}>
            <img src={coverSrc(c.slug)} alt={c.title} loading={k < 6 || k > 25 ? 'eager' : 'lazy'} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ================================================================ O leitor no notebook (meio da Home) */

export function LaptopSection() {
  return (
    <section className="sc-section">
      <SectionHead kicker="No computador" title={<>Uma tela, <i>tudo o que você precisa</i>.</>}
        text="A página com ilustração, a narração com karaokê, o significado de cada palavra e um tutor pronto para conversar. Tudo junto, sem abrir outra aba." />
      <In className="sc-hero-photo sc-laptop-mid">
              <img src="/site/home/setup.webp" alt="Uma jovem sorrindo enquanto lê um livro em inglês no Upoonly, no notebook" />
        <Screen box={[31.101, 40.691, 36.979, 40.426]} w={1000} h={611}><ReaderScreen /></Screen>
        <motion.div className="sc-float sc-float-word" initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-15%' }} transition={{ duration: 1, ease: EASE, delay: 0.5 }}>
          <p className="sc-float-k">Palavra salva</p>
          <p className="sc-float-w" lang="en">sand-bank</p>
          <p className="sc-float-d">banco de areia</p>
          <div><span data-k="g"><Check size={11} />Aprendi</span><span data-k="a"><RotateCcw size={11} />Revisar</span></div>
        </motion.div>
        <motion.div className="sc-float sc-float-tutor" initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-15%' }} transition={{ duration: 1, ease: EASE, delay: 0.8 }}>
          <img src={tutorAvatar('bia')} alt="" />
          <p lang="en">Great reading! Want to talk about Peter?</p>
        </motion.div>
      </In>
    </section>
  )
}

/* ================================================================ Manifesto com marca-texto */

function Mark({ children, delay }: { children: ReactNode; delay: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const on = useInView(ref, { once: true, margin: '0px 0px -10% 0px' })
  return <span ref={ref} className="sc-mark" data-on={on} style={{ transitionDelay: `${delay}s` }}>{children}</span>
}

export function Manifesto() {
  return (
    <section className="sc-manifesto">
      <In><p className="sc-kicker">O jeito Upoonly</p></In>
      <In delay={0.05}>
        <p className="sc-manifesto-text">
          Você abre um clássico, <Mark delay={0.1}>ouve</Mark> a história, <Mark delay={0.35}>entende</Mark> cada palavra
          e <Mark delay={0.6}>conversa</Mark> sobre ela. Sem decoreba, sem aula chata. Só o prazer de ler, e o inglês <Mark delay={0.85}>vindo junto</Mark>.
        </p>
      </In>
    </section>
  )
}

/* ================================================================ Blocos de funções */

export type Tile = { title: string; text: string; to: string; tone: 'sage' | 'sand' | 'blush' | 'sky' | 'paper'; span: number; visual?: ReactNode }

export function SectionHead({ kicker, title, text }: { kicker: string; title: ReactNode; text: string }) {
  return (
    <div className="sc-head">
      <In><p className="sc-kicker">{kicker}</p><h2 className="sc-title">{title}</h2></In>
      <In delay={0.08}><p className="sc-head-text">{text}</p></In>
    </div>
  )
}

export function Tiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="sc-tiles">
      {tiles.map((t, k) => (
        <In key={t.title} delay={(k % 2) * 0.08} className={`sc-tile-cell sc-span-${t.span}`}>
          <Link to={t.to} className="sc-tile" data-tone={t.tone}>
            <div className="sc-tile-copy">
              <p className="sc-tile-title">{t.title}</p>
              <p className="sc-tile-text">{t.text}</p>
            </div>
            <span className="sc-tile-go" aria-hidden><ArrowUpRight size={17} /></span>
            {t.visual && <div className="sc-tile-visual"><Fit>{t.visual}</Fit></div>}
          </Link>
        </In>
      ))}
    </div>
  )
}

export function ReadFeatures() {
  return (
    <section className="sc-section">
      <SectionHead kicker="O leitor" title={<>Um leitor que ensina <i>enquanto você lê</i>.</>}
        text="Mais de 100 clássicos com narração natural. A palavra acende no momento em que é dita, e um toque explica qualquer uma no contexto da história." />
      <Tiles tiles={[
        { title: 'Narração com karaokê', text: 'Ouça e acompanhe. Escolha a voz e a velocidade.', to: '/leitor', tone: 'sage', span: 7, visual: <VReader /> },
        { title: 'Toque na palavra', text: 'Pronúncia, tradução e exemplo, sem sair da página.', to: '/leitor', tone: 'sand', span: 5, visual: <div className="pb-24"><VWord /></div> },
        { title: 'Decifrar a página', text: 'A gramática da página explicada em português.', to: '/leitor', tone: 'blush', span: 5, visual: <VGrammar /> },
        { title: 'Leitura confortável', text: 'Temas Dia, Tarde e Noite, fontes e sons ambientes.', to: '/leitor', tone: 'sky', span: 7, visual: <ThemesVisual /> },
      ]} />
    </section>
  )
}

export function PhoneTutor() {
  return (
    <section className="sc-section">
      <div className="sc-split">
        <In className="sc-phone-photo">
          <img src="/site/home/celular.webp" alt="Uma mão segurando o celular com a tutora Bia conversando em inglês no Upoonly" />
          <Screen box={[32.143, 14.732, 35.826, 63.125]} w={360} h={793} radius={40}><TutorScreen /></Screen>
        </In>
        <div className="sc-split-copy">
          <In><p className="sc-kicker">Tutores</p><h2 className="sc-title">Converse sobre o livro, <i>de onde estiver</i>.</h2></In>
          <In delay={0.06}><p className="sc-lead">Leu um capítulo no computador? Continue no celular e fale em voz alta com quem leu junto com você. O tutor corrige com carinho e lembra do que vocês conversaram.</p></In>
          <In delay={0.12}>
            <div className="sc-tutors">
              {['bia', 'luck', 'yuno', 'yuri'].map(id => <img key={id} src={tutorAvatar(id)} alt="" />)}
              <span>Bia, Luck, Yuno e Yuri</span>
            </div>
          </In>
          <In delay={0.18}><Link to="/tutores" className="sc-textlink">Conhecer os tutores <ArrowRight size={15} /></Link></In>
        </div>
      </div>
    </section>
  )
}

export function GrowFeatures() {
  return (
    <section className="sc-section">
      <SectionHead kicker="Praticar e evoluir" title={<>Fale sem medo. Veja <i>o quanto evoluiu</i>.</>}
        text="Leia em voz alta, faça ditados e revise as palavras na hora certa. Toda semana, o Raio-X mostra em português o que treinar a seguir." />
      <Tiles tiles={[
        { title: 'Fala, palavra por palavra', text: 'Certo, quase, errado ou pulou. E a nota da leitura.', to: '/pratica', tone: 'sand', span: 6, visual: <VSpeak /> },
        { title: 'Raio-X do inglês', text: 'Cinco habilidades medidas toda semana.', to: '/evolucao', tone: 'sage', span: 6, visual: <VRaioX /> },
        { title: 'Ditado', text: 'Ouça, escreva e veja o que o ouvido deixou escapar.', to: '/pratica', tone: 'sky', span: 4, visual: <VDictation /> },
        { title: 'Vocabulário', text: 'As palavras salvas voltam na hora certa.', to: '/pratica', tone: 'paper', span: 4, visual: <VVocab /> },
        { title: 'Prova de proficiência', text: 'As 4 habilidades, com relatório e nível CEFR.', to: '/prova', tone: 'blush', span: 4, visual: <VProva /> },
      ]} />
    </section>
  )
}

/* ================================================================ Leitor no celular (cartão "Entender") */

export function PhoneReader() {
  const i = useTick(3, 2600)
  return (
    <div className="sc-preader">
      <p className="sc-preader-top">Alice’s Adventures in Wonderland</p>
      <p className="sc-preader-text" lang="en">Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had <b data-on={i > 0}>peeped</b> into the book her sister was reading.</p>
      <AnimatePresence>
        {i > 0 && (
          <motion.div className="sc-preader-pop" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.6, ease: EASE }}>
            <p><b>peeped</b><span>/piːpt/</span><Volume2 size={16} /></p>
            <p className="sc-preader-d"><b>espiou</b> · deu uma olhadinha rápida e meio escondida.</p>
            <div><span data-k="g"><Check size={13} />Aprendi</span><span data-k="a"><RotateCcw size={13} />Revisar</span></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ================================================================ Galeria de estilos */

function StyleRow({ items, reverse }: { items: typeof STYLES; reverse?: boolean }) {
  const list = [...items, ...items]
  return (
    <div className="sc-gal-row">
      <div className="sc-gal-track" data-rev={reverse ? 'y' : undefined}>
        {list.map((s, k) => (
          <figure key={k} className="sc-gal-item">
            <img src={`/styles/${s.id}.webp`} alt={k < items.length ? `Ilustração no estilo ${s.name}` : ''} loading="lazy" />
            <figcaption>{s.name}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

export function StylesGallery() {
  return (
    <section className="sc-gal">
      <div className="sc-section sc-gal-head">
        <div className="sc-head">
          <In><p className="sc-kicker">Ilustrações com IA</p><h2 className="sc-title">Cada página pode virar <i>uma obra de arte</i>.</h2></In>
          <In delay={0.08}><p className="sc-head-text">Escolha entre 16 estilos e veja a cena que você está lendo ganhar forma, em ilustração ou quadrinho. O que a comunidade já ilustrou é grátis para todos.</p>
            <Link to="/ilustracoes" className="sc-textlink">Ver os estilos <ArrowRight size={15} /></Link></In>
        </div>
      </div>
      <StyleRow items={STYLES.slice(0, 8)} />
      <StyleRow items={STYLES.slice(8)} reverse />
    </section>
  )
}

/* ================================================================ Leitura confortável: a mesma página em Dia, Tarde e Noite */

const THEMES = [
  { n: 'Dia', bg: '#FFFFFF', fg: '#15171C', mute: '#A5A9B2', sound: 'Pássaros' },
  { n: 'Tarde', bg: '#F4EAD8', fg: '#3A2D21', mute: '#A8977F', sound: 'Chuva' },
  { n: 'Noite', bg: '#191919', fg: '#EBEBEA', mute: '#6E6D6A', sound: 'Lareira' },
]

function ThemesVisual() {
  const ref = useRef<HTMLDivElement>(null)
  const on = useInView(ref, { amount: 0.3 })
  const i = useTick(THEMES.length, 2600, on)
  const t = THEMES[i]
  return (
    <div ref={ref} className="sc-themes">
      <div className="sc-themes-page" style={{ background: t.bg, color: t.fg }}>
        <img src="/styles/romance-aquarela.webp" alt="" />
        <div>
          <p className="sc-themes-k" style={{ color: t.mute }}>Pride and Prejudice · Capítulo 1</p>
          <p className="sc-themes-text" lang="en">It is a truth universally acknowledged, that a single man in possession of a good fortune, <span style={{ color: t.mute }}>must be in want of a wife.</span></p>
        </div>
      </div>
      <div className="sc-themes-bar">
        {THEMES.map((x, k) => <span key={x.n} data-on={k === i}>{x.n}</span>)}
        <i />
        <AnimatePresence mode="wait"><motion.b key={t.sound} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3 }}>♪ {t.sound}</motion.b></AnimatePresence>
      </div>
    </div>
  )
}

/* ================================================================ Um dia com o Upoonly (seção fixa na rolagem) */

const DAY = [
  { time: '07:40 · no trem', title: 'Ouça a história a caminho do trabalho.', text: 'A narração lê para você e a palavra acende no momento em que é dita.', img: 'ouvir', to: '/leitor',
    ui: <div className="sc-day-chip sc-day-karaoke" lang="en"><span>Once upon a</span> <b>time</b> <span>there were…</span></div> },
  { time: '12:30 · no almoço', title: 'Toque na palavra e ela faz sentido.', text: 'Tradução, pronúncia e exemplo, no contexto da frase. A palavra vai para o seu vocabulário.', img: 'celular', to: '/leitor', screen: 'phone' as const },
  { time: '19:00 · em casa', title: 'Leia no computador, com calma.', text: 'A mesma página continua de onde parou, com ilustrações, temas e tudo sincronizado.', img: 'setup', to: '/leitor', screen: 'laptop' as const },
  { time: '22:10 · antes de dormir', title: 'Converse sobre o que você leu.', text: 'Fale em voz alta com a Bia, o Luck, o Yuno ou o Yuri. Eles corrigem com carinho.', img: 'conversar', to: '/tutores',
    ui: <div className="sc-day-chip sc-day-chat"><img src={tutorAvatar('bia')} alt="" /><p lang="en">Great sentence! Just one tip…</p></div> },
]

export function DayStory() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const [i, setI] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', v => setI(Math.min(DAY.length - 1, Math.max(0, Math.floor(v * DAY.length)))))
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.08])
  return (
    <section ref={ref} className="sc-day" style={{ height: `${DAY.length * 100}vh` }}>
      <div className="sc-day-sticky">
        <div className="sc-day-grid">
          <div className="sc-day-copy">
            <p className="sc-kicker">Um dia com o Upoonly</p>
            <ol className="sc-day-steps">
              {DAY.map((d, k) => (
                <li key={k} data-on={k === i}>
                  <p className="sc-day-time">{d.time}</p>
                  <p className="sc-day-title">{d.title}</p>
                  <div className="sc-day-more"><div><p>{d.text}</p><Link to={d.to} className="sc-textlink" tabIndex={k === i ? 0 : -1}>Saiba mais <ArrowRight size={15} /></Link></div></div>
                </li>
              ))}
            </ol>
          </div>
          <div className="sc-day-frame">
            {DAY.map((d, k) => (
              <motion.div key={k} className="sc-day-shot" initial={false}
                animate={{ opacity: k === i ? 1 : 0, scale: k === i ? 1 : 1.06, filter: k === i ? 'blur(0px)' : 'blur(6px)' }}
                transition={{ duration: reduce ? 0 : 0.9, ease: EASE }} aria-hidden={k !== i}>
                <motion.div className="sc-day-img" style={{ scale: reduce ? 1 : scale }} data-kind={d.screen ?? 'photo'}>
                  <img src={`/site/home/${d.img}.webp`} alt="" />
                  {d.screen === 'phone' && <Screen box={[32.143, 14.732, 35.826, 63.125]} w={360} h={793} radius={40}><PhoneReader /></Screen>}
                  {d.screen === 'laptop' && <Screen box={[31.101, 40.691, 36.979, 40.426]} w={1000} h={611}><ReaderScreen /></Screen>}
                </motion.div>
                <AnimatePresence>{d.ui && k === i && <motion.div className="sc-day-ui" initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}>{d.ui}</motion.div>}</AnimatePresence>
              </motion.div>
            ))}
            <div className="sc-day-dots">{DAY.map((_, k) => <i key={k} data-on={k === i} />)}</div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Foto do notebook com o leitor de verdade na tela (topo da página do Leitor). */
export function LaptopShot() {
  return (
    <div className="sc-hero-photo sc-laptop-shot">
      <img src="/site/home/setup.webp" alt="Uma jovem sorrindo enquanto lê em inglês no Upoonly, no notebook" />
      <Screen box={[31.101, 40.691, 36.979, 40.426]} w={1000} h={611}><ReaderScreen /></Screen>
    </div>
  )
}
