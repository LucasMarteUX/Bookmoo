// Regra única de "o que é uma palavra" — usada pela tela (data-word-index) e pela narração.
// Se as duas contarem diferente, o destaque se desalinha ao longo do texto.
export const WORD_PATTERN = "[\\p{L}\\p{N}_]+(?:'[\\p{L}\\p{N}_]+)*"

export function wordRegex() {
  return new RegExp(WORD_PATTERN, 'gu')
}

export function countWords(text: string): number {
  return text.match(wordRegex())?.length ?? 0
}

export function listWords(text: string): string[] {
  return text.match(wordRegex()) ?? []
}
