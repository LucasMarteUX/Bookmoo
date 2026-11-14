// Perguntas do questionário inicial. As chaves e os valores são os mesmos usados pelos filtros do admin.
export type SurveyQuestion = {
  key: 'reason' | 'self_level' | 'difficulty' | 'tried_books' | 'topics' | 'daily_minutes' | 'how_found'
  multi: boolean
  title: { pt: string; en: string }
  hint?: { pt: string; en: string }
  options: { value: string; pt: string; en: string }[]
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
    key: 'self_level', multi: false,
    title: { pt: 'Como está o seu inglês hoje?', en: 'How is your English today?' },
    options: [
      { value: 'zero', pt: 'Estou começando do zero', en: 'Starting from zero' },
      { value: 'basic', pt: 'Entendo o básico', en: 'I understand the basics' },
      { value: 'survive', pt: 'Me viro em situações simples', en: 'I manage simple situations' },
      { value: 'intermediate', pt: 'Converso, mas com dificuldade', en: 'I talk, but with difficulty' },
      { value: 'advanced', pt: 'Me sinto confortável', en: 'I feel comfortable' },
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
    title: { pt: 'Como você conheceu o Bookmoo?', en: 'How did you find Bookmoo?' },
    options: [
      { value: 'friend', pt: 'Indicação de amigo', en: 'A friend' },
      { value: 'social', pt: 'Redes sociais', en: 'Social media' },
      { value: 'search', pt: 'Busca na internet', en: 'Web search' },
      { value: 'teacher', pt: 'Professor ou escola', en: 'Teacher or school' },
      { value: 'other', pt: 'Outro', en: 'Other' },
    ],
  },
]
