// Planos para a interface (preço e benefícios). O servidor (tabela plans) é a fonte de verdade dos limites;
// estes textos só descrevem — mudar preço/limite aqui não muda o que o servidor libera.
export type PlanId = 'free' | 'essencial' | 'plus' | 'pro'

export type PlanCard = {
  id: PlanId
  name: string
  priceCents: number
  credits: number
  minutes: number
  tagline: { pt: string; en: string }
  highlight?: boolean
  benefits: { pt: string; en: string }[]
}

export const PLANS: PlanCard[] = [
  {
    id: 'free', name: 'Grátis', priceCents: 0, credits: 60, minutes: 3,
    tagline: { pt: 'Para conhecer e se apaixonar', en: 'To try it and fall in love' },
    benefits: [
      { pt: 'Leitura com áudio, vocabulário, prática de fala e ditado', en: 'Audio reading, vocabulary, speaking and dictation practice' },
      { pt: '🎁 1 livro da galeria de presente, seu para sempre', en: '🎁 1 gallery book as a gift, yours forever' },
      { pt: '3 páginas ilustradas por IA por mês', en: '3 AI-illustrated pages per month' },
      { pt: '~30 explicações de palavras por mês', en: '~30 word explanations per month' },
      { pt: '1 conversa de 3 minutos para experimentar as Cenas', en: '1 three-minute conversation to try Scenes' },
    ],
  },
  {
    id: 'essencial', name: 'Essencial', priceCents: 2490, credits: 200, minutes: 30,
    tagline: { pt: 'A biblioteca inteira é sua', en: 'The whole library is yours' },
    benefits: [
      { pt: '📚 Biblioteca completa da galeria', en: '📚 The full gallery library' },
      { pt: '📥 Importar EPUB e PDF (até 20 livros)', en: '📥 Import EPUB and PDF (up to 20 books)' },
      { pt: '✨ 200 créditos de IA por mês', en: '✨ 200 AI credits per month' },
      { pt: '🎨 Estilo de ilustração próprio, editar e redesenhar páginas', en: '🎨 Your own illustration style, edit and redraw pages' },
      { pt: '🗣️ 30 min de Conversa e Cenas por mês', en: '🗣️ 30 min of Conversation and Scenes per month' },
      { pt: 'Nota e feedback no fim de cada conversa', en: 'Score and feedback after every conversation' },
    ],
  },
  {
    id: 'plus', name: 'Plus', priceCents: 4490, credits: 450, minutes: 120, highlight: true,
    tagline: { pt: 'Seu tutor de inglês pessoal', en: 'Your personal English tutor' },
    benefits: [
      { pt: 'Tudo do Essencial', en: 'Everything in Essencial' },
      { pt: '✨ 450 créditos de IA por mês', en: '✨ 450 AI credits per month' },
      { pt: '📖🎙️ Tutor de leitura: converse por voz sobre o livro enquanto lê', en: '📖🎙️ Reading tutor: talk about the book by voice while you read' },
      { pt: '🧠 Raio-X do seu inglês com IA, toda semana', en: '🧠 Weekly AI report on your English' },
      { pt: '📖 12 histórias de reforço por mês, feitas para as suas dificuldades', en: '📖 12 reinforcement stories a month, built on your weak spots' },
      { pt: '🎭 Crie suas próprias Cenas e converse com o tutor livremente', en: '🎭 Create your own Scenes and talk freely with the tutor' },
      { pt: '🗣️ 120 min de conversa por mês, com correção frase a frase', en: '🗣️ 120 conversation minutes a month, with line-by-line corrections' },
      { pt: '📥 Importar até 100 livros', en: '📥 Import up to 100 books' },
    ],
  },
  {
    id: 'pro', name: 'Pro', priceCents: 8990, credits: 900, minutes: 300,
    tagline: { pt: 'Para quem quer fluência rápido', en: 'For fast-track fluency' },
    benefits: [
      { pt: 'Tudo do Plus', en: 'Everything in Plus' },
      { pt: '✨ 900 créditos de IA por mês', en: '✨ 900 AI credits per month' },
      { pt: '🗣️ 300 min de conversa por mês e Cenas de até 10 min', en: '🗣️ 300 conversation minutes and Scenes up to 10 min' },
      { pt: '📖 Histórias de reforço sem limite e Raio-X sob demanda', en: '📖 Unlimited reinforcement stories and on-demand reports' },
      { pt: '📥 Importação ilimitada (uso justo)', en: '📥 Unlimited imports (fair use)' },
      { pt: '📊 Relatório mensal de evolução e novidades antes de todos', en: '📊 Monthly progress report and early access' },
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
export const CREDIT_COST = { page: 10, replan: 10, panel: 5, explain: 1, story: 1, mosaic: 1, styleExtract: 3, sceneCover: 2 } as const
