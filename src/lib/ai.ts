import { GoogleGenAI, Type, Modality } from "@google/genai"
import type { ComicStyleDoc, ComicCharacter } from "@/store/useBookStore"
import { GEMINI_MODELS } from "@/lib/geminiConfig"

let clientInstance: GoogleGenAI | null = null

export const API_KEY_REQUIRED_MESSAGE =
  "Configure GEMINI_API_KEY no arquivo .env.local para usar esta função."

/** If apiKey is provided (e.g. non-admin user key), use it; otherwise use env GEMINI_API_KEY. */
function getClient(apiKey?: string | null): GoogleGenAI | null {
  const key = typeof apiKey === "string" && apiKey.trim()
    ? apiKey.trim()
    : (process.env.GEMINI_API_KEY as string | undefined)
  if (typeof key !== "string" || !key.trim()) return null
  if (typeof apiKey === "string" && apiKey.trim()) {
    return new GoogleGenAI({ apiKey: key })
  }
  if (!clientInstance) {
    clientInstance = new GoogleGenAI({ apiKey: key })
  }
  return clientInstance
}

/** Optional: use Gemini with Google Search to get visual references (movies, art, characters) for the comic prompt. Returns text to inject or empty on failure. */
export async function enrichComicPromptWithSearch(
  bookTitle: string,
  bookContext: string,
  pageText: string,
  apiKey?: string | null
): Promise<string> {
  const ai = getClient(apiKey)
  if (!ai) return ""
  try {
    const prompt = `For a comic book adaptation, suggest brief visual references (movies, animated series, book covers, existing character designs or art style) that could inspire the look of this story. Be very concise (max 4–5 short bullet points).
Book title: ${bookTitle}
Story context: ${bookContext.substring(0, 800)}
This page: ${pageText.substring(0, 600)}
Reply with only the bullet points, no intro.`
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      } as any
    })
    const text = response.text?.trim() ?? ""
    return text
  } catch (error) {
    console.warn("enrichComicPromptWithSearch failed (grounding may be unavailable):", error)
    return ""
  }
}

export interface VocabExplanation {
  definition: string
  ipa: string
  examples: string[]
  grammarExamples: {
    form: "affirmative" | "negative" | "interrogative"
    context: string
    english: string
    portuguese: string
  }[]
  usageNote: string
}

/** Language code (ISO 639-1) for TTS; affects pronunciation. */
export async function generateAudio(text: string, apiKey?: string | null, languageCode?: string): Promise<string | null> {
  const ai = getClient(apiKey)
  if (!ai) return null
  try {
    const config: any = {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Puck" }
        }
      }
    }
    if (languageCode) {
      config.speechConfig = { ...config.speechConfig, languageCode }
    }
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config
    })
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
    return base64Audio || null
  } catch (error) {
    console.error("Failed to generate audio:", error)
    return null
  }
}

export interface GenerateComicOptions {
  pageText: string
  bookTitle: string
  bookContext: string
  /** Single reference image (legacy). Ignored if referenceImages is set. */
  referenceImage?: string
  /** Up to 2 images: [firstPageForStyle, previousPage]. First is always style reference. */
  referenceImages?: string[]
  /** Documented style from first page; injected into prompt. */
  comicStyleDoc?: ComicStyleDoc
  /** Documented characters; injected into prompt. */
  comicCharacters?: ComicCharacter[]
  /** Optional block from web search to enrich the prompt. */
  searchContext?: string
  /** ISO 639-1. All speech bubbles and captions must be in this language. */
  languageCode?: string
}

