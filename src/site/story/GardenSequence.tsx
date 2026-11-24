import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { useNarrow } from '../ui'

const captions = ['Leia a primeira frase.', 'Ouça como ela soa.', 'Conte do seu jeito.']
const plates = ['leitora-tablet', 'tutora-convite-640', 'mesa-tarde', 'conversa-menino', 'conversa-ouvir', 'fala', 'narracao', 'tutora-leitura-640', 'conversa-video', 'palavras']

function Caption({ text, index, progress }: {text: string; index: number; progress: MotionValue<number>}) {
  const stops = [[0,.20,.28,1],[.28,.35,.48,.56],[.56,.64,.74,.81]][index]
  const opacity = useTransform(progress, stops, index === 0 ? [1,1,0,0] : [0,1,1,0])
  const scale = useTransform(progress, stops, index === 0 ? [1,1,.82,.82] : [.82,1,1,.82])
  return <motion.p style={{opacity,scale}}>{text}</motion.p>
}

function Fragment({ index, progress, still }: {index: number; progress: MotionValue<number>; still: boolean}) {
  const initial = index < 4
  const start = initial ? 0 : .06 + (index - 4) * .085
  const side = index % 2 ? 1 : -1
  const x = useTransform(progress, [start, .86], [0, side * 45])
  const y = useTransform(progress, [start, .86], [0, index % 4 < 2 ? -38 : 38])
  const scale = useTransform(progress, [start, .86], [initial ? 1 : 1.4, .72])
  const opacity = useTransform(progress, [start, start + .09, .77, .88], [initial ? 1 : 0, 1, 1, 0])
  // Celular: as quatro pinturas se afastam da frase devagar (as de cima sobem, as de baixo descem) e
  // encolhem um pouco, sem sair da tela nem encostar uma na outra.
  const my = useTransform(progress, [0, .86], [0, index % 4 < 2 ? -18 : 18])
  const mx = useTransform(progress, [0, .86], [0, side * 6])
  const ms = useTransform(progress, [0, .86], [1, .86])
  return <motion.img src={'/site/home/' + plates[index] + '.webp'} alt="" loading="lazy" style={still ? {x: mx, y: my, scale: ms, opacity} : {x, y, scale, opacity}} />
}

export function GardenSequence() {
  const section = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const narrow = useNarrow(700)
  const {scrollYProgress} = useScroll({target:section,offset:['start start','end end']})
  const inset = useTransform(scrollYProgress,[.78,1],['inset(48% 46% 48% 46%)','inset(0% 0% 0% 0%)'])
  const opacity = useTransform(scrollYProgress,[.79,.91],[0,1])
  return <section ref={section} className="garden-sequence" aria-label="Dentro da história">
    <div className="garden-stage">
      {!reduced && <div className="study-mosaic" aria-hidden="true">{plates.map((plate,i)=><Fragment key={plate} index={i} progress={scrollYProgress} still={narrow}/>)}</div>}
      <div className="garden-captions">{captions.map((text,i)=>reduced ? <p key={text}>{text}</p> : <Caption key={text} text={text} index={i} progress={scrollYProgress}/>)}</div>
      <motion.img className="garden-reveal" src="/site/home/estudante-monitor.webp" loading="lazy" alt="Um estudante de costas ouve a leitura no computador junto à janela." style={reduced ? undefined : {clipPath:inset,opacity}}/>
    </div>
  </section>
}
