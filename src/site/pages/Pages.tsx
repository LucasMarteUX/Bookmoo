// Páginas internas no mesmo padrão da Home: abertura centralizada, fotos humanas, blocos em tons suaves e respiro.
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, BookOpen, Clock, Headphones, Mic, PenLine } from 'lucide-react'
import { ReportPreview } from '@/pages/proficiency/ReportPreview'
import { BAND_CEFR, SECTION_LABEL, SECTION_PLAN, type Section } from '@/lib/proficiencyApi'
import { SiteLayout } from '../SiteLayout'
import { useSeo } from '../ui'
import { FaqSection, FinalCta } from '../sections'
import { CompareTable, Pricing } from '../blocks'
import { LiveTutor } from '../LiveTutor'
import { SUPPORT_EMAIL, TUTORS, tutorAvatar, tutorImg } from '../content'
import { VMemory, VPhone, VScenes, VSpeed } from '../vignettes2'
import { VTutorChat } from '../vignettes'
import { In, SectionHead, Tiles } from '../story/Showcase'

const EASE = [0.2, 0.8, 0.2, 1] as const

/** Abertura das páginas: igual ao topo da Home. */
function PageHero({ kicker, title, text, actions, children }: { kicker: string; title: ReactNode; text: string; actions?: ReactNode; children?: ReactNode }) {
  const reduce = useReducedMotion()
  const a = (d: number) => ({ initial: reduce ? { opacity: 0 } : { opacity: 0, y: 20, filter: 'blur(8px)' }, animate: { opacity: 1, y: 0, filter: 'blur(0px)' }, transition: { duration: 1.1, ease: EASE, delay: d } })
  return (
    <section className="sc-hero sc-page-hero">
      <div className="sc-hero-copy">
        <motion.p {...a(0.08)} className="sc-kicker">{kicker}</motion.p>
        <motion.h1 {...a(0.16)} className="sc-hero-title sc-page-title">{title}</motion.h1>
        <motion.p {...a(0.26)} className="sc-hero-lead">{text}</motion.p>
        {actions && <motion.div {...a(0.36)} className="sc-hero-actions">{actions}</motion.div>}
      </div>
      {children && <motion.div className="sc-page-media" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.3, ease: EASE, delay: 0.45 }}>{children}</motion.div>}
    </section>
  )
}

const Primary = ({ to, children }: { to: string; children: ReactNode }) => <Link to={to} className="sc-btn sc-btn-dark">{children} <ArrowRight size={16} /></Link>
const Secondary = ({ to, children }: { to: string; children: ReactNode }) => <Link to={to} className="sc-btn sc-btn-line">{children}</Link>

/* ================================================================ Planos */

export function SitePlanos() {
  useSeo('Planos · Upoonly', 'Compare os planos do leitor Upoonly, as formas de pagamento e os créditos de cada assinatura.')
  return (
    <SiteLayout>
      <PageHero kicker="Planos" title={<>Escolha como quer <i>ler</i>.</>}
        text="O primeiro livro é seu no plano Grátis. Nos planos pagos, você abre toda a galeria e recebe novos créditos de IA a cada mês. No anual, você paga 20% menos." />
      <section className="sc-section sc-plans-wrap"><Pricing /></section>
      <section className="sc-section">
        <SectionHead kicker="Comparar" title={<>Os planos, <i>lado a lado</i>.</>} text="Limites de importação, conversas com os tutores e tudo o que vem em cada plano." />
        <In><CompareTable /></In>
      </section>
      <FaqSection ids={['pagar', 'creditos', 'presente', 'cancelar']} />
    </SiteLayout>
  )
}

/* ================================================================ Tutores */