export async function generateComicPage(
  options: GenerateComicOptions | (string & {}),
  legacyBookContext?: string,
  legacyReferenceImage?: string,
  apiKey?: string | null
): Promise<string | null> {
  const pageText = typeof options === 'string' ? options : options.pageText
  const bookTitle = typeof options === 'string' ? '' : options.bookTitle
  const bookContext = typeof options === 'string' ? (legacyBookContext ?? '') : options.bookContext
  const referenceImage = typeof options === 'string' ? legacyReferenceImage : options.referenceImage
  const referenceImages = typeof options === 'string' ? undefined : options.referenceImages
  const comicStyleDoc = typeof options === 'string' ? undefined : options.comicStyleDoc
  const comicCharacters = typeof options === 'string' ? undefined : options.comicCharacters
  const searchContext = typeof options === 'string' ? undefined : options.searchContext
  const languageCode = typeof options === 'string' ? undefined : options.languageCode
  const langInstruction = languageCode
    ? `\nLANGUAGE: The book is in ${languageCode}. All speech bubbles, captions, and any visible text MUST be in this same language. Do not translate the page text.`
    : ''

  const refs = referenceImages && referenceImages.length > 0 ? referenceImages : (referenceImage ? [referenceImage] : [])

  // In the published app, keep the Gemini key on the server. Local Vite
  // development keeps the direct path so the existing .env.local workflow
  // remains useful.
  const isPublishedBrowser = typeof window !== 'undefined'
    && !['localhost', '127.0.0.1'].includes(window.location.hostname)
  if (isPublishedBrowser) {
    const response = await fetch('/api/generate-comic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageText,
        bookTitle,
        bookContext,
        referenceImages: refs,
        comicStyleDoc,
        comicCharacters,
        searchContext,
        languageCode
      })
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload.error || `Gemini request failed (${response.status})`)
    }
    return payload.image || null
  }

  const ai = getClient(apiKey)
  if (!ai) return null

  try {
    const contextExcerpt = bookContext.trim().substring(0, 2000)
    const thematicBlock = bookTitle
      ? `BOOK TITLE: "${bookTitle}"
This title and the context below define the genre, era, setting, and mood (e.g. medieval drama, sci-fi, contemporary romance). Use them to choose a consistent visual style, color palette, and atmosphere for the entire story.

FULL BOOK CONTEXT (use for thematic consistency):
"""
${contextExcerpt}
${contextExcerpt.length < bookContext.length ? '\n...' : ''}
"""`
      : `BOOK CONTEXT (use for thematic consistency — genre, era, setting, mood):
"""
${contextExcerpt}
${contextExcerpt.length < bookContext.length ? '\n...' : ''}
"""`

    let prompt = `You are creating ONE PAGE of a comic book or manga that belongs to a longer story. Your goal is VISUAL AND THEMATIC CONSISTENCY so that every page feels like the same book and the same characters.

${thematicBlock}
`
    if (searchContext && searchContext.trim()) {
      prompt += `
VISUAL REFERENCES (use to inspire style and mood; adapt to your comic):
"""
${searchContext.trim().substring(0, 1500)}
"""
`
    }
    if (comicStyleDoc && (comicStyleDoc.colors || comicStyleDoc.lineStyle || comicStyleDoc.aesthetics || comicStyleDoc.fonts)) {
      const parts: string[] = []
      if (comicStyleDoc.colors) parts.push(`Colors: ${comicStyleDoc.colors}`)
      if (comicStyleDoc.lineStyle) parts.push(`Line style: ${comicStyleDoc.lineStyle}`)
      if (comicStyleDoc.aesthetics) parts.push(`Aesthetics: ${comicStyleDoc.aesthetics}`)
      if (comicStyleDoc.fonts) parts.push(`Fonts/lettering: ${comicStyleDoc.fonts}`)
      prompt += `
STYLE REFERENCE (must follow exactly):
${parts.join('\n')}
`
    }
    if (comicCharacters && comicCharacters.length > 0) {
      prompt += `
CHARACTERS (draw identically in every panel where they appear):
${comicCharacters.map(c => `- ${c.name}: ${c.visualDescription}`).join('\n')}
`
    }

    prompt += `

CURRENT PAGE TEXT TO ILLUSTRATE (use ONLY this text in speech bubbles and captions — do not invent or add any other text):
"""
${pageText}
"""

COMPOSITION — Full comic page:
- Divide the page into clear PANELS (frames) that show different moments or angles.
- Put dialogue in SPEECH BUBBLES and narration in CAPTION BOXES.
- Translate the action and emotions of the text into clear poses and expressions.

STYLE:
- Use a vibrant, colorful comic book or manga style (rich colors, not grayscale).
- Match the atmosphere to the book context (e.g. dark for drama, bright for adventure).

TEXT FIDELITY (critical):
- NEVER invent or hallucinate text. Every word in speech bubbles and captions MUST be EXACTLY from the "CURRENT PAGE TEXT TO ILLUSTRATE" above. Do not paraphrase or add anything.

QUALITY & READABILITY (critical):
- Render the image at high resolution with sharp, crisp details. All text inside speech bubbles and caption boxes MUST be legible and easy to read: use clear lettering, strong contrast between text and background, and avoid blurry or low-resolution text. Dialogue and captions are essential for reading the story—prioritize their visual clarity.${langInstruction}`

    if (refs.length === 2) {
      prompt += `

VISUAL MEMORY — Two reference images provided (in order):
1. FIRST IMAGE: The FIRST PAGE of this comic. This is your MAIN style reference. You MUST use the exact same colors, line work, shading, aesthetics, and overall look.
2. SECOND IMAGE: The PREVIOUS page. Use it for character continuity (same faces, hair, clothing) and scene flow.
Draw the CURRENT page so that a reader would have no doubt it is the same story and the same characters.`
    } else if (refs.length === 1) {
      prompt += `

VISUAL MEMORY — Reference image provided:
- The attached image is the FIRST or PREVIOUS page of this same comic. You MUST use it as the visual reference for:
  * Same art style (line work, shading, color palette).
  * Same character designs: same faces, same hair, same body types.
  * Same clothing and accessories for each character.
  * Same overall aesthetic (e.g. same kind of backgrounds, same level of detail).
- Draw the CURRENT page so that a reader would have no doubt it is the same story and the same characters. The protagonists and secondary characters must look IDENTICAL to how they appear in the reference.`
    } else {
      prompt += `

VISUAL IDENTITY:
- Establish a clear, memorable visual style and character designs so that future pages can stay consistent with this one.`
    }

    const parts: any[] = []
    for (const img of refs) {
      parts.push({
        inlineData: {
          data: img,
          mimeType: "image/jpeg"
        }
      })
    }
    parts.push({ text: prompt })

    const response = await ai.models.generateContent({
      model: GEMINI_MODELS.comicImage,
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "3:4",
          imageSize: "1K"
        }
      }
    })
    
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data
      }
    }
    
    return null
  } catch (error) {
    console.error("Failed to generate comic page:", error)
    return null
  }
}

