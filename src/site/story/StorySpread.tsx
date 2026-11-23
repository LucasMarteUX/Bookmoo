import { Fragment, useRef, useState } from 'react'
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Link } from 'react-router-dom'
import { ImageDither } from '../ImageDither'
import { QuadScreen } from '../QuadScreen'

const excerpt = 'Oh dear! Oh dear! I shall be too late'.split(' ')

const chapters = [
  ['Leia.', '/leitor', 'the-secret-garden', 'Cada palavra no seu contexto'],
  ['Escute.', '/pratica', 'alices-adventures-in-wonderland', 'Do ouvido à pronúncia'],
  ['Converse.', '/tutores', 'anne-of-green-gables', 'Sua vez de contar a história'],
]

function MosaicLine({ chapter, index }: { chapter: string[]; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const side = index === 1 ? -1 : 1
  const x = useTransform(scrollYProgress, [0, .5, 1], [65 * side, 0, -65 * side])
  const [verb, url, slug, description] = chapter
  return <div ref={ref} className="mosaic-line">
    <motion.div style={reduced ? undefined : {x}}>
      <Link to={url}><img loading="lazy" src={'/site/covers/' + slug + '.webp'} alt="" /><span>{verb}</span><small>{description} ↗</small></Link>
    </motion.div>
  </div>
}

/** Trecho do livro: as palavras acendem conforme a rolagem (sem áudio), no título e dentro do tablet. */
function useScrollWord(target: React.RefObject<HTMLElement | null>, total: number) {
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target, offset: ['start 0.8', 'end 0.45'] })
  const [word, setWord] = useState(reduced ? total - 1 : -1)
  useMotionValueEvent(scrollYProgress, 'change', v => { if (!reduced) setWord(Math.min(total - 1, Math.floor(v * (total + 1)) - 1)) })
  return word
}

function Excerpt({ word, open, onGloss, small }: { word: number; open?: boolean; onGloss?: () => void; small?: boolean }) {
  return <>{excerpt.map((text, i) => <Fragment key={i}>
    {i > 0 && ' '}
    <span className="excerpt-word" data-read={i <= word} data-current={i === word}>
      {i === excerpt.length - 1 && onGloss && !small
        ? <><button type="button" aria-expanded={open} aria-controls="rabbit-gloss" onClick={onGloss}>{text}</button>!</>
        : i === excerpt.length - 1 ? `${text}!` : text}
    </span>
  </Fragment>)}</>
}

function ReadingExcerpt({ word }: { word: number }) {
  const [open, setOpen] = useState(false)
  return <div className="spread-copy">
    <p className="journey-label">Alice's Adventures in Wonderland · Capítulo 1</p>
    <h2 lang="en"><Excerpt word={word} open={open} onGloss={() => setOpen(!open)} /></h2>
    <p id="rabbit-gloss" aria-live="polite">{open ? 'Atrasado · O Coelho Branco olha a hora e corre, com medo de chegar tarde.' : 'Role a página para ler junto. Toque na palavra sublinhada para descobrir o significado.'}</p>
  </div>
}

/** O que aparece na tela do tablet pintado: a mesma página no leitor, com a palavra do momento marcada. */
function TabletPage({ word }: { word: number }) {
  return <div className="tablet-page">
    <p className="tablet-page-head">Alice's Adventures in Wonderland<span>Capítulo 1 · página 4</span></p>
    <p className="tablet-page-text" lang="en">There was nothing so <i>very</i> remarkable in that; nor did Alice think it so <i>very</i> much out of the way to hear the Rabbit say to itself, “<Excerpt word={word} small />”</p>
    <div className="tablet-page-word" data-on={word >= excerpt.length - 1}><b lang="en">late</b><span>/leɪt/</span><p>atrasado · depois da hora combinada</p></div>
  </div>
}

export function StorySpread() {
  const section = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: section, offset: ['start end', 'end start'] })
  const imageY = useTransform(scrollYProgress, [0, 1], ['-3%', '3%'])
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.08, 1.02])
  const word = useScrollWord(section, excerpt.length)
  return <>
    <section ref={section} className="story-spread" id="primeira-pagina">
      <ReadingExcerpt word={word} />
      <figure className="garden-frame">
        <motion.div className="garden-art" style={reduced ? undefined : { y: imageY, scale: imageScale }}>
          <img src="/site/home/mesa-alice.webp" alt="Pintura a óleo de uma mesa antiga com relógio de bolso, chá, cartas, uma pena e um tablet aberto na história de Alice" />
          <QuadScreen quad={[[44.33, 34.64], [68.05, 35.33], [64.95, 57.85], [40.93, 56.3]]} w={600} h={740}><TabletPage word={word} /></QuadScreen>
        </motion.div>
        <ImageDither corners={['bl', 'tr']} />
      </figure>
    </section>
    <nav className="story-verbs" aria-label="Explore as formas de aprender">{chapters.map((chapter,i)=><MosaicLine key={chapter[1]} chapter={chapter} index={i}/>)}</nav>
  </>
}
