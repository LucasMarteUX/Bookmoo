// Webhook do gateway (Zouti). Sem JWT: a autenticidade vem do token na URL (?token=) ou da assinatura HMAC.
// Dois webhooks na Zouti apontam para cá: ...?ciclo=mensal e ...?ciclo=anual (dica de ciclo; o valor decide o plano).
// Idempotente: o mesmo evento (e a mesma cobrança) nunca é aplicado duas vezes. Falha técnica → 500 para a Zouti
// tentar de novo; pagamento que não fecha com nenhum plano → 200 + revisão manual (nada é liberado).
import { adminClient, corsHeaders, json, log } from '../_shared/tts.ts'
import { applyEvent, NeedsReview, normalize, verifySignature } from '../_shared/payments.ts'
import { emails } from '../_shared/email.ts'
import { clientIp, rateLimit } from '../_shared/rate.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const limited = await rateLimit(req, clientIp(req), 'webhook', 240)
  if (limited) return limited
  const raw = await req.text()
  if (raw.length > 1_000_000) return json({ error: 'too_large' }, 413)
  if (!(await verifySignature(raw, req))) {
    log('billing-webhook', 'bad_signature', {})
    return json({ error: 'invalid_signature' }, 401)
  }
  let payload: Record<string, unknown>
  try { payload = JSON.parse(raw) } catch { return json({ error: 'invalid_json' }, 400) }

  const url = new URL(req.url)
  const ev = normalize(payload, req.headers.get('x-zouti-event-id'), url.searchParams.get('ciclo') ?? url.searchParams.get('cycle'))
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
      const result = await applyEvent(ev, { eventRowId })
      await db.from('payment_events').update({ processed_at: new Date().toISOString(), error: null }).eq('id', eventRowId)
      log('billing-webhook', 'applied', { kind: ev.kind, result })
      return json({ ok: true, result })
    } catch (e) {
      if (e instanceof NeedsReview) {
        await db.from('payment_events').update({ processed_at: new Date().toISOString(), error: `review:${e.reason}` }).eq('id', eventRowId)
        log('billing-webhook', 'needs_review', { reason: e.reason, kind: ev.kind, amount: ev.amountCents, cycle: ev.cycle })
        await emails.adminAlert('Pagamento para revisar', `<p>Um pagamento da Zouti não foi liberado automaticamente (${e.reason}).</p><p>E-mail: ${ev.email ?? 'sem e-mail'} · valor: ${ev.amountCents ?? '?'} centavos · ciclo: ${ev.cycle ?? '?'} · cobrança: ${ev.chargeRef ?? '?'}</p><p>Evento ${eventRowId} em payment_events.</p>`)
        return json({ ok: true, result: 'needs_review', reason: e.reason })
      }
      const msg = String((e as Error)?.message ?? e).slice(0, 300)
      await db.from('payment_events').update({ error: msg }).eq('id', eventRowId)
      log('billing-webhook', 'apply_failed', { kind: ev.kind, msg })
      return json({ error: 'apply_failed' }, 500)
    }
  }
})
