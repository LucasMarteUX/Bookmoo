// Auditoria das coleções: lista os livros de cada coleção do Standard Ebooks e compara com a galeria.
//   npx tsx scripts/classics/audit.mts            gera content/collections/auditoria.json
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { ROOT, SUPABASE_REF } from './lib.mts'
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘`´]/g, "'").replace(/[“”]/g, '"').replace(/[–—-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()

const SOURCES: Record<string, { name: string; url: string }> = {
  'sherlock-holmes': { name: 'The Complete Sherlock Holmes Collection', url: 'https://standardebooks.org/collections/sherlock-holmes' },
  'oz': { name: 'The Wonderful World of Oz', url: 'https://standardebooks.org/collections/oz' },
  'barsoom': { name: 'Barsoom — The Martian Collection', url: 'https://standardebooks.org/collections/martian' },
  'anne-of-green-gables': { name: 'Anne of Green Gables Collection', url: 'https://standardebooks.org/collections/anne-of-green-gables' },
  'tarzan': { name: 'Tarzan — The Jungle Adventures', url: 'https://standardebooks.org/collections/tarzan' },
  'pellucidar': { name: 'Pellucidar — The Lost World Collection', url: 'https://standardebooks.org/collections/pellucidar' },
  'arsene-lupin': { name: 'Arsène Lupin — Gentleman Thief', url: 'https://standardebooks.org/collections/arsene-lupin' },
  'jules-verne': { name: 'Jules Verne — Extraordinary Voyages', url: 'https://standardebooks.org/collections/voyages-extraordinaires' },
  'poe': { name: 'Edgar Allan Poe', url: 'https://standardebooks.org/ebooks/edgar-allan-poe' },
  'lovecraft': { name: 'H. P. Lovecraft', url: 'https://standardebooks.org/ebooks/h-p-lovecraft' },
  'hg-wells': { name: 'H. G. Wells', url: 'https://standardebooks.org/ebooks/h-g-wells' },
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#8217;/g, '’')

async function listing(url: string) {
  const res = await fetch(url, { headers: { 'User-Agent': 'BookmooAudit/1.0 (educational, sequential)' }, signal: AbortSignal.timeout(60_000) })
  if (!res.ok) return { status: res.status, items: [] as { title: string; href: string }[] }
  const html = await res.text()
  const items: { title: string; href: string }[] = []
  for (const m of html.matchAll(/<li[^>]*typeof="schema:Book"[^>]*>[\s\S]*?<a href="(\/ebooks\/[^"]+)"[^>]*>[\s\S]*?<span property="schema:name">([^<]+)<\/span>/g)) items.push({ href: m[1], title: decode(m[2]) })
  if (!items.length) for (const m of html.matchAll(/<a href="(\/ebooks\/[a-z0-9-]+\/[a-z0-9-]+)"[^>]*>\s*(?:<[^>]+>\s*)*<span property="schema:name">([^<]+)</g)) items.push({ href: m[1], title: decode(m[2]) })
  return { status: res.status, items: items.filter((x, i, a) => a.findIndex(y => y.href === x.href) === i) }
}

function dbBooks() {
  const file = join(ROOT, 'content', 'epubs', '_work', 'audit.sql')
  writeFileSync(file, 'select id, title, author, cefr_level, category, jsonb_array_length(pages) np from public.catalog_books order by title;')
  const r = spawnSync('npx', ['-y', 'supabase@3.1.0', 'db', 'query', `--remote=${SUPABASE_REF}`, '--yes', '-f', file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, cwd: ROOT })
  const raw = (r.stdout ?? '') + (r.stderr ?? '')
  return JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)).rows as { id: string; title: string; author: string; cefr_level: string; category: string; np: number }[]
}

const books = dbBooks()
const out: any = { at: new Date().toISOString(), banco: books.length, colecoes: {} }
for (const [key, src] of Object.entries(SOURCES)) {
  const { status, items } = await listing(src.url)
  const rows = items.map(item => {
    const found = books.find(b => norm(b.title) === norm(item.title) || norm(b.title).replace(/^(the|a|an) /, '') === norm(item.title).replace(/^(the|a|an) /, ''))
    return { title: item.title, href: item.href, noBanco: found ? { id: found.id, title: found.title, level: found.cefr_level } : null }
  })
  out.colecoes[key] = { nome: src.name, fonte: src.url, httpStatus: status, total: rows.length, existentes: rows.filter(r => r.noBanco).length, livros: rows }
  console.log(`${key.padEnd(22)} HTTP ${status}  ${rows.length} livros na fonte, ${rows.filter(r => r.noBanco).length} já na galeria`)
  await sleep(1500)
}
writeFileSync(join(ROOT, 'content', 'collections', 'auditoria.json'), JSON.stringify(out, null, 2) + '\n')