export interface ExtractComicResult {
  styleDoc: ComicStyleDoc
  characters: ComicCharacter[]
}

/** Analyze the first comic page image and extract style + character descriptions for future consistency. */
export async function extractComicStyleAndCharacters(
  imageBase64: string,
  pageText?: string,
  apiKey?: string | null
): Promise<ExtractComicResult | null> {
  const ai = getClient(apiKey)
  if (!ai) return null
  try {
    const textPart = pageText
      ? `Page text (for character names):\n${pageText.substring(0, 1500)}`
      : "Describe the visible style and any characters."
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: imageBase64,
                mimeType: "image/jpeg"
              }
            },
            { text: `Analyze this comic page. ${textPart}\n\nRespond with JSON only, no markdown. Use this exact structure:
{
  "styleDoc": {
    "colors": "short description of color palette and mood",
    "lineStyle": "line weight, clean vs sketchy, etc.",
    "aesthetics": "overall look: manga, western comic, etc.",
    "fonts": "lettering style if visible"
  },
  "characters": [
    { "name": "Character name", "visualDescription": "face, hair, clothing, distinctive traits", "firstPage": 0 }
  ]
}
Include every character visible in the page. firstPage should be 0 for this first page.` }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            styleDoc: {
              type: Type.OBJECT,
              properties: {
                colors: { type: Type.STRING },
                lineStyle: { type: Type.STRING },
                aesthetics: { type: Type.STRING },
                fonts: { type: Type.STRING }
              }
            },
            characters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  visualDescription: { type: Type.STRING },
                  firstPage: { type: Type.NUMBER }
                },
                required: ["name", "visualDescription"]
              }
            }
          },
          required: ["styleDoc", "characters"]
        }
      }
    })
    const raw = response.text || "{}"
    const parsed = JSON.parse(raw) as { styleDoc?: ComicStyleDoc; characters?: ComicCharacter[] }
    const styleDoc: ComicStyleDoc = parsed.styleDoc ?? {}
    const characters: ComicCharacter[] = Array.isArray(parsed.characters)
      ? parsed.characters.map((c: any) => ({
          name: String(c.name ?? ""),
          visualDescription: String(c.visualDescription ?? ""),
          firstPage: typeof c.firstPage === "number" ? c.firstPage : undefined
        }))
      : []
    return { styleDoc, characters }
  } catch (error) {
    console.error("Failed to extract comic style and characters:", error)
    return null
  }
}

