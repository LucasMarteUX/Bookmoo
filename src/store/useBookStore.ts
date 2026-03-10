import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { splitContentIntoPages } from '@/lib/utils'

export interface Book {
  id: string
  title: string
  /** Optional author name displayed under the title. */
  author?: string
  content: string // deprecated, kept for backward compatibility
  /** Optional summary/context used in the comic generation prompt for thematic consistency. */
  context?: string
  /** Short description shown on the book card. */
  description?: string
  pages: string[]
  currentPage: number
  progress: number
  lastRead: number
  wordCount: number
  /** Target number of pages for progress bar (progress = pages.length / totalPages). */
  totalPages?: number
  comicPages?: Record<number, string>
  pinnedVocabIds?: string[]
  /** ISO 639-1 language code of the book (e.g. en, pt, es). Used for AI and display. */
  languageCode?: string
  /** Base64 data URL or raw base64 of cover image. */
  coverData?: string
}

interface BookState {
  books: Book[]
  currentBookId: string | null
  /** 
   * `content` here is optional initial full text used para IA (quadrinhos),
   * não gera páginas automaticamente. Páginas são criadas depois no Editor.
   */
  addBook: (title: string, content: string, opts?: { languageCode?: string; coverData?: string; description?: string; totalPages?: number; author?: string }) => Book
  updateBook: (id: string, updates: Partial<Book>) => void
  deleteBook: (id: string) => void
  setCurrentBook: (id: string | null) => void
  /** Replace all books (e.g. after loading from Supabase). */
  setBooks: (books: Book[]) => void
}

export const useBookStore = create<BookState>()(
  persist(
    (set) => ({
      books: [],
      currentBookId: null,
      addBook: (title, content, opts = {}) => {
        const { languageCode = 'en', coverData, description, totalPages, author } = opts
        // Novos livros começam sem páginas; o usuário cria a primeira página depois no Editor.
        const pages: string[] = []
        const fullText = (content || '').trim()
        const wordCount = 0
        const targetPages = totalPages && totalPages > 0 ? totalPages : undefined
        const progress = 0
        const newBook: Book = {
          id: uuidv4(),
          title,
          author: author || undefined,
          content: fullText,
          context: '',
          description: description || undefined,
          pages,
          currentPage: 0,
          progress,
          lastRead: Date.now(),
          wordCount,
          totalPages: targetPages,
          languageCode,
          coverData: coverData || undefined
        }
        useBookStore.setState((state) => ({
          books: [...state.books, newBook],
          currentBookId: newBook.id
        }))
        return newBook
      },
      updateBook: (id, updates) => set((state) => ({
        books: state.books.map(b => {
          if (b.id === id) {
            const updated = { ...b, ...updates }
            // Ensure pages array exists for old books
            if (!updated.pages) updated.pages = [updated.content]
            if (updated.currentPage === undefined) updated.currentPage = 0
            
            // Recalculate word count if pages changed
            if (updates.pages) {
              updated.wordCount = updated.pages.join(' ').split(/\s+/).length
            }
            // Recalculate progress from totalPages if set
            if (updated.totalPages != null && updated.totalPages > 0) {
              updated.progress = Math.min(100, Math.round((updated.pages.length / updated.totalPages) * 100))
            }
            return updated
          }
          return b
        })
      })),
      deleteBook: (id) => set((state) => ({
        books: state.books.filter(b => b.id !== id),
        currentBookId: state.currentBookId === id ? null : state.currentBookId
      })),
      setCurrentBook: (id) => set({ currentBookId: id }),
      setBooks: (books) => set((state) => ({
        books,
        currentBookId: state.currentBookId && books.some(b => b.id === state.currentBookId) ? state.currentBookId : (books[0]?.id ?? null)
      }))
    }),
    {
      name: 'lexis-books'
    }
  )
)
