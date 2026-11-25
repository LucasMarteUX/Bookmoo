import { useEffect, useId, useRef, useState } from 'react'
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { ImageDither } from '../ImageDither'
import './illustration-atelier.css'

const plates = [
  { id: 'aquarela', label: 'Aquarela', technique: 'Aquarela sobre papel', alt: 'Jim contempla o navio na enseada. O verde do pinheiro e o azul do mar se misturam em aguadas.' },
  { id: 'manga', label: 'Mangá', technique: 'Nanquim e retícula', alt: 'Jim segura um pinheiro diante do navio. Hachuras desenham o vento, as rochas e as ondas em preto e branco.' },
  { id: 'noir', label: 'Noir', technique: 'Luz e sombra', alt: 'Jim observa o navio ao anoitecer. Uma lanterna dourada atravessa a névoa azul da enseada.' },
] as const

type PlateId = typeof plates[number]['id']

export function IllustrationAtelier() {
  const section = useRef<HTMLElement>(null)
  const titleId = useId()
  const imageId = useId()
  const [selected, setSelected] = useState<PlateId>('aquarela')
  const [displayed, setDisplayed] = useState<PlateId>('aquarela')
  const [requested, setRequested] = useState<PlateId[]>(['aquarela'])
  const reduce = useReducedMotion()
  // A seção "para" na tela (sticky) e os traços se trocam com a rolagem, como nos temas do leitor.
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] })
  const { scrollYProgress: enter } = useScroll({ target: section, offset: ['start end', 'start start'] })
  const typeY = useTransform(enter, [0, 1], [32, 0])
  const frameY = useTransform(enter, [0, 1], [46, 0])
  const zoom = useTransform(scrollYProgress, [0, 1], [1.02, 1.1])
  const reveal = useTransform(enter, [0, 0.8, 1], ['inset(6% 9% 4% 4%)', 'inset(0% 0% 0% 0%)', 'inset(0% 0% 0% 0%)'])
  const [chosen, setChosen] = useState(false)
  useEffect(() => { setRequested(plates.map(p => p.id)) }, [])
  useMotionValueEvent(scrollYProgress, 'change', v => {
    if (chosen || reduce) return
    const id = plates[Math.min(plates.length - 1, Math.max(0, Math.floor(v * plates.length)))].id
    if (id !== selected) select(id)
  })
  const caption = plates.find(plate => plate.id === displayed)!
  const loaded = useRef(new Set<PlateId>())

  function select(id: PlateId) {
    setSelected(id)
    if (loaded.current.has(id)) setDisplayed(id)
    else setRequested(previous => previous.includes(id) ? previous : [...previous, id])
  }

  return (
    <section id="atelie" className="illustration-atelier" ref={section} aria-labelledby={titleId}>
     <div className="atelier-stage">
      <motion.div className="atelier-copy" style={reduce ? undefined : { y: typeY }}>
        <small>Estilos de ilustração</small>
        <h2 id={titleId}>Gere um<br /><i>estilo personalizado</i></h2>
        <p>Jim avista um navio na enseada. A cena é a mesma. Escolha um traço e veja como muda a história que você imagina.</p>
      </motion.div>
      <motion.figure className="atelier-plate" style={reduce ? undefined : { y: frameY }}>
        <motion.div id={imageId} className="atelier-aperture" style={reduce ? undefined : { clipPath: reveal }}>
          <motion.div className="atelier-layers" style={reduce ? undefined : { scale: zoom }}>
            {plates.filter(plate => requested.includes(plate.id)).map(plate => {
              const base = '/site/atelier/treasure-island-' + plate.id
              return <img key={plate.id} src={base + '.webp'}
                srcSet={base + '-768.webp 768w, ' + base + '.webp 1536w'}
                sizes="(max-width: 760px) 90vw, 56vw" width={1536} height={1024}
                alt={plate.alt} aria-hidden={displayed !== plate.id} data-active={displayed === plate.id}
                loading={plate.id === 'aquarela' ? 'lazy' : 'eager'} decoding="async"
                onLoad={() => {
                  loaded.current.add(plate.id)
                  if (selected === plate.id) setDisplayed(plate.id)
                }} />
            })}
          </motion.div>
          <ImageDither corners={['bl', 'tr']} />
        </motion.div>
        <figcaption>
          <div className="atelier-credit">
            <span aria-live="polite">{caption.technique}</span>
          </div>
          <div className="atelier-commands">
            <div className="chapter-options atelier-options" role="group" aria-label="Técnica da ilustração">
              {plates.map(plate => (
                <Button key={plate.id} type="button" variant={selected === plate.id ? 'default' : 'outline'}
                  aria-pressed={selected === plate.id} aria-controls={imageId} onClick={() => { setChosen(true); select(plate.id) }}>
                  {plate.label}
                </Button>
              ))}
            </div>
            <Link className="atelier-all" to="/ilustracoes">Conhecer os 16 estilos <span aria-hidden="true">↗</span></Link>
          </div>
        </figcaption>
      </motion.figure>
     </div>
    </section>
  )
}
