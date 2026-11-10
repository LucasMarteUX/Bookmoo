// Nível de estudo no Bookmoo. Sobe só quando os dois crescem juntos:
// palavras salvas e pontos. O mais lento segura o nível.
// A tradução em português aparece só no A1.

export type CefrId = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export interface CefrBand {
  id: CefrId
  words: number
  points: number
  pt: string
  en: string
  can: { pt: string; en: string }
}

export const CEFR: CefrBand[] = [
  { id: 'A1', words: 0, points: 0, pt: 'Iniciante', en: 'Beginner', can: { pt: 'Compreender palavras e frases simples.', en: 'Understand simple words and phrases.' } },
  { id: 'A2', words: 40, points: 80, pt: 'Básico', en: 'Elementary', can: { pt: 'Entender conversas do dia a dia.', en: 'Follow everyday conversations.' } },
  { id: 'B1', words: 120, points: 250, pt: 'Intermediário', en: 'Intermediate', can: { pt: 'Manter conversas e ler textos comuns.', en: 'Hold conversations and read everyday texts.' } },
  { id: 'B2', words: 300, points: 600, pt: 'Intermediário superior', en: 'Upper Intermediate', can: { pt: 'Conversar com desenvoltura e dar opinião.', en: 'Talk with ease and share opinions.' } },
  { id: 'C1', words: 700, points: 1400, pt: 'Avançado', en: 'Advanced', can: { pt: 'Ler textos longos e usar inglês de trabalho.', en: 'Read long texts and use English at work.' } },
  { id: 'C2', words: 1500, points: 3000, pt: 'Proficiente', en: 'Proficiency', can: { pt: 'Entender quase tudo e se expressar com naturalidade.', en: 'Understand almost anything and speak naturally.' } },
]

export function studyLevel(words: number, points: number): CefrBand {
  const safeWords = Math.max(0, words)
  const safePoints = Math.max(0, points)
  let current = CEFR[0]
  for (const band of CEFR) {
    if (safeWords >= band.words && safePoints >= band.points) current = band
  }
  return current
}

/** Tradução pronta só enquanto a pessoa ainda está no começo. */
export const showsGloss = (level: CefrId) => level === 'A1'
