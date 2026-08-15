import type { PlaybackResult } from '@/lib/audio'

export const ELEVENLABS_FALLBACK_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'
export const ELEVENLABS_VOICE_ID =
  import.meta.env.VITE_ELEVENLABS_VOICE_ID || ELEVENLABS_FALLBACK_VOICE_ID

export async function generateElevenLabsAudio(
  text: string,
  voiceId = ELEVENLABS_VOICE_ID
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
          ? { text: text.trim(), model_id: 'eleven_multilingual_v2', output_format: 'mp3_44100_128' }
          : { text: text.trim(), voiceId: requestedVoiceId }
      )
    }
  )
  let response = await requestAudio(voiceId)
  if (response.status === 402 && voiceId !== ELEVENLABS_FALLBACK_VOICE_ID) {
    response = await requestAudio(ELEVENLABS_FALLBACK_VOICE_ID)
  }

  if (!response.ok) {
    throw new Error(`ElevenLabs HTTP ${response.status}`)
  }

  const audio = new Audio(URL.createObjectURL(await response.blob()))
  const whenEnded = new Promise<void>((resolve) => {
    audio.onended = () => {
      URL.revokeObjectURL(audio.src)
      resolve()
    }
  })
  await audio.play()

  return {
    stop: () => {
      audio.pause()
      audio.currentTime = 0
      URL.revokeObjectURL(audio.src)
    },
    whenEnded
  }
}
