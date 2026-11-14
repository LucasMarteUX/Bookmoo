// Monta um EPUB 3 mínimo e válido (mimetype, container, OPF, sumário e um arquivo por capítulo) no navegador.
import { zipSync, strToU8 } from 'fflate'

export type EpubChapter = { title: string; paragraphs: string[] }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function buildEpub({ title, author, language = 'en', chapters, id }: { title: string; author?: string; language?: string; chapters: EpubChapter[]; id: string }): Uint8Array {
  const page = (heading: string, body: string) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}" lang="${language}">
<head><meta charset="utf-8"/><title>${esc(heading)}</title></head>
<body>
${body}
</body>
</html>
`
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {}
  files['mimetype'] = [strToU8('application/epub+zip'), { level: 0 }]
  files['META-INF/container.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>
`)
  const items = chapters.map((chapter, i) => ({ href: `chapter-${String(i + 1).padStart(3, '0')}.xhtml`, chapter }))
  for (const { href, chapter } of items) {
    files[`OEBPS/${href}`] = strToU8(page(chapter.title, `<h2>${esc(chapter.title)}</h2>\n${chapter.paragraphs.map(p => `<p>${esc(p)}</p>`).join('\n')}`))
  }
  files['OEBPS/nav.xhtml'] = strToU8(page('Contents', `<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>\n${items.map(({ href, chapter }) => `<li><a href="${href}">${esc(chapter.title)}</a></li>`).join('\n')}\n</ol></nav>`))
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  files['OEBPS/content.opf'] = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${language}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="book-id">urn:bookmoo:import:${esc(id)}</dc:identifier>
<dc:title>${esc(title)}</dc:title>
${author ? `<dc:creator>${esc(author)}</dc:creator>\n` : ''}<dc:language>${language}</dc:language>
<meta property="dcterms:modified">${modified}</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
${items.map(({ href }, i) => `<item id="c${i + 1}" href="${href}" media-type="application/xhtml+xml"/>`).join('\n')}
</manifest>
<spine>
${items.map((_, i) => `<itemref idref="c${i + 1}"/>`).join('\n')}
</spine>
</package>
`)
  return zipSync(files as never)
}
