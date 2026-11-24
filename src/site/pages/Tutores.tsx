import { useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Button } from '@/components/ui/button'
import { SiteLayout } from '../SiteLayout'
import { TUTORS } from '../content'
import { TutorScroll } from '../story/Story'
import { Btn, useSeo } from '../ui'
import '../home/journey.css'
import './tutores.css'

const scenes = [
  { name: 'O capítulo', question: 'Why do you think Peter went into the garden?', reply: 'I think he wanted to explore.', art: 'conversa-menino' },
  { name: 'No café', question: 'What would you like to order?', reply: 'A coffee with milk, please.', art: 'conversa-ouvir' },
  { name: 'Seu dia', question: 'What was the best part of your day?', reply: 'I met an old friend on my way home.', art: 'tutora-leitura-1120' },
]

export function SiteTutores() {
  useSeo('Tutores · Upoonly', 'Conheça Bia, Luck, Yuno e Yuri e pratique conversação em inglês com os tutores de IA do leitor.')
  const hero = useRef<HTMLElement>(null)
  const scene = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: hero, offset: ['start start', 'end start'] })
  const { scrollYProgress: passage } = useScroll({ target: scene, offset: ['start end','end start'] })
  const zoom = useTransform(scrollYProgress, [0, 1], [1, 1.15])
  const lift = useTransform(scrollYProgress, [0, 1], [0, -45])
  const artY = useTransform(passage, [0, 1], ['-4%', '4%'])
  const [index, select] = useState(0)
  const current = scenes[index]
  return <SiteLayout><div className="home-journey tutor-edition">
    <section className="tutor-opening" ref={hero}>
      <motion.div className="tutor-opening-copy" style={reduced ? undefined : {y: lift}}>
        <p className="journey-label">Tutores de inglês</p>
        <h1 className="journey-title">Agora é sua vez de <i>falar.</i></h1>
        <p>Você leu a história. Conte o que achou, pergunte sobre uma expressão ou leve a conversa para outro lugar. Quatro tutores de IA acompanham você.</p>
        <Btn to="#encontro" arrow>Encontrar meu tutor</Btn>
      </motion.div>
      <figure><motion.img src="/site/home/tutora-leitura-1120.webp" srcSet="/site/home/tutora-leitura-640.webp 640w, /site/home/tutora-leitura-1120.webp 1120w" sizes="(max-width: 760px) 90vw, 44vw" alt="Uma leitora acompanha Peter Rabbit na tela do tablet." fetchPriority="high" style={reduced ? undefined : {scale:zoom}}/></figure>
    </section>
    <div id="encontro"><TutorScroll profile /></div>
    <section className="tutor-scenes" ref={scene}>
      <figure><motion.img key={current.art} src={'/site/home/'+current.art+'.webp'} alt="" loading="lazy" style={reduced ? undefined : {y:artY}}/></figure>
      <div><p className="journey-label">Uma amostra de conversa</p><h2 className="journey-title">Por onde <i>começar?</i></h2>
        <div className="chapter-options" role="group" aria-label="Escolher assunto">{scenes.map((s,k)=><Button type="button" key={s.name} variant={k===index?'default':'outline'} aria-pressed={k===index} onClick={()=>select(k)}>{s.name}</Button>)}</div>
        <div className="tutor-exchange" aria-live="polite"><p lang="en">{current.question}</p><p lang="en">{current.reply}</p></div>
        <p>Converse pelo celular ou computador. Ajuste a velocidade da voz e retome o assunto em outra conversa.</p>
      </div>
    </section>
    <section className="tutor-profiles"><div><p className="journey-label">Guia dos tutores</p><h2 className="journey-title">Cada voz, <i>um ritmo.</i></h2></div>
      <div>{TUTORS.map(t=><details key={t.id}><summary>{t.name}<span>{t.role}</span></summary><blockquote>“{t.line}”</blockquote><p>{t.voice} {t.style}</p><ul>{t.fits.map(fit=><li key={fit}>{fit}</li>)}</ul><p>{t.when}</p></details>)}</div>
    </section>
    <section className="tutor-invite"><div className="tutor-invite-copy"><h2 className="journey-title">Vamos <i>conversar?</i></h2><p>O plano grátis inclui uma cena de teste. O tempo de conversa e o acesso ao tutor de leitura variam conforme o plano.</p><div className="chapter-options"><Btn to="/signup" variant="white" arrow>Experimentar uma cena</Btn><Btn to="/planos" variant="light" className="invite-outline">Comparar planos</Btn></div></div><img loading="lazy" decoding="async" src="/site/home/tutora-convite-1120.webp" srcSet="/site/home/tutora-convite-640.webp 640w, /site/home/tutora-convite-1120.webp 1120w" sizes="(max-width: 760px) 100vw, 44vw" alt="Uma leitora com fones conversa diante do notebook, à luz da janela." /></section>
  </div></SiteLayout>
}
