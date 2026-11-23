// Webhook da AbacatePay. Sem JWT: a origem vem do secret (?webhookSecret= / X-Webhook-Secret) e a integridade do
// HMAC (X-Webhook-Signature). Idempotente pelo id da entrega e pelo id da cobrança. Falha técnica → 500 (nova tentativa).
import { adminClient, corsHeaders, json, log } from '../_shared/tts.ts'
import { applyEvent, NeedsReview } from '../_shared/payments.ts'
import { normalizeAbacate, setupProducts, verifyAbacate } from '../_shared/abacate.ts'
import { clientIp, rateLimit } from '../_shared/rate.ts'
import { emails } from '../_shared/email.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  // GET ?setup=<webhookSecret>: cria/confere os produtos (um por plano e ciclo) e confirma as permissões da chave.
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const secret = Deno.env.get('ABACATEPAY_WEBHOOK_SECRET') ?? ''
    if (!secret || url.searchParams.get('setup') !== secret) return json({ error: 'unauthorized' }, 401)
    try { return json({ ok: true, products: await setupProducts() }) }
    catch (e) { return json({ ok: false, error: String((e as Error).message).slice(0, 200) }, 502) }
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const limited = await rateLimit(req, clientIp(req), 'webhook', 240)
  if (limited) return limited
  const raw = await req.text()
  if (raw.length > 1_000_000) return json({ error: 'too_large' }, 413)
  if (!(await verifyAbacate(raw, req))) {
    log('abacate-webhook', 'bad_signature', {})
    return json({ error: 'unauthorized' }, 401)
  }
  let payload: Record<string, unknown>
  try { payload = JSON.parse(raw) } catch { return json({ error: 'invalid_json' }, 400) }

  const ev = await normalizeAbacate(payload)
  const db = adminClient()
  const { data: inserted, error: insErr } = await db.from('payment_events')
    .insert({ provider: 'abacatepay', provider_event_id: ev.eventId, type: ev.type, payload })
    .select('id').maybeSingle()
  let rowId = inserted?.id as string | undefined
  if (insErr) {
    if (!/duplicate/i.test(insErr.message)) return json({ error: 'store_failed' }, 500)
    const { data: prev } = await db.from('payment_events').select('id, processed_at').eq('provider', 'abacatepay').eq('provider_event_id', ev.eventId).maybeSingle()
    if (prev?.processed_at) return json({ ok: true, duplicate: true })
    rowId = prev!.id
  }
  if (payload.devMode === true) log('abacate-webhook', 'dev_mode_event', { event: ev.type })
  try {
    const result = await applyEvent(ev, { eventRowId: rowId })
    await db.from('payment_events').update({ processed_at: new Date().toISOString(), error: null }).eq('id', rowId!)
    log('abacate-webhook', 'applied', { kind: ev.kind, result })
    return json({ ok: true, result })
  } catch (e) {
    if (e instanceof NeedsReview) {
      await db.from('payment_events').update({ processed_at: new Date().toISOString(), error: `review:${e.reason}` }).eq('id', rowId!)
      await emails.adminAlert('Pagamento para revisar (AbacatePay)', `<p>Não liberado automaticamente (${e.reason}). E-mail: ${ev.email ?? '?'} · valor: ${ev.amountCents ?? '?'} · assinatura: ${ev.subscriptionRef ?? '?'}</p>`)
      return json({ ok: true, result: 'needs_review', reason: e.reason })
    }
    const msg = String((e as Error)?.message ?? e).slice(0, 300)
    await db.from('payment_events').update({ error: msg }).eq('id', rowId!)
    log('abacate-webhook', 'apply_failed', { kind: ev.kind, msg })
    return json({ error: 'apply_failed' }, 500)
  }
})
