import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Page length presets. Short and medium pages produce comics with readable balloons. */
export const PAGE_SIZES = { short: 120, medium: 220, long: 350 } as const
export type PageSize = keyof typeof PAGE_SIZES
export const DEFAULT_PAGE_SIZE: PageSize = 'short'
const DEFAULT_WORDS_PER_PAGE = PAGE_SIZES[DEFAULT_PAGE_SIZE]

/** Closest preset for an existing book, from its average words per page. */
export function inferPageSize(pages: string[]): PageSize {
  const filled = pages.filter(page => page.trim())
  if (!filled.length) return DEFAULT_PAGE_SIZE
  const average = filled.reduce((sum, page) => sum + countWords(page), 0) / filled.length
  return (Object.keys(PAGE_SIZES) as PageSize[])
    .reduce((best, size) => Math.abs(PAGE_SIZES[size] - average) < Math.abs(PAGE_SIZES[best] - average) ? size : best, DEFAULT_PAGE_SIZE)
}

/** Sentences of a long paragraph, so pages never break mid-sentence when avoidable. */
function sentenceChunks(paragraph: string, limit: number): string[] {
  const sentences = paragraph.match(/[^.!?…]+(?:[.!?…]+["”’)\]]*|$)\s*/gu)?.map(s => s.trim()).filter(Boolean) ?? [paragraph]
  const chunks: string[] = []
  let current: string[] = []
  let count = 0
  for (const sentence of sentences) {
    const words = countWords(sentence)
    if (words > limit) {
      if (current.length) { chunks.push(current.join(' ')); current = []; count = 0 }
      const parts = sentence.split(/\s+/)
      for (let i = 0; i < parts.length; i += limit) chunks.push(parts.slice(i, i + limit).join(' '))
      continue
    }
    if (count + words > limit && current.length) { chunks.push(current.join(' ')); current = []; count = 0 }
    current.push(sentence)
    count += words
  }
  if (current.length) chunks.push(current.join(' '))
  return chunks
}

export function countWords(text: string) {
  return (text.match(/\S+/g) ?? []).length
}

/**
 * Splits content into pages by word count, optionally respecting paragraph breaks.
 */
export function splitContentIntoPages(content: string, wordsPerPage: number = DEFAULT_WORDS_PER_PAGE): string[] {
  const trimmed = content.trim()
  if (!trimmed) return ['']

  const paragraphs = trimmed.split(/\n\n+/)
  const pages: string[] = []
  let currentPage: string[] = []
  let currentWordCount = 0

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) continue

    if (currentWordCount + words.length <= wordsPerPage) {
      currentPage.push(para)
      currentWordCount += words.length
    } else {
      if (currentPage.length > 0) {
        pages.push(currentPage.join('\n\n').trim())
        currentPage = []
        currentWordCount = 0
      }
      if (words.length >= wordsPerPage) {
        pages.push(...sentenceChunks(para, wordsPerPage))
      } else {
        currentPage.push(para)
        currentWordCount = words.length
      }
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage.join('\n\n').trim())
  }

  return pages.length > 0 ? pages : [trimmed]
}


/** The first page is the starting position. Reaching the last page completes the book. */
export function readingProgress(currentPage: number, availablePages: number, totalPages = 0) {
  const lastPage = Math.max(availablePages, totalPages) - 1
  if (availablePages < 1 || lastPage <= 0 || !Number.isFinite(currentPage)) return 0
  return Math.max(0, Math.min(100, Math.floor(100 * currentPage / lastPage)))
}
