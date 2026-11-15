import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { validateEpubStructure, extractBook } from './epub-lib.mts'
const ROOT = '/Users/lucasmarte/Desktop/BOOKMOO/content/bible'
const ids = process.argv.slice(2)
const syl = (w: string) => { w = w.toLowerCase().replace(/[^a-z]/g, ''); if (!w) return 0; const m = w.replace(/e$/, '').match(/[aeiouy]+/g); return Math.max(1, m?.length ?? 1) }
for (const id of ids) {
  const bytes = new Uint8Array(readFileSync(join(ROOT, 'epub', id + '.epub')))
  const v = validateEpubStructure(bytes)
  if (v.problems.length) { console.log(id, 'INVALIDO', v.problems); continue }
  const b = extractBook(v.files, v.opfPath!, v.opf!)
  const words = b.text.match(/[A-Za-z’']+/g) ?? []
  const sents = b.text.split(/[.!?]+["”’']?\s/).filter(s => s.trim().length > 0)
  const wps = words.length / sents.length
  const spw = words.reduce((a, w) => a + syl(w), 0) / words.length
  const fk = 0.39 * wps + 11.8 * spw - 15.59
  const long = words.filter(w => w.length >= 7).length / words.length
  const arch = (b.text.match(/\b(thee|thou|thy|thine|hath|doth|unto|ye|saith|wherefore|behold|verily|lo)\b/gi) ?? []).length / words.length * 1000
  const uniq = new Set(words.map(w => w.toLowerCase())).size
  mkdirSync(join(ROOT, id), { recursive: true })
  writeFileSync(join(ROOT, id, 'text.txt'), b.text)
  writeFileSync(join(ROOT, id, 'pages.json'), JSON.stringify(b.pages))
  // títulos de capítulo: linhas curtas isoladas em caixa alta ou "Chapter"
  const lines = b.text.split('\n\n')
  const heads = lines.filter(l => l.length < 80 && (/^(chapter|part|book|story|lesson|section)\b/i.test(l) || (/^[A-Z0-9 ,.'’:;!?-]{4,}$/.test(l) && /[A-Z]{3}/.test(l))))
  console.log(JSON.stringify({ id, title: b.title, author: b.author, lang: b.language, date: b.date, contrib: b.contributors, rights: b.rights, words: b.words, pages: b.pages.length, docs: b.chapters, heads: heads.length, wps: +wps.toFixed(1), spw: +spw.toFixed(2), fk: +fk.toFixed(1), long: +(long*100).toFixed(1), archPer1k: +arch.toFixed(1), uniq, first: b.text.slice(0, 160).replace(/\n+/g, ' | '), last: b.text.slice(-160).replace(/\n+/g, ' | ') }))
}
