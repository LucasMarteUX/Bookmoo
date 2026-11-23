import { useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { COVERS, coverSrc } from '../covers'
import { Btn, ScrollRevealText } from '../ui'
import { ImageDither } from '../ImageDither'

export function ConversationPrelude() {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const near = useTransform(scrollYProgress, [0, 1], ['30%', '-36%'])
  const far = useTransform(scrollYProgress, [0, 1], ['-18%', '26%'])
  return (
    <section ref={ref} className="conversation-prelude" aria-label="Da leitura à conversa">
      <motion.img aria-hidden="true" alt="" loading="lazy" className="conversation-detail conversation-detail-ink" src="/site/home/margens.webp" style={reduced ? undefined : { y: far }}/>
      <ScrollRevealText text="Você entrou na história. Agora, como contaria o que aconteceu?" />
      <motion.img aria-hidden="true" alt="" loading="lazy" className="conversation-detail conversation-detail-voice" src="/site/home/fala.webp" style={reduced ? undefined : { y: near }}/>
      <motion.img aria-hidden="true" alt="" loading="lazy" className="conversation-detail conversation-detail-listen" src="/site/home/conversa-ouvir.webp" style={reduced ? undefined : { y: far }}/>
      <motion.img aria-hidden="true" alt="" loading="lazy" className="conversation-detail conversation-detail-call" src="/site/home/conversa-video.webp" style={reduced ? undefined : { y: near }}/>
      <motion.img aria-hidden="true" alt="" loading="lazy" className="conversation-detail conversation-detail-boy" src="/site/home/conversa-menino.webp" style={reduced ? undefined : { y: far }}/>
    </section>
  )
}

const meanings = [
  { word: 'raramente', right: false, feedback: '“Raramente” seria “rarely”. Repare: Peter vê o jardineiro e reage na hora.' },
  { word: 'depressa', right: true, feedback: 'Isso. Peter se escondeu depressa. “Quickly” diz como ele fez isso.' },
  { word: 'em silêncio', right: false, feedback: '“Em silêncio” seria “quietly”. Aqui a palavra fala de velocidade.' },
]

export function PracticePassage() {
  const section = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const [answer, setAnswer] = useState<number | null>(null)
  const { scrollYProgress } = useScroll({ target: section, offset: ['start end', 'end start'] })
  const plateY = useTransform(scrollYProgress, [0, 1], ['-4%', '4%'])
  const sheetY = useTransform(scrollYProgress, [0, .5, 1], [36, 0, -24])
  const chosen = answer === null ? null : meanings[answer]
  return (
    <section id="praticar" ref={section} className="practice-passage" aria-labelledby="practice-title">
      <div className="practice-head">
        <div>
          <p className="journey-label">Prática de vocabulário</p>
          <h2 id="practice-title" className="journey-title">O que a frase <i>conta?</i></h2>
        </div>
        <div className="practice-side">
          <p>Depois de cada página, uma pergunta rápida. A pista está na própria cena.</p>
          <nav className="practice-links" aria-label="Continuar a prática">
            <Link to="/pratica">Explorar a prática <ArrowUpRight aria-hidden size={16}/></Link>
            <Link to="/evolucao">Acompanhar a evolução <ArrowUpRight aria-hidden size={16}/></Link>
            <Link to="/prova">Conhecer a prova de nível <ArrowUpRight aria-hidden size={16}/></Link>
          </nav>
        </div>
      </div>
      <div className="practice-board">
        <figure className="practice-plate">
          <div><motion.img src="/site/home/jardim.webp" alt="Peter, de casaco azul, na horta do Sr. McGregor" loading="lazy" style={reduced ? undefined : { y: plateY }}/><ImageDither corners={['bl', 'tr']} /></div>
          <figcaption><i lang="en">The Tale of Peter Rabbit</i><span>Página 8</span></figcaption>
        </figure>
        <motion.div className="practice-sheet" style={reduced ? undefined : { y: sheetY }}>
          <p className="practice-count"><span>Questão 1 de 5</span><span>Vocabulário</span></p>
          <blockquote lang="en">When Peter saw the gardener, he <em>quickly</em> hid under a bush.</blockquote>
          <p id="practice-question" className="practice-question">O que significa <i lang="en">quickly</i> nesta frase?</p>
          <div className="practice-options" role="group" aria-labelledby="practice-question">
            {meanings.map((option, index) => {
              const state = answer === null ? undefined : option.right ? 'right' : index === answer ? 'wrong' : undefined
              return <button type="button" key={option.word} aria-pressed={index === answer} data-state={state} onClick={() => setAnswer(index)}>
                <b aria-hidden>{'ABC'[index]}</b><span>{option.word}</span>
                {state === 'right' && <Check size={17} aria-label="correta"/>}{state === 'wrong' && <X size={17} aria-label="incorreta"/>}
              </button>
            })}
          </div>
          <p className="practice-feedback" aria-live="polite" data-right={chosen?.right}>{chosen ? chosen.feedback : 'Escolha uma alternativa.'}</p>
        </motion.div>
      </div>
    </section>
  )
}

const shelfSlugs = ['the-secret-garden', 'treasure-island', 'pride-and-prejudice', 'frankenstein']
const shelf = shelfSlugs.flatMap(slug => COVERS.filter(book => book.slug === slug))

function ShelfPrint({ index, progress }: { index: number; progress: MotionValue<number> }) {
  const book = shelf[index]
  const reduced = useReducedMotion()
  const offset = [-1, .65, -.72, .9][index]
  const rise = useTransform(progress, [0, .52, 1], [offset * 48, 0, -offset * 46])
  const angle = useTransform(progress, [0, .52, 1], [offset * 6, 0, -offset * 3])
  return (
    <motion.figure className="shelf-print" style={reduced ? undefined : { y: rise, rotate: angle }}>
      <img src={coverSrc(book.slug)} width="400" height="600" alt={book.title} loading="lazy" decoding="async"/>
      <figcaption><cite lang="en">{book.title}</cite><span>{book.author} · {book.level}</span></figcaption>
    </motion.figure>
  )
}

export function LibraryShelf() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  return (
    <section ref={ref} className="library-shelf" aria-labelledby="shelf-title">
      <div className="shelf-head">
        <div><p className="journey-label">Seleção da biblioteca</p><h2 id="shelf-title" className="journey-title">Que mundo você<br/>quer <i>abrir agora?</i></h2></div>
        <Btn to="/biblioteca" arrow>Percorrer a biblioteca</Btn>
      </div>
      <div className="shelf-prints">{shelf.map((book, i) => <ShelfPrint key={book.slug} index={i} progress={scrollYProgress}/>)}</div>
    </section>
  )
}

export function LastPage() {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const backgroundY = useTransform(scrollYProgress, [0, 1], ['-6%', '6%'])
  const scale = useTransform(scrollYProgress, [0, 1], [1.08, 1])
  const copyY = useTransform(scrollYProgress, [0, .45, 1], [38, 0, -22])
  return (
    <section ref={ref} className="last-page" aria-labelledby="last-page-title">
      <motion.img src="/site/home/convite.webp" loading="lazy" alt="" className="last-page-painting" style={reduced ? undefined : { y: backgroundY, scale }}/>
      <ImageDither corners={['br', 'tr']} z={-1} />
      <motion.div className="last-page-copy" style={reduced ? undefined : { y: copyY }}>
        <h2 className="journey-title" id="last-page-title">Seu primeiro livro<br/>é um <i>presente.</i></h2>
        <p>Escolha um clássico no plano grátis e comece a ler hoje.</p>
        <div className="chapter-options"><Btn variant="white" to="/signup" arrow>Escolher meu livro</Btn><Btn variant="dark" to="/planos">Comparar planos</Btn></div>
      </motion.div>
    </section>
  )
}
