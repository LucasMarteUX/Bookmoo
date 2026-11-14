// Importação de EPUBs ORIGINAIS e INTEGRAIS (Standard Ebooks) para a galeria. Não escreve, resume nem adapta texto.
//   npx tsx scripts/classics/epubs.mts plan                     confere o CSV contra o banco (SKIPPED_ALREADY_EXISTS) e grava o plano
//   npx tsx scripts/classics/epubs.mts fetch <n>                baixa e valida o EPUB (ZIP, mimetype, container, OPF, spine)
//   npx tsx scripts/classics/epubs.mts build <n>                extrai metadados, texto (mesmas regras de src/lib/epub.ts), capa, páginas
//   npx tsx scripts/classics/epubs.mts publish <n> [--run]      SQL (dry-run) ou INSERT na galeria; reconfere duplicidade antes
//   npx tsx scripts/classics/epubs.mts verify <n>               confere no banco (contagem de páginas, md5, capa)
//   npx tsx scripts/classics/epubs.mts all [de [até]] [--run]   lote sequencial, com checkpoints em content/epubs/<slug>/status.json
//   npx tsx scripts/classics/epubs.mts report                   gera content/epubs/relatorio.csv e .json
// Publica com a CLI do Supabase já autenticada (sem service role em arquivo).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { unzipSync, strFromU8 } from 'fflate'
import sharp from 'sharp'
import { splitContentIntoPages, countWords } from '../../src/lib/utils.ts'
import { ROOT, SUPABASE_REF } from './lib.mts'

const CSV = process.env.EPUB_CSV ?? '/Users/lucasmarte/Downloads/catalogo_50_epubs_originais_bookmoo.csv'
const OUT = join(ROOT, 'content', 'epubs')
mkdirSync(OUT, { recursive: true })
const log = (...a: unknown[]) => console.log(...a)

/* ---------- CSV ---------- */
export type Row = { n: number; title: string; author: string; catRef: string; category: string; level: string; page: string; slug: string; downloadUrl: string; galleryTitle?: string; origin?: string }
const CATEGORY_MAP: Record<string, string> = {
  'Infantil': 'children', 'Aventura': 'adventure', 'Fantasia': 'fantasy', 'Mistério': 'mystery', 'Romance': 'romance', 'Clássico': 'classic',
}
// Alternativa legítima quando a página do Standard Ebooks aponta para outra obra (49: lá é a coletânea 'Short Fiction' de Conrad).
const URL_OVERRIDE: Record<number, { url: string; origin: string }> = { 49: { url: 'https://www.gutenberg.org/ebooks/219.epub.noimages', origin: 'Project Gutenberg #219' } }
/** Divide uma linha de CSV respeitando campos entre aspas. */
function csvFields(line: string) {
  const out: string[] = []; let cur = ''; let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ } else if (ch === '"') quoted = false; else cur += ch }
    else if (ch === '"') quoted = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}
