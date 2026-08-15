import type { PlaybackResult } from '@/lib/audio'
import { ELEVENLABS_CONFIG } from '@/lib/elevenlabsConfig'

export const ELEVENLABS_FALLBACK_VOICE_ID = ELEVENLABS_CONFIG.fallbackVoiceId
export const ELEVENLABS_VOICE_ID = import.meta.env.VITE_ELEVENLABS_VOICE_ID || ELEVENLABS_CONFIG.voiceId

export async function generateElevenLabsAudio(
  text: string,
  voiceId = ELEVENLABS_VOICE_ID,
  speed = 1,
  signal?: AbortSignal
): Promise<PlaybackResult | null> {
  if (!text.trim()) return null
  const localApiKey = import.meta.env.DEV
    ? (import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined)
    : undefined
  const requestAudio = (requestedVoiceId: string) => fetch(
    localApiKey
      ? `https://api.elevenlabs.io/v1/text-to-speech/${requestedVoiceId}`
      : '/api/elevenlabs-tts',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(localApiKey ? { Accept: 'audio/mpeg', 'xi-api-key': localApiKey } : {})
      },
      body: JSON.stringify(
        localApiKey
          ? {
              text: text.trim(),
              model_id: ELEVENLABS_CONFIG.modelId,
              output_format: 'mp3_44100_128',
              voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0 }
            }
          : { text: text.trim(), voiceId: requestedVoiceId, speed }
      ),
      signal
    }
  )
  let response = await requestAudio(voiceId)
  if (response.status === 402 && voiceId !== ELEVENLABS_FALLBACK_VOICE_ID) {
    response = await requestAudio(ELEVENLABS_FALLBACK_VOICE_ID)
  }

  if (!response.ok) {
    throw new Error(`ElevenLabs HTTP ${response.status}`)
  }

  if (signal?.aborted) return null
  const audioUrl = URL.createObjectURL(await response.blob())
  if (signal?.aborted) {
    URL.revokeObjectURL(audioUrl)
    return null
  }
  const audio = new Audio(audioUrl)
  audio.playbackRate = speed
  let finished = false
  let resolveEnded: () => void = () => {}
  const whenEnded = new Promise<void>((resolve) => {
    resolveEnded = resolve
  })
  const finish = () => {
    if (finished) return
    finished = true
    URL.revokeObjectURL(audioUrl)
    resolveEnded()
  }
  audio.onended = finish
  try {
    await audio.play()
  } catch (error) {
    finish()
    throw error
  }

  return {
    play: () => audio.play(),
    stop: () => {
      audio.pause()
      audio.currentTime = 0
      finish()
    },
    pause: () => audio.pause(),
    resume: () => { void audio.play() },
    whenEnded
  }
}
