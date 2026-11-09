// Utilidades de IA para as Edge Functions: chaves por usuário (Vault), clientes HTTP mínimos
// para OpenAI e Gemini (sem SDK) e saída JSON robusta. A chave do usuário só existe aqui,
// no servidor, durante a requisição — nunca é devolvida ao navegador.
import { adminClient } from './tts.ts'

export type Provider = 'openai' | 'gemini'
export type ImagePart = { mime: string; data: string }
export type ImageReference = { mime: string; blob: Blob }


export const MODELS = {
  openaiText: 'gpt-4.1-mini',
  openaiImage: 'gpt-image-2',
  geminiText: 'gemini-2.5-flash',
  geminiImage: 'gemini-3.1-flash-image',
} as const

export class AiError extends Error {
  constructor(message: string, public status = 502, public code = 'ai_error') { super(message) }
}

/** Provedores que o usuário conectou. */
export async function connectedProviders(userId: string): Promise<Provider[]> {
  const { data } = await adminClient().from('user_ai_keys').select('provider').eq('user_id', userId)
  return (data ?? []).map((r) => r.provider as Provider)
}

export async function getKey(userId: string, provider: Provider): Promise<string | null> {
  const { data, error } = await adminClient().rpc('ai_key_get', { p_user: userId, p_provider: provider })
  if (error) throw new AiError('key_read_failed', 500, 'key_read_failed')
  return (data as string | null) ?? null
}

/** Escolhe o provedor conforme a preferência da tarefa e o que o usuário conectou. */
export async function pickProvider(userId: string, prefer: Provider[]): Promise<{ provider: Provider; key: string }> {
  const have = await connectedProviders(userId)
  for (const p of prefer) {
    if (have.includes(p)) {
      const key = await getKey(userId, p)
      if (key) return { provider: p, key }
    }
  }
  throw new AiError('no_api_key', 412, 'no_api_key')
}

// ---------------------------------------------------------------------------
// Texto / JSON
// ---------------------------------------------------------------------------
async function openaiChat(key: string, opts: { system?: string; prompt: string; images?: ImagePart[]; json?: boolean }) {
  const content: unknown[] = [{ type: 'text', text: opts.prompt }]
  for (const img of opts.images ?? []) content.push({ type: 'image_url', image_url: { url: `data:${img.mime};base64,${img.data}` } })
  const messages: unknown[] = []
  if (opts.system) messages.push({ role: 'system', content: opts.system })
  messages.push({ role: 'user', content })
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODELS.openaiText, messages, ...(opts.json ? { response_format: { type: 'json_object' } } : {}) }),
    signal: AbortSignal.timeout(90_000),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw providerError('openai', r.status, j)
  return String(j.choices?.[0]?.message?.content ?? '')
}

async function geminiGenerate(key: string, model: string, body: Record<string, unknown>) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw providerError('gemini', r.status, j)
  return j as { candidates?: { content?: { parts?: { text?: string; inlineData?: { data: string; mimeType: string } }[] } }[] }
}

