/** 20 most spoken languages (by total speakers), with ISO 639-1 code and country for flag */
export interface BookLanguage {
  code: string
  nameEn: string
  namePt: string
  flag: string // emoji, e.g. 🇺🇸
}

export const BOOK_LANGUAGES: BookLanguage[] = [
  { code: 'en', nameEn: 'English', namePt: 'Inglês', flag: '🇺🇸' },
  { code: 'zh', nameEn: 'Chinese (Mandarin)', namePt: 'Chinês (Mandarim)', flag: '🇨🇳' },
  { code: 'hi', nameEn: 'Hindi', namePt: 'Hindi', flag: '🇮🇳' },
  { code: 'es', nameEn: 'Spanish', namePt: 'Espanhol', flag: '🇪🇸' },
  { code: 'ar', nameEn: 'Arabic', namePt: 'Árabe', flag: '🇸🇦' },
  { code: 'fr', nameEn: 'French', namePt: 'Francês', flag: '🇫🇷' },
  { code: 'bn', nameEn: 'Bengali', namePt: 'Bengali', flag: '🇧🇩' },
  { code: 'pt', nameEn: 'Portuguese', namePt: 'Português', flag: '🇧🇷' },
  { code: 'ru', nameEn: 'Russian', namePt: 'Russo', flag: '🇷🇺' },
  { code: 'id', nameEn: 'Indonesian', namePt: 'Indonésio', flag: '🇮🇩' },
  { code: 'de', nameEn: 'German', namePt: 'Alemão', flag: '🇩🇪' },
  { code: 'ja', nameEn: 'Japanese', namePt: 'Japonês', flag: '🇯🇵' },
  { code: 'pa', nameEn: 'Punjabi', namePt: 'Punjabi', flag: '🇮🇳' },
  { code: 'vi', nameEn: 'Vietnamese', namePt: 'Vietnamita', flag: '🇻🇳' },
  { code: 'tr', nameEn: 'Turkish', namePt: 'Turco', flag: '🇹🇷' },
  { code: 'te', nameEn: 'Telugu', namePt: 'Telugu', flag: '🇮🇳' },
  { code: 'mr', nameEn: 'Marathi', namePt: 'Marata', flag: '🇮🇳' },
  { code: 'ta', nameEn: 'Tamil', namePt: 'Tâmil', flag: '🇮🇳' },
  { code: 'ko', nameEn: 'Korean', namePt: 'Coreano', flag: '🇰🇷' },
  { code: 'it', nameEn: 'Italian', namePt: 'Italiano', flag: '🇮🇹' }
]

const byCode = new Map(BOOK_LANGUAGES.map(l => [l.code, l]))
export function getBookLanguage(code: string, locale: 'en' | 'pt-BR'): BookLanguage | undefined {
  const lang = byCode.get(code) ?? byCode.get(code.split('-')[0])
  return lang
}
export function getBookLanguageName(code: string, locale: 'en' | 'pt-BR'): string {
  const lang = getBookLanguage(code, locale)
  if (!lang) return code
  return locale === 'pt-BR' ? lang.namePt : lang.nameEn
}
