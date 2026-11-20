import { useState, type ReactNode } from 'react'
import { Award, BookOpen, ChevronDown, Clock, Headphones, Mic, PenLine, Volume2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ReportPreview } from '@/pages/proficiency/ReportPreview'
import { BAND_CEFR, SECTION_LABEL, SECTION_PLAN, type Section } from '@/lib/proficiencyApi'
import { SiteLayout } from '../SiteLayout'
import { Btn, useSeo } from '../ui'
import { FaqSection, FinalCta } from '../sections'
import { CompareTable, CreditsTable, FeatureCatalog, Pricing } from '../blocks'
import { LiveTutor } from '../LiveTutor'
import { STYLES, SUPPORT_EMAIL, TUTORS, tutorAvatar, tutorImg } from '../content'
import { COVERS, coverSrc } from '../covers'
import './internal.css'

function Page({children}: {children: ReactNode}) {
  return <SiteLayout><div className="inside-upo">{children}</div></SiteLayout>
}

function Opening({label, title, text, actions, children}: {label: string; title: ReactNode; text: string; actions?: ReactNode; children?: ReactNode}) {
  return <section className={'ip-wrap ip-opening' + (children ? ' ip-opening-split' : '')}>
    <div className="ip-opening-copy"><p className="ip-label">{label}</p><h1>{title}</h1><p className="ip-lead">{text}</p>
      {actions && <div className="ip-actions">{actions}</div>}
    </div>
    {children}
  </section>
}

function Heading({title,text}: {title:string; text?:string}) {
  return <header className="ip-heading"><h2>{title}</h2>{text && <p>{text}</p>}</header>
}

export function SitePlanos() {
  useSeo('Planos · Upoonly', 'Compare os planos do leitor Upoonly, as formas de pagamento e os créditos de cada assinatura.')
  return <Page>
    <Opening label="Planos" title="Escolha como quer ler." text="O primeiro livro é seu no plano Grátis. Nos planos pagos, você abre toda a galeria e recebe novos créditos de IA a cada mês."/>
    <section className="ip-wrap ip-prices"><Pricing/></section>
    <section className="ip-wrap ip-section"><Heading title="Os planos, lado a lado" text="Compare os limites de importação, as conversas com tutores e os recursos incluídos."/><CompareTable/></section>
    <section className="ip-wrap ip-section ip-text-table"><Heading title="Como funcionam os créditos?" text="Você usa créditos para criar conteúdo com IA. Ler, ouvir, salvar vocabulário e praticar com seu livro fazem parte do leitor."/><CreditsTable/></section>
    <FaqSection ids={['pagar','creditos','presente','cancelar']}/>
  </Page>
}

const examSections: { id: Section; icon: typeof BookOpen; description: string }[] = [
  { id:'reading', icon:BookOpen, description:'Complete palavras e interprete textos do cotidiano e passagens acadêmicas.' },
  { id:'listening', icon:Headphones, description:'Ouça conversas, avisos e aulas curtas. Cada áudio toca uma vez.' },
  { id:'writing', icon:PenLine, description:'Monte frases, escreva um e-mail e defenda uma ideia em uma discussão.' },
  { id:'speaking', icon:Mic, description:'Repita frases e responda em voz alta às perguntas de uma entrevista.' },
]
const examMinutes = examSections.reduce((sum,s)=>sum+SECTION_PLAN[s.id].minutes,0)

export function SiteProva() {
  useSeo('Prova de proficiência · Upoonly', 'Avaliação de leitura, escuta, escrita e fala, com relatório e estimativa CEFR no plano Pro.')
  return <Page>
    <Opening label="Prova de proficiência · Plano Pro" title={<>Seu inglês em{" "}<br/>quatro habilidades.</>} text="Faça a prova de leitura, escuta, escrita e fala. O relatório mostra seu nível estimado em cada habilidade e sugere o que treinar a seguir."
      actions={<><Btn to="/signup?plano=pro" arrow>Começar com o Pro</Btn><Btn to="#estrutura" variant="light">Ver a prova</Btn></>}>
      <div className="ip-report"><ReportPreview/></div>
    </Opening>
    <section id="estrutura" className="ip-wrap ip-section ip-exam-index"><div><Heading title="Por dentro da prova" text="Você faz as quatro seções em ordem, cada uma com seu cronômetro. Abra uma seção para ver os tipos de atividade."/>
      <p className="ip-meta"><Clock size={16}/> Cerca de {examMinutes} minutos</p></div>
      <div className="ip-syllabus">{examSections.map(({id,icon:Icon,description})=>
        <details key={id}><summary><Icon size={19}/><span>{SECTION_LABEL[id].en}</span><small>{SECTION_PLAN[id].minutes} min</small><ChevronDown size={16}/></summary>
          <p><strong>{SECTION_PLAN[id].items} itens.</strong> {description}</p></details>
      )}</div>
    </section>
    <section className="ip-wrap ip-section"><Heading title="Entenda seu resultado" text="O relatório apresenta uma faixa de 1 a 6 e a estimativa correspondente na escala CEFR. Leitura e escuta se adaptam ao seu desempenho. Escrita e fala recebem comentários por critério."/>
      <div className="ip-levels">{[...BAND_CEFR].reverse().map(level=><div key={level.cefr}><strong>{level.cefr}</strong><span>{level.pt}</span><small>Faixa {level.band}</small></div>)}</div>
      <p className="ip-note">Avaliação interna do Upoonly, inspirada no formato público do TOEFL iBT. A ETS não certifica a prova. O resultado serve para acompanhar seus estudos.</p>
    </section>
    <section className="ip-wrap ip-section ip-text-table"><Heading title="Antes de começar"/><div className="ip-prose"><p>Reserve cerca de uma hora e meia e teste o áudio e o microfone. As respostas são salvas durante a prova.</p><p>O Pro inclui duas tentativas por mês. No histórico, você acompanha os resultados e consulta as recomendações para a próxima sessão de estudo.</p><Btn to="/planos" variant="light" arrow>Ver o plano Pro</Btn></div></section>
  </Page>
}