async function geminiChat(key: string, opts: { system?: string; prompt: string; images?: ImagePart[]; json?: boolean; search?: boolean }) {
  const parts: unknown[] = (opts.images ?? []).map((i) => ({ inlineData: { mimeType: i.mime, data: i.data } }))
  parts.push({ text: opts.prompt })
  const j = await geminiGenerate(key, MODELS.geminiText, {
    contents: [{ role: 'user', parts }],
    ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
    ...(opts.json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
    ...(opts.search ? { tools: [{ google_search: {} }] } : {}),
  })
  return (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('')
}

export async function llmText(provider: Provider, key: string, opts: { system?: string; prompt: string; images?: ImagePart[]; search?: boolean }) {
  return provider === 'openai' ? openaiChat(key, opts) : geminiChat(key, opts)
}

export async function llmJson<T>(provider: Provider, key: string, opts: { system?: string; prompt: string; images?: ImagePart[] }): Promise<T> {
  const raw = provider === 'openai' ? await openaiChat(key, { ...opts, json: true }) : await geminiChat(key, { ...opts, json: true })
  return parseJson<T>(raw)
}

export function parseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try { return JSON.parse(cleaned) as T } catch { /* tenta extrair o primeiro bloco JSON */ }
  const m = cleaned.match(/[[{][\s\S]*[\]}]/)
  if (m) return JSON.parse(m[0]) as T
  throw new AiError('invalid_json_from_model', 502, 'invalid_json')
}

// ---------------------------------------------------------------------------
// Imagem
// ---------------------------------------------------------------------------
function b64ToBytes(b64: string) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function bytesToB64(bytes: Uint8Array) {
  let s = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(s)
}

/** Gera uma página 2:3 (retrato). OpenAI em qualidade "medium": "low" ficava simples demais para uma HQ. */
export type ImageShape = { square?: boolean; quality?: 'low' | 'medium' | 'high'; mask?: Blob }

/** Página 2:3 por padrão; `opts` aceita a máscara (edição de painel) ou formato quadrado/qualidade. */
export async function generateImage(provider: Provider, key: string, prompt: string, refs: (ImagePart | ImageReference)[], opts?: Blob | ImageShape): Promise<{ bytes: Uint8Array; mime: string }> {
  const shape: ImageShape = opts instanceof Blob ? { mask: opts } : opts ?? {}
  const mask = shape.mask
  const size = shape.square ? '1024x1024' : '1024x1536'
  const quality = shape.quality ?? 'medium'
  if (provider === 'openai') {
    let r: Response
    if (refs.length > 0) {
      const form = new FormData()
      form.append('model', MODELS.openaiImage)
      form.append('prompt', prompt)
      form.append('size', size)
      form.append('quality', quality)
      form.append('output_format', 'jpeg')
      if (mask) form.append('mask', mask, 'mask.png')
      refs.forEach((ref, i) => {
        const ext = ref.mime === 'image/jpeg' ? 'jpg' : ref.mime.split('/')[1]
        const blob = 'blob' in ref ? ref.blob : new Blob([b64ToBytes(ref.data)], { type: ref.mime })
        form.append('image[]', blob, `ref${i}.${ext}`)
      })
      r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(140_000) })
    } else {
      r = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODELS.openaiImage, prompt, size, quality, output_format: 'jpeg', n: 1 }),
        signal: AbortSignal.timeout(140_000),
      })
    }
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw providerError('openai', r.status, j)
    const b64 = j.data?.[0]?.b64_json
    if (!b64) throw new AiError('no_image_returned')
    return { bytes: b64ToBytes(b64), mime: 'image/jpeg' }
  }
  const parts: unknown[] = await Promise.all(refs.map(async (ref) => ({
    inlineData: {
      mimeType: ref.mime,
      data: 'blob' in ref ? bytesToB64(new Uint8Array(await ref.blob.arrayBuffer())) : ref.data,
    },
  })))
  parts.push({ text: prompt })
  const j = await geminiGenerate(key, MODELS.geminiImage, {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: shape.square ? '1:1' : '2:3' } },
  })
  const img = (j.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData)?.inlineData
  if (!img) throw new AiError('no_image_returned')
  return { bytes: b64ToBytes(img.data), mime: img.mimeType || 'image/png' }
}

/** Valida a chave com uma chamada barata (lista de modelos). */
export async function validateKey(provider: Provider, key: string): Promise<boolean> {
  const r = provider === 'openai'
    ? await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) })
    : await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(15_000) })
  return r.ok
}

/** Erro do provedor sem vazar detalhes sensíveis; mapeia chave inválida/quota para códigos claros. */
function providerError(provider: Provider, status: number, body: { error?: { message?: string; code?: string; status?: string } }) {
  const msg = String(body?.error?.message ?? '')
  if (status === 401 || status === 403 || /api key|invalid.*key|permission/i.test(msg)) return new AiError(`${provider}_invalid_key`, 401, 'invalid_key')
  if (status === 429 || /quota|rate limit|billing/i.test(msg)) return new AiError(`${provider}_quota`, 429, 'quota')
  if (/safety|content policy|moderation/i.test(msg)) return new AiError(`${provider}_blocked`, 422, 'blocked')
  return new AiError(`${provider}_error_${status}: ${msg.slice(0, 200)}`, 502, 'provider_error')
}
