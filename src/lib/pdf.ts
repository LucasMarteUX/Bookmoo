// Importa um PDF no navegador, sem IA e sem servidor. Só o TEXTO é aproveitado (imagens, desenhos e
// figuras são ignorados): o pdf.js entrega as palavras com posição, daí se reconstroem linhas, parágrafos
// e capítulos; o resultado vira um EPUB de verdade (epubBuild) que entra pelo mesmo caminho do EPUB
// importado (parseEpub), então o leitor recebe exatamente a mesma estrutura.
// PDF escaneado (só imagem) precisaria de OCR e é recusado com uma explicação.
import { buildEpub, type EpubChapter } from './epubBuild'
import { parseEpub, type EpubBook } from './epub'

type Line = { text: string; y: number; x: number; size: number }
type Para = { text: string; size: number }

export type PdfImport = EpubBook & {
  /** O EPUB gerado a partir do PDF (para baixar). */
  epub: Blob
  epubName: string
  /** Avisos para mostrar à pessoa (páginas sem texto, capítulos não detectados…). */
  notes: string[]
  /** Páginas do PDF que não tinham texto (só imagem) e foram ignoradas. */
  skippedPages: number
  pdfPages: number
}
/** Tamanho máximo de PDF aceito. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024
export type PdfStatus = (message: string, ratio: number) => void

const median = (values: number[]) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}
const TERMINAL = /[.!?…"”’')\]]$/
const CHAPTER_WORD = /^(chapter|capítulo|capitulo|part|parte|book|livro|canto|act|ato|scene|cena|prologue|prólogo|epilogue|epílogo|preface|prefácio|introduction|introdução)\b/i
const ROMAN_OR_NUMBER = /^(?:[IVXLCDM]{1,8}|\d{1,3})[.)]?$/

/** Agrupa os trechos de texto de uma página em linhas, de cima para baixo. */
function pageLines(items: { str: string; transform: number[]; width: number }[]): Line[] {
  const words = items.filter(item => item.str.trim() !== '' || item.str === ' ')
    .map(item => ({ str: item.str, x: item.transform[4], y: item.transform[5], size: Math.abs(item.transform[3]) || Math.abs(item.transform[0]) || 10, width: item.width }))
  words.sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: { y: number; size: number; parts: typeof words }[] = []
  for (const word of words) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(last.y - word.y) < Math.max(last.size, word.size) * 0.45) { last.parts.push(word); last.size = Math.max(last.size, word.size) }
    else lines.push({ y: word.y, size: word.size, parts: [word] })
  }
  return lines.map(line => {
    const parts = line.parts.sort((a, b) => a.x - b.x)
    let text = ''
    let end = parts[0].x
    for (const part of parts) {
      const gap = part.x - end
      if (text && gap > line.size * 0.12 && !text.endsWith(' ') && !part.str.startsWith(' ')) text += ' '
      text += part.str
      end = part.x + part.width
    }
    return { text: text.replace(/\s+/g, ' ').trim(), y: line.y, x: parts[0].x, size: line.size }
  }).filter(line => line.text)
}

/** Linhas viram parágrafos: quebra onde o espaço vertical é maior que o normal ou há recuo depois de ponto final. */
function toParagraphs(lines: Line[]): Para[] {
  if (!lines.length) return []
  const gaps = lines.slice(1).map((line, i) => lines[i].y - line.y).filter(gap => gap > 0)
  const normal = median(gaps) || lines[0].size * 1.2
  const left = median(lines.map(line => line.x))
  const out: Para[] = []
  let current = lines[0].text
  let size = lines[0].size
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i - 1].y - lines[i].y
    const indented = lines[i].x - left > lines[i].size * 1.2
    const bigGap = gap > normal * 1.45
    const bigText = Math.abs(lines[i].size - lines[i - 1].size) > 1.5 // título entre parágrafos
    if (bigGap || bigText || (indented && TERMINAL.test(current))) { out.push({ text: current, size }); current = lines[i].text; size = lines[i].size; continue }
    current = /[A-Za-zÀ-ÿ]-$/.test(current) && /^[a-zà-ÿ]/.test(lines[i].text) ? current.slice(0, -1) + lines[i].text : `${current} ${lines[i].text}`
  }
  out.push({ text: current, size })
  return out
}

