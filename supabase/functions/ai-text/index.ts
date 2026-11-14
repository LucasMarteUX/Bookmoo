// Tarefas de texto/visão que antes rodavam no navegador com uma chave exposta.
// Usa a chave da plataforma e cobra créditos do plano (billing.ts).
import { corsHeaders, getUser, json, log } from '../_shared/tts.ts'
import { AiError, llmJson, llmText, pickProvider, type ImagePart } from '../_shared/ai.ts'
import { explainTerm, glossTerm, sharedExamples, sharedExplain, sharedImages, sharedStory, storyForTerm } from '../_shared/vocab.ts'
import { entitlements, measured, metered, requireFeature } from '../_shared/billing.ts'

const MAX_IMAGE_B64 = 5_500_000

function imageFromDataUrl(dataUrl: unknown): ImagePart {
  const m = String(dataUrl ?? '').match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i)
  if (!m) throw new AiError('invalid_image', 400, 'invalid_image')
  if (m[2].length > MAX_IMAGE_B64) throw new AiError('image_too_large', 413, 'image_too_large')
  return { mime: m[1], data: m[2] }
}

type Body = Record<string, unknown> & { action?: string }

async function handle(userId: string, b: Body) {
  const ent = await entitlements(userId)
  const plan = ent.plan
  switch (b.action) {
    case 'explain': {
      const text = String(b.text ?? '').slice(0, 300)
      const level = ['A2', 'B1', 'B2'].includes(String(b.level)) ? String(b.level) : 'B1'
      return await metered(userId, 'explain', async () => {
        const { provider, key } = await pickProvider(userId, ['openai', 'gemini'])
        return await explainTerm(provider, key, text, level, String(b.languageCode ?? 'en'), [], b.nativeLanguageCode ? String(b.nativeLanguageCode).slice(0, 5).toLowerCase() : undefined)
      }, { plan })
    }
    case 'gloss': {
      const text = String(b.text ?? '').slice(0, 120)
      return await measured(userId, 'gloss', async () => {
        const { provider, key } = await pickProvider(userId, ['openai', 'gemini'])
        return { gloss: await glossTerm(provider, key, text, String(b.languageCode ?? 'pt')) }
      }, plan)
    }
    case 'variant-story': {
      const text = String(b.text ?? '').slice(0, 300)
      return await metered(userId, 'variant-story', async () => {
        const { provider, key } = await pickProvider(userId, ['openai', 'gemini'])
        return { story: await storyForTerm(provider, key, text, String(b.languageCode ?? '')) }
      }, { plan })
    }
    // Banco compartilhado de vocabulário: gera um item novo, salva para todos e devolve a linha.
    case 'vocab-explain': return await sharedExplain(userId, b, ent)
    case 'vocab-story': return await sharedStory(userId, b, ent)
    case 'vocab-examples': return await sharedExamples(userId, b)
    case 'vocab-images': return await sharedImages(userId, b, ent)
    case 'search-context': {
      // Referências visuais via busca do Google: só existe no Gemini. Sem Gemini, devolve vazio.
      let picked
      try { picked = await pickProvider(userId, ['gemini']) } catch { return { text: '' } }
      if (picked.provider !== 'gemini') return { text: '' }
      try {
        const text = await measured(userId, 'search-context', () => llmText(picked.provider, picked.key, {
          search: true,
          prompt: `For a comic book adaptation, suggest brief visual references (movies, animated series, book covers, existing character designs or art style) that could inspire the look of this story. Be very concise (max 4–5 short bullet points).
Book title: ${String(b.bookTitle ?? '').slice(0, 200)}
Story context: ${String(b.bookContext ?? '').slice(0, 800)}
This page: ${String(b.pageText ?? '').slice(0, 600)}
Reply with only the bullet points, no intro.`,
        }), plan)
        return { text: text.trim() }
      } catch { return { text: '' } }
    }
    case 'style-extract': {
      requireFeature(ent, ent.limits.custom_style, 'custom_style')
      const image = imageFromDataUrl(b.imageDataUrl)
      const pageText = String(b.pageText ?? '').slice(0, 1500)
      return await metered(userId, 'style-extract', async () => {
      const { provider, key } = await pickProvider(userId, ['openai', 'gemini'])
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
      }, { plan })
    }
    case 'detect-characters': {
      const pageText = String(b.pageText ?? '').slice(0, 3000)
      const existing = Array.isArray(b.existingNames) ? (b.existingNames as unknown[]).map(String).slice(0, 50) : []
      return await metered(userId, 'detect-characters', async () => {
      const { provider, key } = await pickProvider(userId, ['openai', 'gemini'])
      const r = await llmJson<{ characters?: { name?: string; visualDescription?: string }[] }>(provider, key, {
        prompt: `This is a page from a story:
"""
${pageText}
"""
${existing.length ? `Already documented characters (do NOT include these again): ${existing.join(', ')}\n\nList ONLY characters that appear or are mentioned on this page and are NOT in the list above.` : 'List the characters that appear or are mentioned on this page.'} For each character, provide a short visual description (face, hair, clothing, distinctive traits) suitable for an artist to draw them consistently. If there are none, return an empty array. Respond with JSON only:
{"characters": [{"name": "Name", "visualDescription": "description"}]}`,
      })
      return { characters: (r.characters ?? []).map((c) => ({ name: String(c.name ?? ''), visualDescription: String(c.visualDescription ?? '') })) }
      }, { plan })
    }
    case 'transcribe-page': {
      requireFeature(ent, ent.limits.imports !== 0, 'imports')
      const image = imageFromDataUrl(b.imageDataUrl)
      const languageCode = String(b.languageCode ?? 'en').slice(0, 5)
      return await metered(userId, 'transcribe-page', async () => {
      const { provider, key } = await pickProvider(userId, ['openai', 'gemini'])
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
      }, { plan })
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
