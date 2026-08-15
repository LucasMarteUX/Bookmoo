import { GoogleGenAI } from '@google/genai'
import { GEMINI_MODELS } from '../src/lib/geminiConfig'

type VercelRequest = {
  method?: string
  body?: { imageDataUrl?: string; languageCode?: string }
}

type VercelResponse = {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

const MAX_IMAGE_BYTES = 4_000_000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.GEMINI_API_KEY
  const imageDataUrl = req.body?.imageDataUrl
  const languageCode = req.body?.languageCode || 'en'
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' })
  if (!imageDataUrl?.startsWith('data:image/')) return res.status(400).json({ error: 'A valid image is required' })
  if (Buffer.byteLength(imageDataUrl, 'utf8') > MAX_IMAGE_BYTES) {
    return res.status(413).json({ error: 'Image is too large' })
  }

  const match = imageDataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i)
  if (!match) return res.status(400).json({ error: 'Unsupported image format' })

  const [, mimeType, data] = match
  const ai = new GoogleGenAI({ apiKey })
  const response = await ai.models.generateContent({
    model: GEMINI_MODELS.transcription,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data } },
        {
          text: `Você está analisando uma fotografia de uma página de livro.

Sua tarefa é transcrever fielmente todo o texto legível presente na página.
Idioma esperado: ${languageCode}

Regras:
1. Não resuma.
2. Não explique.
3. Não faça comentários.
4. Não adicione informações.
5. Preserve a ordem natural de leitura.
6. Preserve títulos, parágrafos, listas e diálogos.
7. Preserve pontuação e acentos.
8. Corrija apenas erros evidentes causados pelo reconhecimento visual, nunca o texto original.
9. Se um trecho estiver ilegível, use [trecho ilegível] e não invente conteúdo.
10. Retorne somente o conteúdo transcrito.`
        }
      ]
    }]
  })

  const text = response.text?.trim()
  if (!text) return res.status(422).json({ error: 'No legible text found' })
  return res.status(200).json({ text })
}
