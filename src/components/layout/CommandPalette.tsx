// Paleta de comandos (⌘K / Ctrl K): busca livros, páginas do app e ações rápidas, só pelo teclado.
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AudioLines, BookMarked, ChartNoAxesColumn, CornerDownLeft, House, Languages, Moon, PenLine, Plus, Search, Settings2, Sun,
} from 'lucide-react'
import { useUiStore } from '@/store/useUiStore'
import { useBookStore } from '@/store/useBookStore'
import { useLanguage } from '@/store/useLanguage'
import { useReaderSettings } from '@/store/useReaderSettings'
import { readingProgress } from '@/lib/utils'

type Item = { id: string; group: string; label: string; hint?: string; icon?: ComponentType<{ className?: string }>; thumb?: ReactNode; run: () => void; keywords?: string }

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function CommandPalette() {
  const { commandOpen: open, setCommandOpen, requestAddBook } = useUiStore()
  const books = useBookStore(s => s.books)
  const { locale, setLocale } = useLanguage()
  const { theme, setTheme } = useReaderSettings()
  const navigate = useNavigate()
  const pt = locale === 'pt-BR'
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // ⌘K / Ctrl K abre e fecha de qualquer tela.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCommandOpen(!useUiStore.getState().commandOpen) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setCommandOpen])
  useEffect(() => { if (open) { setQuery(''); setIndex(0) } }, [open])

  const close = () => setCommandOpen(false)
  const go = (to: string) => () => { close(); navigate(to) }

  const items = useMemo<Item[]>(() => {
    const bookItems: Item[] = [...books].sort((a, b) => +new Date(b.lastRead) - +new Date(a.lastRead)).map(b => ({
      id: `book:${b.id}`, group: pt ? 'Livros' : 'Books', label: b.title, keywords: b.author,
      hint: `${b.author ? `${b.author} · ` : ''}${readingProgress(b.currentPage, b.pages.length, b.totalPages)}%`,
      thumb: <span className="w-5 h-7 rounded-[3px] overflow-hidden shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.25)]" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
        {b.coverData && <img src={b.coverData} alt="" className="w-full h-full object-cover" />}</span>,
      run: go(`/book/${b.id}`),
    }))
    const pages: Item[] = [
      { id: 'p:home', label: pt ? 'Início' : 'Home', icon: House, run: go('/') },
      { id: 'p:vocab', label: pt ? 'Vocabulário' : 'Vocabulary', icon: BookMarked, run: go('/vocabulary'), keywords: 'words palavras review' },
      { id: 'p:speak', label: pt ? 'Praticar fala' : 'Speaking practice', icon: AudioLines, run: go('/practice/speak'), keywords: 'pronunciation pronúncia' },
      { id: 'p:write', label: pt ? 'Ditado' : 'Dictation', icon: PenLine, run: go('/practice/write'), keywords: 'write escrever' },
      { id: 'p:stats', label: pt ? 'Estatísticas' : 'Statistics', icon: ChartNoAxesColumn, run: go('/stats'), keywords: 'progress progresso streak' },
      { id: 'p:settings', label: pt ? 'Configurações' : 'Settings', icon: Settings2, run: go('/settings'), keywords: 'api voice voz' },
    ].map(p => ({ ...p, group: pt ? 'Ir para' : 'Go to' }))
    const actions: Item[] = [
      { id: 'a:add', label: pt ? 'Adicionar livro' : 'Add book', icon: Plus, run: () => { close(); navigate('/'); requestAddBook() }, keywords: 'new novo import' },
      { id: 'a:theme', label: theme === 'dark' ? (pt ? 'Mudar para modo claro' : 'Switch to light mode') : (pt ? 'Mudar para modo escuro' : 'Switch to dark mode'),
        icon: theme === 'dark' ? Sun : Moon, run: () => { setTheme(theme === 'dark' ? 'light' : 'dark'); close() }, keywords: 'theme tema dark light' },
      { id: 'a:lang', label: pt ? 'Interface em inglês' : 'Interface in Portuguese', icon: Languages,
        run: () => { setLocale(pt ? 'en' : 'pt-BR'); close() }, keywords: 'language idioma' },
    ].map(a => ({ ...a, group: pt ? 'Ações' : 'Actions' }))
    return [...bookItems, ...pages, ...actions]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books, pt, theme])

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return items.filter(i => !i.id.startsWith('book:') || items.indexOf(i) < 5)
    return items.filter(i => normalize(`${i.label} ${i.keywords ?? ''}`).includes(q))
  }, [items, query])

  useEffect(() => { setIndex(0) }, [query])
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [index])

  if (!open) return null

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(filtered.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[index]?.run() }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
  }

  let lastGroup = ''
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]" onKeyDown={onKeyDown}>
      <div className="fixed inset-0 bg-black/35 backdrop-blur-[2px] dialog-fade" onClick={close} />
      <div className="elevated dialog-pop relative w-full max-w-[560px] rounded-2xl overflow-hidden" role="dialog" aria-modal="true" aria-label={pt ? 'Buscar' : 'Search'}>
        <div className="flex items-center gap-2.5 px-4 h-[52px] border-b" style={{ borderColor: 'var(--theme-border)' }}>
          <Search className="w-[18px] h-[18px] shrink-0" style={{ color: 'var(--theme-text-secondary)' }} />
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
            placeholder={pt ? 'Buscar livros, páginas e ações…' : 'Search books, pages and actions…'}
            className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-[var(--theme-text-secondary)]" style={{ color: 'var(--theme-text)' }}
            role="combobox" aria-expanded aria-controls="command-list" aria-activedescendant={filtered[index] ? `cmd-${filtered[index].id}` : undefined} />
          <kbd className="kbd">Esc</kbd>
        </div>
        <div ref={listRef} id="command-list" role="listbox" className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5 custom-scrollbar">
          {filtered.length === 0 && (
            <p className="px-3 py-8 text-center text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Nada encontrado.' : 'No results.'}</p>
          )}
          {filtered.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null
            lastGroup = item.group
            const Icon = item.icon
            const active = i === index
            return (
              <div key={item.id}>
                {header && <p className="px-2.5 pt-2.5 pb-1 text-[11.5px] font-medium" style={{ color: 'var(--theme-text-secondary)' }}>{header}</p>}
                <button type="button" id={`cmd-${item.id}`} data-index={i} role="option" aria-selected={active}
                  onMouseMove={() => setIndex(i)} onClick={item.run}
                  className="w-full flex items-center gap-3 px-2.5 h-10 rounded-lg text-left text-[14px] transition-colors"
                  style={{ backgroundColor: active ? 'var(--theme-nav-hover)' : undefined, color: 'var(--theme-text)' }}>
                  {item.thumb ?? (Icon && <span className="grid place-items-center w-6 h-6 rounded-md border shrink-0" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}><Icon className="w-3.5 h-3.5" /></span>)}
                  <span className="flex-1 min-w-0 truncate">{item.label}</span>
                  {item.hint && <span className="text-[12px] truncate max-w-[40%]" style={{ color: 'var(--theme-text-secondary)' }}>{item.hint}</span>}
                  {active && <CornerDownLeft className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--theme-text-secondary)' }} />}
                </button>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 px-4 h-9 border-t text-[11.5px]" style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}>
          <span className="inline-flex items-center gap-1.5"><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd>{pt ? 'navegar' : 'navigate'}</span>
          <span className="inline-flex items-center gap-1.5"><kbd className="kbd">↵</kbd>{pt ? 'abrir' : 'open'}</span>
        </div>
      </div>
    </div>
  )
}
