// Planejamento de balões compartilhado: frases com posição exata no texto da página.
// As posições (charStart/charEnd) são relativas ao texto da página enviado pelo cliente, que usa
// a mesma numeração de palavras da tela — assim destaque, clique e voz funcionam dentro dos balões.

export type Segment = { charStart: number; charEnd: number; kind: 'speech' | 'caption' }

/** Frases do texto com posições [start, end) no texto original (sem espaços nas pontas). */
export function sentenceSpans(text: string): [number, number][] {
  const spans: [number, number][] = []
  // Parágrafos (linha em branco) também são limites: títulos não grudam na frase seguinte.
  const paraRe = /[^\n]+(?:\n(?!\s*\n)[^\n]*)*/g
  let p: RegExpExecArray | null
  while ((p = paraRe.exec(text)) !== null) {
    const base = p.index
    const para = p[0]
    const re = /[^.!?…]+(?:[.!?…]+["'”’)\]]*|$)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(para)) !== null) {
      if (!m[0]) { re.lastIndex++; continue }
      let s = base + m.index
      let e = base + m.index + m[0].length
      while (s < e && /\s/.test(text[s])) s++
      while (e > s && /\s/.test(text[e - 1])) e--
      if (e > s) spans.push([s, e])
    }
  }
  return spans
}

export function wordCount(s: string) {
  return (s.match(/[\p{L}\p{N}]+/gu) ?? []).length
}

/** Agrupa frases consecutivas em n blocos de tamanho parecido (plano de reserva). */
export function evenGroups(spans: [number, number][], text: string, n: number): [number, number][] {
  n = Math.max(1, Math.min(n, spans.length))
  const lens = spans.map(([a, b]) => wordCount(text.slice(a, b)) || 1)
  const total = lens.reduce((a, b) => a + b, 0)
  const groups: [number, number][] = []
  let start = 0
  let acc = 0
  for (let i = 0; i < spans.length; i++) {
    acc += lens[i]
    const groupsLeftAfter = n - groups.length - 1 // grupos que ainda faltam depois deste
    const spansLeftAfter = spans.length - i - 1
    if (groupsLeftAfter === 0) continue // o último grupo leva o resto
    // Fecha o grupo ao atingir a fatia proporcional, ou quando só sobra uma frase por grupo restante.
    if (acc >= (total * (groups.length + 1)) / n || spansLeftAfter === groupsLeftAfter) {
      groups.push([start, i])
      start = i + 1
    }
  }
  groups.push([start, spans.length - 1])
  return groups
}
