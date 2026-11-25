// Rodar: deno test -A supabase/functions/_shared/aiRetry.test.ts
import { assertEquals, assertRejects } from 'jsr:@std/assert@1'
import { AiError, generateImageWithRetry } from './ai.ts'

type Reply = { status: number; body: unknown; headers?: Record<string, string> }
const ok = (b64 = btoa('img')): Reply => ({ status: 200, body: { data: [{ b64_json: b64 }] } })
const geminiOk: Reply = { status: 200, body: { candidates: [{ content: { parts: [{ inlineData: { data: btoa('gem'), mimeType: 'image/png' } }] } }] } }
const rateLimited: Reply = { status: 429, body: { error: { message: 'Rate limit reached for images per minute', code: 'rate_limit_exceeded' } }, headers: { 'retry-after-ms': '5' } }
const noQuota: Reply = { status: 429, body: { error: { message: 'You exceeded your current quota', code: 'insufficient_quota' } } }

async function withFetch<T>(replies: Reply[], fn: (calls: string[]) => Promise<T>) {
  const before = globalThis.fetch
  const calls: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push(url.includes('openai') ? 'openai' : 'gemini')
    if (url.includes('openai')) {
      const sent = init?.body instanceof FormData ? init.body.get('output_format') : JSON.parse(String(init?.body)).output_format
      assertEquals(sent, 'webp')
    }
    const r = replies.shift()!
    return new Response(JSON.stringify(r.body), { status: r.status, headers: r.headers })
  }) as typeof fetch
  try { return await fn(calls) } finally { globalThis.fetch = before }
}

const openai = { provider: 'openai' as const, key: 'k' }
const gemini = { provider: 'gemini' as const, key: 'g' }

Deno.test('429 por minuto: tenta de novo com espera e entrega em WebP', async () => {
  await withFetch([rateLimited, rateLimited, ok()], async (calls) => {
    const img = await generateImageWithRetry([openai], 'p', [], undefined, { baseMs: 1 })
    assertEquals(img.mime, 'image/webp')
    assertEquals(img.provider, 'openai')
    assertEquals(calls, ['openai', 'openai', 'openai'])
  })
})

Deno.test('429 persistente cai para o Gemini quando configurado', async () => {
  await withFetch([rateLimited, rateLimited, rateLimited, geminiOk], async (calls) => {
    const img = await generateImageWithRetry([openai, gemini], 'p', [], undefined, { baseMs: 1 })
    assertEquals(img.provider, 'gemini')
    assertEquals(calls, ['openai', 'openai', 'openai', 'gemini'])
  })
})

Deno.test('cota esgotada não repete na OpenAI: vai direto ao reserva; sem reserva, falha sem ser passageira', async () => {
  await withFetch([noQuota, geminiOk], async (calls) => {
    assertEquals((await generateImageWithRetry([openai, gemini], 'p', [], undefined, { baseMs: 1 })).provider, 'gemini')
    assertEquals(calls, ['openai', 'gemini'])
  })
  await withFetch([noQuota], async () => {
    const err = await assertRejects(() => generateImageWithRetry([openai], 'p', [], undefined, { baseMs: 1 }), AiError)
    assertEquals(err.transient, false)
  })
})

Deno.test('sem tempo para outra tentativa antes do prazo: devolve o erro passageiro (a fila põe de volta)', async () => {
  await withFetch([rateLimited], async (calls) => {
    const err = await assertRejects(() => generateImageWithRetry([openai], 'p', [], undefined, { baseMs: 1, deadline: Date.now() + 60_000 }), AiError)
    assertEquals(err.transient, true)
    assertEquals(calls, [])
  })
  // Cabe uma tentativa, mas não a espera pedida pelo provedor (2 s) mais outra tentativa.
  await withFetch([{ ...rateLimited, headers: { 'retry-after': '2' } }], async (calls) => {
    const err = await assertRejects(() => generateImageWithRetry([openai], 'p', [], undefined, { baseMs: 1, deadline: Date.now() + 100_500 }), AiError)
    assertEquals(err.transient, true)
    assertEquals(calls, ['openai'])
  })
})

Deno.test('conteúdo bloqueado não repete', async () => {
  await withFetch([{ status: 400, body: { error: { message: 'Your request was rejected by the safety system' } } }], async (calls) => {
    const err = await assertRejects(() => generateImageWithRetry([openai, gemini], 'p', [], undefined, { baseMs: 1 }), AiError)
    assertEquals(err.code, 'blocked')
    assertEquals(calls, ['openai'])
  })
})