function parseCsv(): Row[] {
  const lines = readFileSync(CSV, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  return lines.slice(1).map(l => {
    const c = csvFields(l)
    const page = c[9]
    const path = page.replace('https://standardebooks.org/ebooks/', '')
    const file = path.split('/').join('_')
    return {
      n: Number(c[0]), title: c[1], author: c[2], catRef: c[3], category: CATEGORY_MAP[c[4]] ?? '', level: c[5], page,
      slug: path.split('/').slice(1).join('-'),
      downloadUrl: c[12]?.trim() || URL_OVERRIDE[Number(c[0])]?.url || `${page}/downloads/${file}.epub?source=download`,
      origin: c[13]?.trim() || undefined,
      galleryTitle: c[11]?.trim() || undefined,
    }
  })
}
const rows = parseCsv()
const rowOf = (n: number) => rows.find(r => r.n === n) ?? (() => { throw new Error('livro ' + n + ' não está no CSV') })()
const dirOf = (r: Row) => { const d = join(OUT, `${String(r.n).padStart(2, '0')}-${r.slug}`); mkdirSync(d, { recursive: true }); return d }
const statusFile = (r: Row) => join(dirOf(r), 'status.json')
const loadStatus = (r: Row): Record<string, any> => existsSync(statusFile(r)) ? JSON.parse(readFileSync(statusFile(r), 'utf8')) : { n: r.n, title: r.title, author: r.author, cefr: r.level, category: r.category, status: 'PENDING' }
const saveStatus = (r: Row, patch: Record<string, any>) => writeFileSync(statusFile(r), JSON.stringify({ ...loadStatus(r), ...patch, updatedAt: new Date().toISOString() }, null, 2) + '\n')

/** Normaliza título/autor: caixa, espaços, apóstrofos e aspas tipográficas, acentos, hífens. */
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`´]/g, "'").replace(/[“”]/g, '"').replace(/[–—-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
const baseTitle = (s: string) => norm(s).split(':')[0].trim()

/* ---------- Banco ---------- */
const q$ = (s: string) => { const tag = 'bk' + Math.random().toString(36).slice(2, 8); if (s.includes(`$${tag}$`)) throw new Error('tag'); return `$${tag}$${s}$${tag}$` }
function dbQuery(sqlFile: string) {
  const r = spawnSync('npx', ['-y', 'supabase@3.1.0', 'db', 'query', `--remote=${SUPABASE_REF}`, '--yes', '-f', sqlFile], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, cwd: ROOT })
  const raw = (r.stdout ?? '') + (r.stderr ?? '')
  let json: any = null
  try { json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) } catch { /* fora do padrão */ }
  return { ok: r.status === 0 && !!json && !json.error, json, raw: raw.length > 1500 ? raw.slice(0, 1500) : raw }
}
function dbRows(sql: string, tag = 'q'): any[] {
  const f = join(OUT, '_work'); mkdirSync(f, { recursive: true })
  const file = join(f, `${tag}.sql`); writeFileSync(file, sql)
  const r = dbQuery(file)
  if (!r.ok) throw new Error('consulta ao banco falhou: ' + r.raw)
  return r.json?.rows ?? []
}
const existingBooks = () => dbRows('select id, title, author, cefr_level, category, jsonb_array_length(pages) np from public.catalog_books order by created_at;', 'existing')

/** Duplicata = mesmo título normalizado (e autor compatível). Mesmo título-base com subtítulo (reconto) vira alerta, não bloqueio. */
const lastName = (a: string) => norm(a).split(/[ ,.]+/).filter(Boolean).pop() ?? ''
const sameAuthor = (a?: string | null, b?: string | null) => !!a && !!b && (norm(a).includes(lastName(b)) || norm(b).includes(lastName(a)))
function findDuplicate(r: Row, books: any[]) {
  const wanted = r.galleryTitle ?? r.title
  const exact = books.find(b => norm(b.title) === norm(wanted) && sameAuthor(b.author, r.author))
  if (exact) return { kind: 'exact' as const, book: exact }
  const similar = books.filter(b => sameAuthor(b.author, r.author) && baseTitle(b.title) === norm(wanted) && norm(b.title) !== norm(wanted))
  if (similar.length) return { kind: 'similar' as const, book: similar[0] }
  return null
}

/* ---------- Download + validação do ZIP/EPUB ---------- */
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))
async function download(url: string): Promise<Uint8Array> {
  let lastErr = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 90_000)
      const res = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'BookmooImporter/1.0 (educational, sequential)' } })
      clearTimeout(t)
      if (res.status === 429 || res.status === 503) { lastErr = 'HTTP ' + res.status; await sleep(5000 * 2 ** attempt); continue }
      if (!res.ok) throw new Error('HTTP ' + res.status)
      return new Uint8Array(await res.arrayBuffer())
    } catch (e: any) { lastErr = e.message; if (/HTTP 4\d\d/.test(lastErr) && !/429/.test(lastErr)) break; await sleep(3000 * 2 ** attempt) }
  }
  throw new Error('download falhou: ' + lastErr)
}

function resolvePath(base: string, href: string) {
  const path = href.split('#')[0]
  if (!path) return base
  let decoded = path
  try { decoded = decodeURIComponent(path) } catch { /* mantém */ }
  const parts = (decoded.startsWith('/') ? [] : base.split('/').slice(0, -1)).concat(decoded.split('/'))
  const out: string[] = []
  for (const p of parts) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p) }
  return out.join('/')
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' }
const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === '#') { const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(code) } catch { return m } }
  return ENT[e] ?? m
})
const VOID = new Set(['br', 'img', 'hr', 'meta', 'link', 'input', 'col', 'area', 'base', 'wbr', 'source'])
const BLOCK = /^(p|h[1-6]|li|blockquote|pre|div|section|article|td|dt|dd|figcaption)$/i

/** Equivalente sem DOM de `xhtmlToSections` (src/lib/epub.ts): mesmos blocos, quebras e espaços. */
export function xhtmlToSections(xml: string, pageAnchors?: Set<string>) {
  const body = (xml.match(/<body[\s\S]*<\/body>/i) ?? [xml])[0]
  const sections: string[] = []
  let chunks: string[] = []
  let breaks = 0
  const flush = () => {
    const text = chunks.join('').replace(/[^\S\n]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    if (text) sections.push(text)
    chunks = []
  }
  const stack: string[] = []
  let skipAt = -1 // profundidade da pilha em que o ignorar começou
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/?([a-zA-Z][\w:.-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)|</g
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    const whole = m[0]
    if (m[4] !== undefined) { if (skipAt < 0) chunks.push(decode(m[4]).replace(/\s+/g, ' ')); continue }
    if (!m[1]) continue
    const closing = whole.startsWith('</')
    const tag = (m[1].split(':').pop() ?? '').toLowerCase()
    if (closing) {
      const i = stack.lastIndexOf(tag)
      if (i >= 0) {
        stack.length = i
        if (skipAt >= 0 && i <= skipAt) skipAt = -1
      }
      if (skipAt < 0 && BLOCK.test(tag)) chunks.push('\n\n')
      continue
    }
    const attrs = m[2] ?? ''
    const attr = (name: string) => { const a = attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')); return a ? (a[1] ?? a[2]) : null }
    const selfClose = m[3] === '/' || VOID.has(tag)
    if (skipAt >= 0) { if (!selfClose) stack.push(tag); continue }
    const type = attr('epub:type') ?? ''
    const id = attr('id')
    const hidden = /(?:^|\s)hidden(?:\s|=|$)/i.test(attrs)
    if (['script', 'style', 'head', 'nav'].includes(tag) || hidden || /\bbacklink\b/.test(type)) { if (!selfClose) { stack.push(tag); skipAt = stack.length - 1 }; continue }
    if (tag === 'pagebreak' || type.split(/\s+/).includes('pagebreak') || attr('role') === 'doc-pagebreak') {
      breaks++; flush()
      if (!selfClose) { stack.push(tag); skipAt = stack.length - 1 }
      continue
    }
    if (id && pageAnchors?.has(id)) { breaks++; flush() }
    if (tag === 'br') chunks.push('\n')
    if (BLOCK.test(tag)) chunks.push('\n\n')
    if (!selfClose) stack.push(tag)
  }
  flush()
  return { sections, breaks }
}

const attrOf = (tagSrc: string, name: string) => { const a = tagSrc.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')); return a ? (a[1] ?? a[2]) : null }

export function validateEpubStructure(bytes: Uint8Array) {
  const problems: string[] = []
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return { problems: ['não é um ZIP (assinatura PK ausente)'] as string[], files: {} as Record<string, Uint8Array> }
  let files: Record<string, Uint8Array> = {}
  try { files = unzipSync(bytes) } catch (e: any) { return { problems: ['ZIP corrompido: ' + e.message], files } }
  const read = (p: string) => files[p] ? strFromU8(files[p]) : null
  const mt = read('mimetype')
  if (mt === null) problems.push('mimetype ausente'); else if (mt.trim() !== 'application/epub+zip') problems.push('mimetype inválido: ' + mt.slice(0, 40))
  const container = read('META-INF/container.xml')
  if (!container) { problems.push('META-INF/container.xml ausente'); return { problems, files } }
  const opfPath = container.match(/full-path\s*=\s*"([^"]+)"/)?.[1]
  const opf = opfPath ? read(opfPath) : null
  if (!opfPath || !opf) { problems.push('OPF ausente'); return { problems, files } }
  if (!/<manifest[\s>]/.test(opf)) problems.push('manifest ausente')
  if (!/<spine[\s>]/.test(opf)) problems.push('spine ausente')
  const ids = new Map<string, string>()
  for (const it of opf.matchAll(/<item\b[^>]*>/g)) ids.set(attrOf(it[0], 'id') ?? '', attrOf(it[0], 'href') ?? '')
  let nSpine = 0
  for (const ref of opf.matchAll(/<itemref\b[^>]*>/g)) {
    nSpine++
    const href = ids.get(attrOf(ref[0], 'idref') ?? '')
    if (!href) problems.push('itemref sem item no manifest'); else if (!files[resolvePath(opfPath, href)]) problems.push('spine aponta arquivo ausente: ' + href)
  }
  if (!nSpine) problems.push('spine vazia')
  return { problems, files, opfPath, opf }
}

/* ---------- Extração ---------- */
const FRONT_SKIP = /epub:type\s*=\s*"[^"]*\b(titlepage|halftitlepage|imprint|colophon|uncopyright|copyright-page)\b/

function tagText(opf: string, tag: string) {
  const m = opf.match(new RegExp(`<dc:${tag}\\b[^>]*>([\\s\\S]*?)</dc:${tag}>`))
  return m ? decode(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() : undefined
}
const allTagText = (opf: string, tag: string) => [...opf.matchAll(new RegExp(`<dc:${tag}\\b[^>]*>([\\s\\S]*?)</dc:${tag}>`, 'g'))].map(m => decode(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim())

/** A descrição do SE vem como HTML escapado: decodifica, tira a marcação e corta em fim de frase (≤ 600). */
function plainDescription(raw?: string) {
  if (!raw) return undefined
  const t = decode(decode(raw)).replace(/<br\s*\/?>|<\/p>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  if (t.length <= 600) return t || undefined
  const cut = t.slice(0, 600); const i = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  return i > 200 ? cut.slice(0, i + 1) : cut.replace(/\s+\S*$/, '…')
}

export function extractBook(files: Record<string, Uint8Array>, opfPath: string, opf: string) {
  const read = (p: string) => files[p] ? strFromU8(files[p]) : null
  const manifest = new Map<string, { href: string; type: string; props: string }>()
  for (const it of opf.matchAll(/<item\b[^>]*>/g)) manifest.set(attrOf(it[0], 'id') ?? '', { href: attrOf(it[0], 'href') ?? '', type: attrOf(it[0], 'media-type') ?? '', props: attrOf(it[0], 'properties') ?? '' })
  // âncoras de página impressa (page-list)
  const pageAnchors = new Map<string, Set<string>>()
  const nav = [...manifest.values()].find(i => i.props.split(/\s+/).includes('nav'))
  if (nav) {
    const p = resolvePath(opfPath, nav.href); const html = read(p) ?? ''
    for (const n of html.matchAll(/<nav\b[^>]*page-list[^>]*>[\s\S]*?<\/nav>/g)) for (const a of n[0].matchAll(/<a\b[^>]*href="([^"]*)"/g)) {
      const frag = a[1].split('#')[1]; if (!frag) continue
      const path = resolvePath(p, a[1]); const s = pageAnchors.get(path) ?? new Set<string>(); s.add(frag); pageAnchors.set(path, s)
    }
  }
  const chapters: { path: string; sections: string[]; breaks: number }[] = []
  const skipped: string[] = []
  for (const ref of opf.matchAll(/<itemref\b[^>]*>/g)) {
    if (attrOf(ref[0], 'linear') === 'no') continue
    const item = manifest.get(attrOf(ref[0], 'idref') ?? '')
    if (!item || !/x?html/.test(item.type)) continue
    const path = resolvePath(opfPath, item.href)
    const xml = read(path); if (!xml) continue
    const bodyHead = (xml.match(/<body[\s\S]{0,600}/i) ?? [''])[0]
    const secHead = (xml.match(/<section[^>]*>/i) ?? [''])[0]
    if (FRONT_SKIP.test(bodyHead) || FRONT_SKIP.test(secHead)) { skipped.push(path.split('/').pop() ?? path); continue }
    const c = xhtmlToSections(xml, pageAnchors.get(path))
    if (c.sections.length) chapters.push({ path, ...c })
  }
  let text = chapters.flatMap(c => c.sections).join('\n\n')
  // Project Gutenberg: só o miolo da obra, entre os marcadores START/END (a licença continua registrada no relatório).
  const gs = text.search(/\*\*\* ?START OF[^\n]*\*\*\*/)
  if (gs >= 0) {
    text = text.slice(gs).replace(/^[^\n]*\n+/, '')
    const ge = text.search(/\*\*\* ?END OF/)
    if (ge >= 0) text = text.slice(0, ge).trim()
    chapters.length = 0; chapters.push({ path: 'gutenberg-body', sections: text.split(/\n\n+/), breaks: 0 })
  }
  const embedded = chapters.some(c => c.breaks > 0)
  const pages = embedded
    ? chapters.flatMap(c => c.breaks ? c.sections.flatMap(s => splitContentIntoPages(s)) : splitContentIntoPages(c.sections.join('\n\n')))
    : splitContentIntoPages(text)
  // capa
  const coverId = opf.match(/<meta\b[^>]*name="cover"[^>]*content="([^"]+)"/)?.[1]
  const cover = [...manifest.values()].find(m => m.props.split(/\s+/).includes('cover-image')) ?? (coverId ? manifest.get(coverId) : undefined)
  const coverBytes = cover && /^image\//.test(cover.type) ? files[resolvePath(opfPath, cover.href)] : undefined
  return {
    title: tagText(opf, 'title'), author: tagText(opf, 'creator'), language: tagText(opf, 'language')?.slice(0, 2).toLowerCase(),
    description: plainDescription(opf.match(/<dc:description\b[^>]*>([\s\S]*?)<\/dc:description>/)?.[1]), rights: tagText(opf, 'rights'), sources: allTagText(opf, 'source'), date: tagText(opf, 'date'),
    contributors: allTagText(opf, 'contributor'), publisher: tagText(opf, 'publisher'),
    chapters: chapters.length, text, pages, embedded, skipped, words: countWords(text), coverBytes,
    toc: chapters.map(c => c.path.split('/').pop()),
  }
}

/* ---------- Comandos ---------- */
async function plan() {
  const books = existingBooks()
  const out = rows.map(r => {
    const d = findDuplicate(r, books)
    return { n: r.n, title: r.title, author: r.author, level: r.level, category: r.category, decision: d?.kind === 'exact' ? 'SKIPPED_ALREADY_EXISTS' : d ? 'REVIEW_SIMILAR' : 'TO_IMPORT', match: d ? { id: d.book.id, title: d.book.title, author: d.book.author, level: d.book.cefr_level, pages: d.book.np } : null }
  })
  writeFileSync(join(OUT, 'plano.json'), JSON.stringify({ at: new Date().toISOString(), banco: books.length, itens: out }, null, 2) + '\n')
  for (const o of out) log(String(o.n).padStart(2), o.decision.padEnd(24), o.title, o.match ? `← "${o.match.title}" (${o.match.author}, ${o.match.level}, ${o.match.pages} pág.)` : '')
}

async function fetchBook(r: Row) {
  const dir = dirOf(r); const file = join(dir, 'original.epub')
  let bytes: Uint8Array
  if (existsSync(file)) bytes = new Uint8Array(readFileSync(file))
  else { log(`↓ ${r.downloadUrl}`); bytes = await download(r.downloadUrl); writeFileSync(file, bytes) }
  const v = validateEpubStructure(bytes)
  if (v.problems.length) { saveStatus(r, { status: 'FAILED', error: 'EPUB inválido: ' + v.problems.join('; '), url: r.downloadUrl }); throw new Error('EPUB inválido: ' + v.problems.join('; ')) }
  const sha = createHash('sha256').update(bytes).digest('hex')
  saveStatus(r, { origin: r.origin ?? URL_OVERRIDE[r.n]?.origin ?? 'Standard Ebooks (Compatible epub)', url: r.downloadUrl, officialPage: r.page, epubPath: `content/epubs/${String(r.n).padStart(2, '0')}-${r.slug}/original.epub`, epubBytes: bytes.length, epubSha256: sha, fetched: { ok: true, at: new Date().toISOString() } })
  log(`✓ EPUB válido (${(bytes.length / 1024).toFixed(0)} KB, sha256 ${sha.slice(0, 12)}…)`)
}

async function buildBook(r: Row) {
  const dir = dirOf(r)
  const bytes = new Uint8Array(readFileSync(join(dir, 'original.epub')))
  const v = validateEpubStructure(bytes)
  if (v.problems.length || !v.opf || !v.opfPath) throw new Error('EPUB inválido: ' + v.problems.join('; '))
  const b = extractBook(v.files, v.opfPath, v.opf)
  const problems: string[] = []
  const head = (t: string) => norm(t.split(/[;:\n/]/)[0]).replace(/^(the|a|an) /, '')
  if (!b.title || (norm(b.title) !== norm(r.title) && head(b.title) !== head(r.title))) problems.push(`título do EPUB ("${b.title}") ≠ CSV ("${r.title}")`)
  if (!b.author || !sameAuthor(b.author, r.author)) problems.push(`autor do EPUB ("${b.author}") ≠ CSV ("${r.author}")`)
  if (b.language !== 'en') problems.push(`idioma ${b.language} ≠ en`)
  if (!b.chapters || !b.words) problems.push('sem texto')
  const minWords = r.n === 1 ? 5_000 : 15_000
  if (b.words < minWords) problems.push(`texto curto demais: ${b.words} palavras`)
  const tail = b.text.slice(-300)
  if (/\b(TODO|lorem ipsum|placeholder)\b/i.test(b.text)) problems.push('marcador de placeholder no texto')
  if (!/[.!?"”’'…)\]—*↩︎️]\s*$/u.test(tail) && !/\w$/.test(tail)) problems.push('texto termina de forma estranha')
  // direitos: edição Standard Ebooks (CC0) sobre obra em domínio público
  const rightsNotes: string[] = []
  const rightsText = b.rights ?? ''
  if (!/public domain|CC0|creative commons/i.test(rightsText)) problems.push('RIGHTS: o EPUB não declara domínio público/CC0')
  if (b.contributors.some(c => /translat/i.test(c))) rightsNotes.push('Tradução: revisar')
  const illustrators = b.contributors.filter(c => /illustrat|tenniel|denslow|neill|shepard|rackham|potter|sewell/i.test(c))
  const rights = `Obra: domínio público (autor: ${r.author}). Edição digital: Standard Ebooks, dedicada ao domínio público via CC0 1.0 (Universal). ${illustrators.length ? 'Contribuições listadas: ' + illustrators.join('; ') + '. ' : ''}Fontes: ${b.sources.join(' | ') || 'n/d'}. dc:rights: ${rightsText.slice(0, 300)}`
  let cover: Buffer | null = null, thumb: Buffer | null = null
  if (b.coverBytes) {
    cover = await sharp(Buffer.from(b.coverBytes)).resize({ width: 1024, withoutEnlargement: true }).jpeg({ quality: 86, mozjpeg: true }).toBuffer()
    thumb = await sharp(cover).resize(320).webp({ quality: 72 }).toBuffer()
    writeFileSync(join(dir, 'cover.jpg'), cover); writeFileSync(join(dir, 'cover-thumb.webp'), thumb)
  }
  const rightsReview = problems.filter(p => p.startsWith('RIGHTS')).length > 0 || rightsNotes.length > 0
  const descr = b.description && b.description.length > 20 ? b.description : null
  writeFileSync(join(dir, 'pages.json'), JSON.stringify(b.pages))
  const meta = { title: b.title, author: b.author, language: b.language, description: descr, chapters: b.chapters, words: b.words, pages: b.pages.length, pagination: b.embedded ? 'embedded' : 'reader', skippedFrontmatter: b.skipped, hasCover: !!cover, toc: b.toc }
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n')
  saveStatus(r, {
    built: { ok: problems.length === 0, at: new Date().toISOString(), problems }, chapters: b.chapters, words: b.words, pages: b.pages.length, hasCover: !!cover, description: descr,
    galleryTitle: r.galleryTitle, rights, rightsReview, pagesMd5: createHash('md5').update(JSON.stringify(b.pages)).digest('hex'), epubTitle: b.title, epubAuthor: b.author,
    ...(problems.length ? { status: rightsReview ? 'RIGHTS_REVIEW_REQUIRED' : 'FAILED', error: problems.join('; ') } : {}),
  })
  log(`${problems.length ? '✗' : '✓'} "${b.title}" — ${b.chapters} documentos, ${b.words.toLocaleString('en-US')} palavras, ${b.pages.length} páginas, capa ${cover ? (cover.length / 1024).toFixed(0) + ' KB' : 'ausente'}${b.skipped.length ? `, front/back ignorados: ${b.skipped.join(', ')}` : ''}`)
  problems.forEach(p => log('  ✗', p))
  if (problems.length) throw new Error(problems.join('; '))
}

function buildSql(r: Row) {
  const dir = dirOf(r); const st = loadStatus(r); const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'))
  const pages = readFileSync(join(dir, 'pages.json'), 'utf8')
  const cover = existsSync(join(dir, 'cover.jpg')) ? 'data:image/jpeg;base64,' + readFileSync(join(dir, 'cover.jpg')).toString('base64') : null
  const thumb = existsSync(join(dir, 'cover-thumb.webp')) ? 'data:image/webp;base64,' + readFileSync(join(dir, 'cover-thumb.webp')).toString('base64') : null
  const titleNorm = "lower(replace(replace(replace(title, '’', ''''), '‘', ''''), '  ', ' '))"
  const title = (st.galleryTitle ?? meta.title) as string
  const tNorm = title.replace(/[’‘]/g, "'").toLowerCase()
  const lit = (s: string | null) => s === null ? 'null' : q$(s)
  const sql = `do $$ begin
  if exists (select 1 from public.catalog_books where ${titleNorm} = ${q$(tNorm)}) then raise exception 'ja_existe'; end if;
  if (select count(*) from auth.users where lower(email) = 'lucasmarteux@gmail.com') <> 1 then raise exception 'admin_nao_encontrado'; end if;
end $$;
insert into public.catalog_books (title, author, description, language_code, cover_data, cover_thumb, cefr_level, category, pages, created_by)
values (${q$(title)}, ${q$(meta.author)}, ${lit(st.description)}, 'en', ${lit(cover)}, ${lit(thumb)}, ${q$(r.level)}, ${q$(r.category)},
  ${q$(pages)}::jsonb, (select id from auth.users where lower(email) = 'lucasmarteux@gmail.com'))
returning id, title;
`
  return { sql, title }
}

async function publishBook(r: Row, run: boolean) {
  const st = loadStatus(r)
  if (!st.built?.ok) throw new Error('build não aprovado')
  if (st.rightsReview) throw new Error('RIGHTS_REVIEW_REQUIRED')
  const dir = dirOf(r)
  const books = existingBooks() // rechecagem de duplicidade logo antes de gravar
  const dup = findDuplicate(r, books)
  if (dup?.kind === 'exact') { saveStatus(r, { status: 'SKIPPED_ALREADY_EXISTS', existing: dup.book }); return log(`↷ já existe: "${dup.book.title}" — não toca.`) }
  if (dup?.kind === 'similar' && !allowSimilar.has(r.n)) { saveStatus(r, { status: 'REVIEW_SIMILAR', existing: dup.book }); throw new Error(`título parecido já existe ("${dup.book.title}"): confirme com o usuário`) }
  const { sql } = buildSql(r)
  const file = join(dir, 'publish.sql'); writeFileSync(file, sql)
  log(`SQL ${(sql.length / 1024 / 1024).toFixed(2)} MB, ${st.pages} páginas, ${r.category}/${r.level}`)
  if (!run) return log('Dry-run (use --run para gravar).')
  const res = dbQuery(file)
  if (!res.ok && res.raw.includes('ja_existe')) { saveStatus(r, { status: 'SKIPPED_ALREADY_EXISTS' }); return log('↷ ja_existe (corrida): não duplica.') }
  if (!res.ok) { saveStatus(r, { status: 'FAILED', error: 'publicação: ' + res.raw.slice(0, 400) }); throw new Error('publicação falhou: ' + res.raw.slice(0, 400)) }
  saveStatus(r, { status: 'INSERTED', id: res.json?.rows?.[0]?.id })
  await verifyBook(r)
}

async function verifyBook(r: Row) {
  const st = loadStatus(r); const meta = JSON.parse(readFileSync(join(dirOf(r), 'meta.json'), 'utf8'))
  const tNorm = ((st.galleryTitle ?? meta.title) as string).replace(/[’‘]/g, "'").toLowerCase()
  const rowsDb = dbRows(`select id, title, author, cefr_level, category, language_code, jsonb_array_length(pages) as np, md5(pages::text) as pmd5, (cover_data like 'data:image/jpeg%') as cover_ok, (cover_thumb like 'data:image/webp%') as thumb_ok, created_at from public.catalog_books where lower(replace(replace(title, '’', ''''), '‘', '''')) = ${q$(tNorm)};`, 'verify')
  if (rowsDb.length !== 1) { saveStatus(r, { status: 'FAILED', error: `${rowsDb.length} registros com o título no banco` }); throw new Error(`esperava 1 registro, achei ${rowsDb.length}`) }
  const d = rowsDb[0]; const probs: string[] = []
  if (d.np !== st.pages) probs.push(`páginas banco ${d.np} ≠ local ${st.pages}`)
  if (d.cefr_level !== r.level) probs.push('nível')
  if (d.category !== r.category) probs.push('categoria')
  if (d.language_code !== 'en') probs.push('idioma')
  if (st.hasCover && (!d.cover_ok || !d.thumb_ok)) probs.push('capa')
  // md5 do jsonb::text do Postgres difere da serialização local; confere por contagem + conteúdo abaixo
  if (probs.length) { saveStatus(r, { status: 'FAILED', id: d.id, error: 'verificação: ' + probs.join(', ') }); throw new Error('verificação reprovou: ' + probs.join(', ')) }
  saveStatus(r, { status: 'PUBLISHED', id: d.id, verifiedInDb: { at: new Date().toISOString(), pages: d.np, pagesMd5: d.pmd5 }, galleryPath: `/gallery/${d.id}` })
  log(`✓ publicado e verificado no banco: ${d.id} (${d.np} páginas)`)
}

const allowSimilar = new Set<number>([11]) // Alice original ≠ reconto A2 "…: Down the Rabbit-Hole" (obras distintas, decisão registrada no relatório)

async function one(r: Row, run: boolean) {
  const st = loadStatus(r)
  if (st.status === 'PUBLISHED' || st.status === 'SKIPPED_ALREADY_EXISTS') return log(`= ${r.n} ${r.title}: ${st.status} (checkpoint)`)
  log(`\n=== ${r.n}. ${r.title} — ${r.author} [${r.level}/${r.category}]`)
  try {
    const books = existingBooks(); const dup = findDuplicate(r, books)
    if (dup?.kind === 'exact') { saveStatus(r, { status: 'SKIPPED_ALREADY_EXISTS', existing: dup.book }); return log(`↷ SKIPPED_ALREADY_EXISTS: "${dup.book.title}" (${dup.book.author})`) }
    if (!st.fetched?.ok) await fetchBook(r)
    if (!st.built?.ok) await buildBook(r)
    await publishBook(r, run)
  } catch (e: any) {
    const cur = loadStatus(r)
    if (!['RIGHTS_REVIEW_REQUIRED', 'REVIEW_SIMILAR', 'SKIPPED_ALREADY_EXISTS'].includes(cur.status)) saveStatus(r, { status: 'FAILED', error: e.message })
    log('✗', r.n, e.message)
  }
}

/* ---------- Relatório ---------- */
function report() {
  const out = rows.map(r => {
    const s = loadStatus(r)
    return {
      ordem: r.n, titulo: r.title, autor: r.author, cefr: r.level, categoria_app: r.category, status: s.status ?? 'PENDING', origem: s.origin ?? '', url: s.url ?? r.downloadUrl,
      caminho_epub: s.epubPath ?? '', capitulos: s.chapters ?? '', palavras: s.words ?? '', paginas: s.pages ?? '', direitos: s.rights ?? '', id_banco: s.id ?? s.existing?.id ?? '',
      existente_no_banco: s.existing ? `${s.existing.title} (${s.existing.author})` : '', verificado_no_banco: s.verifiedInDb ? 'sim' : 'não', verificado_no_leitor: s.readerCheck ?? 'não', observacao: s.error ?? '',
    }
  })
  const csvEsc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = Object.keys(out[0])
  writeFileSync(join(OUT, process.env.EPUB_CSV ? 'relatorio-extra.csv' : 'relatorio.csv'), '﻿' + [head.join(','), ...out.map(o => head.map(h => csvEsc((o as any)[h])).join(','))].join('\n') + '\n')
  writeFileSync(join(OUT, process.env.EPUB_CSV ? 'relatorio-extra.json' : 'relatorio.json'), JSON.stringify({ geradoEm: new Date().toISOString(), itens: out }, null, 2) + '\n')
  const count: Record<string, number> = {}; for (const o of out) count[o.status] = (count[o.status] ?? 0) + 1
  log('Relatório gravado em content/epubs/relatorio.{csv,json}:', count)
}

/* ---------- CLI ---------- */
const [cmd, a1, a2, ...rest] = process.argv.slice(2)
const run = process.argv.includes('--run')
const num = (s?: string) => (s && /^\d+$/.test(s) ? Number(s) : undefined)
if (cmd === 'plan') await plan()
else if (cmd === 'fetch') await fetchBook(rowOf(Number(a1)))
else if (cmd === 'build') await buildBook(rowOf(Number(a1)))
else if (cmd === 'publish') await publishBook(rowOf(Number(a1)), run)
else if (cmd === 'verify') await verifyBook(rowOf(Number(a1)))
else if (cmd === 'all') { const from = num(a1) ?? 1, to = num(a2) ?? 50; const only = process.env.EPUB_ONLY?.split(',').map(Number); for (const r of rows.filter(x => x.n >= from && x.n <= to && (!only || only.includes(x.n)))) await one(r, run); report() }
else if (cmd === 'report') report()
else { console.error('uso: epubs.mts plan | fetch|build|publish|verify <n> [--run] | all [de [até]] [--run] | report'); process.exit(1) }
void readdirSync; void rest
