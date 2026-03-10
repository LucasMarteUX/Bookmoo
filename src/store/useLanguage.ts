import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Locale = 'en' | 'pt-BR'

interface LanguageState {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useLanguage = create<LanguageState>()(
  persist(
    (set) => ({
      locale: 'en',
      setLocale: (locale) => set({ locale })
    }),
    { name: 'bookmoo-locale' }
  )
)