const shelfTitles = ['pride-and-prejudice','alices-adventures-in-wonderland','the-adventures-of-sherlock-holmes']
function Bookshelf() {
  return <div className="ip-bookshelf" aria-label="Clássicos disponíveis na galeria">{shelfTitles.map(slug=>{
    const book=COVERS.find(item=>item.slug===slug)!
    return <img key={slug} src={coverSrc(slug)} alt={book.title} width={160} height={240}/>
  })}</div>
}

export function SiteSobre() {
  useSeo('Sobre · Upoonly','Conheça o leitor, as histórias e os tutores do Upoonly.')
  return <Page>
    <Opening label="Sobre o Upoonly" title="Tudo começa com um bom livro." text="Criamos o leitor que gostaríamos de ter tido quando começamos a estudar inglês. Um lugar para descobrir uma história e entender o idioma enquanto ela acontece." actions={<Btn to="/recursos" variant="light" arrow>Conhecer o leitor</Btn>}>
      <Bookshelf/>
    </Opening>
    <section className="ip-wrap ip-section ip-text-table"><Heading title="Por que aprender com histórias?"/><div className="ip-prose"><p>Uma palavra é mais fácil de lembrar quando você sabe quem a disse. Uma frase ganha outro sentido quando você conhece o personagem.</p><p>No Upoonly, você ouve a narração, consulta uma expressão dentro do parágrafo e volta ao mesmo ponto. Depois, pode conversar sobre a história com um tutor.</p></div></section>
    <section className="ip-wrap ip-section"><Heading title="As vozes que acompanham você" text="Cada tutor tem uma voz e um jeito de conversar. Conheça quem vai dividir a próxima leitura com você."/>
      <div className="ip-cast">{TUTORS.map(t=><figure key={t.id}><div><img loading="lazy" src={tutorImg(t.id,true)} alt=""/></div><figcaption><strong>{t.name}</strong><span>{t.role}</span></figcaption></figure>)}</div>
      <div className="ip-actions"><Btn to="/tutores" variant="light" arrow>Conhecer os tutores</Btn></div>
    </section>
    <section id="contato" className="ip-wrap ip-section ip-text-table"><Heading title="Fale com a gente"/><div className="ip-prose"><p>Para enviar sugestões de livros, tirar dúvidas sobre a conta ou conversar sobre parcerias com escolas, escreva para nossa equipe.</p><a className="ip-textlink" href={'mailto:'+SUPPORT_EMAIL}>{SUPPORT_EMAIL}</a></div></section>
    <FinalCta/>
  </Page>
}

function TutorPortrait({selected,onSelect}: {selected:number; onSelect:(index:number)=>void}) {
  return <div className="ip-portrait">
    <div className="ip-avatar-stage"><LiveTutor id={TUTORS[selected].id} bubble="head"/></div>
    <div className="ip-tutor-picks" role="group" aria-label="Escolher tutor">{TUTORS.map((t,i)=><button type="button" key={t.id} aria-pressed={i===selected} onClick={()=>onSelect(i)}><img src={tutorAvatar(t.id)} alt=""/>{t.name}</button>)}</div>
  </div>
}

