import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import type { Book } from '@/store/useBookStore'
import { remapComics } from '@/lib/comicPersistence'
import { PAGE_SIZES, inferPageSize, splitContentIntoPages, type PageSize } from '@/lib/utils'

type Props = {
  book: Book
  open: boolean
  pt: boolean
  onOpenChange: (open: boolean) => void
  onApply: (updates: Partial<Book>) => Promise<void>
}

const OPTIONS: { size: PageSize; pt: [string, string]; en: [string, string]; comic: boolean }[] = [
  { size: 'short', pt: ['Página curta', 'Pouco texto por página. Balões leves e mais quadros por cena.'], en: ['Short page', 'Little text per page. Light balloons and more panels per scene.'], comic: true },
  { size: 'medium', pt: ['Página média', 'Equilíbrio entre leitura contínua e quadrinho legível.'], en: ['Medium page', 'A balance between continuous reading and a readable comic.'], comic: true },
  { size: 'long', pt: ['Página longa', 'Mais texto por página. No quadrinho, as caixas de texto ficam densas.'], en: ['Long page', 'More text per page. In comics, text boxes become dense.'], comic: false },
]

/** Repaginate the whole book, keeping the reader near the same passage. */
function repaginate(book: Book, size: PageSize) {
  const pages = book.pages.length ? book.pages : [book.content]
  const offset = pages.slice(0, book.currentPage).reduce((sum, page) => sum + page.length + 2, 0)
  const next = splitContentIntoPages(pages.join('\n\n'), PAGE_SIZES[size])
  let cursor = 0
  let currentPage = next.length - 1
  for (let i = 0; i < next.length; i++) {
    cursor += next[i].length + 2
    if (cursor > offset) { currentPage = i; break }
  }
  const { comicPages, comicLayouts, kept } = remapComics(pages, next, book.comicPages, book.comicLayouts)
  return { pages: next, currentPage, comicPages, comicLayouts, kept }
}

export function PageSizeDialog({ book, open, pt, onOpenChange, onApply }: Props) {
  const current = useMemo(() => inferPageSize(book.pages), [book.pages])
  const [size, setSize] = useState<PageSize>(current)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const preview = useMemo(() => repaginate(book, size), [book, size])
  const comicCount = Object.keys(book.comicPages ?? {}).length
  const lost = comicCount - preview.kept

  const apply = async () => {
    setSaving(true)
    setError('')
    try {
      const updates: Partial<Book> = { pages: preview.pages, currentPage: preview.currentPage, content: preview.pages[preview.currentPage] ?? '' }
      if (comicCount) Object.assign(updates, { comicPages: preview.comicPages, comicLayouts: preview.comicLayouts })
      await onApply(updates)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : pt ? 'Não foi possível salvar.' : 'Could not save.')
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (value) { setSize(current); setError('') } onOpenChange(value) }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{pt ? 'Editar página' : 'Edit page'}</DialogTitle>
          <DialogDescription>
            {pt ? 'Escolha quanto texto cabe em cada página do livro.' : 'Choose how much text goes on each page of the book.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2" role="radiogroup">
          {OPTIONS.map(option => {
            const [title, text] = pt ? option.pt : option.en
            const selected = size === option.size
            return (
              <button
                key={option.size}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setSize(option.size)}
                className="w-full text-left rounded-2xl border p-4 transition-all"
                style={{
                  borderColor: selected ? 'var(--theme-accent, #8b5cf6)' : 'var(--theme-border-subtle)',
                  backgroundColor: selected ? 'var(--theme-bg-secondary)' : 'transparent',
                  boxShadow: selected ? '0 0 0 2px var(--theme-accent, #8b5cf6)' : undefined,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold" style={{ color: 'var(--theme-text)' }}>
                    {title} <span className="font-normal text-sm opacity-60">· ~{PAGE_SIZES[option.size]} {pt ? 'palavras' : 'words'}</span>
                  </span>
                  {option.comic && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-violet-500/15 text-violet-500">
                      <Sparkles className="h-3 w-3" /> {pt ? 'Melhor para HQ' : 'Best for comics'}
                    </span>
                  )}
                </div>
                <p className="text-sm mt-1" style={{ color: 'var(--theme-text-secondary)' }}>{text}</p>
              </button>
            )
          })}
        </div>
        <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
          {pt ? `O livro ficará com ${preview.pages.length} páginas (hoje: ${book.pages.length}).` : `The book will have ${preview.pages.length} pages (now: ${book.pages.length}).`}
        </p>
        {size !== current && lost > 0 && (
          <p className="text-sm rounded-xl p-3 bg-red-500/10 text-red-500">
            {pt
              ? `${lost} quadrinho(s) já gerado(s) deixam de corresponder ao texto das novas páginas e serão desvinculados deste livro.`
              : `${lost} generated comic page(s) will no longer match the new pages and will be unlinked from this book.`}
          </p>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{pt ? 'Cancelar' : 'Cancel'}</Button>
          <Button onClick={apply} disabled={saving || size === current}>
            {saving ? (pt ? 'Salvando…' : 'Saving…') : pt ? 'Aplicar' : 'Apply'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
