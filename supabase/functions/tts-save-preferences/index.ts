import { adminClient, corsHeaders, getUser, json } from '../_shared/tts.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const user = await getUser(req)
  if (!user) return json({ error: 'unauthorized' }, 401)

  const b = await req.json().catch(() => null) as
    { preferred_voice_id?: string | null; playback_speed?: number; auto_play?: boolean } | null
  if (!b) return json({ error: 'invalid_json' }, 400)

  const sb = adminClient()
  const row: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() }

  if (b.preferred_voice_id !== undefined) {
    if (b.preferred_voice_id !== null) {
      const { data: v } = await sb.from('tts_voices').select('id').eq('id', b.preferred_voice_id).eq('is_active', true).maybeSingle()
      if (!v) return json({ error: 'voice_unavailable' }, 422)
    }
    row.preferred_voice_id = b.preferred_voice_id
  }
  if (b.playback_speed !== undefined) {
    const s = Number(b.playback_speed)
    if (!Number.isFinite(s) || s < 0.5 || s > 1.5) return json({ error: 'invalid_speed' }, 400)
    row.playback_speed = Math.round(s * 100) / 100
  }
  if (b.auto_play !== undefined) row.auto_play = !!b.auto_play

  const { data, error } = await sb.from('user_voice_preferences').upsert(row, { onConflict: 'user_id' })
    .select('preferred_voice_id, playback_speed, auto_play').single()
  if (error) return json({ error: 'db_error' }, 500)
  return json({ preferences: data })
})
