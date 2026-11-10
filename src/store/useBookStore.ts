import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { countWords, readingProgress, splitContentIntoPages } from '@/lib/utils'
import type { ComicLayout } from '@/lib/ai'

import type { Character, StyleDocument } from '../../supabase/functions/_shared/comicEditorial'

export type ComicStyleDoc = StyleDocument
export type ComicCharacter = Character

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
  /** Target number of pages for progress bar (reading progress uses the current page). */
  totalPages?: number
  comicPages?: Record<number, string>
  /** Posição dos balões (texto real por cima da imagem) por página. Páginas antigas não têm. */
  comicLayouts?: Record<number, ComicLayout>
  /** Style extracted from first comic page (colors, lineStyle, aesthetics, fonts). */
  comicStyleDoc?: ComicStyleDoc
  /** Characters documented for consistent drawing across pages. */
  comicCharacters?: ComicCharacter[]
  pinnedVocabIds?: string[]
  /** ISO 639-1 language code of the book (e.g. en, pt, es). Used for AI and display. */
  languageCode?: string
  /** Base64 data URL or raw base64 of cover image. */
  coverData?: string
  /** Livro puxado da galeria. EPUB enviado pela pessoa não tem isso. */
  catalogId?: string
  /** shared: imagens da galeria. personal: só as imagens desta pessoa. */
  imageMode?: 'shared' | 'personal'
}

interface BookState {
  books: Book[]
  currentBookId: string | null
  /** 
   * `content` here is optional initial full text used para IA (quadrinhos),
   * não gera páginas automaticamente. Páginas são criadas depois no Editor.
   */
  addBook: (title: string, content: string, opts?: { languageCode?: string; coverData?: string; description?: string; totalPages?: number; author?: string; pages?: string[] }) => Book
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
        const fullText = (content || '').trim()
        const pages = opts.pages ?? (fullText ? splitContentIntoPages(fullText) : [])
        const wordCount = countWords(pages.join(' '))
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
              updated.wordCount = countWords(updated.pages.join(' '))
            }
            updated.progress = readingProgress(updated.currentPage, updated.pages.length, updated.totalPages)
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
        books: books.map(book => {
          const prev = state.books.find(item => item.id === book.id)
          if (!prev?.catalogId && !prev?.imageMode) return book
          return { ...book, catalogId: book.catalogId ?? prev.catalogId, imageMode: book.imageMode ?? prev.imageMode }
        }),
        currentBookId: state.currentBookId && books.some(b => b.id === state.currentBookId) ? state.currentBookId : (books[0]?.id ?? null)
      }))
    }),
    {
      name: 'lexis-books',
      // localStorage tem ~5 MB: imagens em base64 estouravam o limite e o carregamento falhava
      // (ex.: no Chrome). Guardamos localmente só URLs; o resto fica no Supabase.
      storage: createJSONStorage(() => ({
        getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
        setItem: (k, v) => { try { localStorage.setItem(k, v) } catch (e) { console.warn('[books] cache local cheio; seguindo só com o Supabase', e) } },
        removeItem: (k) => { try { localStorage.removeItem(k) } catch { /* ignore */ } },
      })),
      partialize: (state) => ({
        ...state,
        books: state.books.map((b) => ({
          ...b,
          comicPages: b.comicPages
            ? Object.fromEntries(Object.entries(b.comicPages).filter(([, v]) => /^https?:\/\//.test(v)))
            : undefined,
        })),
      }),
    }
  )
)
