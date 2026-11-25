import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigationType } from 'react-router-dom'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Btn } from '../ui'
import './prologue.css'
import { ImageDither } from '../ImageDither'
import { RabbitFlight } from '@/components/brand/RabbitFlight'

let introPlayed = false


export function Prologue() {
  const hero = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const {scrollYProgress} = useScroll({target:hero,offset:['start start','end start']})
  const scale = useTransform(scrollYProgress,[0,1],[1,1.18])
  const y = useTransform(scrollYProgress,[0,1],['0%','16%'])
  const titleY = useTransform(scrollYProgress, [0, 1], ['0%', '-22%'])
  // A abertura toca só quando o site é carregado (ou recarregado) já na home. Chegar à home navegando,
  // pelo logotipo ou por um link, não repete: aí a navegação é PUSH/REPLACE, e não o POP da carga inicial.
  const navigationType = useNavigationType()
  const [intro, setIntro] = useState(() => {
    try { return !introPlayed && navigationType === 'POP' && !location.hash && !matchMedia('(prefers-reduced-motion: reduce)').matches }
    catch { return false }
  })
  // O título só entra quando a abertura começa a se abrir (uma vez), e não de novo quando ela some.
  const [revealed, setRevealed] = useState(!intro)
  useEffect(() => {
    introPlayed = true
    if (!intro) { setRevealed(true); return }
    const open = window.setTimeout(() => setRevealed(true), 3650)
    const done = window.setTimeout(() => setIntro(false), 4600)
    return () => { clearTimeout(open); clearTimeout(done) }
  }, [intro])
  const skip = () => { setRevealed(true); setIntro(false) }
  return <>
    {intro && typeof document !== 'undefined' && createPortal(<div className="flight-intro" onClick={skip}>
      <RabbitFlight className="flight-cast" />
    </div>, document.body)}
    <section ref={hero} data-waiting={!revealed} className="book-prologue">
      <ImageDither corners={['br', 'tr']} z={0} />
      <motion.img style={reduce ? undefined : {scale,y}} className="night-reader" src="/site/home/leitora-tablet.webp" alt="" fetchPriority="high" />
      <motion.div className="book-copy" style={reduce ? undefined : { y: titleY }}><h1 lang="en"><span>Once upon</span>{' '}<i>a time.</i></h1>
      <p>Aprenda inglês lendo clássicos. Ouça a história, descubra o sentido de uma palavra e converse sobre o que acabou de ler.</p>
      <Btn variant="white" to="/signup" arrow>Começar grátis</Btn></motion.div>
    </section>
  </>
}
