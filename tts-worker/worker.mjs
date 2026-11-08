#!/usr/bin/env node
// Bookmoo TTS worker — roda no mesmo host/rede privada do VoiceStudio.
// Busca jobs no Supabase (tts_claim_jobs, SKIP LOCKED + lease), chama POST /v1/audio/speech,
// grava o MP3 no Storage (bucket privado tts-audio) e registra em tts_audio_cache.
//
// Env obrigatórias: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VOICESTUDIO_URL
// Opcionais: VOICESTUDIO_API_KEY, TTS_WORKER_CONCURRENCY (2), TTS_WORKER_TIMEOUT_MS (90000),
//            TTS_WORKER_POLL_MS (1000), TTS_WORKER_ID
import { createClient } from '@supabase/supabase-js'
import os from 'node:os'

const env = (k, d) => process.env[k] ?? d
const SUPABASE_URL = env('SUPABASE_URL')
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')
const VS_URL = env('VOICESTUDIO_URL', 'http://127.0.0.1:3900')
const VS_KEY = env('VOICESTUDIO_API_KEY')
const CONCURRENCY = Number(env('TTS_WORKER_CONCURRENCY', '2'))
const TIMEOUT_MS = Number(env('TTS_WORKER_TIMEOUT_MS', '90000'))
const POLL_MS = Number(env('TTS_WORKER_POLL_MS', '1000'))
const WORKER_ID = env('TTS_WORKER_ID', `${os.hostname()}-${process.pid}`)
const LEASE_S = Math.ceil(TIMEOUT_MS / 1000) + 30
const BUCKET = 'tts-audio'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias')
  process.exit(1)
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const log = (event, extra = {}) =>
  console.log(JSON.stringify({ svc: 'tts-worker', worker: WORKER_ID, event, ts: new Date().toISOString(), ...extra }))

let inFlight = 0
let stopping = false

async function synthesize(job, providerVoiceId) {
  const r = await fetch(new URL('/v1/audio/speech', VS_URL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(VS_KEY ? { Authorization: `Bearer ${VS_KEY}` } : {}) },
    body: JSON.stringify({
      model: job.model_id,
      voice: providerVoiceId,
      input: job.normalized_text,
      response_format: job.format,
      speed: job.generation_settings?.speed ?? 1.0,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    const err = new Error(`VoiceStudio HTTP ${r.status}: ${t.slice(0, 300)}`)
    err.permanent = r.status >= 400 && r.status < 500 && r.status !== 429 && r.status !== 408
    throw err
  }
  const buf = Buffer.from(await r.arrayBuffer())
  if (buf.length < 100) throw new Error(`audio too small (${buf.length} bytes)`)
  return buf
}

async function processJob(job) {
  const t0 = Date.now()
  try {
    // Pode ter sido cancelado entre o claim e agora, ou já existir no cache.
    const { data: cached } = await sb.from('tts_audio_cache').select('id').eq('content_hash', job.content_hash).maybeSingle()
    if (!cached) {
      const { data: voice, error: vErr } = await sb.from('tts_voices').select('provider_voice_id, is_active').eq('id', job.voice_id).single()
      if (vErr || !voice?.is_active) throw Object.assign(new Error('voice inactive'), { permanent: true })

      const audio = await synthesize(job, voice.provider_voice_id)
      const scope = job.scope_user_id ? `private/${job.scope_user_id}` : 'shared'
      const path = `${scope}/${job.model_id}/${job.content_hash.slice(0, 2)}/${job.content_hash}.${job.format}`
      // upsert: true torna a escrita idempotente se dois workers colidirem.
      const { error: upErr } = await sb.storage.from(BUCKET).upload(path, audio, {
        contentType: 'audio/mpeg', upsert: true, cacheControl: '31536000',
      })
      if (upErr) throw new Error(`storage upload: ${upErr.message}`)

      const { error: cErr } = await sb.from('tts_audio_cache').upsert({
        content_hash: job.content_hash, scope_user_id: job.scope_user_id, normalized_text: job.normalized_text,
        language: job.language, voice_id: job.voice_id, model_id: job.model_id, model_version: job.model_version,
        generation_settings: job.generation_settings, format: job.format, storage_path: path, size_bytes: audio.length,
      }, { onConflict: 'content_hash', ignoreDuplicates: true })
      if (cErr) throw new Error(`cache insert: ${cErr.message}`)
    }
    await sb.from('tts_generation_jobs').update({
      status: 'completed', completed_at: new Date().toISOString(), locked_by: null, locked_until: null, error_message: null,
    }).eq('id', job.id).eq('status', 'processing')
    log('job_completed', { job: job.id, ms: Date.now() - t0, attempt: job.attempts, cache_hit: !!cached })
  } catch (e) {
    const msg = String(e?.message ?? e)
    if (e?.permanent) {
      await sb.from('tts_generation_jobs').update({ status: 'failed', error_message: msg.slice(0, 1000), completed_at: new Date().toISOString() }).eq('id', job.id)
    } else {
      await sb.rpc('tts_fail_job', { p_job: job.id, p_error: msg })
    }
    log('job_failed', { job: job.id, ms: Date.now() - t0, attempt: job.attempts, permanent: !!e?.permanent, error: msg })
  }
}

async function tick() {
  const free = CONCURRENCY - inFlight
  if (free <= 0 || stopping) return 0
  const { data, error } = await sb.rpc('tts_claim_jobs', { p_worker: WORKER_ID, p_limit: free, p_lease_seconds: LEASE_S })
  if (error) { log('claim_error', { error: error.message }); return 0 }
  for (const job of data ?? []) {
    inFlight++
    processJob(job).finally(() => { inFlight-- })
  }
  return data?.length ?? 0
}

async function cleanup() {
  const { data, error } = await sb.rpc('tts_expire_cache', { p_limit: 500 })
  if (error) return log('cleanup_error', { error: error.message })
  const paths = (data ?? []).map((r) => r.storage_path)
  if (paths.length) await sb.storage.from(BUCKET).remove(paths)
  log('cleanup', { removed: paths.length })
}

async function main() {
  log('start', { vs: VS_URL, concurrency: CONCURRENCY, timeout_ms: TIMEOUT_MS })
  const h = await fetch(new URL('/health', VS_URL), { signal: AbortSignal.timeout(5000) }).catch((e) => e)
  log('voicestudio_health', { ok: h?.ok === true, status: h?.status, error: h instanceof Error ? h.message : undefined })

  setInterval(cleanup, 6 * 3600_000).unref()
  while (!stopping) {
    const n = await tick().catch((e) => { log('tick_error', { error: String(e) }); return 0 })
    if (n === 0) await new Promise((r) => setTimeout(r, POLL_MS))
  }
  while (inFlight > 0) await new Promise((r) => setTimeout(r, 200))
  log('stopped')
}

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stopping = true; log('stopping', { sig }) })
main()
