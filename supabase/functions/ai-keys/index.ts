// Conecta, consulta e remove as chaves de IA do próprio usuário.
// A chave é validada, guardada cifrada no Vault e NUNCA devolvida ao cliente.
import { adminClient, corsHeaders, getUser, json, log } from '../_shared/tts.ts'
import { validateKey, type Provider } from '../_shared/ai.ts'

const PROVIDERS: Provider[] = ['openai', 'gemini']

async function status(userId: string) {
  const { data } = await adminClient().from('user_ai_keys').select('provider, key_hint, verified_at').eq('user_id', userId)
  const out: Record<string, { connected: boolean; hint: string | null; verifiedAt: string | null }> = {}
  for (const p of PROVIDERS) {
    const row = (data ?? []).find((r) => r.provider === p)
    out[p] = { connected: !!row, hint: row?.key_hint ?? null, verifiedAt: row?.verified_at ?? null }
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const user = await getUser(req)
  if (!user) return json({ error: 'unauthorized' }, 401)

  if (req.method === 'GET') return json({ providers: await status(user.id) })

  const body = await req.json().catch(() => ({})) as { action?: string; provider?: Provider; apiKey?: string }
  const provider = body.provider
  if (!provider || !PROVIDERS.includes(provider)) return json({ error: 'invalid_provider' }, 400)

  if (body.action === 'delete') {
    const { error } = await adminClient().rpc('ai_key_delete', { p_user: user.id, p_provider: provider })
    if (error) return json({ error: 'delete_failed' }, 500)
    log('ai-keys', 'deleted', { user: user.id, provider })
    return json({ providers: await status(user.id) })
  }

  const apiKey = String(body.apiKey ?? '').trim()
  if (apiKey.length < 20 || apiKey.length > 300 || /\s/.test(apiKey)) return json({ error: 'invalid_key_format' }, 400)
  let ok = false
  try { ok = await validateKey(provider, apiKey) } catch { return json({ error: 'validation_unreachable' }, 502) }
  if (!ok) return json({ error: 'invalid_key' }, 400)

  const { error } = await adminClient().rpc('ai_key_upsert', {
    p_user: user.id, p_provider: provider, p_key: apiKey, p_hint: '…' + apiKey.slice(-4),
  })
  if (error) { log('ai-keys', 'save_failed', { error: error.message }); return json({ error: 'save_failed' }, 500) }
  log('ai-keys', 'saved', { user: user.id, provider })
  return json({ providers: await status(user.id) })
})
