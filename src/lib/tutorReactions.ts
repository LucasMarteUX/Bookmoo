// Reações da tutora: frases que combinam com a expressão do rosto e leitura do texto da fala.
// Cada frase vem com o humor que ela mostra (surpresa, tímida, triste...), para o rosto e o texto nunca se contradizerem.
// As frases misturam inglês e português de propósito: é um convite para praticar sem apagar a língua da pessoa.
import type { Mood } from '@/components/voice/TutorAvatar'

export type ReactionLine = { mood: Mood; pt: string; en: string }

/** Convites da conversa livre, antes de começar. */
export const INVITES_FREE: ReactionLine[] = [
  { mood: 'surprised', pt: 'Oh! You are here! Bora praticar inglês?', en: 'Oh! You are here! Shall we practise?' },
  { mood: 'happy', pt: 'So happy to see you! Que bom te ver por aqui.', en: 'So happy to see you! Come, sit with me.' },
  { mood: 'wink', pt: 'Pode errar à vontade. I will not tell anyone.', en: 'Make all the mistakes you want. I will not tell anyone.' },
  { mood: 'shy', pt: 'I am a little shy at first... mas vamos conversar?', en: 'I am a little shy at first... but shall we talk?' },
  { mood: 'confused', pt: 'Hmm... what do you want to practise today?', en: 'Hmm... what do you want to practise today?' },
  { mood: 'sad', pt: 'Faz tempo que a gente não conversa... Let us fix that?', en: 'It has been a while since we talked... Let us fix that?' },
  { mood: 'angry', pt: 'Hmph! Dia sem inglês? Not on my watch!', en: 'Hmph! A day without English? Not on my watch!' },
  { mood: 'laughing', pt: 'Tell me about your day! Eu quero saber de tudo.', en: 'Tell me about your day! I want to hear everything.' },
]

/** Convites das cenas (a pessoa é a personagem da situação). */
export const INVITES_SCENE: ReactionLine[] = [
  { mood: 'happy', pt: 'Ready when you are. Toque em Começar.', en: 'Ready when you are. Tap Start.' },
  { mood: 'wink', pt: 'Errar faz parte. Mistakes are how we learn.', en: 'Mistakes are how we learn. Do not worry.' },
  { mood: 'confused', pt: 'Hmm... do you know what to say? Eu ajudo.', en: 'Hmm... do you know what to say? I will help.' },
  { mood: 'surprised', pt: 'Oh! Already here? Vamos entrar na cena!', en: 'Oh! Already here? Let us step into the scene!' },
  { mood: 'shy', pt: 'A little nervous? Eu também. Let us start slowly.', en: 'A little nervous? Me too. Let us start slowly.' },
]

/** Reação ao toque: o rosto e o texto saem juntos. */
export const POKES: ReactionLine[] = [
  { mood: 'surprised', pt: 'Oh! You startled me! Que susto.', en: 'Oh! You startled me!' },
  { mood: 'shy', pt: 'Hehe... that tickles. Ei, que vergonha!', en: 'Hehe... that tickles!' },
  { mood: 'wink', pt: 'Our little secret. Esse fica entre nós.', en: 'Our little secret.' },
  { mood: 'happy', pt: 'Hi again! Oi de novo, tudo bem?', en: 'Hi again! How are you?' },
  { mood: 'confused', pt: 'Hm? Did you want something? Precisa de ajuda?', en: 'Hm? Did you want something?' },
  { mood: 'laughing', pt: 'Haha! Stop it, vai me fazer rir!', en: 'Haha! Stop it, you will make me laugh!' },
]
/** Cutucar demais (5 vezes em poucos segundos): ela fica brava, de brincadeira. */
export const POKE_ANGRY: ReactionLine = { mood: 'angry', pt: 'Hey! Stop poking me! Ei, para com isso!', en: 'Hey! Stop poking me!' }

/** Microfone bloqueado ou ausente: ela se assusta. */
export const MIC_SCARE: ReactionLine = {
  mood: 'surprised',
  pt: 'Oh no! I cannot hear you. Libere o microfone para conversarmos.',
  en: 'Oh no! I cannot hear you. Allow the microphone so we can talk.',
}

export const lineText = (l: ReactionLine, pt: boolean) => (pt ? l.pt : l.en)

/** Quanto tempo o texto fica na tela (e o rosto na expressão), pelo tamanho da frase. */
export const holdMs = (text: string) => Math.min(6500, Math.max(3200, 1800 + text.length * 55))

/** Sorteia sem repetir a anterior. */
export function pickNext<T>(list: T[], last: T | null): T {
  const pool = list.filter(x => x !== last)
  return pool[Math.floor(Math.random() * pool.length)] ?? list[0]
}

// ---------------------------------------------------------------------------
// Expressão pelo texto da fala. Conservadora: só reage a sinais claros (e devolve null no resto),
// para o rosto acompanhar a conversa sem parecer forçado. A tutora fala inglês; os sinais em português
// cobrem as frases de apoio.
// ---------------------------------------------------------------------------
const RULES: { mood: Mood; re: RegExp }[] = [
  { mood: 'laughing', re: /\b(ha ?ha+|he ?he+|lol|funny|hilarious|engraçad[oa]|que engraçado)\b/i },
  { mood: 'surprised', re: /\b(wow|no way|oh my|oh!|really\?!|you did\?|incredible|unbelievable|amazing news|uau|nossa!|sério\?!)/i },
  { mood: 'sad', re: /\b(i'?m (so )?sorry to hear|that'?s sad|too bad|unfortunately|i feel bad|que pena|sinto muito|lamento)\b/i },
  { mood: 'shy', re: /\b(you'?re too kind|you flatter|i'?m blushing|i'?m a bit shy|thank you so much|que gentil|fico sem graça)\b/i },
  { mood: 'wink', re: /\b(our (little )?secret|just between us|don'?t tell|entre nós)\b/i },
  { mood: 'happy', re: /\b(great job|well done|excellent|perfect|fantastic|awesome|congratulations|proud of you|nice work|good job|parabéns|ótimo|muito bem)\b/i },
  { mood: 'confused', re: /\b(hmm+|let me think|i'?m not sure|i wonder|what do you mean|não entendi|como assim)\b/i },
]

/** Humor que combina com a frase, ou null quando nada pede expressão (o rosto segue neutro). */
export function moodFromText(text: string): Mood | null {
  const t = text.trim()
  if (t.length < 4) return null
  for (const r of RULES) if (r.re.test(t)) return r.mood
  return null
}
