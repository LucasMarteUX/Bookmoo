// Importa um arquivo EPUB no navegador (sem servidor e sem IA): lê o ZIP, segue a ordem de
// leitura (spine) do OPF e extrai o texto de cada capítulo, preservando parágrafos.
import { unzipSync, strFromU8 } from 'fflate'
import { splitContentIntoPages } from './utils'

export interface EpubBook {
  title: string
  author?: string
  language?: string
  /** Texto do livro inteiro, capítulos separados por linha em branco. */
  text: string
  /** Capa como data URL, se o EPUB tiver. */
  coverDataUrl?: string
  /** Sinopse do próprio arquivo, sem marcação. */
  description?: string
  chapters: number
  pages: string[]
  pagination: 'embedded' | 'reader'
}

function resolvePath(base: string, href: string) {
  const path = href.split('#')[0]
  if (!path) return base
  let decoded = path
  try { decoded = decodeURIComponent(path) } catch { /* Preserve literal percent signs. */ }
  const parts = (decoded.startsWith('/') ? [] : base.split('/').slice(0, -1)).concat(decoded.split('/'))
  const out: string[] = []
  for (const p of parts) {
    if (p === '..') out.pop()
    else if (p && p !== '.') out.push(p)
  }
  return out.join('/')
}

/** Preserve mixed inline/block text, with explicit breaks where the EPUB marks print pages. */
function xhtmlToSections(xml: string, pageAnchors: Set<string> | undefined) {
  const doc = new DOMParser().parseFromString(xml, 'application/xhtml+xml')
  const parsed = doc.getElementsByTagName('parsererror').length ? new DOMParser().parseFromString(xml, 'text/html') : doc
  const body = parsed.body ?? parsed.documentElement
  const sections: string[] = []
  let chunks: string[] = []
  let breaks = 0
  const block = /^(p|h[1-6]|li|blockquote|pre|div|section|article|td|dt|dd|figcaption)$/i
  const flush = () => {
    const text = chunks.join('').replace(/[^\S\n]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    if (text) sections.push(text)
    chunks = []
  }
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      chunks.push((node.textContent ?? '').replace(/\s+/g, ' '))
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    const tag = el.localName.toLowerCase()
    if (['script', 'style', 'head', 'nav'].includes(tag) || el.hasAttribute('hidden')) return
    const type = epubType(el)
    const id = el.getAttribute('id')
    const isListedPage = !!id && pageAnchors?.has(id)
    if (tag === 'pagebreak' || type.split(/\s+/).includes('pagebreak') || el.getAttribute('role') === 'doc-pagebreak') {
      breaks++
      flush()
      return
    }
    if (isListedPage) { breaks++; flush() }
    if (tag === 'br') chunks.push('\n')
    if (block.test(tag)) chunks.push('\n\n')
    el.childNodes.forEach(walk)
    if (block.test(tag)) chunks.push('\n\n')
  }
  walk(body)
  flush()
  return { sections, breaks }
}

function epubType(element: Element) {
  return element.getAttributeNS('http://www.idpf.org/2007/ops', 'type') ?? element.getAttribute('epub:type') ?? ''
}

