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

/** Língua que a pessoa já fala, pelo idioma do aparelho. A tela do app pode estar em outra. */
export function nativeLocale(): Locale {
  if (typeof navigator === 'undefined') return 'pt-BR'
  const lang = (navigator.languages?.[0] || navigator.language || '').toLowerCase()
  return lang.startsWith('pt') ? 'pt-BR' : 'en'
}
