import { adminClient, corsHeaders, getUser, json, signedUrl } from '../_shared/tts.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const user = await getUser(req)
  if (!user) return json({ error: 'unauthorized' }, 401)

  const url = new URL(req.url)
  let jobId = url.searchParams.get('job_id')
  let cancel = false
  if (req.method === 'POST') {
    const b = await req.json().catch(() => ({}))
    jobId = b.job_id ?? jobId
    cancel = b.action === 'cancel'
  }
  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) return json({ error: 'invalid_job_id' }, 400)

  const sb = adminClient()
  const { data: job } = await sb.from('tts_generation_jobs')
    .select('id, user_id, status, content_hash, error_message, attempts').eq('id', jobId).maybeSingle()
  // Jobs deduplicados podem ter sido criados por outro aluno; liberamos o status
  // apenas se o hash for compartilhado ou do próprio aluno.
  if (!job) return json({ error: 'not_found' }, 404)

  if (cancel) {
    if (job.user_id !== user.id) return json({ error: 'forbidden' }, 403)
    await sb.from('tts_generation_jobs').update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', jobId).eq('status', 'pending')
    return json({ status: 'cancelled' })
  }

  if (job.status === 'completed') {
    const { data: c } = await sb.from('tts_audio_cache').select('storage_path, duration_ms, scope_user_id')
      .eq('content_hash', job.content_hash).maybeSingle()
    if (!c) return json({ status: 'failed', error: 'cache_missing' })
    if (c.scope_user_id && c.scope_user_id !== user.id) return json({ error: 'forbidden' }, 403)
    return json({ status: 'completed', audio_url: await signedUrl(sb, c.storage_path), duration_ms: c.duration_ms })
  }
  if (job.user_id !== user.id) {
    // Não vazar mensagens de erro de jobs de terceiros.
    return json({ status: job.status })
  }
  return json({ status: job.status, attempts: job.attempts, error: job.status === 'failed' ? job.error_message : undefined })
})
