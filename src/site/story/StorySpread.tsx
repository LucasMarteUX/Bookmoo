import { Fragment, useEffect, useRef, useState } from 'react'
import { animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Link } from 'react-router-dom'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImageDither } from '../ImageDither'

const excerpt = 'Oh dear! Oh dear! I shall be too late'.split(' ')
const readingSeconds = 5.4
const clock = (s: number) => `0:${String(Math.floor(s)).padStart(2, '0')}`

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

function ReadingExcerpt() {
  const copy = useRef<HTMLDivElement>(null)
  const inView = useInView(copy, { amount: .35 })
  const reduced = useReducedMotion()
  const progress = useMotionValue(0)
  const currentWord = useTransform(progress, value => Math.min(excerpt.length - 1, Math.floor(value * excerpt.length)))
  const [tabVisible, setTabVisible] = useState(() => !document.hidden)
  const [playback, setPlayback] = useState<'auto' | 'playing' | 'paused' | 'finished'>('auto')
  const [word, setWord] = useState(0)
  const [open, setOpen] = useState(false)
  const playing = inView && tabVisible && (playback === 'playing' || (playback === 'auto' && !reduced))
  const highlight = playing || progress.get() > 0

  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const [elapsed, setElapsed] = useState(0)
  useMotionValueEvent(currentWord, 'change', setWord)
  // Só o relógio da narração: a linha do tempo anda como um áudio, mas nada toca.
  useMotionValueEvent(progress, 'change', v => setElapsed(Math.floor(v * readingSeconds)))
  useEffect(() => {
    if (!playing) return
    const controls = animate(progress, 1, {
      duration: (1 - progress.get()) * readingSeconds,
      ease: 'linear',
      onComplete: () => setPlayback('finished'),
    })
    return () => controls.stop()
  }, [playing, progress])

  function toggleReading() {
    if (playing) {
      setPlayback('paused')
      return
    }
    if (playback === 'finished') progress.set(0)
    setPlayback('playing')
  }
  function toggleGloss() {
    if (playing) setPlayback('paused')
    setOpen(!open)
  }
  const controlLabel = playing ? 'Pausar leitura guiada' : playback === 'finished' ? 'Reler o trecho' : 'Acompanhar leitura'

  return <div ref={copy} className="spread-copy">
    <h2 lang="en">{excerpt.map((text, i) => <Fragment key={i}>
      {i > 0 && ' '}
      <span className="excerpt-word" data-current={highlight && i === word}>
        {i === excerpt.length - 1
          ? <><button type="button" aria-expanded={open} aria-controls="rabbit-gloss" onClick={toggleGloss}>{text}</button>!</>
          : text}
      </span>
    </Fragment>)}</h2>
    <p id="rabbit-gloss" aria-live="polite">{open ? 'Atrasado · O Coelho Branco olha a hora e corre, com medo de chegar tarde.' : 'Toque na palavra sublinhada para descobrir o significado.'}</p>
    <div className="excerpt-timeline">
      <Button size="icon" variant="outline" type="button" aria-label={controlLabel} title={controlLabel} onClick={toggleReading}>
        {playing ? <Pause size={16} aria-hidden /> : playback === 'finished' ? <RotateCcw size={16} aria-hidden /> : <Play size={16} aria-hidden />}
      </Button>
      <div className="excerpt-meter">
        <div className="excerpt-meter-title"><span>Narração</span><small aria-hidden>{clock(elapsed)} / {clock(readingSeconds)}</small></div>
        <div className="excerpt-track" role="progressbar" aria-label="Palavras acompanhadas" aria-valuenow={highlight ? word + 1 : 0} aria-valuemin={0} aria-valuemax={excerpt.length}>
          <motion.span style={{ scaleX: progress }} />
        </div>
      </div>
    </div>
  </div>
}

export function StorySpread() {
  const section = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: section, offset: ['start end', 'end start'] })
  const imageY = useTransform(scrollYProgress, [0, 1], ['-5%', '5%'])
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.21, 1.13])
  return <>
    <section ref={section} className="story-spread" id="primeira-pagina">
      <ReadingExcerpt />
      <figure className="garden-frame"><motion.img style={reduced ? undefined : { y: imageY, scale: imageScale }} src="/site/home/coelho-alice.webp" alt="O Coelho Branco, de colete vermelho, olha o celular na trilha da floresta" /><ImageDither /></figure>
    </section>
    <nav className="story-verbs" aria-label="Explore as formas de aprender">{chapters.map((chapter,i)=><MosaicLine key={chapter[1]} chapter={chapter} index={i}/>)}</nav>
  </>
}
