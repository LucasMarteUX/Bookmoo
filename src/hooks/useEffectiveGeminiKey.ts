import { useAuth } from '@/contexts/AuthContext'
import { useReaderSettings } from '@/store/useReaderSettings'

/** Returns the API key to use for Gemini: undefined = use env default (admins), or user's saved key for non-admins. */
export function useEffectiveGeminiKey(): string | null | undefined {
  const { isAdmin } = useAuth()
  const { geminiApiKey } = useReaderSettings()
  if (isAdmin) return undefined
  return geminiApiKey
}
