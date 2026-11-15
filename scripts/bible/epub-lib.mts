// Gerado a partir de scripts/classics/epubs.mts (funções de extração de EPUB), sem o CLI.
import { unzipSync, strFromU8 } from 'fflate'
import { splitContentIntoPages, countWords } from '../../src/lib/utils.ts'
export function resolvePath(base: string, href: string) {
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

export const attrOf = (tagSrc: string, name: string) => { const a = tagSrc.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')); return a ? (a[1] ?? a[2]) : null }

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
export { decode }
