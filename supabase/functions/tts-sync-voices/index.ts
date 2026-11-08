// Função administrativa. Consulta o VoiceStudio (via VOICESTUDIO_URL + VOICESTUDIO_API_KEY,
// secrets do Supabase — nunca no frontend) e faz upsert no catálogo.
// Vozes novas entram com is_active=false: um admin precisa ativá-las explicitamente
// (body: { activate: [uuid], deactivate: [uuid], default_voice_id: uuid }).
import { adminClient, corsHeaders, getUser, isAdmin, json, log } from '../_shared/tts.ts'

type VsVoice = Record<string, unknown>

async function vs(path: string) {
  const base = Deno.env.get('VOICESTUDIO_URL')
  if (!base) throw new Error('VOICESTUDIO_URL not configured')
  const key = Deno.env.get('VOICESTUDIO_API_KEY')
  const r = await fetch(new URL(path, base), {
    headers: key ? { Authorization: `Bearer ${key}` } : {},
    signal: AbortSignal.timeout(15_000),
  })
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`)
  return r.json()
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const user = await getUser(req)
  if (!user || !isAdmin(user)) return json({ error: 'forbidden' }, 403)

  const body = await req.json().catch(() => ({})) as {
    model_id?: string; model_version?: string; activate?: string[]; deactivate?: string[]; default_voice_id?: string
  }
  const sb = adminClient()
  const now = new Date().toISOString()

  let upserted = 0
  let models: unknown = null
  try {
    models = await vs('/v1/models')
    const raw = await vs('/v1/audio/voices')
    // Aceita { voices: [...] } ou { data: [...] } ou array.
    const list: VsVoice[] = Array.isArray(raw) ? raw : (raw.voices ?? raw.data ?? [])
    const modelId = body.model_id ?? Deno.env.get('VOICESTUDIO_MODEL') ?? 'kokoro'
    const modelVersion = body.model_version ?? Deno.env.get('VOICESTUDIO_MODEL_VERSION') ?? 'unknown'
    const rows = list
      .map((v) => {
        const id = str(v.id) ?? str(v.voice_id) ?? str(v.name)
        if (!id) return null
        const vModel = str(v.engine) ?? str(v.model) ?? modelId
        if (vModel !== modelId) return null // só a engine escolhida (licença revisada)
        return {
          provider: 'voicestudio', provider_voice_id: id, model_id: modelId, model_version: modelVersion,
          name: str(v.name) ?? id,
          language: str(v.language) ?? str(v.lang),   // só se o backend informar
          accent: str(v.accent),
          description: str(v.description),
          metadata: v, last_seen_at: now, updated_at: now,
        }
      })
      .filter(Boolean)
    if (rows.length) {
      const { error } = await sb.from('tts_voices').upsert(rows, { onConflict: 'provider,model_id,provider_voice_id', ignoreDuplicates: false })
      if (error) throw new Error(error.message)
      upserted = rows.length
    }
  } catch (e) {
    log('tts-sync-voices', 'sync_error', { error: String(e) })
    if (!body.activate && !body.deactivate && !body.default_voice_id) return json({ error: 'voicestudio_unreachable', detail: String(e) }, 502)
  }

  if (body.deactivate?.length) await sb.from('tts_voices').update({ is_active: false, is_default: false }).in('id', body.deactivate)
  if (body.activate?.length) await sb.from('tts_voices').update({ is_active: true }).in('id', body.activate)
  if (body.default_voice_id) {
    await sb.from('tts_voices').update({ is_default: false }).eq('is_default', true)
    await sb.from('tts_voices').update({ is_default: true, is_active: true }).eq('id', body.default_voice_id)
  }
  const { data: catalog } = await sb.from('tts_voices').select('id, name, model_id, provider_voice_id, is_active, is_default, commercial_use_verified, last_seen_at')
  log('tts-sync-voices', 'done', { admin: user.id, upserted })
  return json({ upserted, models, catalog })
})
