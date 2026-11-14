// Assuntos sugeridos para a conversa livre: a pessoa escolhe um (ou troca as sugestões) e a Bea começa por ele.
export type TalkTopic = { id: string; pt: string; en: string; opening: string }

export const TALK_TOPICS: TalkTopic[] = [
  { id: 'routine', pt: 'Minha rotina', en: 'My routine', opening: "Let's talk about your daily routine. What does a normal day look like for you?" },
  { id: 'travel', pt: 'Viagens', en: 'Travel', opening: "Let's talk about travel. What is the best place you have ever visited?" },
  { id: 'work', pt: 'Trabalho e estudos', en: 'Work and studies', opening: 'Tell me about your work or your studies. What do you do?' },
  { id: 'movies', pt: 'Filmes e séries', en: 'Movies and series', opening: 'What movies or series are you watching these days?' },
  { id: 'food', pt: 'Comida', en: 'Food', opening: "Let's talk about food. What is your favorite dish?" },
  { id: 'music', pt: 'Música', en: 'Music', opening: 'What kind of music do you like to listen to?' },
  { id: 'weekend', pt: 'Meu fim de semana', en: 'My weekend', opening: 'How was your last weekend? What did you do?' },
  { id: 'plans', pt: 'Planos para o futuro', en: 'Future plans', opening: 'What are your plans for the next few months?' },
  { id: 'family', pt: 'Família e amigos', en: 'Family and friends', opening: 'Tell me about your family or your best friend.' },
  { id: 'sports', pt: 'Esportes', en: 'Sports', opening: 'Do you like sports? Which ones do you play or watch?' },
  { id: 'books', pt: 'Livros que estou lendo', en: 'Books I am reading', opening: 'What book are you reading right now? Do you like it?' },
  { id: 'tech', pt: 'Tecnologia', en: 'Technology', opening: 'Which app or gadget could you not live without?' },
  { id: 'childhood', pt: 'Minha infância', en: 'My childhood', opening: 'What do you remember about your childhood? Where did you grow up?' },
  { id: 'dreams', pt: 'Um sonho meu', en: 'A dream of mine', opening: 'If you could do anything next year, what would you do?' },
]

export function pickTopics(n: number, exclude: string[] = []): TalkTopic[] {
  const pool = TALK_TOPICS.filter(t => !exclude.includes(t.id))
  const out: TalkTopic[] = []
  while (out.length < n && pool.length) out.push(...pool.splice(Math.floor(Math.random() * pool.length), 1))
  return out
}
