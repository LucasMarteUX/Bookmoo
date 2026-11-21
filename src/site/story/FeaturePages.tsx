// Uma página por função (Leitor, Ilustrações, Prática, Evolução, Biblioteca) e o hub Recursos. Mesma linguagem da Home:
// abertura centralizada, visual grande, blocos alternados e chamadas para as outras páginas. Nada toca no site.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { SiteLayout } from '../SiteLayout'
import { Btn, useSeo } from '../ui'
import { FinalCta } from '../sections'
import { LibraryWall } from '../home/Premium'
import { Fit, VGoal, VGrammar, VImport, VGift, VMosaic, VNotes, VStats, VStory, VStylesGrid, VThemes, VBalloon, VQuiz } from '../vignettes2'
import { VComic, VCovers, VDictation, VLevels, VProva, VRaioX, VReader, VSpeak, VTutorChat, VVocab, VWord } from '../vignettes'
import { LaptopShot, Tiles } from './Showcase'
import { GrowthVisual, Kicker, PracticeVisual, StylesVisual } from './Story'
import './story.css'

const EASE = [0.2, 0.8, 0.2, 1] as const

function Opening({ kicker, title, text, children }: { kicker: string; title: ReactNode; text: string; children?: ReactNode }) {
  const reduce = useReducedMotion()
  const a = (d: number) => ({ initial: reduce ? { opacity: 0 } : { opacity: 0, y: 18, filter: 'blur(8px)' }, animate: { opacity: 1, y: 0, filter: 'blur(0px)' }, transition: { duration: 1, ease: EASE, delay: d } })
  return (
    <section className="st-chapter" style={{ paddingTop: 'clamp(80px, 10vw, 140px)' }}>
      <div className="st-head">
        <motion.div {...a(0.08)}><Kicker>{kicker}</Kicker></motion.div>
        <motion.h1 {...a(0.16)} className="st-title" style={{ fontSize: 'clamp(42px, 6vw, 80px)' }}>{title}</motion.h1>
        <motion.p {...a(0.24)} className="st-text">{text}</motion.p>
        <motion.div {...a(0.32)} className="st-actions" style={{ marginTop: 14 }}>
          <Btn to="/signup" arrow>Começar grátis</Btn>
          <Btn to="/planos" variant="white">Ver planos</Btn>
        </motion.div>
      </div>
      {children && <div className="st-visual">{children}</div>}
    </section>
  )
}

