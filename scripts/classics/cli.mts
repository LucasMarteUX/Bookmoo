// Pipeline reutilizável dos clássicos A1.
//   npx tsx scripts/classics/cli.mts status                 fila e andamento
//   npx tsx scripts/classics/cli.mts validate <slug>        validação editorial/técnica do manuscrito
//   npx tsx scripts/classics/cli.mts build <slug>           capa + EPUB 3 + EPUBCheck + conferência de ida e volta
//   npx tsx scripts/classics/cli.mts publish <slug> [--run] gera o SQL (sem --run) ou publica na galeria (com --run)
//   npx tsx scripts/classics/cli.mts verify <slug>          confere no banco que o livro está publicado e íntegro
// Retoma sozinho: cada etapa grava em content/classics/<slug>/status.json e `build` só refaz o que falhou.
// A publicação usa a CLI do Supabase já autenticada do desenvolvedor (nunca service role em arquivo).
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'
import {
  ROOT, SUPABASE_REF, loadBook, loadQueue, loadStatus, saveStatus, validateBook, buildEpub, readEpubBack, bookPages, bookText,
  bookDir, buildDir, epubName, readingMinutes, type Book,
} from './lib.mts'

const [cmd, slug, ...flags] = process.argv.slice(2)
const log = (...a: unknown[]) => console.log(...a)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function fail(msg: string): never { console.error('ERRO:', msg); process.exit(1) }

function printChecks(checks: ReturnType<typeof validateBook>) {
  for (const c of checks) log(`${c.level === 'error' ? '✗' : c.level === 'warn' ? '!' : '·'} ${c.msg}`)
  return checks.filter(c => c.level === 'error').length
}

