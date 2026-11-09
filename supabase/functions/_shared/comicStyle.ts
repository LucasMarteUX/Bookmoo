import type { ArtDirection } from './comicEditorial.ts'

export function usesRealisticLineArt(style: ArtDirection) {
  return /^(realist|photo)/i.test(style.realism ?? '')
}

export function isHistoricalRomanceStyle(style: ArtDirection) {
  const direction = [style.styleName, style.artStyle, style.coloring].join(' ')
  return !usesRealisticLineArt(style) && /historical romance|romance hist[oó]rico|regency|regência/i.test(direction)
}
