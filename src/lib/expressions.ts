// Reconhece expressões em inglês no texto que já está na tela.
// Roda no aparelho, sem pedir nada ao servidor e sem chamar IA.
// Só agrupa quando o verbo e a partícula cabem na mesma frase.

export type ExpressionHit = {
  /** Índices das palavras que fazem parte da expressão. O miolo (“the light”) fica de fora. */
  indices: number[]
  /** Como a expressão aparece no livro, só com as palavras que são dela. */
  surface: string
  /** Forma de dicionário, para explicação e vocabulário. */
  canonical: string
}

type Pattern = {
  lemma: string
  parts: string[]
  /** Palavra que precisa aparecer depois, como “mind” em “make up your mind”. */
  tail?: string
  /** Quantas palavras podem ficar entre um pedaço e o próximo. */
  gap: number
  canonical: string
}

const PATTERNS: Pattern[] = [
  { lemma: 'give', parts: ['up'], gap: 4, canonical: 'give up' },
  { lemma: 'look', parts: ['after'], gap: 4, canonical: 'look after' },
  { lemma: 'look', parts: ['forward', 'to'], gap: 2, canonical: 'look forward to' },
  { lemma: 'look', parts: ['up'], gap: 4, canonical: 'look up' },
  { lemma: 'look', parts: ['for'], gap: 4, canonical: 'look for' },
  { lemma: 'look', parts: ['into'], gap: 3, canonical: 'look into' },
  { lemma: 'figure', parts: ['out'], gap: 4, canonical: 'figure out' },
  { lemma: 'run', parts: ['out', 'of'], gap: 3, canonical: 'run out of' },
  { lemma: 'run', parts: ['into'], gap: 3, canonical: 'run into' },
  { lemma: 'make', parts: ['up'], tail: 'mind', gap: 3, canonical: 'make up your mind' },
  { lemma: 'make', parts: ['up'], gap: 4, canonical: 'make up' },
  { lemma: 'turn', parts: ['off'], gap: 4, canonical: 'turn off' },
  { lemma: 'turn', parts: ['on'], gap: 4, canonical: 'turn on' },
  { lemma: 'turn', parts: ['down'], gap: 4, canonical: 'turn down' },
  { lemma: 'take', parts: ['off'], gap: 4, canonical: 'take off' },
  { lemma: 'take', parts: ['after'], gap: 3, canonical: 'take after' },
  { lemma: 'take', parts: ['up'], gap: 4, canonical: 'take up' },
  { lemma: 'put', parts: ['off'], gap: 4, canonical: 'put off' },
  { lemma: 'put', parts: ['up', 'with'], gap: 3, canonical: 'put up with' },
  { lemma: 'pick', parts: ['up'], gap: 4, canonical: 'pick up' },
  { lemma: 'come', parts: ['up', 'with'], gap: 3, canonical: 'come up with' },
  { lemma: 'come', parts: ['across'], gap: 3, canonical: 'come across' },
  { lemma: 'get', parts: ['along'], gap: 3, canonical: 'get along' },
  { lemma: 'get', parts: ['over'], gap: 3, canonical: 'get over' },
  { lemma: 'get', parts: ['rid', 'of'], gap: 2, canonical: 'get rid of' },
  { lemma: 'go', parts: ['on'], gap: 3, canonical: 'go on' },
  { lemma: 'go', parts: ['through'], gap: 3, canonical: 'go through' },
  { lemma: 'break', parts: ['down'], gap: 3, canonical: 'break down' },
  { lemma: 'bring', parts: ['up'], gap: 4, canonical: 'bring up' },
  { lemma: 'call', parts: ['off'], gap: 4, canonical: 'call off' },
  { lemma: 'carry', parts: ['on'], gap: 3, canonical: 'carry on' },
  { lemma: 'carry', parts: ['out'], gap: 4, canonical: 'carry out' },
  { lemma: 'catch', parts: ['up'], gap: 4, canonical: 'catch up' },
  { lemma: 'check', parts: ['out'], gap: 4, canonical: 'check out' },
  { lemma: 'cut', parts: ['down', 'on'], gap: 2, canonical: 'cut down on' },
  { lemma: 'end', parts: ['up'], gap: 3, canonical: 'end up' },
  { lemma: 'find', parts: ['out'], gap: 4, canonical: 'find out' },
  { lemma: 'grow', parts: ['up'], gap: 2, canonical: 'grow up' },
  { lemma: 'hand', parts: ['in'], gap: 4, canonical: 'hand in' },
  { lemma: 'hold', parts: ['on'], gap: 2, canonical: 'hold on' },
  { lemma: 'keep', parts: ['up'], gap: 3, canonical: 'keep up' },
  { lemma: 'let', parts: ['down'], gap: 3, canonical: 'let down' },
  { lemma: 'point', parts: ['out'], gap: 4, canonical: 'point out' },
  { lemma: 'set', parts: ['up'], gap: 4, canonical: 'set up' },
  { lemma: 'show', parts: ['up'], gap: 3, canonical: 'show up' },
  { lemma: 'work', parts: ['out'], gap: 4, canonical: 'work out' },
  { lemma: 'give', parts: ['in'], gap: 2, canonical: 'give in' },
  { lemma: 'give', parts: ['away'], gap: 4, canonical: 'give away' },
]

