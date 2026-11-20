// Conteúdo do site. Planos e FAQ vêm das mesmas fontes do app (plans.ts e LegalPage), aqui fica só o que é do site.

export const SUPPORT_EMAIL = 'contato@upoonly.com'

export type Tutor = { id: string; name: string; tint: string; role: string; line: string; about: string; voice: string; when: string }

export const TUTORS: Tutor[] = [
  {
    id: 'bia', name: 'Bia', tint: '#F2D5C8', role: 'A leve', line: 'Oi! Me conta o que você está lendo?',
    about: 'Simpática, curiosa e paciente. Puxa conversa sobre a história, comemora cada acerto e explica sem pressa.',
    voice: 'Voz feminina, calorosa e clara.',
    when: 'Narradora padrão de romances, contos, poesia e livros infantis.',
  },
  {
    id: 'luck', name: 'Luck', tint: '#CFE3E3', role: 'O sério', line: 'Bora conversar sobre o seu dia?',
    about: 'Calmo, direto e atento aos detalhes. Ótimo para quem quer foco, correção cuidadosa e conversa de adulto.',
    voice: 'Voz masculina, grave e tranquila.',
    when: 'Narrador padrão de clássicos, mistério, biografias e não ficção.',
  },
  {
    id: 'yuno', name: 'Yuno', tint: '#E2D8F1', role: 'A animada', line: 'Vamos praticar? Sem pressão!',
    about: 'Jovem, divertida e sem formalidade. Deixa a prática leve, ótima para quem tem vergonha de falar.',
    voice: 'Voz feminina jovem e leve.',
    when: 'Para conversar sobre o dia a dia, séries, jogos e o que você curte.',
  },
  {
    id: 'yuri', name: 'Yuri', tint: '#D5DFEA', role: 'O parceiro', line: 'E aí! Eu ajudo com as palavras.',
    about: 'Gente boa e prático. Ajuda com vocabulário, gírias e frases do jeito que se fala de verdade.',
    voice: 'Voz masculina jovem.',
    when: 'Para treinar palavras novas e conversas rápidas.',
  },
]

export const tutorImg = (id: string, smile = false) => `/characters/bookmoo/banner/${id}${smile ? '-sorriso' : ''}.webp`
export const tutorAvatar = (id: string) => `/characters/bookmoo/${id}-pintura/avatar.webp`

export const CATEGORIES: { id: string; name: string }[] = [
  { id: 'classic', name: 'Clássicos' },
  { id: 'adventure', name: 'Aventura' },
  { id: 'fantasy', name: 'Fantasia' },
  { id: 'mystery', name: 'Mistério' },
  { id: 'romance', name: 'Romance' },
  { id: 'biography', name: 'Biografias' },
  { id: 'poetry', name: 'Poesia' },
  { id: 'short', name: 'Contos' },
  { id: 'nonfiction', name: 'Não ficção' },
  { id: 'children', name: 'Infantil' },
  { id: 'bible-stories', name: 'Histórias Bíblicas' },
]

export const STYLES: { id: string; name: string }[] = [
  { id: 'aquarela-nanquim', name: 'Aquarela e nanquim' },
  { id: 'fantasia-epica', name: 'Fantasia épica' },
  { id: 'manga-tradicional', name: 'Mangá' },
  { id: 'hq-americana', name: 'HQ americana' },
  { id: 'hq-europeia', name: 'HQ europeia' },
  { id: 'noir-misterio', name: 'Noir' },
  { id: 'terror-gotico', name: 'Terror gótico' },
  { id: 'romance-aquarela', name: 'Romance em aquarela' },
  { id: 'cyberpunk', name: 'Cyberpunk' },
  { id: 'anime-colorido', name: 'Anime' },
  { id: 'pintura-historica', name: 'Pintura histórica' },
  { id: 'realismo-magico', name: 'Realismo mágico' },
  { id: 'infantil-guache', name: 'Guache infantil' },
  { id: 'ficcao-cientifica', name: 'Ficção científica' },
  { id: 'fantasia-sombria', name: 'Fantasia sombria' },
  { id: 'thriller-cinematografico', name: 'Thriller' },
]