export async function parsePdf(file: File, onStatus?: PdfStatus): Promise<PdfImport> {
  if (file.size > MAX_PDF_BYTES) throw new Error(`O PDF tem ${(file.size / 1_048_576).toFixed(1)} MB e o limite é 20 MB. Comprima o arquivo ou envie um EPUB.`)
  onStatus?.('Abrindo o PDF…', 0.02)
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const doc = await task.promise
  const pdfPages = doc.numPages
  if (pdfPages > 3000) throw new Error('PDF com páginas demais (limite de 3.000).')

  // 1) Só o texto de cada página; imagens e figuras nunca são lidas.
  const perPage: Line[][] = []
  for (let n = 1; n <= pdfPages; n++) {
    const page = await doc.getPage(n)
    const content = await page.getTextContent()
    perPage.push(pageLines(content.items.filter((item): item is typeof item & { str: string; transform: number[]; width: number } => 'str' in item)))
    page.cleanup()
    if (n % 4 === 0 || n === pdfPages) { onStatus?.(`Lendo o texto: página ${n} de ${pdfPages}…`, 0.05 + (n / pdfPages) * 0.7); await new Promise(resolve => setTimeout(resolve, 0)) }
  }
  const meta = await doc.getMetadata().catch(() => null)
  await task.destroy()
  const info = (meta?.info ?? {}) as { Title?: string; Author?: string }

  const skippedPages = perPage.filter(lines => lines.length === 0).length
  const totalChars = perPage.reduce((sum, lines) => sum + lines.reduce((s, line) => s + line.text.length, 0), 0)
  if (totalChars < Math.min(200, pdfPages * 40)) {
    throw new Error('Este PDF não tem texto selecionável (parece escaneado, só imagens). Sem IA/OCR não dá para converter; use um PDF com texto ou um EPUB.')
  }

  // 2) Limpeza: números de página e títulos correntes (idênticos na maioria das páginas).
  onStatus?.('Montando parágrafos e capítulos…', 0.8)
  const raw = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim()
  const edge = new Map<string, number>()
  for (const lines of perPage) for (const key of new Set([...lines.slice(0, 2), ...lines.slice(-2)].map(line => raw(line.text)))) edge.set(key, (edge.get(key) ?? 0) + 1)
  const repeated = new Set(pdfPages >= 4 ? [...edge].filter(([, count]) => count >= pdfPages * 0.4).map(([key]) => key) : [])
  const isNoise = (line: Line) => /^[-–—]?\s*\d{1,4}\s*[-–—]?$/.test(line.text) || repeated.has(raw(line.text))

  const paras: Para[] = []
  for (const lines of perPage) {
    const kept = lines.filter((line, i) => !((i < 2 || i >= lines.length - 2) && isNoise(line)))
    const found = toParagraphs(kept)
    // O parágrafo que continua na página seguinte volta a ser um só.
    if (found.length && paras.length && !TERMINAL.test(paras[paras.length - 1].text) && /^[a-zà-ÿ]/.test(found[0].text)) {
      paras[paras.length - 1].text += ' ' + found.shift()!.text
    }
    paras.push(...found)
  }
  const clean = paras.filter(p => p.text.trim())
  if (!clean.length) throw new Error('Não encontramos texto neste PDF.')

  // 3) Capítulos: parágrafo curto, sem ponto final, em fonte maior que o corpo ou no formato "Capítulo 3", "IV", "Parte II".
  const body = median(clean.map(p => p.size))
  const isHeading = (p: Para) => p.text.length <= 70 && !TERMINAL.test(p.text) && (
    (p.size >= body * 1.18 && p.text.length >= 2) || CHAPTER_WORD.test(p.text) || (ROMAN_OR_NUMBER.test(p.text) && p.text.length <= 8))
  const title = (info.Title ?? '').trim() || file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'Livro'
  const chapters: EpubChapter[] = []
  let current: EpubChapter = { title, paragraphs: [] }
  for (const para of clean) {
    if (isHeading(para)) {
      // Título seguido de outro título ("Capítulo 1" + "A chegada") vira um só.
      if (current.paragraphs.length === 0 && chapters.length > 0 && current.title !== title) { current.title += ` — ${para.text}`; continue }
      if (current.paragraphs.length) chapters.push(current)
      current = { title: para.text, paragraphs: [] }
    } else current.paragraphs.push(para.text)
  }
  if (current.paragraphs.length) chapters.push(current)
  const detected = chapters.length > 1 || (chapters[0] && chapters[0].title !== title)

  // 4) PDF -> EPUB -> o mesmo importador de EPUB (o leitor recebe a estrutura de sempre).
  onStatus?.('Convertendo para EPUB…', 0.9)
  const author = (info.Author ?? '').trim() || undefined
  const bytes = buildEpub({ title, author, chapters, id: `${Date.now().toString(36)}-${file.size}` })
  const epubName = `${title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'livro'}.epub`
  const epubFile = new File([bytes as BlobPart], epubName, { type: 'application/epub+zip' })
  const book = await parseEpub(epubFile)
  onStatus?.('Pronto.', 1)

  const notes: string[] = []
  notes.push(detected ? `${chapters.length} capítulo${chapters.length === 1 ? '' : 's'} identificado${chapters.length === 1 ? '' : 's'}.` : 'Nenhum capítulo identificado: o livro ficou em um bloco só.')
  if (skippedPages) notes.push(`${skippedPages} página${skippedPages === 1 ? '' : 's'} sem texto (só imagem) foram ignoradas.`)
  notes.push('Imagens e figuras do PDF não são importadas, só o texto.')
  return { ...book, title: book.title || title, author: book.author ?? author, epub: new Blob([bytes as BlobPart], { type: 'application/epub+zip' }), epubName, notes, skippedPages, pdfPages }
}