/** Detect new characters in page text that are not yet in existingCharacters; return descriptions for them. */
export async function detectNewCharactersInPageText(
  pageText: string,
  existingCharacters: ComicCharacter[],
  apiKey?: string | null
): Promise<ComicCharacter[]> {
  const ai = getClient(apiKey)
  if (!ai) return []
  const existingNames = existingCharacters.map(c => c.name.trim().toLowerCase())
  if (existingNames.length === 0) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `This is a page from a story:
"""
${pageText.substring(0, 3000)}
"""
List the characters that appear or are mentioned on this page. For each character, provide a short visual description (face, hair, clothing, distinctive traits) suitable for an artist to draw them consistently. Respond with JSON only:
{ "characters": [ { "name": "Name", "visualDescription": "description" } ] }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              characters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    visualDescription: { type: Type.STRING }
                  },
                  required: ["name", "visualDescription"]
                }
              }
            },
            required: ["characters"]
          }
        }
      })
      const raw = response.text || "{}"
      const parsed = JSON.parse(raw) as { characters?: { name: string; visualDescription: string }[] }
      const arr = Array.isArray(parsed.characters) ? parsed.characters : []
      return arr.map(c => ({ name: String(c.name ?? ""), visualDescription: String(c.visualDescription ?? "") }))
    } catch (e) {
      console.error("detectNewCharactersInPageText:", e)
      return []
    }
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `This is a page from a story:
"""
${pageText.substring(0, 3000)}
"""
Already documented characters (do NOT include these again): ${existingCharacters.map(c => c.name).join(", ")}

List ONLY characters that appear or are mentioned on this page and are NOT in the list above. For each NEW character, provide a short visual description (face, hair, clothing, distinctive traits). If no new characters, return empty array. Respond with JSON only:
{ "characters": [ { "name": "Name", "visualDescription": "description" } ] }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            characters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  visualDescription: { type: Type.STRING }
                },
                required: ["name", "visualDescription"]
              }
            }
          },
          required: ["characters"]
        }
      }
    })
    const raw = response.text || "{}"
    const parsed = JSON.parse(raw) as { characters?: { name: string; visualDescription: string }[] }
    const arr = Array.isArray(parsed.characters) ? parsed.characters : []
    return arr.map(c => ({ name: String(c.name ?? ""), visualDescription: String(c.visualDescription ?? "") }))
  } catch (e) {
    console.error("detectNewCharactersInPageText:", e)
    return []
  }
}

