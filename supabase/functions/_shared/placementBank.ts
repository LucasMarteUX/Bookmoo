// Banco de itens do teste de nível (docs/TESTE-DE-NIVEL.md, seção 5). Cada nível tem o seu: leitura em voz alta, pergunta
// aberta (resposta falada), ditado e uma conversa curta com tarefas. Fica só no servidor (o gabarito nunca vai ao cliente,
// exceto o texto do ditado, que o aparelho precisa para falar com a voz local).
export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
export const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export type LevelBank = {
  read: string[]        // frases para ler em voz alta
  open: string[]        // perguntas abertas (resposta falada)
  dictation: string[]   // frases do ditado
  talk: { topic: string; tasks: string[]; opening: string }[]  // conversa: tema, tarefas, primeira fala do tutor
  guide: string         // como falar com a pessoa neste nível
}

export const BANK: Record<Level, LevelBank> = {
  A1: {
    guide: 'Very short, simple sentences with the most common words. Speak slowly and kindly.',
    read: ['My name is Leo. I like cats.', 'I have a red bag.', 'She is my sister.', 'We live in a small house.', 'I drink water every day.', 'The book is on the table.', 'He is ten years old.', 'I like pizza and juice.'],
    open: ['What is your name and where are you from?', 'What do you like to eat?', 'Tell me about your family.', 'What colour do you like?', 'What do you do in the morning?'],
    dictation: ['I have two brothers.', 'My cat is black.', 'She likes apples.', 'We go to school.', 'This is my phone.', 'I am very happy.', 'The dog is big.', 'He has a blue car.'],
    talk: [
      { topic: 'introducing yourself', tasks: ['say their name', 'say where they are from', 'say one thing they like'], opening: 'Hi! I am your tutor today. What is your name?' },
      { topic: 'family and home', tasks: ['say who is in their family', 'say where they live', 'say if they have a pet'], opening: 'Hello! Tell me, do you have brothers or sisters?' },
      { topic: 'food', tasks: ['say a food they like', 'say a drink they like', 'say what they eat for breakfast'], opening: 'Hi there! What food do you like?' },
    ],
  },
  A2: {
    guide: 'Short sentences and everyday vocabulary, simple past and present. Avoid idioms.',
    read: ['Yesterday I went to the market with my mother.', 'On weekends I usually visit my grandparents.', 'I am going to travel to the beach next month.', 'We had pizza for dinner last night.', 'My brother works in a big hospital.', 'It was cold, so I stayed at home.'],
    open: ['What do you do on weekends?', 'What did you do yesterday?', 'Describe your favourite place in your city.', 'What is your daily routine like?', 'What are your plans for next week?'],
    dictation: ['Last summer we visited my aunt in the countryside.', 'I usually take the bus to work.', 'She bought a new dress yesterday.', 'We are going to watch a movie tonight.', 'My father cooks dinner on Sundays.', 'The shop opens at nine in the morning.', 'I did not go to school on Friday.', 'Can you help me with my homework?'],
    talk: [
      { topic: 'ordering food at a café', tasks: ['order a drink and a snack', 'ask the price', 'say how they want to pay'], opening: 'Good morning! Welcome to the café. What would you like?' },
      { topic: 'daily routine', tasks: ['describe their morning', 'say what they did yesterday', 'say what they do in the evening'], opening: 'Hi! Tell me, what time do you usually wake up?' },
      { topic: 'a weekend trip', tasks: ['say where they went', 'say who they went with', 'say what they liked most'], opening: 'Hello! Did you do anything nice last weekend?' },
    ],
  },
  B1: {
    guide: 'Natural everyday English with common expressions and connectors. Normal but clear pace.',
    read: ['Last year I went to Chile, and the food was amazing because everything was so fresh.', 'Although it was raining, we decided to go for a walk in the park.', 'I have been learning English for two years, and I can finally watch series without subtitles.', 'If I had more free time, I would learn to play the guitar.', 'The hotel was nice, but the room was smaller than we expected.'],
    open: ['Tell me about a trip you really enjoyed.', 'What is something you would like to change in your city, and why?', 'Describe a problem you solved recently.', 'What kind of job would you like to have in the future?', 'Tell me about a book or film that made an impression on you.'],
    dictation: ['I have been working here since I finished university.', 'If it rains tomorrow, we will stay at home and watch a film.', 'She told me that she had already seen the movie.', 'The train was delayed, so we arrived late for the meeting.', 'Although the exam was difficult, most students passed.', 'I am looking forward to meeting your family next weekend.', 'He suggested that we should try the new restaurant downtown.', 'We had to cancel the trip because my brother got sick.'],
    talk: [
      { topic: 'a problem at a hotel', tasks: ['explain a problem with their room', 'ask for a solution', 'react to the solution and justify'], opening: 'Good evening, front desk. How can I help you?' },
      { topic: 'a memorable experience', tasks: ['tell a past experience with details', 'say how they felt', 'give an opinion about it'], opening: 'Hi! I would love to hear about a moment you will never forget.' },
      { topic: 'technology in daily life', tasks: ['give an opinion', 'justify it with an example', 'agree or disagree with the tutor'], opening: 'Hey! Do you think we use our phones too much?' },
    ],
  },
  B2: {
    guide: 'Speak naturally at normal speed, with common idioms and phrasal verbs.',
    read: ['I see your point, but I would argue that remote work actually makes teams more productive.', 'Had I known about the traffic, I would have left home much earlier.', 'The government has come up with a plan to cut down on plastic waste.', 'Despite the criticism, the director managed to make a film that appeals to everyone.', 'It is high time we stopped treating mental health as a taboo subject.'],
    open: ['Should cities ban cars from downtown areas? Why or why not?', 'What are the pros and cons of working from home?', 'How has social media changed the way people communicate?', 'If you could change one thing about the education system, what would it be?', 'Is it better to rent or to buy a home? Explain your view.'],
    dictation: ['Not only did she finish the project early, but she also helped her colleagues.', 'I would rather we discussed this in person than over the phone.', 'The company is likely to cut down on costs after the merger.', 'He turned down the offer because the salary did not make up for the long hours.', 'By the time we got to the station, the last train had already left.', 'It is worth considering how these changes will affect small businesses.', 'She has been looking into the possibility of moving abroad.', 'Had they listened to the experts, the crisis could have been avoided.'],
    talk: [
      { topic: 'debate: remote work', tasks: ['state a clear opinion', 'support it with two arguments', 'respond to a counter-argument with nuance'], opening: 'Let us debate a bit. Some say offices are dead. Do you agree?' },
      { topic: 'hypothetical situations', tasks: ['answer a hypothetical question', 'explain consequences', 'compare two options'], opening: 'Imagine you won a year off work, fully paid. What would you do with it?' },
      { topic: 'news and society', tasks: ['summarise a social issue', 'give a balanced view', 'propose a solution'], opening: 'What is a social issue in your country that people talk about a lot these days?' },
    ],
  },
  C1: {
    guide: 'Speak fully naturally, like with a native speaker, including idioms and implicit meaning.',
    read: ['It is not so much the cost as the hidden trade-offs that worry me about this proposal.', 'Were it not for her persistence, the project would have been shelved years ago.', 'The findings, while intriguing, hardly warrant the sweeping conclusions drawn by the media.', 'He has a tendency to play down his achievements, which some people mistake for indifference.'],
    open: ['What makes a good leader, in your opinion?', 'To what extent should governments regulate artificial intelligence?', 'How do you think cities will change in the next twenty years?', 'Is it ever acceptable to break a rule? Give an example.'],
    dictation: ['The proposal, though ambitious, fails to address the underlying causes of the problem.', 'Were it not for the delays, the bridge would have opened months ago.', 'She was quick to point out the inconsistencies in his argument.', 'Few would dispute that the policy has had unintended consequences.', 'It remains to be seen whether the new measures will make any real difference.', 'His remarks, intended as a joke, were taken rather more seriously than he had anticipated.'],
    talk: [
      { topic: 'leadership and work', tasks: ['argue a nuanced position', 'reformulate an idea when asked', 'handle an unexpected objection'], opening: 'They say great leaders are born, not made. Where do you stand on that?' },
      { topic: 'ethics of technology', tasks: ['weigh pros and cons', 'use precise vocabulary', 'concede a point and counter it'], opening: 'Should we let algorithms decide who gets a loan or a job? I am curious what you think.' },
    ],
  },
  C2: {
    guide: 'Speak at native pace with sophistication, nuance, humour and varied register.',
    read: ['Her remark was tongue-in-cheek, yet it struck a nerve with everyone in the room.', 'The novel’s understated prose belies the emotional turmoil simmering beneath its surface.', 'For all its grandiose rhetoric, the manifesto offers precious little in the way of concrete policy.', 'Notwithstanding the board’s reservations, the merger went ahead, much to the shareholders’ chagrin.'],
    open: ['What role should art play in times of political crisis?', 'Is irony a sign of intelligence or of disengagement? Discuss.', 'How would you explain a complex idea from your field to a curious teenager?'],
    dictation: ['Notwithstanding the committee’s reservations, the bill was rushed through parliament.', 'The author’s wry humour belies a deep unease about the direction of modern society.', 'Scarcely had the meeting begun when the chairman was called away on urgent business.', 'It would be disingenuous to claim that the reforms were universally welcomed.', 'Her argument, compelling as it was, rested on a number of untested assumptions.'],
    talk: [
      { topic: 'art and society', tasks: ['develop a sophisticated argument', 'shift register when asked', 'use humour or irony appropriately'], opening: 'Some say art should comfort the disturbed and disturb the comfortable. Thoughts?' },
      { topic: 'language and identity', tasks: ['discuss abstract ideas', 'give precise examples', 'challenge an assumption politely'], opening: 'Do you feel like a slightly different person when you speak English?' },
    ],
  },
}

