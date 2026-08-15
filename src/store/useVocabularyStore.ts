import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'

export type VocabStatus = 'learned' | 'review' | 'important'
export type VocabType = 'word' | 'phrase' | 'sentence'

export interface GrammarExample {
  form: 'affirmative' | 'negative' | 'interrogative'
  context: string
  english: string
  portuguese: string
}

export interface Vocabulary {
  id: string
  bookId: string
  text: string
  type: VocabType
  status: VocabStatus
  explanation: string
  examples: string[]
  grammarExamples?: GrammarExample[]
  usageNote?: string
  variantStory?: string
  audioData?: string
  createdAt: number
}

interface VocabularyState {
  vocabularies: Vocabulary[]
  addVocabulary: (vocab: Omit<Vocabulary, 'id' | 'createdAt'>) => Vocabulary
  updateVocabulary: (id: string, updates: Partial<Vocabulary>) => void
  deleteVocabulary: (id: string) => void
  getVocabByBook: (bookId: string) => Vocabulary[]
  /** Replace all vocabularies (e.g. after loading from Supabase). */
  setVocabularies: (vocabularies: Vocabulary[]) => void
}

export const useVocabularyStore = create<VocabularyState>()(
  persist(
    (set, get) => ({
      vocabularies: [],
      addVocabulary: (vocab) => {
        const newVocab: Vocabulary = { ...vocab, id: uuidv4(), createdAt: Date.now() }
        useVocabularyStore.setState((state) => ({
          vocabularies: [...state.vocabularies, newVocab]
        }))
        return newVocab
      },
      updateVocabulary: (id, updates) => set((state) => ({
        vocabularies: state.vocabularies.map(v => v.id === id ? { ...v, ...updates } : v)
      })),
      deleteVocabulary: (id) => set((state) => ({
        vocabularies: state.vocabularies.filter(v => v.id !== id)
      })),
      getVocabByBook: (bookId) => get().vocabularies.filter(v => v.bookId === bookId),
      setVocabularies: (vocabularies) => set({ vocabularies })
    }),
    {
      name: 'lexis-vocabulary'
    }
  )
)