function TutorHero() {
  const [i, setI] = useState(0)
  const t = TUTORS[i]
  return (
    <section className="sc-thero">
      <div className="sc-thero-grid">
        <div className="sc-thero-copy">
          <In><p className="sc-kicker">Tutores de IA</p><h1 className="sc-hero-title sc-page-title">Vamos conversar <i>em inglês</i>?</h1></In>
          <In delay={0.08}><p className="sc-lead">Quatro tutores, cada um com sua voz e seu jeito. Passe o mouse, toque neles e veja como reagem.</p></In>
          <In delay={0.12}>
            <div className="sc-thero-picks" role="group" aria-label="Escolher tutor">
              {TUTORS.map((x, k) => <button type="button" key={x.id} aria-pressed={k === i} onClick={() => setI(k)}><img src={tutorAvatar(x.id)} alt="" />{x.name}</button>)}
            </div>
          </In>
          <AnimatePresence mode="wait">
            <motion.div key={t.id} className="sc-thero-about" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.45, ease: EASE }}>
              <p className="sc-thero-role">{t.name}, {t.role.toLowerCase()}</p>
              <p>{t.about}</p>
              <p className="sc-thero-voice">{t.voice}</p>
            </motion.div>
          </AnimatePresence>
          <In delay={0.16}><div className="sc-hero-actions" style={{ justifyContent: 'flex-start' }}><Primary to="/signup">Experimentar uma conversa</Primary><Secondary to="/planos">Ver planos</Secondary></div></In>
        </div>
        <motion.div className="sc-thero-stage" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, ease: EASE, delay: 0.2 }}
          style={{ background: `radial-gradient(70% 60% at 50% 32%, #fff 0%, ${t.tint} 78%)` }}>
          <LiveTutor id={t.id} bubble="head" />
        </motion.div>
      </div>
    </section>
  )
}

export function SiteTutores() {
  useSeo('Tutores · Upoonly', 'Conheça Bia, Luck, Yuno e Yuri e pratique conversação em inglês com os tutores de IA do leitor.')
  return (
    <SiteLayout>
      <TutorHero />

      <section className="sc-section">
        <In className="sc-photo-band">
          <img src="/site/home/conversar.webp" alt="Uma jovem rindo enquanto conversa em inglês com a tutora pelo celular" />
          <div className="sc-photo-chip"><img src={tutorAvatar('bia')} alt="" /><p lang="en">Great sentence! Just one tip…</p></div>
          <div className="sc-photo-caption"><p>22:10 · antes de dormir</p><h2>Falar em voz alta fica leve quando alguém <i>torce por você</i>.</h2></div>
        </In>
      </section>

      <section className="sc-section">
        <SectionHead kicker="Sobre o que conversar" title={<>Do capítulo de hoje <i>à vida real</i>.</>}
          text="Abra uma conversa sobre o livro, entre numa cena como pedir um café ou chegar a uma entrevista, ou simplesmente fale sobre o seu dia." />
        <Tiles tiles={[
          { title: 'O capítulo de hoje', text: 'Converse sobre os personagens e peça ajuda com as expressões do texto.', to: '/signup', tone: 'blush', span: 7, visual: <VTutorChat /> },
          { title: 'Cenas da vida real', text: 'Café, aeroporto, entrevista. Pratique antes de precisar.', to: '/signup', tone: 'sage', span: 5, visual: <VScenes /> },
          { title: 'Eles lembram de você', text: 'A conversa continua de onde parou.', to: '/signup', tone: 'sand', span: 4, visual: <VMemory /> },
          { title: 'Vozes naturais', text: 'Escolha a voz e a velocidade de cada tutor.', to: '/signup', tone: 'sky', span: 4, visual: <VSpeed /> },
          { title: 'No celular também', text: 'Leia no computador e converse no celular.', to: '/signup', tone: 'sage', span: 4, visual: <VPhone /> },
        ]} />
      </section>

      <section className="sc-section sc-note-line">
        <In><p>O Grátis inclui uma cena de teste. A duração das cenas, o tutor de leitura e a conversa livre variam de acordo com o plano. <Link to="/planos" className="sc-textlink">Comparar planos <ArrowRight size={15} /></Link></p></In>
      </section>
      <FinalCta />
    </SiteLayout>
  )
}

/* ================================================================ Prova */

