// Cria/atualiza coleções e associa livros que JÁ existem na galeria (nunca duplica livro nem coleção).
//   npx tsx scripts/classics/collections-seed.mts seed      cria as coleções (rascunho) e vincula os livros encontrados
//   npx tsx scripts/classics/collections-seed.mts publish   coloca o banner e publica coleções com 2+ livros e banner pronto
//   npx tsx scripts/classics/collections-seed.mts status    mostra livros vinculados x planejados
// Idempotente: pode rodar quantas vezes quiser. Livros são resolvidos por título + sobrenome do autor.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { ROOT, SUPABASE_REF } from './lib.mts'

type Def = { slug: string; title: string; description: string; author: string; category: string; kind: 'series' | 'thematic'; books: [title: string, authorLast: string][] }
const DEFS: Def[] = [
  { slug: 'gothic-horror-classics', title: 'Gothic Horror Classics', author: 'Various authors', category: 'mystery', kind: 'thematic',
    description: 'Five landmark tales of gothic horror, from vampires and monsters to haunted houses and cursed plays, in their complete original text.',
    books: [['Dracula', 'Stoker'], ['Frankenstein', 'Shelley'], ['The Strange Case of Dr. Jekyll and Mr. Hyde', 'Stevenson'], ['The Turn of the Screw', 'James'], ['The King in Yellow', 'Chambers']] },
  { slug: 'h-g-wells-science-fiction', title: 'H. G. Wells — Science Fiction Collection', author: 'H. G. Wells', category: 'fantasy', kind: 'series',
    description: 'The scientific romances that helped invent modern science fiction: time travel, invisibility, Martian invaders, voyages to the Moon and more.',
    books: [['The Time Machine', 'Wells'], ['The Island of Doctor Moreau', 'Wells'], ['The Invisible Man', 'Wells'], ['The War of the Worlds', 'Wells'], ['The First Men in the Moon', 'Wells'], ['The Food of the Gods', 'Wells']] },
  { slug: 'wonderful-world-of-oz', title: 'The Wonderful World of Oz', author: 'L. Frank Baum', category: 'fantasy', kind: 'series',
    description: 'The fourteen original Oz novels by L. Frank Baum, in the order they were written, from Dorothy’s first journey to Glinda of Oz.',
    books: [['The Wonderful Wizard of Oz', 'Baum'], ['The Marvelous Land of Oz', 'Baum'], ['Ozma of Oz', 'Baum'], ['Dorothy and the Wizard in Oz', 'Baum'], ['The Road to Oz', 'Baum'], ['The Emerald City of Oz', 'Baum'], ['The Patchwork Girl of Oz', 'Baum'], ['Tik-Tok of Oz', 'Baum'], ['The Scarecrow of Oz', 'Baum'], ['Rinkitink in Oz', 'Baum'], ['The Lost Princess of Oz', 'Baum'], ['The Tin Woodman of Oz', 'Baum'], ['The Magic of Oz', 'Baum'], ['Glinda of Oz', 'Baum']] },
  { slug: 'anne-of-green-gables', title: 'Anne of Green Gables Collection', author: 'L. M. Montgomery', category: 'children', kind: 'series',
    description: 'The eight main Anne novels in the order of Anne’s life, from the orphan who arrives at Green Gables to the family of Ingleside.',
    books: [['Anne of Green Gables', 'Montgomery'], ['Anne of Avonlea', 'Montgomery'], ['Anne of the Island', 'Montgomery'], ['Anne of Windy Poplars', 'Montgomery'], ['Anne’s House of Dreams', 'Montgomery'], ['Anne of Ingleside', 'Montgomery'], ['Rainbow Valley', 'Montgomery'], ['Rilla of Ingleside', 'Montgomery']] },
  { slug: 'edgar-allan-poe', title: 'Edgar Allan Poe — Tales of Mystery & Horror', author: 'Edgar Allan Poe', category: 'mystery', kind: 'thematic',
    description: 'Poe’s short fiction, his only novel and his poems: the master of the macabre and the birth of the detective story.',
    books: [['Edgar Allan Poe: Short Fiction', 'Poe'], ['The Narrative of Arthur Gordon Pym of Nantucket', 'Poe'], ['Edgar Allan Poe: Poetry', 'Poe']] },
  { slug: 'barsoom', title: 'Barsoom — The Martian Collection', author: 'Edgar Rice Burroughs', category: 'fantasy', kind: 'series',
    description: 'John Carter’s planetary adventures on Barsoom, the dying red world of Mars: the original series by Edgar Rice Burroughs.',
    books: [['A Princess of Mars', 'Burroughs'], ['The Gods of Mars', 'Burroughs'], ['The Warlord of Mars', 'Burroughs'], ['Thuvia, Maid of Mars', 'Burroughs'], ['The Chessmen of Mars', 'Burroughs'], ['The Master Mind of Mars', 'Burroughs'], ['A Fighting Man of Mars', 'Burroughs'], ['Swords of Mars', 'Burroughs'], ['Synthetic Men of Mars', 'Burroughs'], ['Llana of Gathol', 'Burroughs'], ['John Carter of Mars', 'Burroughs']] },
  { slug: 'pellucidar', title: 'Pellucidar — The Lost World Collection', author: 'Edgar Rice Burroughs', category: 'fantasy', kind: 'series',
    description: 'A hollow world beneath our feet, lit by an eternal sun and ruled by prehistoric beasts: the Pellucidar series.',
    books: [['At the Earth’s Core', 'Burroughs'], ['Pellucidar', 'Burroughs'], ['Tanar of Pellucidar', 'Burroughs'], ['Tarzan at the Earth’s Core', 'Burroughs'], ['Back to the Stone Age', 'Burroughs'], ['Land of Terror', 'Burroughs'], ['Savage Pellucidar', 'Burroughs']] },
  { slug: 'arsene-lupin', title: 'Arsène Lupin — Gentleman Thief', author: 'Maurice Leblanc', category: 'mystery', kind: 'series',
    description: 'The elegant master thief of belle-époque Paris, and his duels with the great detectives, in early English translations.',
    books: [['The Extraordinary Adventures of Arsène Lupin, Gentleman-Burglar', 'Leblanc'], ['Arsène Lupin Versus Herlock Sholmes', 'Leblanc'], ['The Hollow Needle', 'Leblanc']] },
  { slug: 'jules-verne', title: 'Jules Verne — Extraordinary Voyages', author: 'Jules Verne', category: 'adventure', kind: 'thematic',
    description: 'Journeys to the center of the Earth, under the sea, around the world and to the Moon: six of Verne’s most famous Extraordinary Voyages.',
    books: [['Journey to the Center of the Earth', 'Verne'], ['Twenty Thousand Leagues under the Seas', 'Verne'], ['Around the World in Eighty Days', 'Verne'], ['The Mysterious Island', 'Verne'], ['From the Earth to the Moon', 'Verne'], ['In Search of the Castaways', 'Verne']] },
  { slug: 'lovecraft', title: 'H. P. Lovecraft — Cosmic Horror', author: 'H. P. Lovecraft', category: 'mystery', kind: 'thematic',
    description: 'The founder of cosmic horror: short fiction, the Antarctic expedition of At the Mountains of Madness, and the dark case of Charles Dexter Ward.',
    books: [['H. P. Lovecraft: Short Fiction', 'Lovecraft'], ['At the Mountains of Madness', 'Lovecraft'], ['The Case of Charles Dexter Ward', 'Lovecraft']] },
]

