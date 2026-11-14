// Idioma das respostas da tutora (leitura e conversa livre), salvo no aparelho.
import { useEffect, useState } from 'react'
import type { TutorLangMode } from '@/lib/billingApi'

const KEY = 'bookmoo-tutor-lang'
const EVT = 'bookmoo-tutor-lang'

export function getTutorLang(): TutorLangMode {
  try { const v = localStorage.getItem(KEY); return v === 'hybrid' || v === 'pt' || v === 'en' ? v : 'auto' } catch { return 'auto' }
}
export function setTutorLang(mode: TutorLangMode) {
  try { localStorage.setItem(KEY, mode) } catch { /* sem armazenamento */ }
  window.dispatchEvent(new Event(EVT))
}
export function useTutorLang(): [TutorLangMode, (m: TutorLangMode) => void] {
  const [mode, setMode] = useState(getTutorLang)
  useEffect(() => {
    const sync = () => setMode(getTutorLang())
    window.addEventListener(EVT, sync)
    return () => window.removeEventListener(EVT, sync)
  }, [])
  return [mode, setTutorLang]
}

export const TUTOR_LANG_OPTIONS: { id: TutorLangMode; pt: string; en: string; hint: [string, string] }[] = [
  { id: 'auto', pt: 'Automático', en: 'Automatic', hint: ['Mistura português e inglês no A1 e A2; só inglês do B1 em diante.', 'Mixes Portuguese and English at A1/A2; English only from B1.'] },
  { id: 'hybrid', pt: 'Misto', en: 'Mixed', hint: ['Conversa em inglês e explica em português quando precisa.', 'Talks in English and explains in Portuguese when needed.'] },
  { id: 'pt', pt: 'Português', en: 'Portuguese', hint: ['Explica tudo em português, com os exemplos em inglês.', 'Explains in Portuguese, with examples in English.'] },
  { id: 'en', pt: 'Só inglês', en: 'English only', hint: ['Fala apenas em inglês, no seu nível.', 'Speaks English only, at your level.'] },
]