/* ---------- Capa ---------- */
function wrap(text: string, max: number) {
  const lines: string[] = []; let cur = ''
  for (const w of text.split(/\s+/)) { if ((cur + ' ' + w).trim().length > max) { lines.push(cur); cur = w } else cur = (cur + ' ' + w).trim() }
  if (cur) lines.push(cur)
  return lines
}
async function makeCover(book: Book) {
  const { meta } = book
  const artFile = join(bookDir(meta.slug), 'cover-art.svg')
  if (!existsSync(artFile)) fail('cover-art.svg ausente (arte da capa, viewBox 1024x830)')
  const art = readFileSync(artFile, 'utf8').replace(/<\?xml[^>]*>/, '').replace(/<svg([^>]*)>/, '<svg x="0" y="190" width="1024" height="830"$1>')
  const [main, sub] = meta.title.split(/:\s*/)
  let mainLines = wrap(main, 16)
  if (mainLines.length > 2) mainLines = wrap(main, 21)
  const longest = Math.max(...mainLines.map(l => l.length))
  const size = Math.min(mainLines.length > 2 ? 92 : 104, Math.floor(880 / (longest * 0.6)))
  const titleSvg = mainLines.map((l, i) => `<text x="512" y="${1070 + i * (size + 8)}" font-size="${size}" font-weight="700" text-anchor="middle" fill="${meta.cover.paper}" font-family="Georgia, 'Times New Roman', serif">${esc(l)}</text>`).join('')
  const subY = 1070 + mainLines.length * (size + 8) - 6
  const subSvg = sub ? wrap(sub, 30).map((l, i) => `<text x="512" y="${subY + 56 + i * 52}" font-size="44" font-style="italic" text-anchor="middle" fill="${meta.cover.accent === '#c8372d' ? '#f2b8b1' : meta.cover.paper}" font-family="Georgia, 'Times New Roman', serif">${esc(l)}</text>`).join('') : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${meta.cover.bg1}"/><stop offset="1" stop-color="${meta.cover.bg2}"/></linearGradient><clipPath id="artclip"><rect x="0" y="190" width="928" height="760" rx="8"/></clipPath></defs>
<rect width="1024" height="1536" fill="url(#bg)"/>
<rect x="24" y="24" width="976" height="1488" fill="none" stroke="${meta.cover.paper}" stroke-width="3" opacity=".9"/>
<rect x="36" y="36" width="952" height="1464" fill="none" stroke="${meta.cover.paper}" stroke-width="1" opacity=".5"/>
<text x="512" y="100" font-size="34" letter-spacing="10" text-anchor="middle" fill="${meta.cover.paper}" font-family="Georgia, serif" opacity=".95">BOOKMOO CLASSICS</text>
<text x="512" y="148" font-size="26" letter-spacing="6" text-anchor="middle" fill="${meta.cover.accent === '#c8372d' ? '#f2b8b1' : meta.cover.paper}" font-family="Georgia, serif">GRADED READER · ${meta.level}</text>
<g clip-path="url(#artclip)" transform="translate(48,0)"><svg x="0" y="190" width="928" height="760" viewBox="0 0 1024 830" preserveAspectRatio="xMidYMid slice">${art.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</svg></g>
<rect x="48" y="190" width="928" height="760" rx="8" fill="none" stroke="${meta.cover.paper}" stroke-width="3"/>
${titleSvg}${subSvg}
<line x1="312" y1="1400" x2="712" y2="1400" stroke="${meta.cover.accent}" stroke-width="4"/>
<text x="512" y="1452" font-size="${Math.min(40, Math.floor(880 / (meta.author.length * 0.78)))}" letter-spacing="4" text-anchor="middle" fill="${meta.cover.paper}" font-family="Georgia, serif">${esc(meta.author.toUpperCase())}</text>
</svg>`
  const dir = buildDir(meta.slug)
  writeFileSync(join(dir, 'cover.svg'), svg)
  const jpg = await sharp(Buffer.from(svg), { density: 144 }).resize(1024, 1536).jpeg({ quality: 88, mozjpeg: true }).toBuffer()
  const thumb = await sharp(jpg).resize(320).webp({ quality: 72 }).toBuffer()
  writeFileSync(join(dir, 'cover.jpg'), jpg)
  writeFileSync(join(dir, 'cover-thumb.webp'), thumb)
  return { jpg, thumb }
}

/* ---------- Comandos ---------- */
async function status() {
  const q = loadQueue()
  log('n  livro                                   cap  palavras  glos  capa  epub  valid  publicado')
  for (const b of q) {
    const st = loadStatus(b.slug); const s = st.stages ?? {}
    const f = (x: any) => (x?.ok ? '✓' : x ? '✗' : '·')
    log(`${String(b.n).padStart(2)} ${b.title.slice(0, 38).padEnd(38)} ${String(st.chapters ?? '-').padStart(4)} ${String(st.storyWords ?? '-').padStart(8)} ${String(st.glossary ?? '-').padStart(5)}    ${f(s.cover)}     ${f(s.epub)}     ${f(s.validated)}     ${s.published?.ok ? 'sim ' + s.published.id : st.blocked ? 'BLOQUEADO' : 'não'}`)
  }
}

async function validate() {
  const book = loadBook(slug)
  const errors = printChecks(validateBook(book))
  saveStatus(slug, { chapters: book.chapters.length, storyWords: book.storyWords, glossary: book.glossary.length, stages: { manuscript: { ok: errors === 0, at: new Date().toISOString() } } })
  if (errors) fail(`${errors} erro(s) crítico(s): publicação bloqueada.`)
  log('Manuscrito válido.')
}

async function build() {
  const book = loadBook(slug)
  const errors = printChecks(validateBook(book))
  if (errors) { saveStatus(slug, { stages: { manuscript: { ok: false } } }); fail('Manuscrito com erros críticos.') }
  const { jpg, thumb } = await makeCover(book)
  saveStatus(slug, { stages: { cover: { ok: true, jpgBytes: jpg.length, thumbBytes: thumb.length } } })
  log(`Capa: ${(jpg.length / 1024).toFixed(0)} KB (jpeg), miniatura ${(thumb.length / 1024).toFixed(0)} KB (webp)`)
  const bytes = buildEpub(book, jpg)
  const out = join(buildDir(slug), epubName(slug))
  writeFileSync(out, bytes)
  log(`EPUB: ${out} (${(bytes.length / 1024).toFixed(0)} KB)`)
  // ida e volta: cada capítulo do EPUB tem de conter exatamente o manuscrito
  const back = readEpubBack(bytes)
  const probs: string[] = []
  if (!back.mimetypeFirst) probs.push('mimetype não é o primeiro item')
  for (const c of book.chapters) {
    const doc = back.docs.find(d => d.href === `chapter-${String(c.n).padStart(2, '0')}.xhtml`)
    if (!doc) { probs.push(`capítulo ${c.n} ausente da spine`); continue }
    const inEpub = doc.text.split('\n').filter(Boolean)
    for (const p of c.paragraphs) if (!inEpub.includes(p)) probs.push(`capítulo ${c.n}: parágrafo diferente/ausente: ${p.slice(0, 40)}…`)
    if (!back.nav.includes(`chapter-${String(c.n).padStart(2, '0')}.xhtml`)) probs.push(`capítulo ${c.n} fora do sumário`)
  }
  for (const need of ['cover.xhtml', 'title.xhtml', 'edition.xhtml', 'glossary.xhtml', 'adaptation.xhtml', 'credits.xhtml']) if (!back.docs.some(d => d.href === need)) probs.push(`${need} ausente`)
  if (!back.entries.includes('OEBPS/images/cover.jpg')) probs.push('capa ausente')
  if (/(?:src|href)="https?:\/\//.test(back.docs.map(d => d.html).join(''))) probs.push('recurso remoto encontrado no XHTML')
  const gl = back.docs.find(d => d.href === 'glossary.xhtml')?.text ?? ''
  for (const g of book.glossary) if (!gl.includes(g.term)) probs.push(`glossário sem ${g.term}`)
  if (probs.length) { probs.forEach(p => log('✗', p)); saveStatus(slug, { stages: { epub: { ok: false, problems: probs } } }); fail('Conferência do EPUB falhou.') }
  log('Conferência de ida e volta: ok (capítulos, glossário, sumário, capa).')
  // EPUBCheck
  const chk = spawnSync('epubcheck', [out, '--json', join(buildDir(slug), 'epubcheck.json')], { encoding: 'utf8' })
  const report = existsSync(join(buildDir(slug), 'epubcheck.json')) ? JSON.parse(readFileSync(join(buildDir(slug), 'epubcheck.json'), 'utf8')) : null
  const fatal = report?.items?.filter((m: any) => m.severity === 'FATAL' || m.severity === 'ERROR') ?? []
  const warns = report?.items?.filter((m: any) => m.severity === 'WARNING') ?? []
  log(`EPUBCheck ${report?.checker?.checkerVersion ?? ''}: ${fatal.length} erro(s), ${warns.length} aviso(s)`)
  for (const m of [...fatal, ...warns].slice(0, 15)) log(`  [${m.severity}] ${m.ID}: ${m.message} (${m.locations?.[0]?.path ?? ''})`)
  if (!report) log(chk.stderr || chk.stdout)
  const ok = !!report && fatal.length === 0
  const pages = bookPages(book)
  saveStatus(slug, {
    chapters: book.chapters.length, storyWords: book.storyWords, glossary: book.glossary.length, pages: pages.length,
    readingMinutes: readingMinutes(book.storyWords, book.meta.readingWpm),
    stages: { epub: { ok, file: `content/classics/${slug}/build/${epubName(slug)}`, bytes: bytes.length, epubcheck: { errors: fatal.length, warnings: warns.length } }, validated: { ok, at: new Date().toISOString() } },
  })
  if (!ok) fail('EPUBCheck reprovou.')
  log(`Pronto para publicar: ${pages.length} páginas de leitura.`)
}

const q$ = (s: string) => { const tag = 'bk' + Math.random().toString(36).slice(2, 8); if (s.includes(`$${tag}$`)) throw new Error('tag'); return `$${tag}$${s}$${tag}$` }

function dbQuery(sqlFile: string) {
  const r = spawnSync('npx', ['-y', 'supabase@3.1.0', 'db', 'query', `--remote=${SUPABASE_REF}`, '--yes', '-f', sqlFile], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, cwd: ROOT })
  const raw = (r.stdout ?? '') + (r.stderr ?? '')
  const i = raw.indexOf('{')
  let json: any = null
  try { json = JSON.parse(raw.slice(i, raw.lastIndexOf('}') + 1)) } catch { /* saída fora do padrão */ }
  return { ok: r.status === 0 && json && !json.error, json, raw: raw.length > 1500 ? raw.slice(0, 1500) : raw }
}

async function publish() {
  const book = loadBook(slug)
  const st = loadStatus(slug)
  if (!st.stages?.validated?.ok || !st.stages?.epub?.ok) fail('Rode `build` antes: EPUB/validação ainda não aprovados.')
  if (book.meta.blocked) fail(`Livro bloqueado: ${book.meta.blocked}`)
  const dir = buildDir(slug)
  const cover = 'data:image/jpeg;base64,' + readFileSync(join(dir, 'cover.jpg')).toString('base64')
  const thumb = 'data:image/webp;base64,' + readFileSync(join(dir, 'cover-thumb.webp')).toString('base64')
  const pages = bookPages(book)
  const title = book.meta.galleryTitle
  const update = flags.includes('--update')
  const sql = update ? `update public.catalog_books set author = ${q$(book.meta.author)}, description = ${q$(book.meta.descriptionEn)}, cover_data = ${q$(cover)}, cover_thumb = ${q$(thumb)}, cefr_level = ${q$(book.meta.level)}, category = ${q$(book.meta.category)}, pages = ${q$(JSON.stringify(pages))}::jsonb
  where lower(title) = lower(${q$(title)}) returning id, title;
` : `do $$ begin
  if exists (select 1 from public.catalog_books where lower(title) = lower(${q$(title)})) then raise exception 'ja_existe: ${title.replace(/'/g, "''")}'; end if;
  if (select count(*) from auth.users where lower(email) = 'lucasmarteux@gmail.com') <> 1 then raise exception 'admin_nao_encontrado'; end if;
