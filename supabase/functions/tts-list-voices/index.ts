import { adminClient, corsHeaders, getUser, json, signedUrl } from '../_shared/tts.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const user = await getUser(req)
  if (!user) return json({ error: 'unauthorized' }, 401)

  const sb = adminClient()
  // Só vozes ativas (habilitadas por admin) e vistas recentemente pelo sync = realmente disponíveis.
  const { data, error } = await sb
    .from('tts_voices')
    .select('id, name, language, accent, description, model_id, is_default, preview_audio_path, last_seen_at')
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('name')
  if (error) return json({ error: 'db_error' }, 500)

  const { data: pref } = await sb
    .from('user_voice_preferences')
    .select('preferred_voice_id, playback_speed, auto_play')
    .eq('user_id', user.id)
    .maybeSingle()

  const voices = await Promise.all((data ?? []).map(async (v) => ({
    ...v,
    preview_url: v.preview_audio_path ? await signedUrl(sb, v.preview_audio_path) : null,
  })))
  return json({ voices, preferences: pref ?? null })
})
