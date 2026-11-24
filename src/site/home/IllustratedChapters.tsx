import { useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Btn } from '../ui'
import { VReader, VSpeak, VRaioX } from '../vignettes'
import { Fit, VNotes } from '../vignettes2'
import './illustrated-chapters.css'
import { ImageDither } from '../ImageDither'

function VocabularyEntry() {
  return (
    <details className="folio-word">
      <summary>
        <span lang="en">voyage</span>
        <span className="folio-translation">
          <span className="folio-show">Ver tradução</span><span className="folio-hide">Ocultar</span>
          <ChevronDown size={14} aria-hidden="true" />
        </span>
      </summary>
      <div className="folio-meaning">Viagem longa, especialmente por mar.</div>
    </details>
  )
}

const chapters = {
  narracao: {
    label: 'Narração', title: 'Siga a', emphasis: 'voz.',
    copy: 'A palavra se ilumina enquanto a história é narrada. Ajuste a velocidade e acompanhe o inglês no ritmo do seu ouvido.',
    alt: 'Um gramofone ao lado de um celular aberto em uma página ilustrada.',
    to: '/leitor', action: 'Conhecer o leitor', Demo: VReader,
  },
  palavras: {
    label: 'Vocabulário', title: 'Uma palavra', emphasis: 'puxa outra.',
    copy: 'Guarde as palavras que chamaram sua atenção. Quando voltar a elas, você encontra o significado junto da lembrança do livro.',
    alt: 'Uma leitora de vestido verde lê um livro antigo à janela, com o celular ao lado.',
    to: '/pratica', action: 'Explorar a revisão', Demo: VocabularyEntry,
  },
  margens: {
    label: 'Notas de leitura', title: 'Escreva nas', emphasis: 'margens.',
    copy: 'Marque a frase que merece uma segunda leitura e deixe uma nota na própria página.',
    alt: 'Uma passagem em inglês recebe anotações com uma caneta digital.',
    to: '/leitor', action: 'Ver as ferramentas', Demo: VNotes,
  },
  fala: {
    label: 'Prática de fala', title: 'Agora, na', emphasis: 'sua voz.',
    copy: 'Leia a passagem em voz alta. Veja quais palavras você acertou e descubra onde vale tentar de novo.',
    alt: 'Um leitor pratica em voz alta diante do computador.',
    to: '/pratica', action: 'Explorar a prática', Demo: VSpeak,
  },
  percurso: {
    label: 'Evolução', title: 'Veja o caminho', emphasis: 'percorrido.',
    copy: 'O Raio-X reúne fala, ditado, conversa, vocabulário e constância para mostrar o que praticar a seguir.',
    alt: 'Um mapa com o percurso de um navio aparece no tablet ao lado de uma bússola.',
    to: '/evolucao', action: 'Conhecer o Raio-X', Demo: VRaioX,
  },
  aventura: {
    label: 'Biblioteca', title: 'O próximo', emphasis: 'porto.',
    copy: 'De uma ilha de piratas a um jardim escondido. Encontre um clássico pelo seu nível ou traga um EPUB ou PDF.',
    alt: 'Um cartógrafo escolhe uma aventura no tablet diante do porto.',
    to: '/biblioteca', action: 'Abrir a biblioteca', Demo: null,
  },
}

type ChapterName = keyof typeof chapters

export function IllustratedChapter({ name, reverse = false }: { name: ChapterName; reverse?: boolean }) {
  const { label, title, emphasis, copy, alt, to, action, Demo } = chapters[name]
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const artY = useTransform(scrollYProgress, [0, 1], ['-3.2%', '3.2%'])
  const artScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.12, 1.045, 1.12])
  const windowEdge = useTransform(scrollYProgress, [0, 0.36, 0.72, 1], [
    'inset(8% 4% 0% 4%)', 'inset(0% 0% 0% 0%)', 'inset(0% 0% 0% 0%)', 'inset(0% 3% 7% 3%)',
  ])
  const letterY = useTransform(scrollYProgress, [0, 0.48, 1], [36, 0, -20])
  const sampleY = useTransform(scrollYProgress, [0, 0.52, 1], [20, 0, -10])

  return (
    <section ref={ref} className="illustrated-chapter folio-plate" data-chapter={name} data-reverse={reverse} aria-labelledby={`folio-title-${name}`}>
      <motion.figure className="folio-image" style={reduced ? undefined : { clipPath: windowEdge }}>
        <motion.img src={`/site/home/${name === 'aventura' ? 'cartografo' : name}.webp`} alt={alt} loading="lazy" decoding="async" width="506" height="506"
          style={reduced ? undefined : { y: artY, scale: artScale }} />
        <ImageDither corners={reverse ? ['br', 'tl'] : ['bl', 'tr']} />
      </motion.figure>
      <div className="folio-body">
        <motion.div className="folio-introduction" style={reduced ? undefined : { y: letterY }}>
          <span className="folio-label">{label}</span>
          <h2 id={`folio-title-${name}`}>{title} <em>{emphasis}</em></h2>
          <p>{copy}</p>
        </motion.div>
        {Demo && <motion.div className="folio-sample" style={reduced ? undefined : { y: sampleY }}>
          {name === 'palavras' ? <Demo /> : <Fit><Demo /></Fit>}
        </motion.div>}
        <div className="folio-action"><Btn to={to} arrow>{action}</Btn></div>
      </div>
    </section>
  )
}
