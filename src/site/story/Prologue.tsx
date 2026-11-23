import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Btn } from '../ui'
import './prologue.css'
import { ImageDither } from '../ImageDither'

let introPlayed = false


export function Prologue() {
  const hero = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const {scrollYProgress} = useScroll({target:hero,offset:['start start','end start']})
  const scale = useTransform(scrollYProgress,[0,1],[1,1.18])
  const y = useTransform(scrollYProgress,[0,1],['0%','16%'])
  const titleY = useTransform(scrollYProgress, [0, 1], ['0%', '-22%'])
  // A abertura toca a cada carregamento da página (F5 / Ctrl+Shift+R), mas não ao voltar para a home navegando.
  const [intro, setIntro] = useState(() => {
    try { return !introPlayed && !location.hash && !matchMedia('(prefers-reduced-motion: reduce)').matches }
    catch { return false }
  })
  useEffect(() => {
    introPlayed = true
    if (!intro) return
    const timer = window.setTimeout(() => setIntro(false), 4600)
    return () => clearTimeout(timer)
  }, [intro])
  return <>
    {intro && <div className="flight-intro" onClick={() => setIntro(false)}>
      <div className="flight-cast" aria-hidden="true">
        <i className="fr fr-body"/><i className="fr fr-paw"/>
        <span className="fr-head"><i className="fr fr-face"/><i className="fr fr-ears"/></span>
        <div className="flight-butterfly"><i/><b/></div>
      </div>
    </div>}
    <section ref={hero} data-waiting={intro} className="book-prologue">
      <ImageDither corners={['br', 'tr']} z={0} />
      <motion.img style={reduce ? undefined : {scale,y}} className="night-reader" src="/site/home/leitora-tablet.webp" alt="" fetchPriority="high" />
      <motion.div className="book-copy" style={reduce ? undefined : { y: titleY }}><h1 lang="en"><span>Once upon</span>{' '}<i>a time.</i></h1>
      <p>Aprenda inglês lendo clássicos. Ouça a história, descubra o sentido de uma palavra e converse sobre o que acabou de ler.</p>
      <Btn variant="white" to="/signup" arrow>Começar grátis</Btn></motion.div>
    </section>
  </>
}
