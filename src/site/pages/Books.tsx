// Catálogo público (/livros) e perfil do livro (/livro/:slug), no padrão editorial da home.
// "Começar a ler" leva aos planos: o livro abre no app depois do cadastro.
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, BookOpen, Headphones, Languages, MessageCircle, Sparkles } from 'lucide-react'
import { SiteLayout } from '../SiteLayout'
import { PageOpening } from '../PageOpening'
import { Btn, useSeo } from '../ui'
import { CATALOG, coverSrc, type Book } from '../catalog'
import { FinalCta } from '../sections'

const SYNOPSIS: Record<string, string> = {
  'alices-adventures-in-wonderland': 'Alice segue um coelho apressado até uma toca e cai num país onde nada faz sentido: chás sem fim, uma rainha que grita "cortem-lhe a cabeça!" e um gato que some aos poucos.',
  'pride-and-prejudice': 'Elizabeth Bennet e o orgulhoso Mr. Darcy se estranham desde o primeiro baile. Ironia, cartas e mal-entendidos num dos romances mais amados da língua inglesa.',
  'the-adventures-of-sherlock-holmes': 'Doze casos de Sherlock Holmes narrados pelo Dr. Watson: um rei chantageado, uma liga de ruivos e o detetive que vê o que todos só olham.',
  'treasure-island': 'Jim Hawkins encontra um mapa do tesouro e embarca num navio cheio de piratas, liderados pelo encantador e perigoso Long John Silver.',
  'the-wonderful-wizard-of-oz': 'Um ciclone leva Dorothy para Oz. Pela estrada de tijolos amarelos, ela, o Espantalho, o Homem de Lata e o Leão procuram o mágico que pode levá-la para casa.',
  dracula: 'Cartas e diários contam a chegada do conde Drácula à Inglaterra e a caçada para detê-lo. O terror gótico que inventou o vampiro moderno.',
  frankenstein: 'Victor Frankenstein dá vida a uma criatura e foge dela. Rejeitado, o ser busca o criador em uma história sobre ciência, culpa e solidão.',
  'the-secret-garden': 'Mary encontra a chave de um jardim trancado há dez anos. Cuidando dele, ela e um primo doente descobrem que também podem florescer.',
  'anne-of-green-gables': 'Os irmãos Cuthbert esperavam um menino para ajudar na fazenda e recebem Anne, ruiva, sonhadora e cheia de palavras grandes.',
  'little-women': 'As irmãs March crescem durante a guerra entre sonhos, cartas, peças de teatro e escolhas difíceis sobre amor e independência.',
  'the-great-gatsby': 'Nick Carraway observa o misterioso Gatsby, suas festas enormes e o amor impossível por Daisy, no auge dos anos 1920.',
  'jane-eyre': 'Órfã e determinada, Jane vira governanta em Thornfield e se apaixona pelo sombrio Mr. Rochester, que guarda um segredo no sótão.',
  'a-christmas-carol': 'Na véspera de Natal, o avarento Scrooge recebe a visita de três fantasmas que mostram seu passado, seu presente e o futuro que o espera.',
  'the-jungle-book': 'Mogli é criado por lobos e aprende as leis da selva com o urso Baloo e a pantera Baguera, enquanto o tigre Shere Khan o persegue.',
  'moby-dick': 'O capitão Ahab arrasta a tripulação do Pequod numa caçada obsessiva à baleia branca que lhe arrancou a perna.',
  'the-time-machine': 'Um inventor viaja ao ano 802.701 e encontra a humanidade dividida entre os delicados Eloi e os sombrios Morlocks.',
}

