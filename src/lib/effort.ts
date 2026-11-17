// Esforço dentro do nível: o nível (A1 a C2) vem do progresso da pessoa e a IA já se adapta a ele; o esforço ajusta o quanto
// a conversa puxa dentro desse nível. 1 = mais leve, 2 = no ponto, 3 = desafio. Cada nível tem nomes próprios para os três.
// Salvo no aparelho e enviado à IA a cada conversa (tutor livre, cenas e tutora do livro).
import { useEffect, useState } from 'react'
import type { CefrId } from '@/lib/cefr'

export type Effort = 1 | 2 | 3

type Names = Record<Effort, { pt: string; en: string; hint: { pt: string; en: string } }>

export const EFFORT_NAMES: Record<CefrId, Names> = {
  A1: {
    1: { pt: 'Super iniciante', en: 'Absolute beginner', hint: { pt: 'Frases curtíssimas, bem devagar, com escolhas para responder.', en: 'Tiny sentences, very slow, with choices to answer.' } },
    2: { pt: 'Iniciante', en: 'Beginner', hint: { pt: 'Frases simples do dia a dia, com paciência.', en: 'Simple everyday sentences, with patience.' } },
    3: { pt: 'Praticante', en: 'Practising', hint: { pt: 'Puxa respostas um pouco maiores e traz uma palavra nova por vez.', en: 'Asks for slightly longer answers and adds one new word at a time.' } },
  },
  A2: {
    1: { pt: 'Primeiros passos', en: 'First steps', hint: { pt: 'Bem simples, com muita ajuda.', en: 'Very simple, with lots of help.' } },
    2: { pt: 'Básico', en: 'Elementary', hint: { pt: 'Conversa do dia a dia, sem pressa.', en: 'Everyday talk, no rush.' } },
    3: { pt: 'Básico confiante', en: 'Confident elementary', hint: { pt: 'Perguntas abertas e expressões novas.', en: 'Open questions and new expressions.' } },
  },
  B1: {
    1: { pt: 'Intermediário inicial', en: 'Early intermediate', hint: { pt: 'Ritmo calmo e vocabulário comum.', en: 'Calm pace and common words.' } },
    2: { pt: 'Intermediário', en: 'Intermediate', hint: { pt: 'Inglês natural do dia a dia.', en: 'Natural everyday English.' } },
    3: { pt: 'Intermediário fluente', en: 'Fluent intermediate', hint: { pt: 'Mais rápido, com expressões e opiniões.', en: 'Faster, with expressions and opinions.' } },
  },
  B2: {
    1: { pt: 'Independente', en: 'Independent', hint: { pt: 'Natural, mas sem gírias difíceis.', en: 'Natural, without hard slang.' } },
    2: { pt: 'Desenvolto', en: 'At ease', hint: { pt: 'Velocidade normal, com phrasal verbs.', en: 'Normal speed, with phrasal verbs.' } },
    3: { pt: 'Quase avançado', en: 'Nearly advanced', hint: { pt: 'Debate, nuance e vocabulário mais rico.', en: 'Debate, nuance and richer vocabulary.' } },
  },
  C1: {
    1: { pt: 'Avançado', en: 'Advanced', hint: { pt: 'Natural e claro.', en: 'Natural and clear.' } },
    2: { pt: 'Avançado fluente', en: 'Fluent advanced', hint: { pt: 'Como com um nativo, com idioms.', en: 'Like with a native, with idioms.' } },
    3: { pt: 'Quase nativo', en: 'Near native', hint: { pt: 'Ritmo e vocabulário de nativo, temas complexos.', en: 'Native pace and vocabulary, complex topics.' } },
  },
  C2: {
    1: { pt: 'Proficiente', en: 'Proficient', hint: { pt: 'Natural, sem pressa.', en: 'Natural, unhurried.' } },
    2: { pt: 'Refinado', en: 'Refined', hint: { pt: 'Precisão, estilo e registro.', en: 'Precision, style and register.' } },
    3: { pt: 'Especialista', en: 'Expert', hint: { pt: 'Discussão sofisticada, humor e sutileza.', en: 'Sophisticated discussion, humour and subtlety.' } },
  },
}

const KEY = 'bookmoo.effort.v1'
const EVT = 'bookmoo-effort'
export function getEffort(): Effort {
  try { const v = Number(localStorage.getItem(KEY)); return v === 1 || v === 3 ? v : 2 } catch { return 2 }
}
export function setEffort(e: Effort) {
  try { localStorage.setItem(KEY, String(e)) } catch { /* sem armazenamento */ }
  window.dispatchEvent(new Event(EVT))
}
export function useEffort(): [Effort, (e: Effort) => void] {
  const [e, set] = useState<Effort>(getEffort)
  useEffect(() => {
    const sync = () => set(getEffort())
    window.addEventListener(EVT, sync)
    return () => window.removeEventListener(EVT, sync)
  }, [])
  return [e, setEffort]
}
export const effortName = (level: CefrId, e: Effort, pt: boolean) => (pt ? EFFORT_NAMES[level]?.[e]?.pt : EFFORT_NAMES[level]?.[e]?.en) ?? ''
