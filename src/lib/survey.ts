// Perguntas do questionário inicial. As chaves e os valores são os mesmos usados pelos filtros do admin.
export type SurveyQuestion = {
  key: 'reason' | 'self_level' | 'difficulty' | 'tried_books' | 'topics' | 'daily_minutes' | 'how_found'
  multi: boolean
  title: { pt: string; en: string }
  hint?: { pt: string; en: string }
  options: { value: string; pt: string; en: string; desc?: { pt: string; en: string }; example?: string }[]
}

export const SURVEY: SurveyQuestion[] = [
  {
    key: 'reason', multi: true,
    title: { pt: 'Por que você quer aprender inglês?', en: 'Why do you want to learn English?' },
    hint: { pt: 'Pode escolher mais de uma.', en: 'Pick as many as you like.' },
    options: [
      { value: 'work', pt: 'Trabalho e carreira', en: 'Work and career' },
      { value: 'travel', pt: 'Viajar', en: 'Travel' },
      { value: 'study', pt: 'Estudos e faculdade', en: 'Studies' },
      { value: 'culture', pt: 'Filmes, séries, música e livros', en: 'Films, series, music and books' },
      { value: 'abroad', pt: 'Morar ou estudar fora', en: 'Living or studying abroad' },
      { value: 'fun', pt: 'Por prazer de aprender', en: 'For the joy of learning' },
    ],
  },
  {
    // Nível declarado (A1 a C2), com o que a pessoa já consegue fazer em cada um. Grava profiles.declared_level e vale no app
    // até o teste de nível confirmar (docs/TESTE-DE-NIVEL.md). "unsure" abre 3 perguntas rápidas que sugerem um nível.
    key: 'self_level', multi: false,
    title: { pt: 'Qual é o seu nível de inglês hoje?', en: 'What is your English level today?' },
    hint: { pt: 'Escolha o que mais parece com você. Depois um teste curto confirma.', en: 'Pick what sounds most like you. A short test confirms it later.' },
    options: [
      { value: 'A1', pt: 'Iniciante', en: 'Beginner', desc: { pt: 'Entendo e uso palavras e frases muito simples: me apresentar, números, cores.', en: 'I understand and use very simple words and phrases.' }, example: 'Hi, my name is Ana. I am from Brazil.' },
      { value: 'A2', pt: 'Aprendiz', en: 'Apprentice', desc: { pt: 'Falo de rotina, família e compras em frases curtas.', en: 'I talk about routine, family and shopping in short sentences.' }, example: 'I usually take the bus to work.' },
      { value: 'B1', pt: 'Praticante', en: 'Practitioner', desc: { pt: 'Me viro numa viagem, conto experiências e dou opiniões simples.', en: 'I manage on a trip, tell experiences and give simple opinions.' }, example: 'Last year I went to Chile and loved the food.' },
      { value: 'B2', pt: 'Experiente', en: 'Seasoned', desc: { pt: 'Converso com fluidez, defendo um ponto de vista e entendo séries com algum esforço.', en: 'I talk fluently, argue a point and follow series with some effort.' }, example: 'I see your point, but I would argue that…' },
      { value: 'C1', pt: 'Expert', en: 'Expert', desc: { pt: 'Uso inglês no trabalho e nos estudos com flexibilidade e entendo textos longos.', en: 'I use English at work and in studies flexibly.' }, example: 'It is not so much the cost as the hidden trade-offs.' },
      { value: 'C2', pt: 'Lenda', en: 'Legend', desc: { pt: 'Entendo praticamente tudo e me expresso com precisão e nuance.', en: 'I understand almost everything and speak with nuance.' }, example: 'Her remark was tongue-in-cheek, yet it struck a nerve.' },
      { value: 'unsure', pt: 'Não sei, me ajude a escolher', en: 'Not sure, help me choose', desc: { pt: '3 perguntas rápidas e sugerimos um nível.', en: '3 quick questions and we suggest a level.' } },
    ],
  },
  {
    key: 'difficulty', multi: true,
    title: { pt: 'Onde você sente mais dificuldade?', en: 'Where do you struggle most?' },
    hint: { pt: 'Vamos priorizar isso nas suas atividades.', en: 'We will prioritise this in your activities.' },
    options: [
      { value: 'speaking', pt: 'Falar', en: 'Speaking' },
      { value: 'listening', pt: 'Entender quando ouço', en: 'Understanding when I listen' },
      { value: 'writing', pt: 'Escrever', en: 'Writing' },
      { value: 'reading', pt: 'Ler', en: 'Reading' },
      { value: 'vocabulary', pt: 'Vocabulário', en: 'Vocabulary' },
      { value: 'grammar', pt: 'Gramática', en: 'Grammar' },
    ],
  },
  {
    key: 'tried_books', multi: false,
    title: { pt: 'Você já tentou ler livros em inglês?', en: 'Have you tried reading books in English?' },
    options: [
      { value: 'never', pt: 'Nunca tentei', en: 'Never tried' },
      { value: 'gave_up', pt: 'Tentei e desisti', en: 'Tried and gave up' },
      { value: 'sometimes', pt: 'Leio de vez em quando', en: 'I read now and then' },
      { value: 'often', pt: 'Leio com frequência', en: 'I read often' },
    ],
  },
  {
    key: 'topics', multi: true,
    title: { pt: 'Que tipo de história você gosta?', en: 'What kind of stories do you like?' },
    hint: { pt: 'Usamos isso para sugerir livros.', en: 'We use this to suggest books.' },
    options: [
      { value: 'fantasy', pt: 'Fantasia', en: 'Fantasy' },
      { value: 'adventure', pt: 'Aventura', en: 'Adventure' },
      { value: 'romance', pt: 'Romance', en: 'Romance' },
      { value: 'mystery', pt: 'Mistério e suspense', en: 'Mystery and suspense' },
      { value: 'scifi', pt: 'Ficção científica', en: 'Science fiction' },
      { value: 'classics', pt: 'Clássicos', en: 'Classics' },
      { value: 'kids', pt: 'Histórias infantis', en: "Children's stories" },
      { value: 'history', pt: 'História e biografias', en: 'History and biographies' },
      { value: 'selfhelp', pt: 'Desenvolvimento pessoal', en: 'Self-development' },
    ],
  },
  {
    key: 'daily_minutes', multi: false,
    title: { pt: 'Quanto tempo você pode estudar por dia?', en: 'How much time can you study each day?' },
    options: [
      { value: '5', pt: 'Uns 5 minutos', en: 'About 5 minutes' },
      { value: '10', pt: 'Uns 10 minutos', en: 'About 10 minutes' },
      { value: '20', pt: 'Uns 20 minutos', en: 'About 20 minutes' },
      { value: '30', pt: '30 minutos ou mais', en: '30 minutes or more' },
    ],
  },
  {
    key: 'how_found', multi: true,
    title: { pt: 'Como você conheceu o Upoonly?', en: 'How did you find Upoonly?' },
    options: [
      { value: 'friend', pt: 'Indicação de amigo', en: 'A friend' },
      { value: 'social', pt: 'Redes sociais', en: 'Social media' },
      { value: 'search', pt: 'Busca na internet', en: 'Web search' },
      { value: 'teacher', pt: 'Professor ou escola', en: 'Teacher or school' },
      { value: 'other', pt: 'Outro', en: 'Other' },
    ],
  },
]

