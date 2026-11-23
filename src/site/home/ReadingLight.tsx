import { useRef, useState } from 'react'
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Button } from '@/components/ui/button'

const themes = ['Dia', 'Tarde', 'Noite'] as const

export function ReadingLight() {
  const section = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const [scrollTheme, setScrollTheme] = useState(0)
  const [choice, setChoice] = useState<number | null>(null)
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] })
  const zoom = useTransform(scrollYProgress, [0, 1], [1, 1.12])
  const horizon = useTransform(scrollYProgress, [0, 1], ['0%', '-3%'])
  useMotionValueEvent(scrollYProgress, 'change', progress => {
    setScrollTheme(Math.min(2, Math.floor(progress * 3)))
  })
  const theme = choice ?? (reduced ? 0 : scrollTheme)

  return (
    <section id="luz-da-leitura" ref={section} className="reading-light" aria-labelledby="reading-light-title">
      <div className="reading-light-stage">
        <div className="reading-light-intro">
          <div>
            <p className="journey-label">Temas do leitor</p>
            <h2 id="reading-light-title" className="journey-title">A mesma página, <br/><i>outra luz.</i></h2>
          </div>
          <div className="reading-light-tools">
            <p>Escolha a luz que acompanha a sua leitura.</p>
            <div className="chapter-options" role="group" aria-label="Tema da página ilustrada">
              {themes.map((name, index) => (
                <Button type="button" key={name} variant={theme === index ? 'default' : 'outline'} aria-pressed={theme === index} onClick={() => setChoice(index)}>{name}</Button>
              ))}
            </div>
          </div>
        </div>
        <figure className="reading-light-page" data-theme={theme}>
          <div className="reading-light-landscape">
            <motion.img src="/site/home/pemberley.webp" srcSet="/site/home/pemberley-768.webp 768w, /site/home/pemberley.webp 1536w" sizes="(max-width: 760px) 90vw, 54vw" width="1536" height="1024" loading="lazy" decoding="async" alt="Duas mulheres passeiam perto de uma ponte nos jardins de uma propriedade inglesa." style={reduced ? undefined : { scale: zoom, y: horizon }}/>
          </div>
          <figcaption>
            <cite lang="en">Pride and Prejudice</cite>
            <blockquote lang="en" cite="https://www.gutenberg.org/cache/epub/1342/pg1342.html">“She had never seen a place for which nature had done more…”</blockquote>
            <span>Jane Austen · Capítulo 43</span>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
