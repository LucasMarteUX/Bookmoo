// Webhook do gateway (Zouti). Sem JWT: a autenticidade vem da assinatura HMAC do corpo.
// Idempotente: o mesmo evento nunca é aplicado duas vezes. Falha → 500 para o gateway tentar de novo.
import { adminClient, corsHeaders, json, log } from '../_shared/tts.ts'
import { applyEvent, normalize, verifySignature } from '../_shared/payments.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const raw = await req.text()
  if (raw.length > 1_000_000) return json({ error: 'too_large' }, 413)
  if (!(await verifySignature(raw, req))) {
    log('billing-webhook', 'bad_signature', {})
    return json({ error: 'invalid_signature' }, 401)
  }
  let payload: Record<string, unknown>
  try { payload = JSON.parse(raw) } catch { return json({ error: 'invalid_json' }, 400) }

  const ev = normalize(payload, req.headers.get('x-zouti-event-id'))
  const db = adminClient()
  const { data: inserted, error: insErr } = await db.from('payment_events')
    .insert({ provider: 'zouti', provider_event_id: ev.eventId, type: ev.type, payload })
    .select('id').maybeSingle()
  if (insErr) {
    if (/duplicate/i.test(insErr.message)) {
      const { data: prev } = await db.from('payment_events').select('id, processed_at').eq('provider', 'zouti').eq('provider_event_id', ev.eventId).maybeSingle()
      if (prev?.processed_at) return json({ ok: true, duplicate: true })
      // Recebido antes mas falhou ao processar: tenta de novo abaixo.
      return await process(prev!.id)
    }
    return json({ error: 'store_failed' }, 500)
  }
  return await process(inserted!.id)

  async function process(eventRowId: string) {
    try {
      const result = await applyEvent(ev)
      await db.from('payment_events').update({ processed_at: new Date().toISOString(), error: null }).eq('id', eventRowId)
      log('billing-webhook', 'applied', { kind: ev.kind, result })
      return json({ ok: true, result })
    } catch (e) {
      const msg = String((e as Error)?.message ?? e).slice(0, 300)
      await db.from('payment_events').update({ error: msg }).eq('id', eventRowId)
      log('billing-webhook', 'apply_failed', { kind: ev.kind, msg })
      return json({ error: 'apply_failed' }, 500)
    }
  }
})