// Promoção sugerida a partir do teste de confirmação (total e conversa mínimos). C2 não tem promoção.
export const PROMOTE_AT: Record<Level, { total: number; talk: number } | null> = {
  A1: { total: 85, talk: 80 }, A2: { total: 85, talk: 80 }, B1: { total: 85, talk: 82 },
  B2: { total: 87, talk: 85 }, C1: { total: 90, talk: 88 }, C2: null,
}
export const CONFIRM_AT = 55        // abaixo disso (com conversa < 50), sugere descer um nível (nunca no A1)
export const PROMOTION_PASS_AT = 60 // nota no teste do nível de cima para subir

const shuffle = <T,>(list: T[]) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
/** Sorteia os itens de uma tentativa, evitando os da tentativa anterior quando possível. */
export function drawItems(level: Level, avoid: Set<string> = new Set()) {
  const b = BANK[level]
  const pick = (list: string[], n: number) => { const fresh = shuffle(list.filter(x => !avoid.has(x))); return [...fresh, ...shuffle(list.filter(x => avoid.has(x)))].slice(0, n) }
  // Teste mais completo: 3 leituras, 2 perguntas abertas, 6 a 7 ditados e uma conversa de até 8 turnos.
  const dict = Math.min(b.dictation.length, level === 'A1' || level === 'A2' ? 6 : 7)
  const talk = shuffle(b.talk)[0]
  return {
    read: pick(b.read, Math.min(3, b.read.length)).map((text, i) => ({ id: `r${i}`, text })),
    open: pick(b.open, Math.min(2, b.open.length)).map((question, i) => ({ id: `o${i}`, question })),
    dictation: pick(b.dictation, dict).map((text, i) => ({ id: `d${i}`, text })),
    talk,
  }
}
