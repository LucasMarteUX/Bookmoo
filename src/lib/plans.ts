// Planos para a interface (preço e benefícios). O servidor (tabela plans) é a fonte de verdade dos limites;
// estes textos só descrevem — mudar preço/limite aqui não muda o que o servidor libera.
export type PlanId = 'free' | 'essencial' | 'plus' | 'pro'

export type PlanCard = {
  id: PlanId
  name: string
  priceCents: number
  credits: number
  tagline: { pt: string; en: string }
  highlight?: boolean
  benefits: { pt: string; en: string }[]
}

export const PLANS: PlanCard[] = [
  {
    id: 'free', name: 'Grátis', priceCents: 0, credits: 60,
    tagline: { pt: 'Para conhecer e se apaixonar', en: 'To try it and fall in love' },
    benefits: [
      { pt: 'Leitura com áudio, vocabulário, prática de fala e ditado', en: 'Audio reading, vocabulary, speaking and dictation practice' },
      { pt: '1 livro da galeria de presente, seu para sempre', en: '1 gallery book as a gift, yours forever' },
      { pt: '3 páginas ilustradas por IA por mês', en: '3 AI-illustrated pages per month' },
      { pt: '~30 explicações de palavras por mês', en: '~30 word explanations per month' },
      { pt: 'Experimente uma Cena de conversa por voz', en: 'Try one voice conversation Scene' },
    ],
  },
  {
    id: 'essencial', name: 'Essencial', priceCents: 2490, credits: 230,
    tagline: { pt: 'A biblioteca inteira é sua', en: 'The whole library is yours' },
    benefits: [
      { pt: 'Biblioteca completa da galeria', en: 'The full gallery library' },
      { pt: 'Importar EPUB e PDF (até 20 livros)', en: 'Import EPUB and PDF (up to 20 books)' },
      { pt: '230 créditos de IA por mês para imagens, explicações e conversas', en: '230 AI credits a month for images, explanations and conversations' },
      { pt: 'Estilo de ilustração próprio, editar e redesenhar páginas', en: 'Your own illustration style, edit and redraw pages' },
      { pt: 'Conversa por voz em todas as Cenas', en: 'Voice conversation in every Scene' },
      { pt: 'Nota e feedback no fim de cada conversa', en: 'Score and feedback after every conversation' },
    ],
  },
  {
    id: 'plus', name: 'Plus', priceCents: 4490, credits: 550, highlight: true,
    tagline: { pt: 'Seu tutor de inglês pessoal', en: 'Your personal English tutor' },
    benefits: [
      { pt: 'Tudo do Essencial', en: 'Everything in Essencial' },
      { pt: '550 créditos de IA por mês', en: '550 AI credits per month' },
      { pt: 'Tutor de leitura: converse por voz sobre o livro enquanto lê', en: 'Reading tutor: talk about the book by voice while you read' },
      { pt: 'Raio-X do seu inglês com IA, toda semana', en: 'Weekly AI report on your English' },
      { pt: '12 histórias de reforço por mês, feitas para as suas dificuldades', en: '12 reinforcement stories a month, built on your weak spots' },
      { pt: 'Crie suas próprias Cenas e converse com o tutor livremente', en: 'Create your own Scenes and talk freely with the tutor' },
      { pt: 'Correção frase a frase em cada conversa', en: 'Line-by-line corrections in every conversation' },
      { pt: 'Importar até 100 livros', en: 'Import up to 100 books' },
    ],
  },
  {
    id: 'pro', name: 'Pro', priceCents: 8990, credits: 1100,
    tagline: { pt: 'Para quem quer fluência rápido', en: 'For fast-track fluency' },
    benefits: [
      { pt: 'Tudo do Plus', en: 'Everything in Plus' },
      { pt: '1.100 créditos de IA por mês', en: '1,100 AI credits per month' },
      { pt: 'Cenas de até 10 minutos', en: 'Scenes up to 10 minutes' },
      { pt: 'Histórias de reforço sem limite e Raio-X sob demanda', en: 'Unlimited reinforcement stories and on-demand reports' },
      { pt: 'Importação ilimitada (uso justo)', en: 'Unlimited imports (fair use)' },
      { pt: 'Relatório mensal de evolução e novidades antes de todos', en: 'Monthly progress report and early access' },
    ],
  },
]

export const planById = (id: string | null | undefined) => PLANS.find(p => p.id === id) ?? PLANS[0]
export const planRank = (id: string | null | undefined) => Math.max(0, PLANS.findIndex(p => p.id === id))
export const nextPlan = (id: string | null | undefined) => PLANS[Math.min(PLANS.length - 1, planRank(id) + 1)]

export function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Custo em créditos mostrado antes de gerar (o servidor cobra o mesmo valor). */
export const CREDIT_COST = { page: 10, replan: 10, panel: 5, explain: 1, story: 1, mosaic: 1, styleExtract: 3, sceneCover: 2, conversationMinute: 1 } as const

/** Tabela mostrada em "Seus créditos". */
export const COST_TABLE: { pt: string; en: string; credits: string }[] = [
  { pt: 'Página ilustrada nova', en: 'New illustrated page', credits: '10' },
  { pt: 'Redesenhar página', en: 'Redraw page', credits: '10' },
  { pt: 'Editar um quadro', en: 'Edit a panel', credits: '5' },
  { pt: 'Conversa por voz (Cenas e tutores)', en: 'Voice conversation (Scenes and tutors)', credits: '1 / min' },
  { pt: 'Explicação, história ou exemplo', en: 'Explanation, story or example', credits: '1' },
  { pt: 'Imagem do mosaico', en: 'Mosaic image', credits: '1' },
  { pt: 'O que a comunidade já gerou', en: 'What the community already generated', credits: '0' },
]