/** Recursos explicados (página /recursos e bento da Home). */
export const FEATURES: { id: string; kicker: string; title: string; text: string; points: string[]; img?: string }[] = [
  {
    id: 'leitura', kicker: 'Leitura', title: 'Leia ouvindo, palavra por palavra',
    text: 'Cada página tem áudio com vozes naturais. O texto acende enquanto a voz lê, no seu ritmo: diminua a velocidade, repita a frase, leia em silêncio quando quiser.',
    points: ['Karaokê que acompanha a voz', 'Velocidade ajustável sem mudar o tom', 'Tema claro, sépia e escuro, fontes confortáveis', 'Sons ambientes: lareira e chuva'],
    img: '/illustrations/reading.svg',
  },
  {
    id: 'palavras', kicker: 'Palavras', title: 'Toque em qualquer palavra e entenda de verdade',
    text: 'Pronúncia, significado no contexto da frase, exemplo e gramática. Nada de tradução solta: você entende por que aquela palavra está ali.',
    points: ['Explicação no contexto da página', 'Marque como Aprendi, Revisar ou Importante', 'Mosaico de imagens da comunidade para memorizar', 'Notas e destaques no livro'],
    img: '/illustrations/on-the-laptop.svg',
  },
  {
    id: 'ilustracoes', kicker: 'Ilustrações com IA', title: 'Cada página pode virar uma ilustração',
    text: 'Escolha entre 16 estilos (aquarela, mangá, HQ, noir…) ou crie o seu. A página vira imagem ou quadrinho com balões, e o que a comunidade já gerou é grátis para todo mundo.',
    points: ['16 estilos prontos ou estilo próprio', 'Quadrinhos com balões e letreiros', 'Edite e redesenhe páginas', 'Páginas geradas pela comunidade não gastam crédito'],
  },
  {
    id: 'pratica', kicker: 'Prática', title: 'Pratique com o livro que você está lendo',
    text: 'Exercícios feitos a partir das páginas que você leu: fale em voz alta, escreva o que ouviu, responda ao questionário e decifre a página.',
    points: ['Prática de fala com correção', 'Ditado', 'Questionário e Desafio', 'Decifrar a página: gramática explicada'],
    img: '/illustrations/public-speaking.svg',
  },
  {
    id: 'conversas', kicker: 'Conversas por voz', title: 'Fale inglês com um tutor que te escuta',
    text: 'Escolha a Bia, o Luck, a Yuno ou o Yuri e converse em voz alta. Cenas do dia a dia, conversa livre ou um papo sobre o livro enquanto você lê. No fim, nota e correção frase a frase.',
    points: ['Cenas prontas ou criadas por você', 'Tutor de leitura dentro do livro', 'Nota e feedback no fim', 'Os tutores lembram do que vocês conversaram'],
    img: '/illustrations/chatting.svg',
  },
  {
    id: 'raio-x', kicker: 'Raio-X', title: 'Saiba exatamente onde você está',
    text: 'A IA analisa sua leitura, seu vocabulário e suas conversas e mostra o que você já domina e onde tropeça. Depois cria histórias de reforço feitas para as suas dificuldades.',
    points: ['Relatório semanal do seu inglês', 'Histórias de reforço personalizadas', 'Evolução ao longo do tempo', 'Pontos, níveis e metas'],
    img: '/illustrations/hiking.svg',
  },
  {
    id: 'nivel', kicker: 'Nível e prova', title: 'Teste de nível e Prova de proficiência',
    text: 'Um teste curto por nível CEFR (A1 a C2) confirma ou promove o seu nível. E a Prova de proficiência avalia leitura, escuta, escrita e fala com relatório completo.',
    points: ['Níveis A1 a C2 explicados', 'Prova com as 4 habilidades', 'Relatório com nota por habilidade', 'Inspirada no formato TOEFL iBT, não oficial'],
    img: '/illustrations/launch.svg',
  },
  {
    id: 'comunidade', kicker: 'Comunidade', title: 'Leia junto com outras pessoas',
    text: 'Compartilhe momentos de leitura, siga leitores, comente e marque amigos. Um lugar para manter o hábito e descobrir o próximo livro.',
    points: ['Posts com momentos de leitura', 'Perfis, seguidores e menções', 'Notificações em tempo real', 'Denúncia e moderação'],
    img: '/illustrations/teamworks.svg',
  },
  {
    id: 'biblioteca', kicker: 'Biblioteca', title: 'Uma galeria inteira e os seus próprios livros',
    text: 'Clássicos em domínio público prontos para estudar, organizados por categoria e coleção. E você pode importar seus EPUBs e PDFs, que ficam só na sua conta.',
    points: ['11 categorias e coleções', 'Importe EPUB e PDF', 'Livros enviados ficam privados', '1 livro de presente no plano Grátis'],
    img: '/illustrations/delivery.svg',
  },
]

export const FAQ_IDS = ['pagar', 'creditos', 'presente', 'cancelar', 'conversar', 'nivel', 'livros-privados', 'galeria']