const examSections: { id: Section; icon: typeof BookOpen; description: string; tone: 'sage' | 'sand' | 'blush' | 'sky' }[] = [
  { id: 'reading', icon: BookOpen, description: 'Complete palavras e interprete textos do cotidiano e passagens acadêmicas.', tone: 'sage' },
  { id: 'listening', icon: Headphones, description: 'Ouça conversas, avisos e aulas curtas. Cada áudio toca uma vez.', tone: 'sky' },
  { id: 'writing', icon: PenLine, description: 'Monte frases, escreva um e-mail e defenda uma ideia em uma discussão.', tone: 'sand' },
  { id: 'speaking', icon: Mic, description: 'Repita frases e responda em voz alta às perguntas de uma entrevista.', tone: 'blush' },
]
const examMinutes = examSections.reduce((sum, s) => sum + SECTION_PLAN[s.id].minutes, 0)

export function SiteProva() {
  useSeo('Prova de proficiência · Upoonly', 'Avaliação de leitura, escuta, escrita e fala, com relatório e estimativa CEFR no plano Pro.')
  return (
    <SiteLayout>
      <section className="sc-thero sc-prova-hero">
        <div className="sc-thero-grid">
          <div className="sc-thero-copy">
            <In><p className="sc-kicker">Prova de proficiência · Plano Pro</p><h1 className="sc-hero-title sc-page-title">Seu inglês em <i>quatro habilidades</i>.</h1></In>
            <In delay={0.08}><p className="sc-lead">Leitura, escuta, escrita e fala em cerca de {examMinutes} minutos. O relatório mostra seu nível em cada habilidade, a estimativa CEFR e o que treinar a seguir.</p></In>
            <In delay={0.14}><div className="sc-hero-actions" style={{ justifyContent: 'flex-start' }}><Primary to="/signup?plano=pro">Começar com o Pro</Primary><Secondary to="/planos">Ver planos</Secondary></div></In>
          </div>
          <In delay={0.1} className="sc-prova-visual">
            <div className="theme-light sc-report" style={{ background: 'transparent' }}><ReportPreview /></div>
            <motion.div className="sc-prova-chip sc-prova-chip-a" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE, delay: 0.6 }}><b>B2</b><span>Independente avançado</span></motion.div>
            <motion.div className="sc-prova-chip sc-prova-chip-b" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE, delay: 0.85 }}><Mic size={15} /><span>Speaking · 4 de 6</span></motion.div>
          </In>
        </div>
      </section>

      <section className="sc-section">
        <SectionHead kicker={`Cerca de ${examMinutes} minutos`} title={<>Por dentro <i>da prova</i>.</>} text="Você faz as quatro seções em ordem, cada uma com seu cronômetro. As respostas são salvas durante a prova." />
        <div className="sc-tiles">
          {examSections.map(({ id, icon: Icon, description, tone }, k) => (
            <In key={id} delay={(k % 2) * 0.08} className="sc-tile-cell sc-span-6">
              <div className="sc-tile sc-fact" data-tone={tone}>
                <div className="sc-fact-top"><span className="sc-fact-icon"><Icon size={20} /></span><span className="sc-fact-min"><Clock size={14} />{SECTION_PLAN[id].minutes} min</span></div>
                <p className="sc-tile-title">{SECTION_LABEL[id].en}</p>
                <p className="sc-tile-text"><b>{SECTION_PLAN[id].items} itens.</b> {description}</p>
              </div>
            </In>
          ))}
        </div>
      </section>

      <section className="sc-section">
        <SectionHead kicker="Resultado" title={<>Uma faixa de 1 a 6, <i>e o seu CEFR</i>.</>} text="Leitura e escuta se adaptam ao seu desempenho. Escrita e fala recebem comentários por critério." />
        <In><div className="sc-levels">{[...BAND_CEFR].reverse().map(l => <div key={l.cefr}><b>{l.cefr}</b><span>{l.pt}</span><small>Faixa {l.band}</small></div>)}</div></In>
        <In><p className="sc-fineprint">Avaliação interna do Upoonly, inspirada no formato público do TOEFL iBT. A ETS não certifica a prova. O resultado serve para acompanhar seus estudos. O Pro inclui duas tentativas por mês.</p></In>
      </section>
      <FinalCta />
    </SiteLayout>
  )
}

/* ================================================================ Sobre */

