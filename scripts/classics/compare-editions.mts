// Compara edições alternativas do Gutenberg (palavras e documentos) com a que foi importada.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { unzipSync, strFromU8 } from 'fflate'
import { ROOT } from './lib.mts'
const found = JSON.parse(readFileSync(join(ROOT, 'content', 'epubs', '_work', 'gutenberg_found.json'), 'utf8'))
const dir = join(ROOT, 'content', 'epubs'); const dirs = readdirSync(dir)
const cache = join(dir, '_work', 'alt'); mkdirSync(cache, { recursive: true })
const stat = (bytes: Uint8Array) => {
  const z = unzipSync(bytes); let words = 0, docs = 0
  for (const [name, data] of Object.entries(z)) if (/\.x?html$/.test(name) && !/nav|toc|cover|wrap|pg-header|pg-footer/i.test(name)) { docs++; words += strFromU8(data).replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length }
  return { words, docs, bytes: bytes.length }
}
for (const [n, info] of Object.entries<any>(found)) {
  const d = dirs.find(x => x.startsWith(n + '-')); if (!d) continue
  const st = JSON.parse(readFileSync(join(dir, d, 'status.json'), 'utf8'))
  const alts = (info.alternatives as number[]).filter(id => id !== info.id)
  for (const id of alts) {
    const f = join(cache, `${id}.epub`)
    if (!existsSync(f)) {
      const r = await fetch(`https://www.gutenberg.org/ebooks/${id}.epub.noimages`, { headers: { 'User-Agent': 'BookmooCompare/1.0 (low rate)' }, signal: AbortSignal.timeout(90_000) })
      if (!r.ok) { console.log(n, 'alt', id, 'HTTP', r.status); continue }
      writeFileSync(f, new Uint8Array(await r.arrayBuffer())); await new Promise(res => setTimeout(res, 4000))
    }
    const a = stat(new Uint8Array(readFileSync(f)))
    console.log(`${n} ${st.title ?? ''}`.slice(0, 40).padEnd(40), `importada PG#${info.id}: ${st.words ?? '?'} palavras, ${st.chapters ?? '?'} docs | alternativa PG#${id}: ${a.words} palavras, ${a.docs} docs`)
  }
}
