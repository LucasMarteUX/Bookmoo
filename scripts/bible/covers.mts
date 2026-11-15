// Capas e banner da coleção "Bible Stories for Beginners" (arte gerada no ChatGPT).
//   npx tsx scripts/bible/covers.mts convert          converte a pasta de origem em content/bible/covers e no banner da coleção
//   npx tsx scripts/bible/covers.mts apply [--run]    grava cover_data/cover_thumb dos livros já publicados e o banner da coleção
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'
import { ITEMS } from './books.mts'
const ROOT = '/Users/lucasmarte/Desktop/BOOKMOO'
const SRC = '/Users/lucasmarte/Downloads/Capas e banner'
const OUT = join(ROOT, 'content/bible/covers'); const BANNER_DIR = join(ROOT, 'content/collections/bible-stories-for-beginners')
const W = join(ROOT, 'content/bible/_work'); mkdirSync(W, { recursive: true }); mkdirSync(OUT, { recursive: true }); mkdirSync(BANNER_DIR, { recursive: true })
// número do livro (books.mts) -> arquivo de origem
const FILES: Record<number, string> = {
  1: 'O Mendigo Cego de Jericó', 2: 'Cristo no Coração da Tempestade', 3: 'Jovem Pastor no Vale Dourado', 4: 'Capa Ilustrada de Histórias Bíblicas',
  5: 'Mãe, Histórias do Antigo Testamento', 6: 'Bíblia em Silhueta Dourada', 7: 'Histórias da Mãe_ Novo Testamento', 8: 'Caravana Bíblica sob Céus Dourados',
  9: 'Histórias Bíblicas ao Amanhecer', 10: 'História Infantil da Bíblia em Luz', 11: 'Bíblia e Clássicos Religiosos na Biblioteca', 12: 'Histórias de Domingo na Colina',
  13: 'Capa Ilustrada da Vida de Cristo', 14: 'A Bíblia em Silhueta Dourada', 15: 'Hosanna_ Caminho de Luz', 16: 'A Terra Prometida ao Amanhecer', 17: 'Não temas_ Jesus sobre as águas',
}
const BANNER = 'Peregrinos sob a lua dourada'
const mode = process.argv[2]; const run = process.argv.includes('--run')
const q = (s: string) => { const t = 'bb' + Math.random().toString(36).slice(2, 8); return `$${t}$${s}$${t}$` }
const TN = "lower(replace(replace(b.title, '’', ''''), '‘', ''''))"
function exec(file: string) {
  const r = spawnSync('npx', ['-y', 'supabase@3.1.0', 'db', 'query', '--remote=ywnmeacpvmcuhzhshpwz', '--yes', '-f', file], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, cwd: ROOT })
  const raw = (r.stdout ?? '') + (r.stderr ?? ''); let json: any = null
  try { json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) } catch { /* */ }
  if (r.status !== 0 || json?.error) throw new Error(raw.slice(0, 600))
  return json
}
if (mode === 'convert') {
  for (const [n, name] of Object.entries(FILES)) {
    const f = join(SRC, name + '.webp'); if (!existsSync(f)) { console.log('FALTA', n, name); continue }
    await sharp(f).resize(600, 900, { fit: 'cover' }).jpeg({ quality: 90 }).toFile(join(OUT, `${n}.jpg`))
    await sharp(f).resize(320, 480, { fit: 'cover' }).webp({ quality: 72 }).toFile(join(OUT, `${n}-thumb.webp`))
    console.log('ok capa', n)
  }
  await sharp(join(SRC, BANNER + '.webp')).resize(1440, 600, { fit: 'cover', position: 'centre' }).webp({ quality: 86 }).toFile(join(BANNER_DIR, 'banner.webp'))
  console.log('ok banner')
} else if (mode === 'apply') {
  for (const it of ITEMS.filter(i => i.rights === 'APPROVED')) {
    const cover = 'data:image/jpeg;base64,' + readFileSync(join(OUT, `${it.n}.jpg`)).toString('base64')
    const thumb = 'data:image/webp;base64,' + readFileSync(join(OUT, `${it.n}-thumb.webp`)).toString('base64')
    const sql = `update public.catalog_books b set cover_data = ${q(cover)}, cover_thumb = ${q(thumb)} where ${TN} = ${q(it.title.toLowerCase())} and b.author = ${q(it.author)} and b.category = 'bible-stories' returning b.id, b.title, length(b.cover_data) as len;\n`
    const f = join(W, `cover-${it.n}.sql`); writeFileSync(f, sql)
    if (!run) { console.log('dry-run', it.n, it.title); continue }
    try { const j = exec(f); console.log(it.n, it.title, j?.rows?.[0] ? `ok (${j.rows[0].len} bytes)` : 'LIVRO NÃO ENCONTRADO') } catch (e: any) { console.log('FALHOU', it.n, e.message) }
  }
  const bd = 'data:image/webp;base64,' + readFileSync(join(BANNER_DIR, 'banner.webp')).toString('base64')
  const f = join(W, 'banner.sql'); writeFileSync(f, `update public.collections set banner_data = ${q(bd)} where slug = 'bible-stories-for-beginners' returning slug, length(banner_data) as len;\n`)
  if (!run) console.log('dry-run banner'); else try { console.log('banner', JSON.stringify(exec(f).rows)) } catch (e: any) { console.log('FALHOU banner', e.message) }
}
