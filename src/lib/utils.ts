import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const DEFAULT_WORDS_PER_PAGE = 350

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
        for (let i = 0; i < words.length; i += wordsPerPage) {
          const chunk = words.slice(i, i + wordsPerPage).join(' ')
          pages.push(chunk)
        }
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
