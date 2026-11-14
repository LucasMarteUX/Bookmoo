// Ações que a tutora executa na tela enquanto conversa: abrir a lição (numa seção), abrir o desafio,
// ir para uma página do livro e destacar um trecho. O leitor escuta estes eventos.
export type TutorAction =
  | { type: 'open_study'; page?: number; section?: string; generate?: boolean }
  | { type: 'open_quiz' }
  | { type: 'goto_page'; page: number }
  | { type: 'highlight'; text: string; page?: number }
  | { type: 'show_examples'; title: string; items: { en: string; pt?: string }[] }

export function runTutorAction(a: TutorAction) {
  window.dispatchEvent(new CustomEvent('bookmoo:tutor-action', { detail: a }))
}

/** Destaca um trecho do texto visível do leitor (sem mexer no HTML) e rola até ele. */
export function flashPassage(root: Element, phrase: string): boolean {
  const target = phrase.replace(/\s+/g, ' ').trim().toLowerCase()
  if (target.length < 2) return false
  const nodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let all = ''
  const starts: number[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text
    if (!t.data) continue
    nodes.push(t); starts.push(all.length); all += t.data
  }
  // Normaliza espaços mantendo o mapa de posições.
  let norm = ''
  const map: number[] = []
  for (let i = 0; i < all.length; i++) {
    const ch = /\s/.test(all[i]) ? ' ' : all[i].toLowerCase()
    if (ch === ' ' && norm.endsWith(' ')) continue
    norm += ch; map.push(i)
  }
  const at = norm.indexOf(target)
  if (at < 0) return false
  const from = map[at], to = map[at + target.length - 1] + 1
  const locate = (pos: number) => {
    let k = starts.length - 1
    while (k > 0 && starts[k] > pos) k--
    return { node: nodes[k], offset: Math.min(nodes[k].data.length, pos - starts[k]) }
  }
  const a = locate(from), b = locate(to)
  const range = document.createRange()
  range.setStart(a.node, a.offset)
  range.setEnd(b.node, b.offset)
  const H = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight
  const reg = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights
  if (H && reg) {
    reg.set('tutor', new H(range))
    window.setTimeout(() => reg.delete('tutor'), 9000)
  }
  const r = range.getBoundingClientRect()
  window.scrollBy({ top: r.top - window.innerHeight / 3, behavior: 'smooth' })
  return true
}