const generic = (b: Book) => `${b.title}, de ${b.author}: um clássico de ${b.category.toLowerCase()} para ler em inglês com a página narrada, cada palavra explicada e um tutor para conversar sobre a história.`
const LEVELS = ['Todos', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

export function SiteLivros() {
  useSeo('Livros · Upoonly', 'Os clássicos da biblioteca do Upoonly, com nível indicado do A1 ao C2.')
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('Todos')
  const list = useMemo(() => CATALOG.filter(b => level === 'Todos' || b.level === level), [level])
  return (
    <SiteLayout>
      <PageOpening kicker="Biblioteca" title={<>Escolha sua <i>próxima história.</i></>}
        text={`${CATALOG.length} livros em inglês, com capa nova e nível indicado. Toque num livro para ver do que ele trata.`}
        actions={<div className="books-levels" role="group" aria-label="Filtrar por nível">{LEVELS.map(l => <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)}>{l}</button>)}</div>} />
      <section className="books-grid" aria-label="Livros">
        {list.map(b => (
          <Link key={b.slug} to={`/livro/${b.slug}`} className="books-item">
            <img src={coverSrc(b.slug)} alt={`Capa de ${b.title}`} loading="lazy" width={400} height={600} />
            <cite lang="en">{b.title}</cite>
            <span>{b.author} · {b.level}</span>
          </Link>
        ))}
      </section>
      <FinalCta />
    </SiteLayout>
  )
}

export function SiteLivro() {
  const { slug } = useParams()
  const book = CATALOG.find(b => b.slug === slug)
  useSeo(book ? `${book.title} · Upoonly` : 'Livro · Upoonly', book ? (SYNOPSIS[book.slug] ?? book.description ?? generic(book)) : '')
  if (!book) return (
    <SiteLayout>
      <PageOpening kicker="Biblioteca" title="Livro não encontrado." text="Esse livro não está na vitrine. Veja os outros clássicos da biblioteca." actions={<Btn to="/livros" arrow>Ver os livros</Btn>} />
    </SiteLayout>
  )
  const related = CATALOG.filter(b => b.slug !== book.slug && (b.category === book.category || b.level === book.level)).slice(0, 4)
  return (
    <SiteLayout>
      <section className="book-profile">
        <figure className="book-profile-cover"><img src={coverSrc(book.slug)} alt={`Capa de ${book.title}`} width={400} height={600} /></figure>
        <div className="book-profile-copy">
          <p className="journey-label"><Link to="/livros">Biblioteca</Link> · {book.category}</p>
          <h1 className="journey-title" lang="en">{book.title}</h1>
          <p className="book-profile-author">{book.author}</p>
          <div className="book-profile-meta"><span>Nível {book.level}</span><span>Em inglês</span><span>Narrado</span></div>
          <p className="book-profile-synopsis">{SYNOPSIS[book.slug] ?? book.description ?? generic(book)}</p>
          <div className="chapter-options">
            <Btn to={`/planos?livro=${book.slug}`} arrow>Começar a ler</Btn>
            <Btn to="/signup?plano=free" variant="white">Começar grátis</Btn>
          </div>
          <ul className="book-profile-tools">
            <li><Headphones size={17} />Página narrada com a palavra do momento marcada</li>
            <li><Languages size={17} />Toque em qualquer palavra para entender o sentido</li>
            <li><Sparkles size={17} />Ilustrações da cena que você está lendo</li>
            <li><MessageCircle size={17} />Tutores para conversar sobre a história</li>
          </ul>
        </div>
      </section>
      {related.length > 0 && (
        <section className="book-related">
          <p className="journey-label">Para ler depois</p>
          <div className="books-grid books-grid-small">
            {related.map(b => (
              <Link key={b.slug} to={`/livro/${b.slug}`} className="books-item">
                <img src={coverSrc(b.slug)} alt={`Capa de ${b.title}`} loading="lazy" width={400} height={600} />
                <cite lang="en">{b.title}</cite>
                <span>{b.author} · {b.level}</span>
              </Link>
            ))}
          </div>
          <Link to="/livros" className="book-related-all"><BookOpen size={16} />Ver todos os livros <ArrowRight size={15} /></Link>
        </section>
      )}
      <FinalCta />
    </SiteLayout>
  )
}
