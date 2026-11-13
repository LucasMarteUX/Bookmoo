// Pipeline dos clássicos adaptados: leitura do manuscrito, validação, EPUB 3 e páginas da galeria.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate'
import { splitContentIntoPages, countWords } from '../../src/lib/utils.ts'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const CLASSICS = join(ROOT, 'content', 'classics')
export const SUPABASE_REF = 'ywnmeacpvmcuhzhshpwz'

export type Meta = {
  n: number; slug: string; title: string; galleryTitle: string; author: string; authorFull: string
  originalTitle: string; originalYear: number; category: string; level: string; language: string
  readingWpm: number; descriptionEn: string; descriptionPt: string; adaptationCredit: string
  sources: string[]; rights: string; blocked?: string
  cover: { bg1: string; bg2: string; accent: string; paper: string }
}
export type Entry = { term: string; pt: string; meaning: string; example: string }
export type Chapter = { n: number; title: string; paragraphs: string[]; words: number }
export type Book = { dir: string; meta: Meta; chapters: Chapter[]; glossary: Entry[]; storyWords: number }

export const bookDir = (slug: string) => join(CLASSICS, slug)
export const buildDir = (slug: string) => { const d = join(bookDir(slug), 'build'); mkdirSync(d, { recursive: true }); return d }
export const epubName = (slug: string) => {
  let level = 'a1'
  try { level = String(JSON.parse(readFileSync(join(CLASSICS, slug, 'meta.json'), 'utf8')).level ?? 'A1').toLowerCase() } catch { /* meta ainda não existe */ }
  return `${slug}-${level}-expanded.epub`
}

export function loadQueue(): { n: number; slug: string; title: string; author: string; category: string }[] {
  return JSON.parse(readFileSync(join(CLASSICS, 'queue.json'), 'utf8'))
}

export function loadStatus(slug: string): Record<string, any> {
  const f = join(bookDir(slug), 'status.json')
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : { slug, stages: {} }
}
export function saveStatus(slug: string, patch: Record<string, any>) {
  const cur = loadStatus(slug)
  const next = { ...cur, ...patch, stages: { ...cur.stages, ...(patch.stages ?? {}) }, updatedAt: new Date().toISOString() }
  writeFileSync(join(bookDir(slug), 'status.json'), JSON.stringify(next, null, 2) + '\n')
}

