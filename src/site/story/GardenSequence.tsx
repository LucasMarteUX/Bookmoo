import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react'

const captions = ['Uma frase abre o jardim.', 'Uma palavra ganha voz.', 'Agora, entre na história.']
const crops = ['3% 72%', '96% 18%', '90% 97%', '50% 26%']

function Caption({ text, index, progress }: {text: string; index: number; progress: MotionValue<number>}) {
  const stops = [[0,.22,.34,1],[.24,.38,.55,.68],[.58,.72,.82,.92]][index]
  const opacity = useTransform(progress, stops, index === 0 ? [1,1,0,0] : [0,1,1,0])
  const scale = useTransform(progress, stops, index === 0 ? [1,1,.82,.82] : [.82,1,1,.82])
  return <motion.p style={{opacity,scale}}>{text}</motion.p>
}

function Fragment({ index, progress }: {index: number; progress: MotionValue<number>}) {
  const direction = index % 2 ? 1 : -1
  const x = useTransform(progress,[0,.82],[0,direction * 125])
  const y = useTransform(progress,[0,.82],[index % 2 ? 70 : -30,index < 2 ? -150 : 140])
  const scale = useTransform(progress,[0,.82],[.82,1.48])
  const opacity = useTransform(progress,[.71,.88],[1,0])
  return <motion.i style={{x,y,scale,opacity,backgroundPosition:crops[index]}} />
}

export function GardenSequence() {
  const section = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const {scrollYProgress} = useScroll({target:section,offset:['start 0.85','end end']})
  const inset = useTransform(scrollYProgress,[.78,1],['inset(48% 46% 48% 46%)','inset(0% 0% 0% 0%)'])
  const opacity = useTransform(scrollYProgress,[.79,.91],[0,1])
  return <section ref={section} className="garden-sequence" aria-label="Dentro da história">
    <div className="garden-stage">
      {!reduced && <div className="garden-pieces" aria-hidden="true">{crops.map((crop,i)=><Fragment key={crop} index={i} progress={scrollYProgress}/>)}</div>}
      <div className="garden-captions">{captions.map((text,i)=>reduced ? <p key={text}>{text}</p> : <Caption key={text} text={text} index={i} progress={scrollYProgress}/>)}</div>
      <motion.img className="garden-reveal" src="/site/home/jardim.webp" alt="" style={reduced ? undefined : {clipPath:inset,opacity}}/>
    </div>
  </section>
}
