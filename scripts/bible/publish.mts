// Gera (e, com --run, executa via CLI do Supabase já autenticada) a importação idempotente dos livros aprovados e a coleção.
//   npx tsx scripts/bible/publish.mts books [--run]   insere os livros aprovados que ainda não existem (título normalizado + autor)
//   npx tsx scripts/bible/publish.mts collection [--run]   cria/atualiza a coleção e associa os livros (sem tocar em livros existentes)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { ITEMS } from './books.mts'
const ROOT = '/Users/lucasmarte/Desktop/UPOONLY'
const W = join(ROOT, 'content/bible/_work'); mkdirSync(W, { recursive: true })
const run = process.argv.includes('--run'); const mode = process.argv[2]
const q = (s: string) => { const t = 'bb' + Math.random().toString(36).slice(2, 8); return `$${t}$${s}$${t}$` }
const TN = "lower(replace(replace(title, '’', ''''), '‘', ''''))"
function exec(file: string) {
  const r = spawnSync('npx', ['-y', 'supabase@3.1.0', 'db', 'query', '--remote=ywnmeacpvmcuhzhshpwz', '--yes', '-f', file], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, cwd: ROOT })
  const raw = (r.stdout ?? '') + (r.stderr ?? ''); let json: any = null
  try { json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) } catch { /* */ }
  if (r.status !== 0 || json?.error) throw new Error(raw.slice(0, 600))
  return json
}
const approved = ITEMS.filter(i => i.rights === 'APPROVED')
if (mode === 'books') {
  for (const it of approved) {
    const pages = readFileSync(join(ROOT, 'content/bible', String(it.gid), 'pages.json'), 'utf8')
    const cats = it.children ? "array['bible-stories','children']" : "array['bible-stories']"
    const sql = `insert into public.catalog_books (title, author, description, language_code, cefr_level, category, categories, pages, created_by)
select ${q(it.title)}, ${q(it.author)}, ${q(it.en + '\n\n' + it.pt)}, 'en', ${q(it.cefr)}, 'bible-stories', ${cats}, ${q(pages)}::jsonb, (select id from auth.users where lower(email) = 'lucasmarteux@gmail.com')
where not exists (select 1 from public.catalog_books where ${TN} = ${q(it.title.toLowerCase())})
returning id, title;
`
    const f = join(W, `book-${it.gid}.sql`); writeFileSync(f, sql)
    if (!run) { console.log(`dry-run ${it.gid} ${it.title} (${(sql.length / 1e6).toFixed(2)} MB)`); continue }
    try { const j = exec(f); console.log(it.gid, it.title, j?.rows?.[0]?.id ?? 'JA_EXISTIA (nada gravado)') } catch (e: any) { console.log('FALHOU', it.gid, e.message) }
  }
} else if (mode === 'collection') {
  const ordered = approved.filter(i => i.order).sort((a, b) => a.order! - b.order!)
  const desc = 'Explore timeless Bible stories while improving your English. Discover classic tales about faith, courage, kindness, and hope, with books organized by reading level.\n\nDescubra histórias bíblicas clássicas enquanto desenvolve seu inglês. Explore narrativas sobre fé, coragem, bondade e esperança, com livros organizados por nível de leitura.'
  const links = ordered.map((it, k) => `insert into public.collection_books (collection_id, book_id, sort_order)
select c.id, b.id, ${k + 1} from public.collections c, public.catalog_books b where c.slug = 'bible-stories-for-beginners' and ${TN.replace('title', 'b.title')} = ${q(it.title.toLowerCase())} and b.author = ${q(it.author)} and b.category = 'bible-stories'
on conflict (collection_id, book_id) do nothing;`).join('\n')
  const sql = `insert into public.collections (slug, title, description, author_name, category, language_code, is_featured, is_published)
values ('bible-stories-for-beginners', 'Bible Stories for Beginners', ${q(desc)}, 'Various authors', 'bible-stories', 'en', true, true)
on conflict (slug) do nothing;
${links}
select c.slug, (select count(*) from public.collection_books where collection_id = c.id) n from public.collections c where c.slug = 'bible-stories-for-beginners';
`
  const f = join(W, 'collection.sql'); writeFileSync(f, sql)
  if (!run) console.log(sql.slice(0, 1500)); else console.log(JSON.stringify(exec(f).rows))
}
