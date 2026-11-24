import { Link } from 'react-router-dom'

export const resourceIntro = {
  title: <>Tudo o que o Upoonly <i>faz por você</i>.</>,
  text: 'Um leitor completo para aprender inglês com livros de verdade. Escolha por onde começar.',
}

export const resources = [
  { cover: 'the-secret-garden', to: '/leitor', name: 'Leitor', d: 'Áudio, karaokê e cada palavra explicada.' },
  { cover: 'through-the-looking-glass', to: '/ilustracoes', name: 'Ilustrações', d: 'Páginas que viram imagem e quadrinho.' },
  { cover: 'little-women', to: '/tutores', name: 'Tutores', d: 'Conversas em inglês por voz.' },
  { cover: 'the-call-of-the-wild', to: '/pratica', name: 'Prática', d: 'Fala, ditado e vocabulário.' },
  { cover: 'great-expectations', to: '/evolucao', name: 'Evolução', d: 'Raio-X, metas e estatísticas.' },
  { cover: 'treasure-island', to: '/biblioteca', name: 'Biblioteca', d: 'Clássicos e seus próprios livros.' },
  { cover: 'the-adventures-of-sherlock-holmes', to: '/prova', name: 'Prova', d: 'Seu nível nas 4 habilidades.' },
]

export function ResourceIndex() {
  return (
    <nav className="folio-index" aria-label="Índice de recursos">
      {resources.map(item => (
        <Link key={item.to} to={item.to}>
          <span>{item.name}</span>
          <small>{item.d}</small>
          <b aria-hidden="true">↗</b>
          <img loading="lazy" alt="" src={'/site/covers/' + item.cover + '.webp'} />
        </Link>
      ))}
    </nav>
  )
}
