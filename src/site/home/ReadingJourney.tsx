import { useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, X } from 'lucide-react'
import { CATALOG, coverSrc, type Book } from '../catalog'
import { Btn, ScrollRevealText, useNarrow } from '../ui'
import { ImageDither } from '../ImageDither'

export function ConversationPrelude() {
  const ref = useRef<HTMLElement>(null)
  // No celular o paralaxe grande as levava por cima do texto: lá elas só se afastam da frase (as de cima
  // sobem, as de baixo descem) e escorregam para fora pela borda da tela.
  const narrow = useNarrow()
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  // As pinturas sobem mais rápido que o texto (parallax): as próximas correm mais, as distantes menos.
  const near = useTransform(scrollYProgress, [0, 1], [260, -320])
  const far = useTransform(scrollYProgress, [0, 1], [140, -170])
  const topY = useTransform(scrollYProgress, [0, 1], [34, -34])
  const bottomY = useTransform(scrollYProgress, [0, 1], [-34, 34])
  const outL = useTransform(scrollYProgress, [0, 1], [0, -28])
  const outR = useTransform(scrollYProgress, [0, 1], [0, 28])
  const motionFor = (place: 'tl' | 'tr' | 'bl' | 'br', desktop: MotionValue<number>) => reduced ? undefined
    : narrow ? { y: place[0] === 't' ? topY : bottomY, x: place[1] === 'l' ? outL : outR }
    : { y: desktop }
  return (
    <section ref={ref} className="conversation-prelude" aria-label="Da leitura à conversa">
      <motion.img aria-hidden="true" alt="" loading="lazy" className="conversation-detail conversation-detail-ink" src="/site/home/margens.webp" style={motionFor('tl', far)}/>
      <ScrollRevealText text="Você entrou na história. Agora, como contaria o que aconteceu?" />
      <motion.img aria-hidden="true" alt="" loading="lazy" className="conversation-detail conversation-detail-voice" src="/site/home/fala.webp" style={motionFor('br', near)}/>
      <motion.img aria-hidden="true" alt="" loading="lazy" className="conversation-detail conversation-detail-listen" src="/site/home/conversa-ouvir.webp" style={motionFor('tr', far)}/>
      <motion.img aria-hidden="true" alt="" loading="lazy" className="conversation-detail conversation-detail-call" src="/site/home/conversa-video.webp" style={motionFor('bl', near)}/>
      <motion.img aria-hidden="true" alt="" loading="lazy" className="conversation-detail conversation-detail-boy" src="/site/home/conversa-menino.webp" style={narrow || reduced ? undefined : { y: far }}/>
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

// Seleção da biblioteca: três fileiras de capas passando sozinhas, em velocidade constante e sentidos
// alternados, com uma placa de categoria abrindo cada grupo. É vitrine, não galeria: sem filtro nem
// paginação, sem parar no mouse e sem depender da rolagem; quem quer escolher vai para /livros.
const PER_GROUP = 6
const groups = [...new Set(CATALOG.map(book => book.category))]
  .map(category => ({ category, books: CATALOG.filter(book => book.category === category) }))
  .sort((a, b) => b.books.length - a.books.length)
// Distribui as categorias em três fileiras de tamanho parecido.
const rows: { category: string; total: number; books: Book[] }[][] = [[], [], []]
for (const g of groups) {
  const lightest = rows.reduce((min, row, i) => (row.reduce((n, x) => n + x.books.length, 0) < rows[min].reduce((n, x) => n + x.books.length, 0) ? i : min), 0)
  rows[lightest].push({ category: g.category, total: g.books.length, books: g.books.slice(0, PER_GROUP) })
}
const ROW_SPEED = [96, 118, 84] // segundos para uma volta completa

function RiverRow({ row, index }: { row: typeof rows[number]; index: number }) {
  const reduced = useReducedMotion()
  // A faixa vai duas vezes seguidas: quando a primeira sai inteira, a segunda está no lugar dela.
  const items = (copy: number) => row.flatMap(group => [
    <div key={`${copy}-g-${group.category}`} className="river-genre" aria-hidden={copy > 0 || undefined}>
      <span className="river-genre-kicker">{String(group.total).padStart(2, '0')} livros</span>
      <i>{group.category}</i>
    </div>,
    ...group.books.map(book => (
      <Link key={`${copy}-${book.slug}`} to={`/livro/${book.slug}`} className="river-book" tabIndex={copy > 0 ? -1 : undefined} aria-hidden={copy > 0 || undefined}>
        <img src={coverSrc(book.slug)} width="400" height="600" alt={copy > 0 ? '' : book.title} loading="lazy" decoding="async"/>
        {book.level && <span className="river-book-level">{book.level}</span>}
      </Link>
    )),
  ])
  return (
    <div className="river-row">
      <div className={`river-track${index % 2 ? ' is-reverse' : ''}`} style={{ ['--river-dur' as string]: `${ROW_SPEED[index]}s` }}>
        {items(0)}{!reduced && items(1)}
      </div>
    </div>
  )
}

export function LibraryShelf() {
  return (
    <section className="library-shelf" aria-labelledby="shelf-title">
      <div className="shelf-head">
        <div><p className="journey-label">Seleção da biblioteca</p><h2 id="shelf-title" className="journey-title">Que mundo você<br/>quer <i>abrir agora?</i></h2></div>
        <Btn to="/livros" arrow>Percorrer a biblioteca</Btn>
      </div>
      <div className="shelf-river">
        {rows.filter(row => row.length).map((row, i) => <RiverRow key={i} row={row} index={i}/>)}
      </div>
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
