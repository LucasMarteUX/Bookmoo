// Descobre IDs no catálogo oficial do Project Gutenberg (pg_catalog.csv, baixado uma única vez) em vez de consultar APIs de terceiros.
//   npx tsx scripts/classics/gutenberg-catalog.mts <csv-de-livros> <n,n,...>
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './lib.mts'
const [csvFile, list] = process.argv.slice(2)
const CATALOG = join(ROOT, 'content', 'epubs', '_work', 'pg_catalog.csv')
if (!existsSync(CATALOG)) {
  const r = await fetch('https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv', { headers: { 'User-Agent': 'BookmooCatalog/1.0 (single catalog download)' }, signal: AbortSignal.timeout(180_000) })
  if (!r.ok) throw new Error('catálogo: HTTP ' + r.status)
  writeFileSync(CATALOG, await r.text()); console.log('catálogo baixado')
}
function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') q = false; else cur += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
    else if (c !== '\r') cur += c
  }
  return rows
}
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`´]/g, "'").replace(/[–—-]/g, ' ').replace(/[^a-z0-9' ]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
const base = (t: string) => norm(t.split(/[;:\n]/)[0]).replace(/^(the|a|an) /, '')
const cat = parseCsv(readFileSync(CATALOG, 'utf8')).slice(1).filter(r => r[1] === 'Text' && r[4] === 'en')
const wanted = readFileSync(csvFile, 'utf8').replace(/^﻿/, '').split(/\r?\n/).slice(1).filter(Boolean).map(l => {
  const f: string[] = []; let cur = '', q = false
  for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') q = false; else cur += c } else if (c === '"') q = true; else if (c === ',') { f.push(cur); cur = '' } else cur += c }
  f.push(cur); return { n: Number(f[0]), title: f[1], author: f[2] }
}).filter(r => new Set(list.split(',').map(Number)).has(r.n))
const found: Record<number, any> = {}
for (const w of wanted) {
  const last = norm(w.author).split(' ').pop()!
  const cands = cat.filter(r => base(r[3]) === base(w.title) && norm(r[5]).includes(last))
  console.log(String(w.n).padEnd(4), w.title.padEnd(46), cands.length ? cands.map(c => `PG#${c[0]}`).join(', ') : 'NÃO ESTÁ NO CATÁLOGO DO GUTENBERG')
  if (cands.length) found[w.n] = { id: Number(cands[0][0]), title: cands[0][3].replace(/\s+/g, ' '), authors: cands[0][5], alternatives: cands.map(c => Number(c[0])) }
}
writeFileSync(join(ROOT, 'content', 'epubs', '_work', 'gutenberg_found.json'), JSON.stringify(found, null, 2))
