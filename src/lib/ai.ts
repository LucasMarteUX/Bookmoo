import { GoogleGenAI, Type, Modality } from "@google/genai"

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

export interface VocabExplanation {
  definition: string
  ipa: string
  examples: string[]
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
  referenceImage?: string
  /** ISO 639-1. All speech bubbles and captions must be in this language. */
  languageCode?: string
}

export async function generateComicPage(
  options: GenerateComicOptions | (string & {}),
  legacyBookContext?: string,
  legacyReferenceImage?: string,
  apiKey?: string | null
): Promise<string | null> {
  const ai = getClient(apiKey)
  if (!ai) return null

  const pageText = typeof options === 'string' ? options : options.pageText
  const bookTitle = typeof options === 'string' ? '' : options.bookTitle
  const bookContext = typeof options === 'string' ? (legacyBookContext ?? '') : options.bookContext
  const referenceImage = typeof options === 'string' ? legacyReferenceImage : options.referenceImage
  const languageCode = typeof options === 'string' ? undefined : options.languageCode
  const langInstruction = languageCode
    ? `\nLANGUAGE: The book is in ${languageCode}. All speech bubbles, captions, and any visible text MUST be in this same language. Do not translate the page text.`
    : ''

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
- NEVER invent or hallucinate text. Every word in speech bubbles and captions MUST be EXACTLY from the "CURRENT PAGE TEXT TO ILLUSTRATE" above. Do not paraphrase or add anything.${langInstruction}`

    if (referenceImage) {
      prompt += `

VISUAL MEMORY — Reference image provided:
- The attached image is the PREVIOUS page of this same comic. You MUST use it as the ONLY visual reference for:
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
    if (referenceImage) {
      parts.push({
        inlineData: {
          data: referenceImage,
          mimeType: "image/jpeg"
        }
      })
    }
    parts.push({ text: prompt })

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
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
      examples: []
    }
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Explain clearly in ${langName} the meaning of "${text}".
Level: ${level}
Be concise.`,
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
            }
          },
          required: ["definition", "ipa", "examples"]
        }
      }
    })

    const result = JSON.parse(response.text || "{}")
    return {
      definition: result.definition || "No definition found.",
      ipa: result.ipa || "",
      examples: result.examples || []
    }
  } catch (error) {
    console.error("Failed to generate explanation:", error)
    return {
      definition: "Failed to generate explanation.",
      ipa: "",
      examples: []
    }
  }
}
