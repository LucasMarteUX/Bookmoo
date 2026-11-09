// Compara o que o aluno falou (transcrição) com o texto da página, palavra por palavra.
//
// A página é dividida com a MESMA regra da tela (`listWords` / `wordRegex` de wordTokens.ts),
// então o índice i aqui é o mesmo `data-word-index="i"` que o leitor desenha.
//
// O alinhamento é uma distância de edição entre sequências de palavras (estilo
// Needleman–Wunsch), com operações extras para fala:
//   • 1↔1  palavra esperada × palavra reconhecida (custo = 1 − similaridade)
//   • 1↔2  "today" × "to day", "it's" × "it is"
//   • 2↔1  "every one" × "everyone"
//   • pular uma palavra da página (custo 1) e palavra extra falada (custo baixo: repetições, "um")
// O fim da página é livre: o que vem depois da última palavra alinhada fica "pendente"
// (o aluno ainda não chegou lá), não errado.
//
// Similaridade de uma palavra = máximo entre Levenshtein normalizado da grafia e de uma
// chave fonética simples (metaphone simplificado). Homófonos ("their"/"there") contam como
// pronúncia correta: o reconhecedor não tem como distinguir, e o aluno falou certo.

import { listWords } from '@/lib/wordTokens'

export type WordGrade = 'ok' | 'close' | 'bad' | 'pending'

export interface WordResult {
  index: number // = data-word-index na tela
  expected: string
  heard: string | null // o que o reconhecedor ouviu (null = palavra pulada ou ainda não lida)
  /** Posições [início, fim] (inclusive) em `heardTokens` do que foi ouvido para esta palavra. */
  heardRange: [number, number] | null
  similarity: number // 0–1
  grade: WordGrade
}

export interface AlignResult {
  words: WordResult[]
  /** Índice da última palavra da página alcançada pela leitura (−1 = nada ainda). */
  lastReached: number
  /** Palavras faladas que não correspondem a nada na página (repetições, hesitações). */
  extras: string[]
}

export const OK_THRESHOLD = 0.82
export const CLOSE_THRESHOLD = 0.6

// ---------------------------------------------------------------------------
// Normalização
// ---------------------------------------------------------------------------

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

/** "21" → ["twenty", "one"]; "1990" → ["nineteen", "ninety"]. Reconhecedores escrevem números com dígitos. */
function numberToWords(n: number): string[] {
  if (n < 20) return [ONES[n]]
  if (n < 100) return n % 10 ? [TENS[Math.floor(n / 10)], ONES[n % 10]] : [TENS[n / 10]]
  if (n < 1000) {
    const rest = n % 100
    return [ONES[Math.floor(n / 100)], 'hundred', ...(rest ? numberToWords(rest) : [])]
  }
  // anos: 1990 → nineteen ninety; 2005 → two thousand five
  if (n < 10000 && Math.floor(n / 100) % 10 !== 0 && n % 100 !== 0 && n < 2000) {
    return [...numberToWords(Math.floor(n / 100)), ...numberToWords(n % 100)]
  }
  if (n < 1_000_000) {
    const rest = n % 1000
    return [...numberToWords(Math.floor(n / 1000)), 'thousand', ...(rest ? numberToWords(rest) : [])]
  }
  return [String(n)]
}

