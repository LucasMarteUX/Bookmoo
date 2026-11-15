// Limpeza mínima (só navegação técnica) do texto extraído e paginação com as regras do leitor.
// Remove: notas do transcritor, lista de correções de erros de digitação, marcadores de imagem (imageNNN), "Book Cover",
// marcadores de página {n} e o índice remissivo do último volume de The Bible Story. Não altera nenhuma palavra da obra.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { splitContentIntoPages, countWords } from '../../src/lib/utils.ts'
const ROOT = '/Users/lucasmarte/Desktop/BOOKMOO/content/bible'
const stats: Record<string, any> = {}
for (const id of process.argv.slice(2)) {
  let t = readFileSync(join(ROOT, id, 'text.txt'), 'utf8')
  const before = countWords(t)
  const removed: string[] = []
  const cut = (re: RegExp, label: string) => { const n = t.length; t = t.replace(re, ''); if (t.length !== n) removed.push(label) }
  cut(/^\[Transcriber's notes\][\s\S]*?\[End transcriber's notes\]\s*/i, 'notas do transcritor (início)')
  cut(/^Transcriber's note:[^\n]*\n+/i, 'nota do transcritor (início)')
  cut(/\n+Transcriber's Notes?:?\n[\s\S]*$/i, 'notas/erratas do transcritor (fim)')
  cut(/^Transcriber's Note:[^\n]*\n+/gim, 'nota do transcritor (mapas)')
  cut(/^Book Cover\n+/i, 'Book Cover')
  if (/^(71243|72839|73421|73954)$/.test(id)) cut(/\bimage\d{3}\b\n*/g, 'marcadores imageNNN')
  if (id === '32736') {
    cut(/ ?\{\d+\} ?/g, 'marcadores de página {n}')
    const i = t.indexOf('\nGENERAL INDEX\n'); if (i > 0) { t = t.slice(0, i); removed.push('índice remissivo final') }
  }
  t = t.replace(/\n{3,}/g, '\n\n').trim()
  const pages = splitContentIntoPages(t)
  writeFileSync(join(ROOT, id, 'clean.txt'), t)
  writeFileSync(join(ROOT, id, 'pages.json'), JSON.stringify(pages))
  stats[id] = { wordsBefore: before, words: countWords(t), pages: pages.length, removed, md5: createHash('md5').update(JSON.stringify(pages)).digest('hex'), emptyPages: pages.filter(p => !p.trim()).length, maxPage: Math.max(...pages.map(p => p.length)) }
  console.log(id, JSON.stringify(stats[id]))
}
