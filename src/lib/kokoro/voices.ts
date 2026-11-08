// Vozes reais do Kokoro-82M v1.0 (hexgrad/Kokoro-82M VOICES.md).
// Só inglês: kokoro-js 1.2.1 só traz vozes en-us/en-gb (os outros idiomas do Kokoro não funcionam no navegador).
// Vozes com nota geral < C entram marcadas como `basic` (qualidade menor), para ampliar as opções masculinas.
export interface KokoroVoice {
  id: string
  name: string
  accent: 'US' | 'UK'
  gender: 'female' | 'male'
  grade: string
  basic?: boolean
}

export const KOKORO_VOICES: KokoroVoice[] = [
  { id: 'af_heart', name: 'Heart', accent: 'US', gender: 'female', grade: 'A' },
  { id: 'af_bella', name: 'Bella', accent: 'US', gender: 'female', grade: 'A-' },
  { id: 'af_nicole', name: 'Nicole', accent: 'US', gender: 'female', grade: 'B-' },
  { id: 'af_aoede', name: 'Aoede', accent: 'US', gender: 'female', grade: 'C+' },
  { id: 'af_kore', name: 'Kore', accent: 'US', gender: 'female', grade: 'C+' },
  { id: 'af_sarah', name: 'Sarah', accent: 'US', gender: 'female', grade: 'C+' },
  { id: 'am_michael', name: 'Michael', accent: 'US', gender: 'male', grade: 'C+' },
  { id: 'am_fenrir', name: 'Fenrir', accent: 'US', gender: 'male', grade: 'C+' },
  { id: 'am_puck', name: 'Puck', accent: 'US', gender: 'male', grade: 'C+' },
  { id: 'bf_emma', name: 'Emma', accent: 'UK', gender: 'female', grade: 'B-' },
  { id: 'bf_isabella', name: 'Isabella', accent: 'UK', gender: 'female', grade: 'C' },
  { id: 'bm_george', name: 'George', accent: 'UK', gender: 'male', grade: 'C' },
  { id: 'bm_fable', name: 'Fable', accent: 'UK', gender: 'male', grade: 'C' },
  { id: 'bm_lewis', name: 'Lewis', accent: 'UK', gender: 'male', grade: 'D+', basic: true },
  { id: 'bm_daniel', name: 'Daniel', accent: 'UK', gender: 'male', grade: 'D', basic: true },
  { id: 'am_echo', name: 'Echo', accent: 'US', gender: 'male', grade: 'D', basic: true },
  { id: 'am_eric', name: 'Eric', accent: 'US', gender: 'male', grade: 'D', basic: true },
  { id: 'am_liam', name: 'Liam', accent: 'US', gender: 'male', grade: 'D', basic: true },
  { id: 'am_onyx', name: 'Onyx', accent: 'US', gender: 'male', grade: 'D', basic: true },
]

export const DEFAULT_KOKORO_VOICE = 'af_heart'

export function getKokoroVoice(id: string | null | undefined): KokoroVoice | undefined {
  return KOKORO_VOICES.find((v) => v.id === id)
}