export function SiteTutores() {
  const [selected,select]=useState(0)
  const tutor=TUTORS[selected]
  useSeo('Tutores · Upoonly','Conheça Bia, Luck, Yuno e Yuri e pratique conversação em inglês com os tutores de IA do leitor.')
  return <Page>
    <Opening label="Tutores de IA" title="Vamos conversar em inglês?" text="Escolha uma voz para acompanhar a leitura. Quando quiser falar, abra uma conversa sobre o capítulo ou ensaie uma situação do dia a dia." actions={<Btn to="/signup" arrow>Experimentar uma conversa</Btn>}>
      <TutorPortrait selected={selected} onSelect={select}/>
    </Opening>
    <section aria-live="polite" className="ip-wrap ip-profile"><div><p className="ip-label">Seu tutor</p><h2>{tutor.name}</h2></div><div><p className="ip-profile-line">{tutor.role}. {tutor.voice}</p><p>{tutor.about}</p></div></section>
    <section className="ip-wrap ip-section"><Heading title="Escolha o assunto"/><div className="ip-editorial-grid">
      <article><BookOpen size={22}/><h3>O capítulo de hoje</h3><p>Converse sobre as decisões dos personagens e peça ajuda com as expressões que apareceram no texto.</p></article>
      <article><Mic size={22}/><h3>Uma cena da vida real</h3><p>Entre em uma situação, como pedir um café ou chegar a uma entrevista, e pratique suas respostas em voz alta.</p></article>
      <article><Volume2 size={22}/><h3>Uma conversa livre</h3><p>Fale sobre seu dia, retome um assunto ou treine vocabulário com o tutor que já conhece seu jeito de aprender.</p></article>
    </div></section>
    <section className="ip-wrap ip-section ip-text-table"><Heading title="Qual conversa está no meu plano?"/><div className="ip-prose"><p>O Grátis inclui uma cena de teste. A duração das cenas e o acesso ao tutor de leitura e à conversa livre variam de acordo com o plano.</p><Btn to="/planos" variant="light" arrow>Comparar planos</Btn></div></section>
  </Page>
}

function SampleReader(){
  const [definition,setDefinition]=useState(false)
  return <div className="ip-reader">
    <div className="ip-reader-top"><BookOpen size={17}/><span>Leitor</span></div>
    <div className="ip-reader-body"><small>Beatrix Potter</small><h2>The Tale of Peter Rabbit</h2>
      <blockquote lang="en">Once upon a time there were four little <button type="button" aria-expanded={definition} onClick={()=>setDefinition(!definition)}>Rabbits</button>, and their names were Flopsy, Mopsy, Cotton-tail, and Peter.</blockquote>
      {definition && <p className="ip-definition"><strong>Rabbits</strong> · coelhos. A narradora está apresentando os quatro filhotes.</p>}
    </div><div className="ip-reader-audio"><audio controls preload="none" aria-label="Ouvir trecho de Peter Rabbit" src="/site/reader/peter-rabbit.m4a"/></div>
  </div>
}

function IllustrationSample(){
  const [index,select]=useState(0)
  const examples=[STYLES[0],STYLES[2],STYLES[5]]
  return <figure className="ip-art"><img loading="lazy" src={'/styles/'+examples[index].id+'.webp'} alt={'Amostra do estilo '+examples[index].name}/>
    <figcaption role="group" aria-label="Explorar estilos">{examples.map((s,i)=><button type="button" key={s.id} aria-pressed={i===index} onClick={()=>select(i)}>{s.name}</button>)}</figcaption>
  </figure>
}

export function SiteRecursos() {
  useSeo('Recursos · Upoonly','Experimente a leitura com áudio e as ilustrações. Conheça os tutores e as atividades de vocabulário, fala e ditado.')
  return <Page>
    <div id="leitura"><Opening label="Recursos do leitor" title="Abra o livro e ouça a primeira página." text="Dê o play para ouvir o início de Peter Rabbit em inglês. Toque na palavra sublinhada para entender seu significado dentro da frase." actions={<Btn to="/signup" arrow>Escolher meu livro</Btn>}><SampleReader/></Opening></div>
    <section id="ilustracoes" className="ip-wrap ip-section ip-feature"><div><Heading title="O texto também pode virar imagem" text="Escolha um estilo para transformar uma página em ilustração ou quadrinho. Veja algumas das referências visuais disponíveis no leitor."/></div><IllustrationSample/></section>
    <section className="ip-wrap ip-section"><Heading title="Depois da leitura"/><div className="ip-resource-pair">
      <article id="conversas"><div className="ip-avatar-row">{TUTORS.map(t=><img key={t.id} loading="lazy" src={tutorAvatar(t.id)} alt={t.name}/>)}</div><h3>Converse com seu tutor</h3><p>Conte o que aconteceu no capítulo e receba ajuda para formular sua próxima frase em inglês.</p><Link to="/tutores" className="ip-textlink">Conhecer os quatro tutores</Link></article>
      <article id="raio-x"><Award size={27}/><h3>Veja o que treinar a seguir</h3><p>O Raio-X acompanha fala, conversa, vocabulário, ditado e constância. O relatório indica em quais habilidades concentrar o próximo estudo.</p><Link to="/planos" className="ip-textlink">Ver planos com Raio-X</Link></article>
    </div></section>
    <section id="interface" className="ip-wrap ip-section"><Heading title="Explore por atividade"/><FeatureCatalog/></section>
    <FaqSection/><FinalCta/>
  </Page>
}
