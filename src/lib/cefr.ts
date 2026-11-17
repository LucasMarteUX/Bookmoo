// Nível de estudo no Bookmoo. Sobe só quando os dois crescem juntos:
// palavras salvas e pontos. O mais lento segura o nível.
// A tradução em português aparece só no primeiro nível (Iniciante).

export type CefrId = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export interface CefrBand {
  id: CefrId
  words: number
  points: number
  /** Nome do nível da pessoa no Bookmoo (o código CEFR fica interno; a prova de proficiência é que usa CEFR). */
  pt: string
  en: string
  /** Livros continuam com o código CEFR (A1…C2) e esta descrição da faixa. */
  book: { pt: string; en: string }
  can: { pt: string; en: string }
}

// O nível da pessoa tem nomes próprios (Iniciante … Lenda), para não confundir com o selo CEFR que vem da prova de
// proficiência. Os livros continuam indicados por CEFR (A1 … C2).
export const CEFR: CefrBand[] = [
  { id: 'A1', words: 0, points: 0, pt: 'Iniciante', en: 'Beginner', book: { pt: 'Iniciante', en: 'Beginner' }, can: { pt: 'Compreender palavras e frases simples.', en: 'Understand simple words and phrases.' } },
  { id: 'A2', words: 40, points: 80, pt: 'Aprendiz', en: 'Apprentice', book: { pt: 'Básico', en: 'Elementary' }, can: { pt: 'Entender conversas do dia a dia.', en: 'Follow everyday conversations.' } },
  { id: 'B1', words: 120, points: 250, pt: 'Praticante', en: 'Practitioner', book: { pt: 'Intermediário', en: 'Intermediate' }, can: { pt: 'Manter conversas e ler textos comuns.', en: 'Hold conversations and read everyday texts.' } },
  { id: 'B2', words: 300, points: 600, pt: 'Experiente', en: 'Seasoned', book: { pt: 'Intermediário superior', en: 'Upper Intermediate' }, can: { pt: 'Conversar com desenvoltura e dar opinião.', en: 'Talk with ease and share opinions.' } },
  { id: 'C1', words: 700, points: 1400, pt: 'Expert', en: 'Expert', book: { pt: 'Avançado', en: 'Advanced' }, can: { pt: 'Ler textos longos e usar inglês de trabalho.', en: 'Read long texts and use English at work.' } },
  { id: 'C2', words: 1500, points: 3000, pt: 'Lenda', en: 'Legend', book: { pt: 'Proficiente', en: 'Proficiency' }, can: { pt: 'Entender quase tudo e se expressar com naturalidade.', en: 'Understand almost anything and speak naturally.' } },
]

const bandOf = (id: string | null | undefined) => CEFR.find(b => b.id === id)
/** Nome do nível da pessoa (Iniciante … Lenda). */
export const levelName = (id: string | null | undefined, pt = true) => { const b = bandOf(id); return b ? (pt ? b.pt : b.en) : '' }
/** Descrição da faixa CEFR de um livro (Iniciante … Proficiente); o selo do livro mostra o código. */
export const bookLevelName = (id: string | null | undefined, pt = true) => { const b = bandOf(id); return b ? (pt ? b.book.pt : b.book.en) : '' }
/** Cor de cada nível (tons pastéis do tema, com contraste nos temas claro, sépia e escuro). */
const TONES = ['green', 'blue', 'lavender', 'amber', 'rose', 'sand'] as const
export const levelTone = (id: string | null | undefined) => {
  const t = TONES[Math.max(0, CEFR.findIndex(b => b.id === id))]
  return { bg: `var(--pastel-${t}-bg)`, fg: `var(--pastel-${t}-fg)`, bd: `var(--pastel-${t}-bd)` }
}
/** Posição 1–6 (para emblemas e escalas visuais). */
export const levelRank = (id: string | null | undefined) => Math.max(0, CEFR.findIndex(b => b.id === id)) + 1

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
