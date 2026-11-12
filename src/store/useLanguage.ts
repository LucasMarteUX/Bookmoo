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
      // Interface em português por padrão (o livro continua na língua dele). Dá para trocar em Ajustes.
      locale: 'pt-BR',
      setLocale: (locale) => set({ locale })
    }),
    {
      name: 'bookmoo-locale',
      // v1: o padrão antigo era inglês e ficou gravado para todo mundo; passa para português uma vez.
      version: 1,
      migrate: () => ({ locale: 'pt-BR' as Locale }),
    }
  )
)

/** Língua que a pessoa já fala, pelo idioma do aparelho. A tela do app pode estar em outra. */
export function nativeLocale(): Locale {
  if (typeof navigator === 'undefined') return 'pt-BR'
  const lang = (navigator.languages?.[0] || navigator.language || '').toLowerCase()
  return lang.startsWith('pt') ? 'pt-BR' : 'en'
}