end $$;
insert into public.catalog_books (title, author, description, language_code, cover_data, cover_thumb, cefr_level, category, pages, created_by)
values (${q$(title)}, ${q$(book.meta.author)}, ${q$(book.meta.descriptionEn)}, 'en', ${q$(cover)}, ${q$(thumb)}, ${q$(book.meta.level)}, ${q$(book.meta.category)},
  ${q$(JSON.stringify(pages))}::jsonb, (select id from auth.users where lower(email) = 'lucasmarteux@gmail.com'))
returning id, title;
`
  const file = join(dir, 'publish.sql')
  writeFileSync(file, sql)
  log(`SQL gerado (${(sql.length / 1024).toFixed(0)} KB): ${pages.length} páginas, categoria ${book.meta.category}, nível ${book.meta.level}.`)
  if (!flags.includes('--run')) return log('Dry-run. Use --run para publicar (escreve na produção); --update atualiza um livro já publicado, sem duplicar.')
  const r = dbQuery(file)
  if (!r.ok && r.raw.includes('ja_existe')) { log('Já existe na galeria: não duplica, só verifica.'); return verify() }
  if (!r.ok) { saveStatus(slug, { stages: { published: { ok: false, error: r.raw.slice(0, 400) } } }); fail('Publicação falhou: ' + r.raw.slice(0, 400)) }
  const row = r.json?.rows?.[0]
  log('Inserido:', row)
  saveStatus(slug, { stages: { published: { ok: false, id: row?.id, at: new Date().toISOString(), note: 'inserido; falta verificar' } } })
  await verify()
}

async function verify() {
  const book = loadBook(slug)
  const pages = bookPages(book)
  const sql = `select id, title, author, cefr_level, category, jsonb_array_length(pages) as np, (cover_data like 'data:image/jpeg%') as cover_ok, (cover_thumb like 'data:image/webp%') as thumb_ok, length(cover_data) as cover_len, md5(pages::text) as pages_md5, created_at from public.catalog_books where lower(title) = lower(${q$(book.meta.galleryTitle)});`
  const f = join(buildDir(slug), 'verify.sql'); writeFileSync(f, sql)
  const r = dbQuery(f)
  if (!r.ok) fail('Consulta falhou: ' + r.raw)
  const rows = r.json?.rows ?? []
  if (rows.length !== 1) { saveStatus(slug, { stages: { published: { ok: false, error: `${rows.length} registros com o título` } } }); fail(`Esperava 1 registro, achei ${rows.length}`) }
  const row = rows[0]
  const problems: string[] = []
  if (row.np !== pages.length) problems.push(`páginas: banco ${row.np} ≠ local ${pages.length}`)
  if (row.cefr_level !== book.meta.level) problems.push(`nível não é ${book.meta.level}`)
  if (row.category !== book.meta.category) problems.push('categoria diferente')
  if (!row.cover_ok || !row.thumb_ok) problems.push('capa/miniatura ausentes')
  log('No banco:', { id: row.id, title: row.title, author: row.author, level: row.cefr_level, category: row.category, pages: row.np, createdAt: row.created_at })
  if (problems.length) { problems.forEach(p => log('✗', p)); saveStatus(slug, { stages: { published: { ok: false, id: row.id, problems } } }); fail('Verificação reprovou.') }
  saveStatus(slug, { stages: { published: { ok: true, id: row.id, at: new Date().toISOString(), verifiedPages: row.np } } })
  log(`Verificado: publicado e íntegro. Link interno: /gallery/${row.id}`)
}

const commands: Record<string, () => Promise<void>> = { status, validate, build, publish, verify }
if (!cmd || !commands[cmd]) fail('uso: cli.mts status | validate|build|publish|verify <slug> [--run]')
if (cmd !== 'status' && !slug) fail('informe o slug do livro')
await commands[cmd]()
void bookText