export function SiteSobre() {
  useSeo('Sobre · Upoonly', 'Conheça o leitor, as histórias e os tutores do Upoonly.')
  return (
    <SiteLayout>
      <PageHero kicker="Sobre o Upoonly" title={<>Tudo começa com <i>um bom livro</i>.</>}
        text="Criamos o leitor que gostaríamos de ter tido quando começamos a estudar inglês. Um lugar para descobrir uma história e entender o idioma enquanto ela acontece."
        actions={<><Primary to="/signup">Começar grátis</Primary><Secondary to="/recursos">Conhecer o leitor</Secondary></>} />
      <section className="sc-section">
        <div className="sc-split sc-story">
          <In className="sc-story-photo"><img src="/site/home/ouvir.webp" alt="Um jovem sorrindo enquanto ouve um livro em inglês no celular, no trem" /></In>
          <div>
            <In><p className="sc-kicker">Nossa história</p><h2 className="sc-title">Aprender inglês não precisava <i>ser chato</i>.</h2></In>
            <In delay={0.06}><p className="sc-lead">A gente aprendeu de verdade quando parou de decorar listas e começou a ler o que gostava. O difícil era o resto: parar a cada palavra, abrir o tradutor, perder o fio da história.</p></In>
            <In delay={0.12}><p className="sc-lead">O Upoonly junta tudo isso num lugar só. A história continua, a palavra é explicada ali mesmo, e quando você quiser falar, tem alguém para conversar.</p></In>
          </div>
        </div>
      </section>
      <section className="sc-section">
        <SectionHead kicker="No que acreditamos" title={<>Quatro ideias <i>que guiam o Upoonly</i>.</>} text="Elas decidem o que entra no leitor e o que fica de fora." />
        <Tiles tiles={[
          { title: 'A história vem primeiro', text: 'Você abre um livro porque quer saber o que acontece. O inglês vem junto, não no lugar.', to: '/leitor', tone: 'sand', span: 6 },
          { title: 'Errar faz parte', text: 'Os tutores corrigem com carinho e comemoram cada acerto. Falar em voz alta tem que ser leve.', to: '/tutores', tone: 'blush', span: 6 },
          { title: 'Português quando ajuda', text: 'Explicações, gramática e diagnóstico em português, para você entender e seguir em frente.', to: '/leitor', tone: 'sage', span: 6 },
          { title: 'No seu ritmo', text: 'Do A1 ao C2, no computador ou no celular, alguns minutos por dia ou um capítulo inteiro.', to: '/evolucao', tone: 'sky', span: 6 },
        ]} />
      </section>
      <section className="sc-section">
        <In><div className="sc-numbers">
          <div><b>100+</b><span>clássicos em inglês, com capa nova e nível indicado</span></div>
          <div><b>16</b><span>estilos para ilustrar as páginas</span></div>
          <div><b>4</b><span>tutores para conversar por voz</span></div>
          <div><b>A1–C2</b><span>do primeiro conto ao Sherlock Holmes</span></div>
        </div></In>
      </section>
      <section className="sc-section">
        <SectionHead kicker="As vozes do Upoonly" title={<>Quem vai ler <i>com você</i>.</>} text="Cada tutor tem uma voz e um jeito de conversar. Escolha quem vai dividir a próxima leitura com você." />
        <div className="sc-cast">
          {TUTORS.map((t, k) => (
            <In key={t.id} delay={k * 0.06}>
              <Link to="/tutores" className="sc-cast-card" style={{ background: t.tint }}>
                <img src={tutorImg(t.id, true)} alt="" loading="lazy" />
                <div><p className="sc-tile-title">{t.name}</p><p className="sc-tile-text">{t.role}</p></div>
              </Link>
            </In>
          ))}
        </div>
      </section>
      <section id="contato" className="sc-section sc-note-line">
        <In><p className="sc-kicker">Fale com a gente</p><h2 className="sc-title">Sugestões, dúvidas <i>ou parcerias</i>?</h2>
          <p className="sc-lead" style={{ marginInline: 'auto' }}>Escreva para a nossa equipe. Respondemos sugestões de livros, dúvidas sobre a conta e propostas para escolas.</p>
          <a className="sc-textlink" href={'mailto:' + SUPPORT_EMAIL}>{SUPPORT_EMAIL} <ArrowRight size={15} /></a></In>
      </section>
      <FinalCta />
    </SiteLayout>
  )
}
