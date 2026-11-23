// Rodar: deno test --allow-env supabase/functions/_shared/abacate.test.ts
import { assertEquals } from 'jsr:@std/assert@1'
import { normalizeAbacate, verifyAbacate } from './abacate.ts'

const PRODUCTS: Record<string, { plan: string; cycle: 'monthly' | 'annual' }> = {
  prod_plus_m: { plan: 'plus', cycle: 'monthly' }, prod_pro_a: { plan: 'pro', cycle: 'annual' },
}
const lookup = async (id: string) => PRODUCTS[id] ?? null
const env = (event: string, sub: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  id: `log_${event}`, event, apiVersion: 2, devMode: true,
  data: {
    subscription: { id: 'subs_1', amount: 4490, method: 'CARD', status: 'ACTIVE', frequency: 'MONTHLY', cancelPolicy: null, cancelledDueTo: null, ...sub },
    customer: { id: 'cust_1', email: 'Ana@Ex.com' },
    checkout: { id: 'bill_1', externalId: '0b6c6a43-6a39-4c1f-9a51-2a3f0b7e8c11', frequency: 'SUBSCRIPTION', items: [{ id: 'prod_plus_m', quantity: 1 }], platformFee: 217 },
    payment: { id: 'char_1', amount: 4490, paidAmount: 4490, status: 'APPROVED' },
    ...extra,
  },
})

Deno.test('subscription.completed: plano pelo produto, intenção e assinatura', async () => {
  const ev = await normalizeAbacate(env('subscription.completed', {}), lookup)
  assertEquals([ev.kind, ev.planId, ev.cycle, ev.subscriptionRef, ev.chargeRef, ev.intentId, ev.email, ev.provider, ev.renewal],
    ['paid', 'plus', 'monthly', 'subs_1', 'char_1', '0b6c6a43-6a39-4c1f-9a51-2a3f0b7e8c11', 'ana@ex.com', 'abacatepay', false])
})

Deno.test('subscription.renewed é renovação', async () => {
  const ev = await normalizeAbacate(env('subscription.renewed', {}), lookup)
  assertEquals([ev.kind, ev.renewal], ['paid', true])
})

Deno.test('produto desconhecido na contratação vai para revisão', async () => {
  const p = env('subscription.completed', {}); (p.data.checkout as { items: unknown[] }).items = [{ id: 'prod_x', quantity: 1 }]
  assertEquals((await normalizeAbacate(p, lookup)).review, 'product_not_mapped')
})

Deno.test('falha, cancelamento pelo cliente, por nós, por tentativas e reembolso', async () => {
  assertEquals((await normalizeAbacate(env('subscription.payment_failed', {}), lookup)).kind, 'failed')
  const portal = await normalizeAbacate(env('subscription.cancelled', { status: 'CANCELLED', cancelPolicy: 'NEXT_CYCLE', cancelledDueTo: 'Cancelada pelo cliente no portal: caro' }), lookup)
  assertEquals([portal.kind, portal.cancelAtPeriodEnd], ['canceled', true])
  assertEquals((await normalizeAbacate(env('subscription.cancelled', { status: 'CANCELLED', cancelPolicy: 'NOW' }), lookup)).cancelAtPeriodEnd, false)
  assertEquals((await normalizeAbacate(env('subscription.cancelled', { cancelledDueTo: 'max_payment_retries_exceeded' }), lookup)).kind, 'failed')
  assertEquals((await normalizeAbacate(env('subscription.cancelled', { cancelledDueTo: 'Cancelada pelo cliente no portal (reembolso solicitado)' }), lookup)).kind, 'refunded')
})

Deno.test('checkout.completed de assinatura é ignorado (já tratado pelo subscription.*)', async () => {
  assertEquals((await normalizeAbacate(env('checkout.completed', {}), lookup)).kind, 'ignored')
})

Deno.test('troca de plano aplicada: produto novo define o plano', async () => {
  const ev = await normalizeAbacate(env('subscription.renewed', { frequency: 'ANNUALLY' }, { checkout: { id: 'bill_1', items: [{ id: 'prod_pro_a' }] } }), lookup)
  assertEquals([ev.planId, ev.cycle], ['pro', 'annual'])
})

Deno.test('webhook: exige o secret e o HMAC do corpo', async () => {
  Deno.env.set('ABACATEPAY_WEBHOOK_SECRET', 'x'.repeat(40))
  const raw = JSON.stringify({ id: 'log_1', event: 'subscription.completed' })
  const KEY = 't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9'
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(raw)))))
  const mk = (secret: string, s: string) => new Request(`https://x/fn?webhookSecret=${secret}`, { method: 'POST', headers: { 'x-webhook-signature': s } })
  assertEquals(await verifyAbacate(raw, mk('x'.repeat(40), sig)), true)
  assertEquals(await verifyAbacate(raw, mk('errado', sig)), false)
  assertEquals(await verifyAbacate(raw + ' ', mk('x'.repeat(40), sig)), false)
})
