// Tarefas de texto/visão que antes rodavam no navegador com uma chave exposta.
// Usa a chave do próprio usuário (Gemini preferido para texto/visão; OpenAI como alternativa).
import { corsHeaders, getUser, json, log } from '../_shared/tts.ts'
import { AiError, llmJson, llmText, pickProvider, type ImagePart } from '../_shared/ai.ts'

const LANG_NAMES: Record<string, string> = { pt: 'Portuguese', es: 'Spanish', fr: 'French', de: 'German', ja: 'Japanese', zh: 'Chinese', en: 'English' }
const MAX_IMAGE_B64 = 5_500_000

function imageFromDataUrl(dataUrl: unknown): ImagePart {
  const m = String(dataUrl ?? '').match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i)
  if (!m) throw new AiError('invalid_image', 400, 'invalid_image')
  if (m[2].length > MAX_IMAGE_B64) throw new AiError('image_too_large', 413, 'image_too_large')
  return { mime: m[1], data: m[2] }
}

type Body = Record<string, unknown> & { action?: string }

async function handle(userId: string, b: Body) {
  switch (b.action) {
    case 'explain': {
      const text = String(b.text ?? '').slice(0, 300)
      const level = ['A2', 'B1', 'B2'].includes(String(b.level)) ? String(b.level) : 'B1'
      const langName = LANG_NAMES[String(b.languageCode ?? 'en')] ?? 'English'
      const { provider, key } = await pickProvider(userId, ['gemini', 'openai'])
      const r = await llmJson<Record<string, unknown>>(provider, key, {
        system: `You are a ${langName} teacher. Provide a simple definition in ${langName}, an intuitive phonetic spelling (e.g., AP-uhl for apple) instead of IPA, and exactly 3 example sentences in ${langName}.`,
        prompt: `Explain clearly in ${langName} the meaning of "${text}".
Level: ${level}
Be concise.

You are a language teacher focused on practical English for business and career. In addition to the definition and pronunciation, create exactly three practical examples using different business contexts:
1. affirmative
2. negative
3. interrogative

For each example, include the grammatical form, a distinct context, the sentence in English with the analyzed term wrapped in **, and a fluent Portuguese translation. Add a short usage note when the negative or interrogative form changes an auxiliary, verb tense, word order, or another grammatical element.

Return JSON only with this exact shape:
{"definition": string, "ipa": string, "examples": [string, string, string], "grammarExamples": [{"form": "affirmative"|"negative"|"interrogative", "context": string, "english": string, "portuguese": string}], "usageNote": string}`,
      })
      return {
        definition: String(r.definition ?? 'No definition found.'),
        ipa: String(r.ipa ?? ''),
        examples: Array.isArray(r.examples) ? r.examples.map(String) : [],
        grammarExamples: Array.isArray(r.grammarExamples) ? r.grammarExamples : [],
        usageNote: String(r.usageNote ?? ''),
      }
    }
    case 'variant-story': {
      const text = String(b.text ?? '').slice(0, 300)
      const language = b.languageCode === 'pt' ? 'Portuguese' : "the learner's interface language"
      const { provider, key } = await pickProvider(userId, ['gemini', 'openai'])
      const story = await llmText(provider, key, {
        prompt: `Create a short parallel story for a language learner based on the English term "${text}".
The story must be independent from any book context, use a fresh everyday or professional situation, and demonstrate the term naturally at least three times in different sentences. Write the story in ${language}, but keep the target term and its example sentences in English. Add a one-sentence title. Keep it between 80 and 130 words. Return plain text only.`,
      })
      return { story: story.trim() }
    }
    case 'search-context': {
      // Referências visuais via busca do Google: só existe no Gemini. Sem Gemini, devolve vazio.
      let picked
      try { picked = await pickProvider(userId, ['gemini']) } catch { return { text: '' } }
      try {
        const text = await llmText(picked.provider, picked.key, {
          search: true,
          prompt: `For a comic book adaptation, suggest brief visual references (movies, animated series, book covers, existing character designs or art style) that could inspire the look of this story. Be very concise (max 4–5 short bullet points).
Book title: ${String(b.bookTitle ?? '').slice(0, 200)}
Story context: ${String(b.bookContext ?? '').slice(0, 800)}
This page: ${String(b.pageText ?? '').slice(0, 600)}
Reply with only the bullet points, no intro.`,
        })
        return { text: text.trim() }
      } catch { return { text: '' } }
    }
    case 'style-extract': {
      const image = imageFromDataUrl(b.imageDataUrl)
      const pageText = String(b.pageText ?? '').slice(0, 1500)
      const { provider, key } = await pickProvider(userId, ['gemini', 'openai'])
      const r = await llmJson<{ styleDoc?: Record<string, string>; characters?: { name?: string; visualDescription?: string; firstPage?: number }[] }>(provider, key, {
        images: [image],
        prompt: `Analyze this comic page. ${pageText ? `Page text (for character names):\n${pageText}` : 'Describe the visible style and any characters.'}

Respond with JSON only, no markdown. Use this exact structure:
{"styleDoc": {"colors": "short description of color palette and mood", "lineStyle": "line weight, clean vs sketchy, etc.", "aesthetics": "overall look: manga, western comic, etc.", "fonts": "lettering style if visible"}, "characters": [{"name": "Character name", "visualDescription": "face, hair, clothing, distinctive traits", "firstPage": 0}]}
Include every character visible in the page.`,
      })
      return {
        styleDoc: r.styleDoc ?? {},
        characters: (r.characters ?? []).map((c) => ({ name: String(c.name ?? ''), visualDescription: String(c.visualDescription ?? ''), firstPage: typeof c.firstPage === 'number' ? c.firstPage : undefined })),
      }
    }
    case 'detect-characters': {
      const pageText = String(b.pageText ?? '').slice(0, 3000)
      const existing = Array.isArray(b.existingNames) ? (b.existingNames as unknown[]).map(String).slice(0, 50) : []
      const { provider, key } = await pickProvider(userId, ['gemini', 'openai'])
      const r = await llmJson<{ characters?: { name?: string; visualDescription?: string }[] }>(provider, key, {
        prompt: `This is a page from a story:
"""
${pageText}
"""
${existing.length ? `Already documented characters (do NOT include these again): ${existing.join(', ')}\n\nList ONLY characters that appear or are mentioned on this page and are NOT in the list above.` : 'List the characters that appear or are mentioned on this page.'} For each character, provide a short visual description (face, hair, clothing, distinctive traits) suitable for an artist to draw them consistently. If there are none, return an empty array. Respond with JSON only:
{"characters": [{"name": "Name", "visualDescription": "description"}]}`,
      })
      return { characters: (r.characters ?? []).map((c) => ({ name: String(c.name ?? ''), visualDescription: String(c.visualDescription ?? '') })) }
    }
    case 'transcribe-page': {
      const image = imageFromDataUrl(b.imageDataUrl)
      const languageCode = String(b.languageCode ?? 'en').slice(0, 5)
      const { provider, key } = await pickProvider(userId, ['gemini', 'openai'])
      const text = await llmText(provider, key, {
        images: [image],
        prompt: `Você está analisando uma fotografia de uma página de livro.
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
10. Retorne somente o conteúdo transcrito.`,
      })
      if (!text.trim()) throw new AiError('no_legible_text', 422, 'no_legible_text')
      return { text: text.trim() }
    }
    default:
      throw new AiError('unknown_action', 400, 'unknown_action')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const user = await getUser(req)
  if (!user) return json({ error: 'unauthorized' }, 401)
  const body = await req.json().catch(() => null) as Body | null
  if (!body) return json({ error: 'invalid_json' }, 400)
  try {
    return json(await handle(user.id, body))
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError(String((e as Error)?.message ?? e))
    log('ai-text', 'error', { action: body.action, code: err.code, msg: err.message.slice(0, 200) })
    return json({ error: err.code, detail: err.message }, err.status)
  }
})