/** Ajuda para escolher o nível: 3 perguntas rápidas, cada acerto sobe um degrau. */
export const LEVEL_HELP: { q: { pt: string; en: string }; text: string; options: string[]; answer: number }[] = [
  { q: { pt: 'O que esta frase quer dizer?', en: 'What does this sentence mean?' }, text: 'I have two sisters and one brother.', options: ['Tenho duas irmãs e um irmão.', 'Tenho dois irmãos e uma irmã.', 'Minhas irmãs têm um irmão.'], answer: 0 },
  { q: { pt: 'Qual continuação faz mais sentido?', en: 'Which continuation makes most sense?' }, text: 'I was going to call you, but…', options: ['…my phone died.', '…I am calling you yesterday.', '…you are phone.'], answer: 0 },
  { q: { pt: 'O que significa a expressão destacada?', en: 'What does the expression mean?' }, text: 'Let us call it a day.', options: ['Vamos encerrar por hoje.', 'Vamos ligar durante o dia.', 'Vamos dar um nome ao dia.'], answer: 0 },
]
/** Nível sugerido pela ajuda e pela resposta "como está seu inglês" quando a pessoa não sabe: 0 acertos A1 … 3 acertos B2. */
export const levelFromHelp = (hits: number) => (['A1', 'A2', 'B1', 'B2'] as const)[Math.max(0, Math.min(3, hits))]