const mode = process.argv[2]
const q = (s: string) => { const tag = 'cs' + Math.random().toString(36).slice(2, 7); return `$${tag}$${s}$${tag}$` }
const low = (s: string) => s.replace(/[’‘]/g, "'").toLowerCase()
const bookId = (title: string, last: string) => `(select id from public.catalog_books where lower(replace(replace(title, '’', ''''), '‘', '''')) = ${q(low(title))} and lower(author) like ${q('%' + last.toLowerCase() + '%')} limit 1)`

function run(sql: string) {
  const file = join(ROOT, 'content', 'epubs', '_work', 'cseed.sql'); writeFileSync(file, sql)
  const r = spawnSync('npx', ['-y', 'supabase@3.1.0', 'db', 'query', `--remote=${SUPABASE_REF}`, '--yes', '-f', file], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, cwd: ROOT })
  const raw = (r.stdout ?? '') + (r.stderr ?? '')
  const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1) || 'null')
  if (r.status !== 0 || json?.error) throw new Error(raw.slice(0, 600))
  return json?.rows ?? []
}

if (mode === 'seed') {
  const sql = DEFS.map(d => `insert into public.collections (slug, title, description, author_name, category, language_code, is_featured, is_published)
values (${q(d.slug)}, ${q(d.title)}, ${q(d.description)}, ${q(d.author)}, ${q(d.category)}, 'en', false, false) on conflict (slug) do nothing;
${d.books.map(([t, last], i) => `insert into public.collection_books (collection_id, book_id, sort_order)
select (select id from public.collections where slug = ${q(d.slug)}), ${bookId(t, last)}, ${i + 1}
where ${bookId(t, last)} is not null on conflict (collection_id, book_id) do nothing;`).join('\n')}`).join('\n') + '\nselect 1 as ok;'
  run(sql); console.log('Coleções criadas/atualizadas e livros existentes vinculados.')
}
if (mode === 'publish') {
  const replace = process.argv.includes('--replace-banner')
  for (const d of [...DEFS, ...(replace ? [{ slug: 'sherlock-holmes' } as Def] : [])]) {
    const banner = join(ROOT, 'content', 'collections', d.slug, 'banner.webp')
    if (!existsSync(banner)) {
      if (process.argv.includes('--sem-banner')) {
        const rows = run(`update public.collections c set is_published = true, is_featured = true where c.slug = ${q(d.slug)} and (select count(*) from public.collection_books where collection_id = c.id) >= 2;
select slug, is_published, (select count(*) from public.collection_books where collection_id = c.id) n from public.collections c where slug = ${q(d.slug)};`)
        console.log(`✓ ${d.slug}: ${rows[0]?.n} livros, publicada=${rows[0]?.is_published} (sem banner; usa o fundo da paleta)`)
      } else console.log(`· ${d.slug}: sem banner ainda`)
      continue
    }
    const data = 'data:image/webp;base64,' + readFileSync(banner).toString('base64')
    const rows = run(`update public.collections set banner_data = ${replace ? q(data) : `coalesce(banner_data, ${q(data)})`} where slug = ${q(d.slug)};
update public.collections c set is_published = true, is_featured = true where c.slug = ${q(d.slug)} and (select count(*) from public.collection_books where collection_id = c.id) >= 2 and c.banner_data is not null;
select slug, is_published, (select count(*) from public.collection_books where collection_id = c.id) n from public.collections c where slug = ${q(d.slug)};`)
    console.log(`✓ ${d.slug}: ${rows[0]?.n} livros, publicada=${rows[0]?.is_published}`)
  }
}
if (mode === 'status') {
  const rows = run(`select c.slug, c.is_published, c.is_featured, (select count(*) from public.collection_books where collection_id = c.id) n, c.banner_data is not null as banner from public.collections c order by c.created_at;`)
  for (const d of DEFS) { const r = rows.find((x: any) => x.slug === d.slug); console.log(`${d.slug.padEnd(28)} ${String(r?.n ?? 0).padStart(2)}/${d.books.length} livros · banner ${r?.banner ? 'sim' : 'não'} · publicada ${r?.is_published ? 'sim' : 'não'}`) }
}
if (!['seed', 'publish', 'status'].includes(mode ?? '')) { console.error('uso: collections-seed.mts seed | publish | status'); process.exit(1) }