const TONES = ['#F1EADF', '#E7ECE3', '#F5E6DF', '#E6EBF0']
function Block({ kicker, title, text, visual, flip }: { kicker: string; title: ReactNode; text: string; visual: ReactNode; flip?: boolean }) {
  const tone = TONES[[...kicker].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length]
  const reduce = useReducedMotion()
  return (
    <section className="px-5 py-[clamp(64px,9vw,128px)]">
      <div className={`mx-auto max-w-[1240px] grid gap-10 md:gap-16 md:grid-cols-2 items-center ${flip ? 'md:[&>*:first-child]:order-2' : ''}`}>
        <motion.div initial={reduce ? { opacity: 0 } : { opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-10%' }} transition={{ duration: 1, ease: EASE }}
          className="sc-fblock" style={{ ['--tone' as string]: tone }}>
          <Fit>{visual}</Fit>
        </motion.div>
        <motion.div initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-10%' }} transition={{ duration: 1, ease: EASE, delay: 0.1 }} className="flex flex-col gap-4 max-w-[520px]">
          <Kicker>{kicker}</Kicker>
          <h2 className="st-title st-title-left" style={{ fontSize: 'clamp(32px, 3.8vw, 52px)' }}>{title}</h2>
          <p className="st-text st-text-left">{text}</p>
        </motion.div>
      </div>
    </section>
  )
}

const ALL = [
  { to: '/leitor', name: 'Leitor', d: 'Áudio, karaokê e cada palavra explicada.' },
  { to: '/ilustracoes', name: 'Ilustrações', d: 'Páginas que viram imagem e quadrinho.' },
  { to: '/tutores', name: 'Tutores', d: 'Conversas em inglês por voz.' },
  { to: '/pratica', name: 'Prática', d: 'Fala, ditado e vocabulário.' },
  { to: '/evolucao', name: 'Evolução', d: 'Raio-X, metas e estatísticas.' },
  { to: '/biblioteca', name: 'Biblioteca', d: 'Clássicos e seus próprios livros.' },
  { to: '/prova', name: 'Prova', d: 'Seu nível nas 4 habilidades.' },
]

function Next({ current }: { current: string }) {
  return (
    <section className="px-5 pt-[clamp(80px,10vw,140px)]">
      <div className="mx-auto max-w-[1240px]">
        <Kicker>Continue explorando</Kicker>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ALL.filter(x => x.to !== current).slice(0, 6).map(x => (
            <Link key={x.to} to={x.to} className="group flex items-center justify-between gap-4 rounded-[20px] px-6 py-5 transition-transform duration-300 hover:-translate-y-1" style={{ background: 'var(--site-card)', boxShadow: '0 0 0 1px var(--site-line)' }}>
              <span><span className="block s-serif text-[26px] tracking-[-0.03em]">{x.name}</span><span className="block text-[14px] font-light" style={{ color: 'var(--site-muted)' }}>{x.d}</span></span>
              <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ================================================================ Páginas */

export function SiteLeitor() {
  useSeo('Leitor · Upoonly', 'Leia clássicos em inglês com áudio, karaokê e explicação de cada palavra no contexto.')
  return (
    <SiteLayout>
      <Opening kicker="O leitor" title={<>Cada página vira <i>uma aula</i>.</>} text="Ouça a página com vozes naturais, acompanhe a palavra que está sendo dita e toque em qualquer termo para entender o que ele significa ali."><LaptopShot /></Opening>
      <Block kicker="Palavras" title="Um toque e a palavra faz sentido." text="Pronúncia, significado na frase, exemplos nas formas afirmativa, negativa e pergunta, e um clique para marcar como Aprendi, Revisar ou Importante." visual={<div className="pb-20"><VWord /></div>} />
      <Block flip kicker="Gramática" title="Decifre a página." text="A gramática da página explicada em português, trecho por trecho, sem precisar sair da história." visual={<VGrammar />} />
      <Block kicker="Notas" title="Marque o que importa." text="Destaque trechos e escreva suas notas. Elas ficam junto do livro, onde você precisa delas." visual={<VNotes />} />
      <Next current="/leitor" />
      <FinalCta />
    </SiteLayout>
  )
}

export function SiteIlustracoes() {
  useSeo('Ilustrações · Upoonly', 'Cada página do livro pode virar ilustração ou quadrinho, em 16 estilos ou no seu.')
  return (
    <SiteLayout>
      <Opening kicker="Ilustrações" title={<>Leia vendo a história <i>acontecer</i>.</>} text="Cada página pode virar ilustração ou quadrinho. Escolha um dos 16 estilos ou crie o seu."><StylesVisual /></Opening>
      <Block kicker="Quadrinhos" title="A página vira quadrinho." text="As cenas ganham quadros, e as falas ganham balão com o nome do personagem." visual={<VComic />} />
      <Block flip kicker="Estilos" title="Aquarela, mangá, HQ, noir." text="Cada livro da galeria já vem com um estilo pensado para ele. Se preferir, escolha outro ou crie o seu próprio." visual={<VStylesGrid />} />
      <Block kicker="Balões" title="Os personagens ganham voz." text="Falas com balão, narrador e o nome de quem está falando, para você acompanhar a cena." visual={<VBalloon />} />
      <Block flip kicker="Comunidade" title="O que já foi ilustrado é de todos." text="Quando um leitor gera uma página no estilo padrão do livro, ela fica disponível para todo mundo, sem gastar créditos." visual={<VMosaic />} />
      <Next current="/ilustracoes" />
      <FinalCta />
    </SiteLayout>
  )
}

export function SitePratica() {
  useSeo('Prática · Upoonly', 'Pratique fala, ditado, questionário e vocabulário com o livro que você está lendo.')
  return (
    <SiteLayout>
      <Opening kicker="Prática" title={<>Fale em voz alta. <i>Sem medo de errar.</i></>} text="Treine com o livro que você está lendo: fala, ditado, questionário e revisão de vocabulário."><PracticeVisual /></Opening>
      <Block kicker="Ditado" title="Seu ouvido, em números." text="Ouça frase a frase, escreva e veja na hora o que errou. A nota por página mostra a sua evolução." visual={<VDictation />} />
      <Block flip kicker="Questionário" title="Entendeu o capítulo?" text="Perguntas sobre a história para conferir a compreensão, no seu nível." visual={<VQuiz />} />
      <Block kicker="Vocabulário" title="As palavras voltam na hora certa." text="Tudo o que você salva fica organizado em Revisar, Importante e Aprendido, com áudio e explicação." visual={<VVocab />} />
      <Block flip kicker="Reforço" title="Histórias feitas para você." text="Pequenas histórias escritas com as palavras e as estruturas em que você mais tropeça." visual={<VStory />} />
      <Next current="/pratica" />
      <FinalCta />
    </SiteLayout>
  )
}

export function SiteEvolucao() {
  useSeo('Evolução · Upoonly', 'Raio-X do seu inglês, metas, sequência e estatísticas de estudo.')
  return (
    <SiteLayout>
      <Opening kicker="Evolução" title={<>Veja o quanto <i>você evoluiu</i>.</>} text="O Raio-X mede fala, conversa, vocabulário, ditado e constância, e diz em português o que treinar a seguir."><GrowthVisual /></Opening>
      <Block kicker="Constância" title="Um pouco por dia, todos os dias." text="Defina sua meta de minutos, acompanhe a sequência e ganhe pontos por tudo o que faz no app." visual={<VGoal />} />
      <Block flip kicker="Estatísticas" title="Um ano de leitura num calendário." text="Tempo de estudo, palavras aprendidas, recordes e os horários em que você mais estuda." visual={<VStats />} />
      <Block kicker="Nível" title="Do A1 ao C2." text="O teste de nível confirma ou promove o seu nível, e o app sugere livros e exercícios na medida certa." visual={<VLevels />} />
      <Next current="/evolucao" />
      <FinalCta />
    </SiteLayout>
  )
}

export function SiteBiblioteca() {
  useSeo('Biblioteca · Upoonly', 'Mais de 100 clássicos em inglês com capa nova e nível indicado, e seus próprios EPUBs e PDFs.')
  return (
    <SiteLayout>
      <Opening kicker="Biblioteca" title={<>Os clássicos que você <i>sempre quis ler</i>.</>} text="Mais de 100 obras em domínio público, com capa nova e nível indicado. Contos de fadas para quem está começando, Sherlock e Austen para quem quer ir longe." />
      <LibraryWall head={false} />
      <Block kicker="Por nível" title="Do conto de fadas ao Sherlock." text="Quem está começando encontra contos curtos. Quem quer ir longe encontra Austen, Dickens e Conan Doyle." visual={<VCovers />} />
      <Block flip kicker="Seus livros" title="Importe EPUB e PDF." text="Leia os seus próprios livros com todas as ferramentas do Upoonly. Eles ficam só na sua conta." visual={<VImport />} />
      <Block kicker="Presente" title="Um livro seu, para sempre." text="No plano Grátis você escolhe 1 livro da galeria e ele é seu para sempre." visual={<VGift />} />
      <Next current="/biblioteca" />
      <FinalCta />
    </SiteLayout>
  )
}

export function SiteRecursos() {
  useSeo('Recursos · Upoonly', 'Tudo o que o Upoonly faz: leitor, ilustrações, tutores, prática, evolução, biblioteca e prova.')
  return (
    <SiteLayout>
      <Opening kicker="Recursos" title={<>Tudo o que o Upoonly <i>faz por você</i>.</>} text="Um leitor completo para aprender inglês com livros de verdade. Escolha por onde começar." />
      <section className="sc-section">
        <Tiles tiles={[
          { title: 'Leitor', text: 'Narração com karaokê e cada palavra explicada no contexto.', to: '/leitor', tone: 'sage', span: 7, visual: <VReader /> },
          { title: 'Ilustrações', text: 'Páginas que viram ilustração e quadrinho, em 16 estilos.', to: '/ilustracoes', tone: 'blush', span: 5, visual: <VStylesGrid /> },
          { title: 'Tutores', text: 'Converse por voz com Bia, Luck, Yuno e Yuri.', to: '/tutores', tone: 'sand', span: 5, visual: <VTutorChat /> },
          { title: 'Prática', text: 'Fala palavra por palavra, ditado e vocabulário.', to: '/pratica', tone: 'sky', span: 7, visual: <VSpeak /> },
          { title: 'Evolução', text: 'Raio-X semanal, metas e estatísticas.', to: '/evolucao', tone: 'sage', span: 4, visual: <VRaioX /> },
          { title: 'Biblioteca', text: 'Mais de 100 clássicos e seus próprios livros.', to: '/biblioteca', tone: 'sand', span: 4, visual: <VCovers /> },
          { title: 'Prova', text: 'Seu nível nas 4 habilidades, com relatório.', to: '/prova', tone: 'blush', span: 4, visual: <VProva /> },
        ]} />
      </section>
      <FinalCta />
    </SiteLayout>
  )
}
