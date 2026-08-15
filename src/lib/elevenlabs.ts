import type { PlaybackResult } from '@/lib/audio'

export const ELEVENLABS_VOICE_ID =
  import.meta.env.VITE_ELEVENLABS_VOICE_ID || 'jfIS2w2yJi0grJZPyEsk'

export async function generateElevenLabsAudio(
  text: string,
  voiceId = ELEVENLABS_VOICE_ID
): Promise<PlaybackResult | null> {
  if (!text.trim()) return null
  const response = await fetch('/api/elevenlabs-tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: text.trim(), voiceId })
  })

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
