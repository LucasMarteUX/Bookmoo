// deno test supabase/functions/_shared/placementScore.test.ts
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { dictationScore, outcomeOf, readAloudScore, totalOf, words } from './placementScore.ts'
import { BANK, drawItems, LEVELS } from './placementBank.ts'

Deno.test('words normaliza pontuação, maiúsculas e números', () => {
  assertEquals(words('I have 2 brothers!'), ['i', 'have', 'two', 'brothers'])
  assertEquals(words('It’s fine.'), ["it's", 'fine'])
})

Deno.test('ditado: perfeito, com erro de digitação leve e com palavra faltando', () => {
  assertEquals(dictationScore('I have two brothers.', 'i have two brothers'), 100)
  assertEquals(dictationScore('She bought a new dress yesterday.', 'She bougth a new dress yesterday'), 100) // 1 letra trocada em palavra longa
  assertEquals(dictationScore('My cat is black.', 'My cat black'), 75)
  assertEquals(dictationScore('My cat is black.', ''), 0)
})

Deno.test('leitura em voz alta: completa, parcial e fora do texto', () => {
  assertEquals(readAloudScore('My name is Leo. I like cats.', 'my name is leo i like cats'), 100)
  assert(readAloudScore('My name is Leo. I like cats.', 'my name leo cats') < 70)
  assert(readAloudScore('I have a red bag.', 'the weather is nice today and I want to go to the beach with friends') < 30)
})

Deno.test('total ponderado', () => {
  assertEquals(totalOf({ speaking: 100, listening: 100, interaction: 100 }), 100)
  assertEquals(totalOf({ speaking: 60, listening: 80, interaction: 50 }), 61)
})

Deno.test('resultado: promoção, confirmação, ajuste e A1 nunca desce', () => {
  assertEquals(outcomeOf('confirm', 'A2', { speaking: 90, listening: 90, interaction: 90 }).outcome, 'promote')
  assertEquals(outcomeOf('confirm', 'A2', { speaking: 95, listening: 30, interaction: 95 }).outcome, 'confirmed') // uma parte < 40 não promove
  assertEquals(outcomeOf('confirm', 'B1', { speaking: 40, listening: 40, interaction: 40 }).outcome, 'step_down')
  assertEquals(outcomeOf('confirm', 'A1', { speaking: 10, listening: 10, interaction: 10 }).outcome, 'confirmed')
  assertEquals(outcomeOf('confirm', 'C2', { speaking: 100, listening: 100, interaction: 100 }).outcome, 'confirmed') // C2 não promove
  assertEquals(outcomeOf('promotion', 'B1', { speaking: 70, listening: 60, interaction: 65 }).outcome, 'promoted')
  assertEquals(outcomeOf('promotion', 'B1', { speaking: 50, listening: 50, interaction: 50 }).outcome, 'not_promoted')
})

Deno.test('banco: todos os níveis têm itens suficientes e o sorteio evita repetir', () => {
  for (const l of LEVELS) {
    const b = BANK[l]
    assert(b.read.length >= 4 && b.open.length >= 3 && b.dictation.length >= 5 && b.talk.length >= 2, l)
    const first = drawItems(l)
    const avoid = new Set([...first.read.map(x => x.text), ...first.dictation.map(x => x.text)])
    const second = drawItems(l, avoid)
    const repeated = second.read.filter(x => avoid.has(x.text)).length
    assert(repeated <= Math.max(0, 3 * 2 - b.read.length), `${l}: leitura repetida`)
  }
})