/** targetLanguageCode: ISO 639-1 (e.g. en, pt). Explanation and examples will be in this language. */
export async function generateExplanation(
  text: string,
  level: "A2" | "B1" | "B2" = "B1",
  apiKey?: string | null,
  targetLanguageCode?: string
): Promise<VocabExplanation> {
  const ai = getClient(apiKey)
  const lang = targetLanguageCode || 'en'
  const langName = lang === 'pt' ? 'Portuguese' : lang === 'es' ? 'Spanish' : lang === 'fr' ? 'French' : lang === 'de' ? 'German' : lang === 'ja' ? 'Japanese' : lang === 'zh' ? 'Chinese' : 'English'
  if (!ai) {
    return {
      definition: "Configure GEMINI_API_KEY no arquivo .env.local para usar esta função.",
      ipa: "",
      examples: [],
      grammarExamples: [],
      usageNote: ""
    }
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Explain clearly in ${langName} the meaning of "${text}".
Level: ${level}
Be concise.

You are a language teacher focused on practical English for business and career. In addition to the definition and pronunciation, create exactly three practical examples using different business contexts:
1. affirmative
2. negative
3. interrogative

For each example, include the grammatical form, a distinct context, the sentence in English with the analyzed term wrapped in **, and a fluent Portuguese translation. Add a short usage note when the negative or interrogative form changes an auxiliary, verb tense, word order, or another grammatical element.

Return JSON only.`,
      config: {
        systemInstruction: `You are a ${langName} teacher. Provide a simple definition in ${langName}, an intuitive phonetic spelling (e.g., AP-uhl for apple) instead of IPA, and exactly 3 example sentences in ${langName}.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            definition: {
              type: Type.STRING,
              description: "A simple, concise definition of the word or phrase."
            },
            ipa: {
              type: Type.STRING,
              description: "The intuitive phonetic spelling of the word or phrase (e.g., AP-uhl)."
            },
            examples: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING
              },
              description: "Exactly 3 example sentences using the word or phrase."
            },
            grammarExamples: {
              type: Type.ARRAY,
              minItems: 3,
              maxItems: 3,
              items: {
                type: Type.OBJECT,
                properties: {
                  form: { type: Type.STRING, enum: ["affirmative", "negative", "interrogative"] },
                  context: { type: Type.STRING },
                  english: { type: Type.STRING },
                  portuguese: { type: Type.STRING }
                },
                required: ["form", "context", "english", "portuguese"]
              }
            },
            usageNote: {
              type: Type.STRING,
              description: "Brief grammar note, or an empty string if no special note is needed."
            }
          },
          required: ["definition", "ipa", "examples", "grammarExamples", "usageNote"]
        }
      }
    })

    const result = JSON.parse(response.text || "{}")
    return {
      definition: result.definition || "No definition found.",
      ipa: result.ipa || "",
      examples: result.examples || [],
      grammarExamples: Array.isArray(result.grammarExamples) ? result.grammarExamples : [],
      usageNote: result.usageNote || ""
    }
  } catch (error) {
    console.error("Failed to generate explanation:", error)
    return {
      definition: "Failed to generate explanation.",
      ipa: "",
      examples: [],
      grammarExamples: [],
      usageNote: ""
    }
  }
}

export async function generateVariantStory(
  text: string,
  targetLanguageCode?: string,
  apiKey?: string | null
): Promise<string | null> {
  const ai = getClient(apiKey)
  if (!ai || !text.trim()) return null
  const language = targetLanguageCode === "pt" ? "Portuguese" : "the learner's interface language"
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Create a short parallel story for a language learner based on the English term "${text}".
The story must be independent from any book context, use a fresh everyday or professional situation, and demonstrate the term naturally at least three times in different sentences. Write the story in ${language}, but keep the target term and its example sentences in English. Add a one-sentence title. Keep it between 80 and 130 words. Return plain text only.`,
    })
    return response.text?.trim() || null
  } catch (error) {
    console.error("Failed to generate variant story:", error)
    return null
  }
}