export function loadBook(slug: string): Book {
  const dir = bookDir(slug)
  const meta: Meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'))
  const chDir = join(dir, 'chapters')
  const files = existsSync(chDir) ? readdirSync(chDir).filter(f => /^\d+\.md$/.test(f)).sort() : []
  const chapters: Chapter[] = files.map((f, i) => {
    const raw = readFileSync(join(chDir, f), 'utf8').replace(/\r/g, '').trim()
    const m = raw.match(/^#\s+(.+)\n/)
    const title = m ? m[1].trim() : `Chapter ${i + 1}`
    const body = m ? raw.slice(m[0].length) : raw
    const paragraphs = body.split(/\n{2,}/).map(p => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean)
    return { n: i + 1, title, paragraphs, words: countWords(paragraphs.join(' ')) }
  })
  const gf = join(dir, 'glossary.json')
  const glossary: Entry[] = existsSync(gf) ? JSON.parse(readFileSync(gf, 'utf8')) : []
  return { dir, meta, chapters, glossary, storyWords: chapters.reduce((s, c) => s + c.words, 0) }
}

/* ---------- Validação editorial/técnica (falha crítica bloqueia a publicação) ---------- */
export type Check = { level: 'error' | 'warn' | 'info'; msg: string }

const PLACEHOLDER = /\b(TODO|TBD|lorem ipsum|placeholder|to be continued|\[insert|\.\.\. ?continue|as an ai model|chapter \d+ (goes|here))\b|\[\w+ (here|continues)\]|<[a-z]+>/i

export function validateBook(book: Book): Check[] {
  const out: Check[] = []
  const err = (msg: string) => out.push({ level: 'error', msg })
  const warn = (msg: string) => out.push({ level: 'warn', msg })
  const info = (msg: string) => out.push({ level: 'info', msg })
  const { meta, chapters, glossary } = book
  if (meta.blocked) err(`Livro BLOQUEADO: ${meta.blocked}`)
  if (!chapters.length) return [...out, { level: 'error', msg: 'Sem capítulos.' }]
  for (const f of ['title', 'author', 'category', 'level', 'descriptionEn', 'rights', 'adaptationCredit'] as const) if (!meta[f]) err(`meta.${f} ausente`)
  if (!meta.sources?.length) err('Nenhuma fonte histórica registrada')
  if (!['A1', 'A2', 'B1'].includes(meta.level)) err('Nível deve ser A1, A2 ou B1')
  const avg = book.storyWords / chapters.length
  const sorted = chapters.map(c => c.words).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  for (const c of chapters) {
    if (c.words < 150) err(`Capítulo ${c.n} (${c.title}) muito curto: ${c.words} palavras`)
    if (c.paragraphs.length < 4) err(`Capítulo ${c.n} tem só ${c.paragraphs.length} parágrafos`)
    if (PLACEHOLDER.test(c.paragraphs.join(' '))) err(`Capítulo ${c.n} contém marcador/placeholder/truncamento`)
    const last = c.paragraphs[c.paragraphs.length - 1]
    if (c.n === chapters.length && !/[.!?"]$/.test(last)) err('Último capítulo termina sem pontuação final (truncado?)')
    for (const p of c.paragraphs) {
      for (const s of p.split(/(?<=[.!?])\s+/)) if (countWords(s) > 40) warn(`Cap. ${c.n}: frase com ${countWords(s)} palavras: "${s.slice(0, 60)}…"`)
    }
  }
  const lastCh = chapters[chapters.length - 1]
  if (lastCh.words < median * 0.6) err(`Último capítulo encolheu (${lastCh.words} vs mediana ${median})`)
  // repetição artificial: parágrafos idênticos
  const seen = new Set<string>()
  for (const c of chapters) for (const p of c.paragraphs) { if (p.length > 200 && seen.has(p)) err(`Parágrafo repetido: "${p.slice(0, 50)}…"`); seen.add(p) }
  const all = chapters.flatMap(c => c.paragraphs).join(' ')
  const sentences = all.split(/(?<=[.!?])\s+/).map(s => countWords(s))
  const avgSentence = sentences.reduce((a, b) => a + b, 0) / sentences.length
  info(`${chapters.length} capítulos, ${book.storyWords} palavras (mediana ${median}/cap., média ${Math.round(avg)}); frase média ${avgSentence.toFixed(1)} palavras`)
  if (avgSentence > (meta.level === 'B1' ? 20 : meta.level === 'A2' ? 17 : 14)) warn(`Frase média longa para ${meta.level} (${avgSentence.toFixed(1)})`)
  if (/[“”‘’]/.test(all)) warn('Aspas tipográficas no texto (use aspas retas para o leitor/vocabulário)')
  if (!/"/.test(all)) err('Sem diálogos')
  // glossário
  if (glossary.length < 30) err(`Glossário com só ${glossary.length} termos (mínimo 30)`)
  const low = all.toLowerCase()
  const terms = new Set<string>()
  for (const g of glossary) {
    if (!g.term || !g.pt || !g.meaning || !g.example) err(`Glossário incompleto: ${g.term || '(vazio)'}`)
    if (terms.has(g.term.toLowerCase())) err(`Glossário duplicado: ${g.term}`)
    terms.add(g.term.toLowerCase())
    const stem = g.term.toLowerCase().replace(/^(to )/, '')
    const root = stem.length > 4 ? stem.slice(0, Math.max(4, stem.length - 2)) : stem
    if (!low.includes(root)) warn(`Termo do glossário não aparece no texto: ${g.term}`)
  }
  return out
}

/* ---------- Texto da edição (compartilhado entre EPUB e páginas da galeria) ---------- */
export function readingMinutes(words: number, wpm: number) { return Math.max(1, Math.round(words / wpm)) }

export function editionIntro(book: Book) {
  const { meta } = book
  return [
    `About this edition`,
    `${meta.title.split(':')[0]} in Simple English`,
    `This is a newly written, expanded English retelling of the tale "${meta.originalTitle.replace(/ \(.*$/, '')}" by the ${meta.author}, first published in ${meta.originalYear}. It keeps the people, the places, the events and the ending of the original story, and it tells them with short sentences and common words.`,
    `Reading level: ${meta.level}-adapted, with vocabulary support. This is an estimated teaching level, not an official CEFR certification. Some story words are explained in the vocabulary guide at the end.`,
    `About ${book.storyWords.toLocaleString('en-US')} words in ${book.chapters.length} chapters. Reading time: about ${readingMinutes(book.storyWords, meta.readingWpm)} minutes at a slow, careful pace.`,
  ]
}
export function adaptationNote(book: Book) {
  const { meta } = book
  return [
    'Note on this adaptation',
    `${meta.adaptationCredit}`,
    `Original work: ${meta.originalTitle}, by ${meta.authorFull}, first published in ${meta.originalYear}. The original tale is in the public domain.`,
    `Sources checked: ${meta.sources.join(' ')}`,
    'This edition is an educational adaptation. Scenes, descriptions and dialogue were developed so that the story is fuller and easier to follow, but the events and the ending of the original tale were kept.',
  ]
}

/** Texto corrido do livro, na mesma ordem do EPUB; é o que vira `pages` da galeria. */
export function bookText(book: Book): string {
  // Na galeria o livro começa direto no capítulo 1: só a história, com o título de cada capítulo.
  // Sem página de edição, glossário nem notas (o EPUB mantém tudo isso; o leitor traduz as palavras sozinho).
  return book.chapters.flatMap(c => [c.title, ...c.paragraphs]).join('\n\n')
}
export function bookPages(book: Book): string[] { return splitContentIntoPages(bookText(book)) }

/* ---------- EPUB 3 ---------- */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const xhtml = (title: string, body: string, cls = '') => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en">
<head><meta charset="utf-8"/><title>${esc(title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body${cls ? ` class="${cls}"` : ''}>
${body}
</body>
</html>
`
const CSS = `body{font-family:Georgia,"Times New Roman",serif;line-height:1.55;margin:5%;}
h1{font-size:1.6em;margin:1.2em 0 .6em;text-align:center;}
h2{font-size:1.15em;margin:1.4em 0 .4em;}
p{margin:0 0 .85em;text-indent:0;}
.chapter-num{text-align:center;text-transform:uppercase;letter-spacing:.15em;font-size:.8em;margin-top:2em;}
.center{text-align:center;}
.cover{text-align:center;margin:0;}
.cover img{max-width:100%;max-height:100vh;}
dl dt{font-weight:bold;margin-top:.8em;}dl dd{margin:0 0 .4em 1em;}
.small{font-size:.9em;}
`

export function buildEpub(book: Book, coverJpeg: Uint8Array): Uint8Array {
  const { meta, chapters, glossary } = book
  const uid = `urn:bookmoo:classics:${meta.slug}:${meta.level.toLowerCase()}-expanded`
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {}
  const put = (path: string, text: string) => { files[path] = strToU8(text) }
  files['mimetype'] = [strToU8('application/epub+zip'), { level: 0 }]
  put('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>
`)
  put('OEBPS/styles.css', CSS)
  files['OEBPS/images/cover.jpg'] = coverJpeg
  put('OEBPS/cover.xhtml', xhtml('Cover', `<div class="cover"><img src="images/cover.jpg" alt="Cover of ${esc(meta.title)}"/></div>`, 'cover'))
  put('OEBPS/title.xhtml', xhtml('Title page', `<h1>${esc(meta.title)}</h1>
<p class="center"><em>Extended ${meta.level} Edition</em></p>
<p class="center">${esc(meta.author)}</p>
<p class="center small">Adapted for beginner learners</p>`))
  const intro = editionIntro(book)
  put('OEBPS/edition.xhtml', xhtml('About this edition', `<h1>${esc(intro[0])}</h1>\n<h2>${esc(intro[1])}</h2>\n${intro.slice(2).map(p => `<p>${esc(p)}</p>`).join('\n')}`))
  const chapterFiles = chapters.map(c => ({ id: `ch${String(c.n).padStart(2, '0')}`, href: `chapter-${String(c.n).padStart(2, '0')}.xhtml`, c }))
  for (const { href, c } of chapterFiles) {
    put(`OEBPS/${href}`, xhtml(`Chapter ${c.n}: ${c.title}`, `<p class="chapter-num">Chapter ${c.n}</p>\n<h1>${esc(c.title)}</h1>\n${c.paragraphs.map(p => `<p>${esc(p)}</p>`).join('\n')}`))
  }
  put('OEBPS/glossary.xhtml', xhtml('Vocabulary guide', `<h1>Vocabulary guide</h1>\n<dl>\n${glossary.map(g => `<dt>${esc(g.term)} <span class="small">— ${esc(g.pt)}</span></dt>\n<dd>${esc(g.meaning)} <em>Example: ${esc(g.example)}</em></dd>`).join('\n')}\n</dl>`))
  const note = adaptationNote(book)
  put('OEBPS/adaptation.xhtml', xhtml('Note on this adaptation', `<h1>${esc(note[0])}</h1>\n${note.slice(1).map(p => `<p>${esc(p)}</p>`).join('\n')}`))
  put('OEBPS/credits.xhtml', xhtml('Credits', `<h1>Credits</h1>
<p>Original work: <em>${esc(meta.originalTitle)}</em> by ${esc(meta.authorFull)}, first published in ${meta.originalYear}.</p>
<p>${esc(meta.adaptationCredit)}</p>
<p>Cover: original artwork made for Bookmoo.</p>
<p>Rights: ${esc(meta.rights)}</p>`))

  const nav: [string, string][] = [
    ['cover.xhtml', 'Cover'], ['title.xhtml', 'Title page'], ['edition.xhtml', 'About this edition'],
    ...chapterFiles.map(({ href, c }) => [href, `Chapter ${c.n}: ${c.title}`] as [string, string]),
    ['glossary.xhtml', 'Vocabulary guide'], ['adaptation.xhtml', 'Note on this adaptation'], ['credits.xhtml', 'Credits'],
  ]
  put('OEBPS/nav.xhtml', xhtml('Contents', `<nav epub:type="toc" id="toc"><h1>Contents</h1>\n<ol>\n${nav.map(([h, t]) => `<li><a href="${h}">${esc(t)}</a></li>`).join('\n')}\n</ol></nav>`))
  const manifest = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="css" href="styles.css" media-type="text/css"/>`,
    `<item id="cover-image" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>`,
    ...nav.map(([h]) => `<item id="${h.replace('.xhtml', '').replace(/[^a-z0-9]/gi, '-')}" href="${h}" media-type="application/xhtml+xml"/>`),
  ]
  const spine = nav.map(([h]) => `<itemref idref="${h.replace('.xhtml', '').replace(/[^a-z0-9]/gi, '-')}"/>`)
  put('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="en">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="book-id">${uid}</dc:identifier>
<dc:title>${esc(meta.title)}</dc:title>
<dc:creator>${esc(meta.author)}</dc:creator>
<dc:language>en</dc:language>
<dc:publisher>Bookmoo</dc:publisher>
<dc:description>${esc(meta.descriptionEn)}</dc:description>
<dc:subject>Graded reader, ${meta.level}, ${esc(meta.category)}</dc:subject>
<dc:rights>${esc(meta.rights)}</dc:rights>
<meta property="dcterms:modified">${modified}</meta>
<meta name="cover" content="cover-image"/>
</metadata>
<manifest>
${manifest.join('\n')}
</manifest>
<spine>
${spine.join('\n')}
</spine>
</package>
`)
  return zipSync(files as any)
}

/** Lê o EPUB de volta (sem DOM) e devolve o texto por documento da spine: prova de que o arquivo contém tudo. */
export function readEpubBack(bytes: Uint8Array) {
  const z = unzipSync(bytes)
  const read = (p: string) => (z[p] ? strFromU8(z[p]) : '')
  const opf = read('OEBPS/content.opf')
  const manifest = new Map<string, string>()
  for (const m of opf.matchAll(/<item id="([^"]+)" href="([^"]+)"/g)) manifest.set(m[1], m[2])
  const spine = [...opf.matchAll(/<itemref idref="([^"]+)"/g)].map(m => manifest.get(m[1]) ?? '')
  const docs = spine.map(href => {
    const html = read(`OEBPS/${href}`)
    const text = [...html.matchAll(/<(?:p|h1|h2|dt|dd)[^>]*>([\s\S]*?)<\/(?:p|h1|h2|dt|dd)>/g)].map(m => m[1].replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')).join('\n')
    return { href, html, text }
  })
  return { entries: Object.keys(z), docs, opf, nav: read('OEBPS/nav.xhtml'), mimetypeFirst: Object.keys(z)[0] === 'mimetype' }
}
