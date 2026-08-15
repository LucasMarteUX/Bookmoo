type VercelRequest = {
  method?: string
  body?: { text?: string; voiceId?: string; speed?: number }
}

type VercelResponse = {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
  send: (body: Buffer) => void
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Keep the canonical name server-side; the VITE_ fallback supports an
  // already-configured Vercel variable without exposing it in the client bundle.
  const apiKey = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY
  const text = req.body?.text?.trim()
  const voiceId = req.body?.voiceId?.trim() || 'jfIS2w2yJi0grJZPyEsk'
  const fallbackVoiceId = 'JBFqnCBsd6RMkjVDRZzb'
  const speed = Math.min(1.2, Math.max(0.7, Number(req.body?.speed) || 1))

  if (!apiKey) return res.status(500).json({ error: 'ELEVENLABS_API_KEY is not configured' })
  if (!text) return res.status(400).json({ error: 'Text is required' })

  const requestVoice = (requestedVoiceId: string) => fetch(`https://api.elevenlabs.io/v1/text-to-speech/${requestedVoiceId}`, {
    method: 'POST',
    headers: {
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      output_format: 'mp3_44100_128',
      voice_settings: { speed }
    })
  })
  let elevenResponse = await requestVoice(voiceId)
  if (elevenResponse.status === 402 && voiceId !== fallbackVoiceId) {
    elevenResponse = await requestVoice(fallbackVoiceId)
  }

  if (!elevenResponse.ok) {
    const details = await elevenResponse.text()
    return res.status(elevenResponse.status).json({ error: details || 'ElevenLabs request failed' })
  }

  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).send(Buffer.from(await elevenResponse.arrayBuffer()))
}
