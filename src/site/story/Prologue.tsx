import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Btn } from '../ui'
import './prologue.css'
import { ImageDither } from '../ImageDither'

const books = ['dracula', 'anne-of-green-gables', 'a-princess-of-mars', 'alices-adventures-in-wonderland']

export function Prologue() {
  const hero = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const {scrollYProgress} = useScroll({target:hero,offset:['start start','end start']})
  const scale = useTransform(scrollYProgress,[0,1],[1,1.18])
  const y = useTransform(scrollYProgress,[0,1],['0%','16%'])
  const titleY = useTransform(scrollYProgress, [0, 1], ['0%', '-22%'])
  const [intro, setIntro] = useState(() => {
    try { return !location.hash && !sessionStorage.getItem('upo-flight-v1') && !matchMedia('(prefers-reduced-motion: reduce)').matches }
    catch { return false }
  })
  useEffect(() => {
    if (!intro) return
    try { sessionStorage.setItem('upo-flight-v1', '1') } catch { /* private browsing */ }
    const timer = window.setTimeout(() => setIntro(false), 4900)
    return () => clearTimeout(timer)
  }, [intro])
  return <>
    {intro && <div className="flight-intro" onClick={() => setIntro(false)}>
      {books.map((slug, i) => <img className="flight-cover" alt="" key={slug} src={'/site/covers/' + slug + '.webp'} style={{animationDelay: i * 220 + 'ms'}} />)}
      <div className="flight-cast" aria-hidden="true"><div className="flight-rabbit"><i/><b/></div><div className="flight-butterfly"><i/><b/></div></div>
      <Btn variant="white" onClick={()=>setIntro(false)}>Pular abertura</Btn>
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
