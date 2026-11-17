// deno test supabase/functions/_shared/proficiency/engine.test.ts
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { adaptiveBand, cefrOf, insufficient, maxPoints, overallBand, partScore, route, speakingBand, writingBand } from './engine.ts'
import { buildGaps } from './generate.ts'

Deno.test('contagem de itens por seção segue o blueprint', () => {
  assertEquals(maxPoints('reading', 'easy'), 50)
  assertEquals(maxPoints('reading', 'hard'), 50)
  assertEquals(maxPoints('listening', 'hard'), 47)
  assertEquals(maxPoints('writing', 'fixed'), 12)
  assertEquals(maxPoints('speaking', 'fixed'), 11)
})

Deno.test('roteamento determinístico: 60% vai para o difícil', () => {
  assertEquals(route(13, 21).module, 'hard')
  assertEquals(route(12, 21).module, 'easy')
  assertEquals(route(0, 0).module, 'easy')
})

Deno.test('faixa adaptativa respeita os limites de cada caminho', () => {
  assertEquals(adaptiveBand(1, 1, 'hard'), 6)
  assertEquals(adaptiveBand(0.6, 0, 'hard'), 3.5)
  assertEquals(adaptiveBand(0.5, 1, 'easy'), 3.5)
  assertEquals(adaptiveBand(0, 0, 'easy'), 1)
  assert(adaptiveBand(1, 1, 'easy') <= 4)
})

Deno.test('writing, speaking e nota geral em meia faixa', () => {
  assertEquals(writingBand(1, 5, 5), 6)
  assertEquals(writingBand(0, 0, 0), 1)
  assertEquals(writingBand(0.5, 3, 3), 4)
  assertEquals(speakingBand(0.8, 4), 5)
  assertEquals(overallBand([4, 4.5, 3.5, 4]), 4)
  assertEquals(cefrOf(4), 'B2')
  assertEquals(cefrOf(5.5), 'C1')
  assertEquals(cefrOf(1.5), 'A1')
})

Deno.test('correção objetiva', () => {
  assertEquals(partScore('complete_words', { gaps: { g1: 'ause' } }, 'g1', { letters: ' AUSE ' }), 1)
  assertEquals(partScore('complete_words', { gaps: { g1: 'ause' } }, 'g1', { letters: 'aus' }), 0)
  assertEquals(partScore('daily_life', { choices: { q1: 2 } }, 'q1', { choice: 2 }), 1)
  assertEquals(partScore('daily_life', { choices: { q1: 2 } }, 'q1', {}), 0)
  assertEquals(partScore('build_sentence', { order: ['I', 'would like', 'to go'] }, 'order', { order: ['I', 'would like', 'to go'] }), 1)
  assertEquals(partScore('build_sentence', { order: ['I', 'would like', 'to go'] }, 'order', { order: ['would like', 'I', 'to go'] }), 0)
  assertEquals(partScore('listen_repeat', { text: 'The library opens at nine.' }, 'say', { transcript: 'the library opens at nine' }), 1)
  assertEquals(partScore('write_email', {}, 'text', { text: 'hi' }), null)
})

Deno.test('evidência insuficiente', () => {
  assertEquals(insufficient('reading', { answered: 20, total: 50 }), 'few_answers')
  assertEquals(insufficient('reading', { answered: 30, total: 50 }), null)
  assertEquals(insufficient('speaking', { answered: 11, total: 11, spoken: 4 }), 'too_little_speech')
  assertEquals(insufficient('writing', { answered: 2, total: 12, words: 10 }), 'too_little_writing')
})

Deno.test('Complete the Words: 10 lacunas, segunda metade da palavra, primeira frase intacta', () => {
  const text = 'Rivers shape the land around them. Over thousands of years, flowing water slowly carries small pieces of rock and soil downstream, and this process gradually creates wide valleys, deep canyons and fertile plains where many farmers later decide to settle and grow food.'
  const r = buildGaps(text)
  assert(r)
  const gaps = r!.segments.filter(s => s.t === 'gap')
  assertEquals(gaps.length, 10)
  assert(r!.segments[0].t === 'text' && r!.segments[0].v.startsWith('Rivers shape the land around them. '))
  for (const g of gaps) {
    if (g.t !== 'gap') continue
    const full = g.prefix + r!.gaps[g.id]
    assert(text.includes(full), full)
    assertEquals(g.len, r!.gaps[g.id].length)
  }
})
