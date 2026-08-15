import OpenAI, { toFile } from 'openai'

const COMIC_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2'

type VercelRequest = {
  method?: string
  body?: {
    pageText?: string
    bookTitle?: string
    bookContext?: string
    referenceImages?: string[]
    comicStyleDoc?: { colors?: string; lineStyle?: string; aesthetics?: string; fonts?: string }
    comicCharacters?: { name: string; visualDescription: string }[]
    searchContext?: string
    languageCode?: string
  }
}

type VercelResponse = {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

function isQuotaError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'status' in error
    && (error as { status?: number }).status === 429
}

function buildPrompt(body: NonNullable<VercelRequest['body']>) {
  const pageText = body.pageText?.trim() ?? ''
  const bookContext = body.bookContext?.trim() ?? ''
  const contextExcerpt = bookContext.substring(0, 2000)
  const languageInstruction = body.languageCode
    ? `\nLANGUAGE: The book is in ${body.languageCode}. All speech bubbles, captions, and any visible text MUST be in this same language. Do not translate the page text.`
    : ''

  let prompt = `You are creating ONE PAGE of a comic book or manga that belongs to a longer story. Your goal is VISUAL AND THEMATIC CONSISTENCY so that every page feels like the same book and the same characters.

BOOK TITLE: "${body.bookTitle ?? ''}"
FULL BOOK CONTEXT:
"""
${contextExcerpt}
"""
`

  if (body.searchContext?.trim()) {
    prompt += `\nVISUAL REFERENCES:\n"""\n${body.searchContext.trim().substring(0, 1500)}\n"""\n`
  }

  const style = body.comicStyleDoc
  if (style && (style.colors || style.lineStyle || style.aesthetics || style.fonts)) {
    prompt += `\nSTYLE REFERENCE (must follow exactly):\n${[
      style.colors && `Colors: ${style.colors}`,
      style.lineStyle && `Line style: ${style.lineStyle}`,
      style.aesthetics && `Aesthetics: ${style.aesthetics}`,
      style.fonts && `Fonts/lettering: ${style.fonts}`
    ].filter(Boolean).join('\n')}\n`
  }

  if (body.comicCharacters?.length) {
    prompt += `\nCHARACTERS (draw identically in every panel where they appear):\n${body.comicCharacters.map((c) => `- ${c.name}: ${c.visualDescription}`).join('\n')}\n`
  }

  prompt += `
CURRENT PAGE TEXT TO ILLUSTRATE (use ONLY this text in speech bubbles and captions — do not invent or add any other text):
"""
${pageText}
"""

COMPOSITION — Full comic page:
- Divide the page into clear PANELS that show different moments or angles.
- Put dialogue in SPEECH BUBBLES and narration in CAPTION BOXES.
- Translate the action and emotions of the text into clear poses and expressions.

STYLE:
- Use a vibrant, colorful comic book or manga style (rich colors, not grayscale).
- Match the atmosphere to the book context.

TEXT FIDELITY:
- NEVER invent or hallucinate text. Every word in speech bubbles and captions MUST be EXACTLY from the current page text.

QUALITY:
- Render the image at high resolution with sharp, crisp details.
- All text inside speech bubbles and caption boxes MUST be legible and easy to read.
- Use large, clean comic lettering with strong contrast and generous spacing.
- Never use decorative, distorted, pseudo-text, or unreadable lettering.
- If the supplied text is long, use fewer words per bubble and distribute the exact supplied sentences across more panels; do not invent, alter, or misspell any words.${languageInstruction}`

  const refs = body.referenceImages ?? []
  if (refs.length >= 2) {
    prompt += '\n\nUse the first reference image as the main style reference and the second for character continuity and scene flow.'
  } else if (refs.length === 1) {
    prompt += '\n\nUse the reference image for the same art style, character designs, clothing, shading, and overall aesthetic.'
  } else {
    prompt += '\n\nEstablish a clear, memorable visual style and character designs so future pages stay consistent.'
  }

  return { prompt, refs }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body
  const openAiKey = process.env.OPENAI_API_KEY
  if (!openAiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on Vercel' })
  if (!body?.pageText?.trim()) return res.status(400).json({ error: 'Page text is required' })

  try {
    const openai = new OpenAI({ apiKey: openAiKey })
    const { prompt, refs } = buildPrompt(body)
    const response = refs.length > 0
      ? await openai.images.edit({
          model: COMIC_IMAGE_MODEL,
          image: await Promise.all(refs.slice(0, 2).map((image, index) => (
            toFile(Buffer.from(image, 'base64'), `comic-reference-${index}.jpg`, { type: 'image/jpeg' })
          ))),
          prompt,
          size: '1024x1536',
          quality: 'medium',
          output_format: 'jpeg',
          output_compression: 80
        })
      : await openai.images.generate({
          model: COMIC_IMAGE_MODEL,
          prompt,
          size: '1024x1536',
          quality: 'medium',
          output_format: 'jpeg',
          output_compression: 80
        })

    const image = response.data?.[0]?.b64_json
    if (!image) return res.status(502).json({ error: 'OpenAI did not return an image' })
    return res.status(200).json({ image })
  } catch (error) {
    console.error('OpenAI comic generation failed:', error)
    const message = error instanceof Error ? error.message : 'OpenAI image generation failed'
    return res.status(isQuotaError(error) ? 429 : 502).json({ error: message })
  }
}