export function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`´]/g, "'")
    .replace(/[^a-z0-9']/g, '')
}

/** Palavras da transcrição na mesma regra da página, com números por extenso. */
export function tokenizeTranscript(text: string): string[] {
  const out: string[] = []
  // "3:30", "1,000" e "50%" chegam como dígitos; juntamos separadores antes de dividir.
  const cleaned = text.replace(/(\d),(\d{3})/g, '$1$2').replace(/(\d+)%/g, '$1 percent')
  for (const w of listWords(cleaned)) {
    if (/^\d+$/.test(w)) out.push(...numberToWords(parseInt(w, 10)))
    else if (/^\d+(st|nd|rd|th)$/i.test(w)) out.push(...numberToWords(parseInt(w, 10))) // aproximação
    else out.push(w)
  }
  return out
}

// Formas expandidas aceitas para contrações da página ("it's" pode ser dito "it is").
const CONTRACTIONS: Array<[RegExp, string[]]> = [
  [/^can't$/, ['cannot', 'cant', 'cannot']],
  [/^won't$/, ['willnot', 'wont']],
  [/^shan't$/, ['shallnot', 'shant']],
  [/n't$/, ['not']],
  [/'re$/, ['are']],
  [/'ll$/, ['will']],
  [/'ve$/, ['have']],
  [/'m$/, ['am']],
  [/'d$/, ['would', 'had']],
  [/'s$/, ['is', 'has', 's']],
]

/** Grafias equivalentes de uma palavra da página, sem apóstrofo nem espaço. */
function variants(norm: string): string[] {
  const base = norm.replace(/'/g, '')
  const out = new Set([base])
  if (/^\d+$/.test(base)) out.add(numberToWords(parseInt(base, 10)).join(''))
  // grafia britânica (livros clássicos) × americana (o que o reconhecedor costuma escrever)
  const us = base
    .replace(/our(s|ed|ing)?$/, 'or$1')
    .replace(/is(e|ed|es|ing|ation)$/, 'iz$1')
    .replace(/([^aeiou])re$/, '$1er')
    .replace(/ll(ed|ing|er)$/, 'l$1')
    .replace(/^grey/, 'gray')
  out.add(us.replace(/undefined/g, ''))
  for (const [re, reps] of CONTRACTIONS) {
    if (re.test(norm)) {
      if (re.source.startsWith('^')) reps.forEach((r) => out.add(r))
      else {
        const stem = norm.replace(re, '').replace(/'/g, '')
        reps.forEach((r) => out.add(stem + r))
        // "don't" → "do" + "not"
        if (re.source === "n't$") out.add(stem.replace(/n$/, '') + 'not')
      }
      break
    }
  }
  return [...out]
}

// ---------------------------------------------------------------------------
// Similaridade
// ---------------------------------------------------------------------------

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = new Array(b.length + 1)
  let cur = new Array(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    ;[prev, cur] = [cur, prev]
  }
  return prev[b.length]
}

function levSim(a: string, b: string): number {
  const len = Math.max(a.length, b.length)
  return len ? 1 - levenshtein(a, b) / len : 1
}

/** Chave fonética aproximada do inglês (metaphone simplificado). */
export function phoneticKey(word: string): string {
  let w = word.replace(/[^a-z]/g, '').replace(/([a-z])\1/g, '$1') // letras dobradas soam como uma  // símbolos internos: X = "sh/ch", 0 = "th"
  if (!w) return word
  w = w
    .replace(/^kn|^gn|^pn|^wr|^ps/, (m) => m[1])
    .replace(/^x/, 's')
    .replace(/x/g, 'ks')
    .replace(/^wh/, 'w')
    .replace(/mb$/, 'm')
    .replace(/^(r|t|en|sl)ough/, '$1uf')
    .replace(/ough/g, 'o')
    .replace(/^laugh/, 'laf')
    .replace(/augh/g, 'o')
    .replace(/igh/g, 'i')
    .replace(/tch/g, 'X')
    .replace(/sch/g, 'sk')
    .replace(/ph/g, 'f')
    .replace(/sh|ch/g, 'X')
    .replace(/th/g, '0')
    .replace(/dg(?=[eiy])/g, 'j')
    .replace(/ck/g, 'k')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/c/g, 'k')
    .replace(/q/g, 'k')
    .replace(/z/g, 's')
    .replace(/v/g, 'f')
    .replace(/gh/g, '')
    .replace(/g(?=[eiy])/g, 'j')
    .replace(/dt|tt/g, 't')
  const first = w[0]
  // vogais (e "y"/"w"/"h" entre vogais) quase não distinguem palavras no reconhecimento
  const rest = w.slice(1).replace(/[aeiouyhw]/g, '')
  let key = /[aeiou]/.test(first) ? 'a' : first
  return key + rest
}

/**
 * Chave "tolerante": junta sons que o brasileiro costuma trocar (th→t/d/f, v→b, sh→s…).
 * Se só bate nessa chave, a palavra fica amarela ("quase"), não vermelha.
 */
function lenientKey(phon: string): string {
  return phon.replace(/0/g, 't').replace(/d/g, 't').replace(/f/g, 't').replace(/b/g, 'p').replace(/X/g, 's').replace(/j/g, 's').replace(/(.)\1+/g, '$1')
}

interface Prepared {
  norm: string
  forms: string[] // grafias aceitas (sem apóstrofo)
  phon: string[]
  lenient: string[]
}

function prepare(word: string): Prepared {
  const norm = normalizeWord(word)
  const forms = variants(norm)
  const phon = forms.map(phoneticKey)
  return { norm, forms, phon, lenient: phon.map(lenientKey) }
}

interface Heard { h: string; hp: string; hl: string }
function prepareHeard(word: string): Heard {
  const h = word.replace(/'/g, '')
  const hp = phoneticKey(h)
  return { h, hp, hl: lenientKey(hp) }
}

/** Só grafia: usado ao juntar/dividir palavras ("to day" × "today"). */
function spellingSim(exp: Prepared, heard: string): number {
  const h = heard.replace(/'/g, '')
  let best = 0
  for (const f of exp.forms) best = Math.max(best, levSim(f, h))
  return best
}

// Homófonos comuns: o reconhecedor escreve qualquer um deles para o mesmo som, então
// contam como pronúncia correta.
const HOMOPHONES = [
  'their there theyre', 'to too two', 'your youre', 'its its', 'by buy bye', 'for four fore', 'know no',
  'knew new', 'write right rite', 'hear here', 'one won', 'see sea', 'would wood', 'whole hole',
  'which witch', 'weather whether', 'peace piece', 'made maid', 'eight ate', 'sun son', 'meet meat',
  'week weak', 'blue blew', 'flour flower', 'wear where ware', 'our hour', 'not knot', 'night knight',
  'red read', 'road rode', 'tail tale', 'wait weight', 'way weigh', 'be bee', 'dear deer', 'sail sale',
  'mail male', 'pair pear', 'plain plane', 'rain reign', 'some sum', 'threw through', 'allowed aloud',
  'cent sent scent', 'cell sell', 'principal principle', 'stair stare', 'steal steel', 'ok okay',
]
const HOMO = new Map<string, number>()
HOMOPHONES.forEach((line, g) => line.split(' ').forEach((w) => HOMO.set(w, g)))

/**
 * Similaridade 0–1 entre uma palavra esperada e uma ouvida.
 *  • igual (ou homófono conhecido) → 1
 *  • mesma chave fonética, grafia diferente → 0,5 + 0,3·grafia (vogal trocada: "sleepy"→"slippy"
 *    fica amarelo — as chaves ignoram vogais, então isso pode ser erro de vogal)
 *  • só bate na chave tolerante (th→t etc.) → 0,7 (amarelo)
 *  • senão, média entre grafia e fonética (Levenshtein normalizado)
 */
function similarity(exp: Prepared, heard: Heard): number {
  const { h, hp, hl } = heard
  if (!h) return 0
  let best = 0
  for (let k = 0; k < exp.forms.length; k++) {
    const f = exp.forms[k]
    if (f === h) return 1
    const g = HOMO.get(f)
    if (g !== undefined && HOMO.get(h) === g) return 1
    const spelling = levSim(f, h)
    // mesma chave fonética com grafia diferente: provavelmente só a vogal mudou ("sheep"→"ship")
    let score = exp.phon[k] === hp ? 0.5 + 0.3 * spelling : 0.5 * spelling + 0.5 * levSim(exp.phon[k], hp)
    if (exp.lenient[k].length >= 2 && exp.lenient[k] === hl) score = Math.max(score, 0.7)
    best = Math.max(best, score)
  }
  return best
}

export function gradeOf(sim: number): Exclude<WordGrade, 'pending'> {
  return sim >= OK_THRESHOLD ? 'ok' : sim >= CLOSE_THRESHOLD ? 'close' : 'bad'
}

// ---------------------------------------------------------------------------
// Alinhamento
// ---------------------------------------------------------------------------

/** Hesitações: nunca fazem parte de uma palavra da página. */
const FILLERS = new Set(['um', 'uh', 'er', 'erm', 'ah', 'eh', 'hmm', 'mm', 'hm', 'uhm'])
const COST_SKIP = 1 // palavra da página não falada
const COST_EXTRA = 0.55 // palavra falada que não está na página

type Op = 0 | 1 | 2 | 3 | 4 | 5 // 0 nada, 1 match 1:1, 2 skip, 3 extra, 4 1:2, 5 2:1

/**
 * Alinha as palavras da página (`pageWords`, na numeração da tela) com a transcrição
 * (texto livre, ou lista de palavras já separadas — ex.: as palavras com tempo do Whisper).
 * Palavras depois da última alcançada ficam 'pending'; `scoreResult` as conta como não lidas.
 */
export function alignTranscript(pageWords: string[], transcript: string | string[], opts: { final?: boolean } = {}): AlignResult {
  const raw = Array.isArray(transcript) ? transcript : tokenizeTranscript(transcript)
  // `src[j]` = posição em `raw` da j-ésima palavra ouvida (para achar os tempos do Whisper)
  const heard: string[] = []
  const src: number[] = []
  raw.forEach((w, k) => { const nw = normalizeWord(w); if (nw) { heard.push(nw); src.push(k) } })
  const n = pageWords.length
  const m = heard.length
  const exp = pageWords.map(prepare)
  const hp = heard.map(prepareHeard)
  const joinedExp = pageWords.map((w, k) => (k ? prepare(pageWords[k - 1] + w) : null))

  const W = m + 1
  const cost = new Float64Array((n + 1) * W)
  const op = new Uint8Array((n + 1) * W)
  const simCache = new Float64Array((n + 1) * W) // sim do match que termina em (i, j)
  for (let j = 1; j <= m; j++) { cost[j] = j * COST_EXTRA; op[j] = 3 }
  for (let i = 1; i <= n; i++) {
    cost[i * W] = i * COST_SKIP
    op[i * W] = 2
    for (let j = 1; j <= m; j++) {
      const e = exp[i - 1]
      const s1 = similarity(e, hp[j - 1])
      let best = cost[(i - 1) * W + j - 1] + (1 - s1)
      let bop: Op = 1
      let bsim = s1
      const skip = cost[(i - 1) * W + j] + COST_SKIP
      if (skip < best) { best = skip; bop = 2; bsim = 0 }
      const extra = cost[i * W + j - 1] + COST_EXTRA
      if (extra < best) { best = extra; bop = 3; bsim = 0 }
      if (j >= 2) {
        // Reconhecedores às vezes partem uma palavra ("hideout" → "hi-dot"). Compara grafia e som;
        // o custo extra e o limite de "quase" evitam engolir palavras extras de verdade.
        const s12 = Math.max(spellingSim(e, heard[j - 2] + heard[j - 1]), similarity(e, prepareHeard(heard[j - 2] + heard[j - 1])))
        if (s12 >= CLOSE_THRESHOLD && !FILLERS.has(heard[j - 2]) && !FILLERS.has(heard[j - 1])) {
          const c = cost[(i - 1) * W + j - 2] + (1 - s12) + 0.05
          if (c < best) { best = c; bop = 4; bsim = s12 }
        }
      }
      if (i >= 2) {
        const s21 = spellingSim(joinedExp[i - 1]!, heard[j - 1])
        if (s21 >= OK_THRESHOLD) {
          const c = cost[(i - 2) * W + j - 1] + 2 * (1 - s21) + 0.05
          if (c < best) { best = c; bop = 5; bsim = s21 }
        }
      }
      cost[i * W + j] = best
      op[i * W + j] = bop
      simCache[i * W + j] = bsim
    }
  }

  // Fim livre na página: escolhe onde a leitura parou (menor custo na última coluna,
  // contando as palavras restantes como pendentes, sem custo).
  let endI = 0
  let endCost = Infinity
  for (let i = 0; i <= n; i++) {
    const c = cost[i * W + m]
    if (c < endCost - 1e-9) { endCost = c; endI = i }
  }

  const words: WordResult[] = pageWords.map((w, index) => ({ index, expected: w, heard: null, heardRange: null, similarity: 0, grade: 'pending' }))
  const extras: string[] = []
  let i = endI
  let j = m
  while (i > 0 || j > 0) {
    const o = op[i * W + j] as Op
    if (o === 1) {
      const sim = simCache[i * W + j]
      words[i - 1] = { ...words[i - 1], heard: heard[j - 1], heardRange: [src[j - 1], src[j - 1]], similarity: sim, grade: gradeOf(sim) }
      i--; j--
    } else if (o === 4) {
      const sim = simCache[i * W + j]
      words[i - 1] = { ...words[i - 1], heard: `${heard[j - 2]} ${heard[j - 1]}`, heardRange: [src[j - 2], src[j - 1]], similarity: sim, grade: gradeOf(sim) }
      i--; j -= 2
    } else if (o === 5) {
      const sim = simCache[i * W + j]
      for (const k of [i - 2, i - 1]) words[k] = { ...words[k], heard: heard[j - 1], heardRange: [src[j - 1], src[j - 1]], similarity: sim, grade: gradeOf(sim) }
      i -= 2; j--
    } else if (o === 2) {
      words[i - 1] = { ...words[i - 1], heard: null, heardRange: null, similarity: 0, grade: 'bad' }
      i--
    } else {
      extras.unshift(heard[j - 1])
      j--
    }
  }

  // Palavras "puladas" bem no fim da parte alcançada costumam ser só a transcrição ao vivo
  // atrasada: elas voltam a ficar pendentes até haver uma palavra reconhecida depois delas.
  let lastReached = -1
  for (let k = endI - 1; k >= 0; k--) {
    if (words[k].heard !== null) { lastReached = k; break }
    words[k] = { ...words[k], grade: 'pending' }
  }

  // Resultado final: se o aluno continuou falando depois da última palavra alinhada, mas nada
  // mais bateu (trecho ininteligível), ele não "parou de ler" — essas palavras contam como
  // erradas, uma para cada palavra que sobrou na fala.
  if (opts.final) {
    const lastJ = lastReached >= 0 ? heardEnd(words[lastReached], src) : -1
    const tail = heard.length - 1 - lastJ
    for (let t = 0; t < tail && lastReached + 1 < n; t++) {
      lastReached++
      words[lastReached] = { ...words[lastReached], heard: heard[lastJ + 1 + t], heardRange: [src[lastJ + 1 + t], src[lastJ + 1 + t]], similarity: 0, grade: 'bad' }
      const ex = extras.lastIndexOf(heard[lastJ + 1 + t])
      if (ex >= 0) extras.splice(ex, 1)
    }
  }

  return { words, lastReached, extras }
}

/** Posição (em `heard`) da última palavra ouvida atribuída a esta palavra da página. */
function heardEnd(w: WordResult, src: number[]): number {
  if (!w.heardRange) return -1
  return src.indexOf(w.heardRange[1])
}

export interface Score {
  total: number // palavras da página
  attempted: number // palavras até onde o aluno leu
  ok: number
  close: number
  bad: number // inclui palavras puladas
  missed: number // palavras não alcançadas (depois da última lida)
  /** % de acerto sobre as palavras lidas: verde vale 1, amarelo vale ½. */
  accuracy: number
  errors: number // = bad
}

export function scoreResult(r: AlignResult): Score {
  let ok = 0, close = 0, bad = 0
  for (const w of r.words) {
    if (w.grade === 'ok') ok++
    else if (w.grade === 'close') close++
    else if (w.grade === 'bad') bad++
  }
  const attempted = ok + close + bad
  return {
    total: r.words.length,
    attempted,
    ok,
    close,
    bad,
    missed: r.words.length - attempted,
    accuracy: attempted ? Math.round(((ok + close * 0.5) / attempted) * 100) : 0,
    errors: bad,
  }
}
