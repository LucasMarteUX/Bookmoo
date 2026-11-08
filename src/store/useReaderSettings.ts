import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'sepia' | 'dark'
export type FontFamily = 'serif' | 'sans'
export type BgTone = 'dark' | 'medium' | 'light'

interface ReaderSettingsState {
  theme: Theme
  fontSize: number
  lineHeight: number
  showHighlights: boolean
  playbackRate: number
  voiceGender: 'female' | 'male'
  fontFamily: FontFamily
  bgTone: BgTone
  /** User's Gemini API key (non-admins only). Not persisted to localStorage; loaded from Supabase. */
  geminiApiKey: string | null
  /** TTS for page reading: browser is the default provider. */
  ttsProvider: 'browser' | 'gemini' | 'elevenlabs'
  setTheme: (theme: Theme) => void
  setFontSize: (size: number) => void
  setLineHeight: (height: number) => void
  toggleHighlights: () => void
  setShowHighlights: (show: boolean) => void
  setPlaybackRate: (rate: number) => void
  setVoiceGender: (gender: 'female' | 'male') => void
  setFontFamily: (font: FontFamily) => void
  setBgTone: (tone: BgTone) => void
  setGeminiApiKey: (key: string | null) => void
  setTtsProvider: (provider: 'browser' | 'gemini' | 'elevenlabs') => void
}

export const useReaderSettings = create<ReaderSettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      fontSize: 18,
      lineHeight: 1.8,
      showHighlights: true,
      playbackRate: 1,
      voiceGender: 'male',
      fontFamily: 'serif',
      bgTone: 'medium',
      geminiApiKey: null,
      ttsProvider: 'browser',
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      toggleHighlights: () => set((state) => ({ showHighlights: !state.showHighlights })),
      setShowHighlights: (showHighlights) => set({ showHighlights }),
      setPlaybackRate: (playbackRate) => set({ playbackRate }),
      setVoiceGender: (voiceGender) => set({ voiceGender }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setBgTone: (bgTone) => set({ bgTone }),
      setGeminiApiKey: (geminiApiKey) => set({ geminiApiKey }),
      setTtsProvider: (ttsProvider) => set({ ttsProvider })
    }),
    {
      name: 'lexis-reader-settings',
      version: 2,
      migrate: (persistedState) => {
        if (persistedState && typeof persistedState === 'object') {
          return { ...persistedState, ttsProvider: 'browser' }
        }
        return persistedState
      },
      partialize: (state) => ({
        theme: state.theme,
        fontSize: state.fontSize,
        lineHeight: state.lineHeight,
        showHighlights: state.showHighlights,
        playbackRate: state.playbackRate,
        voiceGender: state.voiceGender,
        fontFamily: state.fontFamily,
        bgTone: state.bgTone,
        ttsProvider: state.ttsProvider
      })
    }
  )
)

/** Velocidades de narração (fala real; aplicadas na geração da voz Kokoro). */
export const PLAYBACK_SPEEDS = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5] as const

export function snapPlaybackRate(r: number): number {
  if (!Number.isFinite(r)) return 1
  return PLAYBACK_SPEEDS.reduce((best, s) => (Math.abs(s - r) < Math.abs(best - r) ? s : best), 1 as number)
}