export async function parseEpub(file: File, onProgress?: (ratio: number) => void): Promise<EpubBook> {
  if (file.size > 100_000_000) throw new Error('O arquivo EPUB excede 100 MB.')
  let expandedSize = 0
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter(entry) {
      expandedSize += entry.originalSize
      if (expandedSize > 200_000_000) throw new Error('O conteúdo descompactado do EPUB excede 200 MB.')
      return true
    },
  })
  const read = (path: string) => (files[path] ? strFromU8(files[path]) : null)

  const container = read('META-INF/container.xml')
  if (!container) throw new Error('Arquivo EPUB inválido (container.xml ausente).')
  const opfPath = new DOMParser().parseFromString(container, 'application/xml').getElementsByTagNameNS('*', 'rootfile')[0]?.getAttribute('full-path')
  if (!opfPath || !read(opfPath)) throw new Error('Arquivo EPUB inválido (OPF ausente).')
  const opf = new DOMParser().parseFromString(read(opfPath)!, 'application/xml')

  const meta = (tag: string) => opf.getElementsByTagNameNS('*', tag)[0]?.textContent?.trim() || undefined
  const description = plainText(meta('description') || opf.querySelector('meta[name="description"]')?.getAttribute('content') || undefined)
  const manifest = new Map<string, { href: string; type: string; props: string }>()
  Array.from(opf.getElementsByTagNameNS('*', 'item')).forEach(it => {
    manifest.set(it.getAttribute('id') ?? '', { href: it.getAttribute('href') ?? '', type: it.getAttribute('media-type') ?? '', props: it.getAttribute('properties') ?? '' })
  })

  const pageAnchors = new Map<string, Set<string>>()
  const collectPages = (documentPath: string, targets: Element[], attribute: string) => {
    for (const target of targets) {
      const href = target.getAttribute(attribute) ?? ''
      const fragment = href.split('#')[1]
      if (!fragment) continue
      let id = fragment
      try { id = decodeURIComponent(fragment) } catch { /* Preserve literal percent signs. */ }
      const path = resolvePath(documentPath, href)
      const anchors = pageAnchors.get(path) ?? new Set<string>()
      anchors.add(id)
      pageAnchors.set(path, anchors)
    }
  }
  const nav = [...manifest.values()].find(item => item.props.split(/\s+/).includes('nav'))
  const ncx = [...manifest.values()].find(item => item.type === 'application/x-dtbncx+xml')
  if (nav) {
    const path = resolvePath(opfPath, nav.href)
    const doc = new DOMParser().parseFromString(read(path) ?? '', 'application/xhtml+xml')
    for (const element of Array.from(doc.getElementsByTagNameNS('*', 'nav'))) {
      if (epubType(element).split(/\s+/).includes('page-list')) {
        collectPages(path, Array.from(element.getElementsByTagNameNS('*', 'a')), 'href')
      }
    }
  }
  if (ncx) {
    const path = resolvePath(opfPath, ncx.href)
    const doc = new DOMParser().parseFromString(read(path) ?? '', 'application/xml')
    for (const target of Array.from(doc.getElementsByTagNameNS('*', 'pageTarget'))) {
      collectPages(path, Array.from(target.getElementsByTagNameNS('*', 'content')), 'src')
    }
  }

  // Capítulos na ordem do spine. Cede a tela entre capítulos para a barra de progresso pintar.
  const chapters: { sections: string[]; breaks: number }[] = []
  const refs = Array.from(opf.getElementsByTagNameNS('*', 'itemref'))
  onProgress?.(0.08)
  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i]
    if (i % 2 === 0) {
      onProgress?.(0.08 + (i / Math.max(refs.length, 1)) * 0.84)
      await new Promise(resolve => setTimeout(resolve, 0))
    }
    if (ref.getAttribute('linear') === 'no') continue
    const item = manifest.get(ref.getAttribute('idref') ?? '')
    if (!item || !/x?html/.test(item.type)) continue
    const path = resolvePath(opfPath, item.href)
    const xml = read(path)
    if (!xml) continue
    const chapter = xhtmlToSections(xml, pageAnchors.get(path))
    if (chapter.sections.length) chapters.push(chapter)
  }
  onProgress?.(0.96)
  if (!chapters.length) throw new Error('Não encontramos texto neste EPUB (pode ser só de imagens ou protegido por DRM).')

  // Capa: EPUB 3 (properties="cover-image") ou EPUB 2 (<meta name="cover">).
  let coverDataUrl: string | undefined
  const coverId = opf.querySelector('meta[name="cover"]')?.getAttribute('content')
  const coverItem = Array.from(manifest.values()).find((m) => m.props.split(/\s+/).includes('cover-image')) ?? (coverId ? manifest.get(coverId) : undefined)
  if (coverItem && /^image\//.test(coverItem.type)) {
    const bytes = files[resolvePath(opfPath, coverItem.href)]
    if (bytes && bytes.length < 3_000_000) {
      let bin = ''
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      coverDataUrl = `data:${coverItem.type};base64,${btoa(bin)}`
    }
  }

  const text = chapters.flatMap(chapter => chapter.sections).join('\n\n')
  const embedded = chapters.some(chapter => chapter.breaks > 0)
  const pages = embedded
    ? chapters.flatMap(chapter => chapter.breaks
      ? chapter.sections.flatMap(section => splitContentIntoPages(section))
      : splitContentIntoPages(chapter.sections.join('\n\n')))
    : splitContentIntoPages(text)
  onProgress?.(1)
  return {
    title: meta('title') || file.name.replace(/\.epub$/i, ''),
    author: meta('creator'),
    language: meta('language')?.slice(0, 2).toLowerCase(),
    text, pages, pagination: embedded ? 'embedded' : 'reader',
    coverDataUrl,
    description,
    chapters: chapters.length,
  }
}

/** Tira HTML e espaços da sinopse que vem dentro do EPUB. */
function plainText(value: string | undefined) {
  if (!value) return undefined
  const text = value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
  return text ? text.slice(0, 600) : undefined
}
