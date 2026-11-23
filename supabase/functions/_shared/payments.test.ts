// Validação do modelo Zouti "dois links, plano pelo valor". Rodar: deno test supabase/functions/_shared/payments.test.ts
import { assertEquals } from 'jsr:@std/assert@1'
import { matchPlan, normalize } from './payments.ts'

const paid = (body: Record<string, unknown>, ciclo: string | null = null) => normalize({ event: 'order.paid', status: 'paid', customer: { email: 'Ana@Ex.com' }, ...body }, null, ciclo)

Deno.test('mensal: cada valor libera o plano certo', () => {
  assertEquals(paid({ amount: 24.9 }, 'mensal').planId, 'essencial')
  assertEquals(paid({ amount: 44.9 }, 'mensal').planId, 'plus')
  assertEquals(paid({ total: '89,90' }, 'mensal').planId, 'pro')
  assertEquals(paid({ amount_cents: 4490 }, 'mensal').cycle, 'monthly')
})

Deno.test('anual: total do ano à vista', () => {
  for (const [v, plan] of [[239.04, 'essencial'], [430.8, 'plus'], [431.04, 'plus'], [863.04, 'pro']] as const) {
    const ev = paid({ amount: v }, 'anual')
    assertEquals([ev.planId, ev.cycle, ev.review], [plan, 'annual', null])
  }
})

Deno.test('formato real Zouti: amount_paid em centavos, juros descontados', () => {
  assertEquals(normalize({ status: 'PAID', amount_paid: 23904, customer: { email: 'a@b.com' } }, null, 'anual').planId, 'essencial')
  assertEquals(normalize({ status: 'PAID', amount_paid: 26304, interest_amount: 2400, installments: 12, customer: { email: 'a@b.com' } }, null, 'anual').planId, 'essencial')
  assertEquals(normalize({ status: 'PAID', payment_total: { amount: 4490 }, amount_total: 4490, customer: { email: 'a@b.com' } }, null, 'mensal').planId, 'plus')
})

Deno.test('exemplos da Zouti (curso R$ 97 / R$ 119,70) NÃO liberam plano', () => {
  const pay = normalize({ id: 'pmt_x', status: 'PAID', amount: 11970, amount_paid: 11970, interest_amount: 970, discount_amount: 500, order_id: 'ord_1', customer: { email: 'm@x.com' }, line_items: [{ type: 'SKU', amount: 11970 }] }, null, 'mensal')
  assertEquals([pay.planId, pay.review, pay.chargeRef], [null, 'amount_not_matched', 'ord_1'])
  const order = normalize({ id: 'ord_1', status: 'PAID', amount_total: 9790, payment_total: { amount: 9790, interest_amount: 0 }, items: [{ type: 'SKU', amount: 9700 }], customer: { email: 'm@x.com' } }, null, 'anual')
  assertEquals([order.planId, order.review, order.chargeRef], [null, 'amount_not_matched', 'ord_1'])
})

Deno.test('o valor decide o ciclo mesmo sem dica', () => {
  assertEquals(paid({ amount: 239.04 }).cycle, 'annual')
  assertEquals(paid({ amount: 24.9 }).cycle, 'monthly')
})

Deno.test('ciclo pela oferta no corpo', () => {
  assertEquals(paid({ amount: 863.04, offer: { id: 'prod_offer_dco7aoi40qrz8uhlywpd24' } }).cycle, 'annual')
})

Deno.test('valor que não fecha (cupom, teste de R$ 1) vai para revisão, sem plano', () => {
  const ev = paid({ amount: 10 }, 'mensal')
  assertEquals([ev.planId, ev.review], [null, 'amount_not_matched'])
})

Deno.test('webhook mensal recebendo valor anual: não libera, vai para revisão', () => {
  assertEquals(paid({ amount: 239.04 }, 'mensal').review, 'cycle_mismatch')
})

Deno.test('nome do plano diferente do valor pago vai para revisão', () => {
  assertEquals(paid({ amount: 24.9, product: { name: 'Upoonly Pro' } }, 'mensal').review, 'plan_name_mismatch')
  assertEquals(paid({ amount: 24.9, product: { name: 'Upoonly - Essencial' } }, 'mensal').review, null)
  // "product"/"produto" não contam como "pro"
  assertEquals(paid({ amount: 24.9, product_name: 'Upoonly - Aprenda inglês com histórias' }, 'mensal').review, null)
})

Deno.test('dois planos batendo por valores diferentes: ambíguo', () => {
  assertEquals('error' in matchPlan([2490, 8990], null, null), true)
})

Deno.test('eventos de status', () => {
  assertEquals(normalize({ event: 'subscription.canceled' }, null).kind, 'canceled')
  assertEquals(normalize({ event: 'order.refunded' }, null).kind, 'refunded')
  assertEquals(normalize({ event: 'order.chargeback' }, null).kind, 'disputed')
  assertEquals(normalize({ event: 'subscription.late', status: 'atrasada' }, null).kind, 'failed')
  assertEquals(normalize({ event: 'pix.created', status: 'pending' }, null).kind, 'ignored')
  assertEquals(normalize({ event: 'abandoned_cart' }, null).kind, 'ignored')
})

Deno.test('e-mail normalizado e intenção reconhecida', () => {
  const ev = paid({ amount: 24.9, src: '0b6c6a43-6a39-4c1f-9a51-2a3f0b7e8c11' }, 'mensal')
  assertEquals(ev.email, 'ana@ex.com')
  assertEquals(ev.intentId, '0b6c6a43-6a39-4c1f-9a51-2a3f0b7e8c11')
})

Deno.test('evento de assinatura (plan.amount + interval)', () => {
  const ok = normalize({ id: 'sub_1', status: 'ACTIVE', account_id: 'acc', order_id: 'ord_9', plan: { amount: 86304, interval: 'ANNUALLY' }, customer: { email: 'a@b.com' }, line_items: [{ amount: 7192 }] }, null, null)
  assertEquals([ok.kind, ok.planId, ok.cycle, ok.subscriptionRef, ok.chargeRef], ['paid', 'pro', 'annual', 'sub_1', 'ord_9'])
  const sample = normalize({ id: 'sub_x', status: 'ACTIVE', account_id: 'acc', plan: { amount: 119700, interval: 'ANNUALLY' }, line_items: [{ amount: 9975, full_amount: 119700 }], customer: { email: 'j@x.com' } }, null, 'anual')
  assertEquals([sample.planId, sample.review], [null, 'amount_not_matched'])
})