const IRREGULAR: Record<string, string> = {
  gave: 'give', given: 'give', giving: 'give',
  took: 'take', taken: 'take', taking: 'take',
  ran: 'run', running: 'run',
  made: 'make', making: 'make',
  looked: 'look', looking: 'look',
  figured: 'figure', figuring: 'figure',
  turned: 'turn', turning: 'turn',
  put: 'put', putting: 'put',
  got: 'get', gotten: 'get', getting: 'get',
  went: 'go', gone: 'go', going: 'go',
  came: 'come', coming: 'come',
  broke: 'break', broken: 'break', breaking: 'break',
  brought: 'bring', bringing: 'bring',
  caught: 'catch', catching: 'catch',
  cut: 'cut', cutting: 'cut',
  found: 'find', finding: 'find',
  grew: 'grow', grown: 'grow', growing: 'grow',
  held: 'hold', holding: 'hold',
  kept: 'keep', keeping: 'keep',
  let: 'let', letting: 'let',
  set: 'set', setting: 'set',
  showed: 'show', shown: 'show', showing: 'show',
  worked: 'work', working: 'work',
  picked: 'pick', picking: 'pick',
  ended: 'end', ending: 'end',
  carried: 'carry', carrying: 'carry',
  called: 'call', calling: 'call',
  checked: 'check', checking: 'check',
  handed: 'hand', handing: 'hand',
  pointed: 'point', pointing: 'point',
}

function lemma(word: string) {
  const w = word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').replace(/[’']/g, '')
  if (IRREGULAR[w]) return IRREGULAR[w]
  if (w.endsWith('ying') && w.length > 5) return w.slice(0, -4) + 'ie'
  if (w.endsWith('ing') && w.length > 5) {
    const stem = w.slice(0, -3)
    if (stem.endsWith(stem.at(-1)!) && stem.length > 3) return stem.slice(0, -1)
    return stem
  }
  if (w.endsWith('ied') && w.length > 4) return w.slice(0, -3) + 'y'
  if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2)
  if (w.endsWith('es') && w.length > 4) return w.slice(0, -2)
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1)
  return w
}

function sentenceBounds(words: string[], index: number) {
  let from = index
  let to = index
  const stops = /[.!?…]$/
  while (from > 0 && !stops.test(words[from - 1])) from--
  while (to < words.length - 1 && !stops.test(words[to])) to++
  return [from, to] as const
}

function findForward(words: string[], from: number, limit: number, target: string) {
  const end = Math.min(words.length - 1, from + limit)
  for (let i = from; i <= end; i++) if (lemma(words[i]) === target || words[i].toLowerCase() === target) return i
  return -1
}

/**
 * Se a palavra clicada faz parte de uma expressão conhecida nesta frase, devolve as peças.
 * Frase ambígua demais (partícula longe, outra oração) não agrupa.
 */
export function findExpression(words: string[], index: number, language = 'en'): ExpressionHit | null {
  if (!words[index] || !language.toLowerCase().startsWith('en')) return null
  const [from, to] = sentenceBounds(words, index)
  const here = lemma(words[index])
  let best: ExpressionHit | null = null
  for (const pattern of PATTERNS) {
    let verbAt = -1
    if (here === pattern.lemma) verbAt = index
    else {
      for (let i = index; i >= from && index - i <= pattern.gap + pattern.parts.length; i--) {
        if (lemma(words[i]) === pattern.lemma) { verbAt = i; break }
      }
    }
    if (verbAt < from) continue
    const indices = [verbAt]
    let cursor = verbAt + 1
    let ok = true
    for (const part of pattern.parts) {
      const at = findForward(words, cursor, pattern.gap, part)
      if (at < 0 || at > to) { ok = false; break }
      indices.push(at)
      cursor = at + 1
    }
    if (!ok) continue
    if (pattern.tail) {
      const at = findForward(words, cursor, pattern.gap, pattern.tail)
      if (at < 0 || at > to) continue
      indices.push(at)
    }
    if (!indices.includes(index)) continue
    const surface = indices.map(i => words[i]).join(' ')
    const hit = { indices, surface, canonical: pattern.canonical }
    if (!best || hit.indices.length > best.indices.length) best = hit
  }
  return best
}
