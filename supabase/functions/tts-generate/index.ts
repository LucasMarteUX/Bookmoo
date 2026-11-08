import {
  adminClient, contentHash, corsHeaders, getUser, json, log, MAX_JOBS_PER_HOUR, MAX_TEXT_CHARS,
  normalizeText, signedUrl,
} from '../_shared/tts.ts'

type Context = 'word' | 'phrase' | 'reader' | 'lesson' | 'preview'
// Velocidade é aplicada no player (preservesPitch). A síntese é sempre 1.0 => menos variantes de cache.
const SYNTH_SPEED = 1.0
const FORMAT = 'mp3'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const user = await getUser(req)
  if (!user) return json({ error: 'unauthorized' }, 401)

  let body: { text?: string; language?: string; voice_id?: string; context?: Context }
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  const text = normalizeText(String(body.text ?? ''))
  const language = String(body.language ?? 'en').slice(0, 10).toLowerCase()
  const context: Context = (['word', 'phrase', 'reader', 'lesson', 'preview'] as const).includes(body.context as Context)
    ? body.context as Context : 'reader'
  if (!text) return json({ error: 'empty_text' }, 400)
  if (text.length > MAX_TEXT_CHARS) return json({ error: 'text_too_long', max: MAX_TEXT_CHARS }, 413)
  if (!/^[a-z]{2}(-[a-z]{2})?$/.test(language)) return json({ error: 'invalid_language' }, 400)

  const sb = adminClient()

  // Voz: a pedida, a preferida do aluno ou a default — sempre ativa.
  let voiceId = body.voice_id ?? null
  if (!voiceId) {
    const { data: pref } = await sb.from('user_voice_preferences').select('preferred_voice_id').eq('user_id', user.id).maybeSingle()
    voiceId = pref?.preferred_voice_id ?? null
  }
  let q = sb.from('tts_voices').select('id, provider, provider_voice_id, model_id, model_version').eq('is_active', true)
  q = voiceId ? q.eq('id', voiceId) : q.eq('is_default', true)
  const { data: voice } = await q.maybeSingle()
  if (!voice) return json({ error: 'voice_unavailable' }, 422)

  // Privacidade: palavras/frases curtas de vocabulário e conteúdo oficial vão para o cache compartilhado.
  // Texto do leitor (livros enviados pelo aluno) fica isolado por usuário.
  const shared = context === 'lesson' || context === 'preview' || ((context === 'word' || context === 'phrase') && text.length <= 60)
  const scopeUserId = shared ? null : user.id

  const hash = await contentHash({
    text, language, provider: voice.provider, providerVoiceId: voice.provider_voice_id,
    modelId: voice.model_id, modelVersion: voice.model_version, synthSpeed: SYNTH_SPEED, format: FORMAT, scopeUserId,
  })

  // 1) Cache
  const { data: cached } = await sb.from('tts_audio_cache').select('id, storage_path, duration_ms').eq('content_hash', hash).maybeSingle()
  if (cached) {
    const url = await signedUrl(sb, cached.storage_path)
    if (url) {
      sb.from('tts_audio_cache').update({ last_accessed_at: new Date().toISOString() }).eq('id', cached.id).then(() => {})
      log('tts-generate', 'cache_hit', { user: user.id, hash })
      return json({ status: 'completed', cached: true, audio_url: url, duration_ms: cached.duration_ms })
    }
  }

  // 2) Job ativo existente para o mesmo hash (dedupe concorrente)
  const { data: active } = await sb.from('tts_generation_jobs').select('id, status, user_id')
    .eq('content_hash', hash).in('status', ['pending', 'processing']).maybeSingle()
  if (active) return json({ status: active.status, job_id: active.id })

  // 3) Limite de uso
  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await sb.from('tts_generation_jobs').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).gte('created_at', since)
  if ((count ?? 0) >= MAX_JOBS_PER_HOUR) return json({ error: 'rate_limited' }, 429)

  // 4) Enfileirar
  const { data: job, error } = await sb.from('tts_generation_jobs').insert({
    user_id: user.id, voice_id: voice.id, content_hash: hash, scope_user_id: scopeUserId,
    normalized_text: text, language, model_id: voice.model_id, model_version: voice.model_version,
    generation_settings: { speed: SYNTH_SPEED, context }, format: FORMAT,
  }).select('id, status').single()

  if (error) {
    // Corrida: outro request inseriu o mesmo hash entre o passo 2 e o 4 (índice único parcial).
    const { data: again } = await sb.from('tts_generation_jobs').select('id, status')
      .eq('content_hash', hash).in('status', ['pending', 'processing']).maybeSingle()
    if (again) return json({ status: again.status, job_id: again.id })
    log('tts-generate', 'enqueue_error', { error: error.message })
    return json({ error: 'enqueue_failed' }, 500)
  }
  log('tts-generate', 'enqueued', { user: user.id, job: job.id, context, shared })
  return json({ status: 'pending', job_id: job.id }, 202)
})
