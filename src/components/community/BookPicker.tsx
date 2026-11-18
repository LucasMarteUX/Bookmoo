// Marcar livros numa publicação: busca que filtra enquanto digita (título e autor, sem acento), estante ou galeria,
// categorias e nível, e seleção de até 5 livros ("Qual desses você me indica?").
import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Check, Search, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { BookCover } from '@/components/book/BookCard'
import { bookCategories, categoryName, listCatalogLite, loadCoverThumbs, sortedCategories, type BookCategory, type CatalogBook } from '@/lib/catalog'
import { CEFR, type CefrId } from '@/lib/cefr'
import { useBookStore } from '@/store/useBookStore'

export const MAX_TAGGED = 5
export type PickedBook = { key: string; catalogId?: string; bookId?: string; title: string; author?: string; cover?: string }
type Item = PickedBook & { categories: BookCategory[]; level?: CefrId; source: 'shelf' | 'gallery' }

const muted = { color: 'var(--theme-text-secondary)' }
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function BookPicker({ open, onOpenChange, books: given, value, onChange, pt }: {
  open: boolean; onOpenChange: (open: boolean) => void; books: CatalogBook[]; value: PickedBook[]; onChange: (books: PickedBook[]) => void; pt: boolean
}) {
  const library = useBookStore(s => s.books)
  // Sem a lista da galeria (ex.: editando uma publicação), busca a versão leve ao abrir.
  const [own, setOwn] = useState<CatalogBook[]>([])
  useEffect(() => { if (open && !given.length && !own.length) void listCatalogLite().then(setOwn).catch(() => {}) }, [open, given.length, own.length])
  const books = given.length ? given : own
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<'all' | 'shelf' | 'gallery'>('all')
  const [category, setCategory] = useState<BookCategory | null>(null)
  const [level, setLevel] = useState<CefrId | null>(null)
  const [picked, setPicked] = useState<PickedBook[]>(value)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open) { setPicked(value); setQuery(''); window.setTimeout(() => input.current?.focus(), 60) } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Estante primeiro (livros da galeria que já estão nela não se repetem), depois a galeria.
  const all = useMemo<Item[]>(() => {
    const onShelf = new Set(library.map(b => b.catalogId).filter(Boolean) as string[])
    const shelf: Item[] = library.map(b => {
      const cat = b.catalogId ? books.find(c => c.id === b.catalogId) : undefined
      return { key: b.catalogId ? `cat:${b.catalogId}` : `lib:${b.id}`, catalogId: b.catalogId ?? undefined, bookId: b.catalogId ? undefined : b.id, title: b.title, author: b.author || undefined, cover: cat?.coverData ?? b.coverData, categories: cat ? bookCategories(cat) : [], level: cat?.level, source: 'shelf' }
    })
    const gallery: Item[] = books.filter(c => !onShelf.has(c.id)).map(c => ({ key: `cat:${c.id}`, catalogId: c.id, title: c.title, author: c.author, cover: c.coverData, categories: bookCategories(c), level: c.level, source: 'gallery' }))
    return [...shelf, ...gallery]
  }, [library, books])

  const results = useMemo(() => {
    const q = fold(query.trim())
    const list = all.filter(b => (source === 'all' || b.source === source) && (!category || b.categories.includes(category)) && (!level || b.level === level)
      && (!q || fold(`${b.title} ${b.author ?? ''}`).includes(q)))
    if (!q) return list
    // Quem começa com o que foi digitado vem primeiro.
    return [...list].sort((a, b) => Number(fold(b.title).startsWith(q)) - Number(fold(a.title).startsWith(q)))
  }, [all, query, source, category, level])

  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const visibleIds = results.slice(0, 40).map(b => b.catalogId).filter((id): id is string => !!id && !thumbs[id]).join(',')
  useEffect(() => { if (open && visibleIds) void loadCoverThumbs(visibleIds.split(',')).then(map => setThumbs(cur => ({ ...cur, ...map }))) }, [open, visibleIds])
  const coverOf = (b: Item) => b.cover ?? (b.catalogId ? thumbs[b.catalogId] : undefined)
  const usedCategories = useMemo(() => sortedCategories(pt).filter(c => all.some(b => b.categories.includes(c.id))), [all, pt])
  const isPicked = (key: string) => picked.some(p => p.key === key)
  const toggle = (b: Item) => setPicked(cur => cur.some(p => p.key === b.key) ? cur.filter(p => p.key !== b.key) : cur.length >= MAX_TAGGED ? cur : [...cur, { key: b.key, catalogId: b.catalogId, bookId: b.bookId, title: b.title, author: b.author, cover: coverOf(b) }])
  const chip = (on: boolean) => on ? { backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)', borderColor: 'var(--theme-primary)' } : { borderColor: 'var(--theme-border)' }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-w-3xl p-0 gap-0 overflow-hidden flex flex-col max-h-[88dvh] sm:max-h-[84dvh]">
        <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: 'var(--theme-border)' }}>
          <DialogTitle className="font-display text-[26px] leading-tight">{pt ? 'Marcar livros' : 'Tag books'}</DialogTitle>
          <p className="mt-1 text-[13.5px]" style={muted}>{pt ? `Escolha até ${MAX_TAGGED} livros. Ótimo para perguntar "qual desses você me indica?".` : `Pick up to ${MAX_TAGGED} books.`}</p>
          <label className="relative mt-4 block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={muted} />
            <input ref={input} value={query} onChange={e => setQuery(e.target.value)} placeholder={pt ? 'Buscar por título ou autor' : 'Search by title or author'}
              className="w-full h-11 rounded-xl border pl-10 pr-10 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)]/40" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg)' }} />
            {query && <button type="button" onClick={() => setQuery('')} aria-label={pt ? 'Limpar' : 'Clear'} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center rounded-full hover:bg-[var(--ui-hover)]"><X className="w-4 h-4" /></button>}
          </label>
          <div className="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar">
            {([['all', pt ? 'Tudo' : 'All'], ['shelf', pt ? 'Minha estante' : 'My shelf'], ['gallery', pt ? 'Galeria' : 'Gallery']] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setSource(id)} className="shrink-0 h-8 px-3 rounded-full border text-[12.5px] font-medium" style={chip(source === id)}>{label}</button>
            ))}
            <span className="mx-1 w-px shrink-0 self-stretch" style={{ backgroundColor: 'var(--theme-border)' }} aria-hidden />
            {CEFR.map(b => <button key={b.id} type="button" onClick={() => setLevel(l => l === b.id ? null : b.id)} className="shrink-0 h-8 px-2.5 rounded-full border text-[12.5px] font-medium tabular-nums" style={chip(level === b.id)}>{b.id}</button>)}
          </div>
          {usedCategories.length > 0 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto no-scrollbar">
              <button type="button" onClick={() => setCategory(null)} className="shrink-0 h-8 px-3 rounded-full border text-[12.5px]" style={chip(!category)}>{pt ? 'Todas as categorias' : 'All categories'}</button>
              {usedCategories.map(c => <button key={c.id} type="button" onClick={() => setCategory(cur => cur === c.id ? null : c.id)} className="shrink-0 h-8 px-3 rounded-full border text-[12.5px]" style={chip(category === c.id)}>{pt ? c.pt : c.en}</button>)}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {results.length === 0
            ? <p className="py-12 text-center text-[14px]" style={muted}>{pt ? 'Nenhum livro encontrado com esses filtros.' : 'No books match these filters.'}</p>
            : <ul className="grid gap-1 sm:grid-cols-2">
                {results.slice(0, 120).map(b => {
                  const on = isPicked(b.key)
                  const full = !on && picked.length >= MAX_TAGGED
                  return (
                    <li key={b.key}>
                      <button type="button" disabled={full} onClick={() => toggle(b)} aria-pressed={on}
                        className="w-full flex items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-[var(--ui-hover)] disabled:opacity-40"
                        style={on ? { backgroundColor: 'var(--theme-bg-secondary)', boxShadow: 'inset 0 0 0 1.5px var(--theme-text)' } : undefined}>
                        {coverOf(b) ? <BookCover title={b.title} coverData={coverOf(b)} className="w-10 shrink-0 rounded-md [&_span]:text-[7px]" /> : <span className="w-10 h-14 shrink-0 grid place-items-center rounded-md" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}><BookOpen className="w-4 h-4" style={muted} /></span>}
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-medium leading-snug line-clamp-2">{b.title}</span>
                          <span className="block text-[12px] truncate" style={muted}>{[b.author, b.level, b.categories[0] && categoryName(b.categories[0], pt), b.source === 'shelf' ? (pt ? 'na estante' : 'on shelf') : null].filter(Boolean).join(' · ')}</span>
                        </span>
                        <span className="w-6 h-6 shrink-0 grid place-items-center rounded-full border" style={on ? { backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)', borderColor: 'var(--theme-primary)' } : { borderColor: 'var(--theme-border)' }}>{on && <Check className="w-3.5 h-3.5" />}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>}
        </div>

        <div className="px-5 py-3 border-t flex items-center gap-3" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {picked.length === 0
              ? <span className="text-[13px]" style={muted}>{pt ? 'Nenhum livro selecionado' : 'No books selected'}</span>
              : picked.map(p => (
                  <span key={p.key} className="shrink-0 inline-flex items-center gap-1 h-8 pl-2.5 pr-1 rounded-full text-[12.5px] max-w-[180px]" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
                    <span className="truncate">{p.title}</span>
                    <button type="button" onClick={() => setPicked(cur => cur.filter(x => x.key !== p.key))} aria-label={pt ? 'Tirar' : 'Remove'} className="w-6 h-6 grid place-items-center rounded-full hover:bg-[var(--ui-hover)]"><X className="w-3.5 h-3.5" /></button>
                  </span>
                ))}
          </div>
          <button type="button" onClick={() => { onChange(picked); onOpenChange(false) }} className="shrink-0 h-10 px-4 rounded-full text-[13.5px] font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            {picked.length ? (pt ? `Marcar ${picked.length}` : `Tag ${picked.length}`) : (pt ? 'Concluir' : 'Done')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
