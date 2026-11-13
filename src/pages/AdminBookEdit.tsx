// Edição de um livro já publicado na galeria (só admin): dados, capa e texto página por página,
// ou substituição do texto por um EPUB novo. Nada muda no banco antes de "Salvar".
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, FileUp, Plus, Search, Trash2, Undo2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/store/useLanguage'
import { askConfirm } from '@/components/ui/confirm'
import { toast } from '@/components/ui/toast'
import { InfoHint } from '@/components/ui/info-hint'
import { CEFR, type CefrId } from '@/lib/cefr'
import { parseEpub } from '@/lib/epub'
import { countWords } from '@/lib/utils'
import { BOOK_CATEGORIES, getCatalogBook, updateCatalogBook, type BookCategory, type CatalogBook } from '@/lib/catalog'

const PER_PAGE = 8

type Draft = { title: string; author: string; description: string; languageCode: string; level: CefrId | ''; category: BookCategory | ''; cover: string; pages: string[] }

function toDraft(book: CatalogBook): Draft {
  return {
    title: book.title, author: book.author ?? '', description: book.description ?? '', languageCode: book.languageCode,
    level: book.level ?? '', category: book.category ?? '', cover: book.coverData ?? '', pages: [...book.pages],
  }
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function AdminBookEdit() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { isAdmin, loading } = useAuth()
  const pt = useLanguage().locale === 'pt-BR'
  const [book, setBook] = useState<CatalogBook | null | undefined>(undefined)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [tab, setTab] = useState<'data' | 'text'>('data')
  const [pageNo, setPageNo] = useState(1)
  const [query, setQuery] = useState('')
  const coverChanged = useRef(false)

  useEffect(() => {
    if (!isAdmin) return
    let alive = true
    getCatalogBook(id).then(b => { if (!alive) return; setBook(b); if (b) setDraft(toDraft(b)) }).catch(() => alive && setBook(null))
    return () => { alive = false }
  }, [id, isAdmin])

  const original = useMemo(() => (book ? toDraft(book) : null), [book])
  const dirty = !!draft && !!original && JSON.stringify(draft) !== JSON.stringify(original)

  // Avisa antes de fechar a aba ou voltar com alterações não salvas.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(d => d && { ...d, [key]: value })

  const words = useMemo(() => countWords(draft?.pages.join(' ') ?? ''), [draft?.pages])
  // Páginas que batem com a pesquisa (guarda o índice real para editar no lugar certo).
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = (draft?.pages ?? []).map((text, index) => ({ text, index }))
    return q ? all.filter(p => p.text.toLowerCase().includes(q)) : all
  }, [draft?.pages, query])
  const pageCount = Math.max(1, Math.ceil(visible.length / PER_PAGE))
  const current = Math.min(pageNo, pageCount)
  const shown = visible.slice((current - 1) * PER_PAGE, current * PER_PAGE)
  useEffect(() => { setPageNo(1) }, [query])

  if (loading) return null
  if (!isAdmin) return <Navigate to="/" replace />
  if (book === undefined || !draft) return <p className="max-w-3xl mx-auto text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Carregando…' : 'Loading…'}</p>
  if (book === null) return <p className="max-w-3xl mx-auto text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Livro não encontrado.' : 'Book not found.'} <Link to="/admin" className="underline">{pt ? 'Voltar' : 'Back'}</Link></p>

  const editPage = (index: number, text: string) => setDraft(d => d && { ...d, pages: d.pages.map((p, i) => i === index ? text : p) })
  const addPageAfter = (index: number) => setDraft(d => d && { ...d, pages: [...d.pages.slice(0, index + 1), '', ...d.pages.slice(index + 1)] })
  const movePage = (index: number, delta: -1 | 1) => setDraft(d => {
    if (!d) return d
    const to = index + delta
    if (to < 0 || to >= d.pages.length) return d
    const pages = [...d.pages]; [pages[index], pages[to]] = [pages[to], pages[index]]
    return { ...d, pages }
  })
  const removePage = async (index: number) => {
    const text = draft.pages[index]
    if (text.trim() && !(await askConfirm(pt ? `Apagar a página ${index + 1}?` : `Delete page ${index + 1}?`, { detail: pt ? 'Ela só some do livro quando você salvar.' : 'It is removed from the book only when you save.', confirmLabel: pt ? 'Apagar página' : 'Delete page', danger: true }))) return
    setDraft(d => d && { ...d, pages: d.pages.filter((_, i) => i !== index) })
  }

  const pickCover = async (file: File) => {
    try { coverChanged.current = true; set('cover', await readImage(file)) }
    catch { toast(pt ? 'Não consegui ler essa imagem' : 'Could not read that image', { tone: 'error' }) }
  }

  const replaceWithEpub = async (file: File) => {
    setImporting(true)
    try {
      const parsed = await parseEpub(file)
      if (!parsed.pages.length) throw new Error('empty')
      const ok = await askConfirm(pt ? 'Trocar o texto pelo deste EPUB?' : 'Replace the text with this EPUB?', {
        detail: pt
          ? `O livro passa a ter ${parsed.pages.length} páginas (${countWords(parsed.text).toLocaleString('pt-BR')} palavras), no lugar das ${draft.pages.length} atuais. Nada é salvo até você clicar em Salvar.`
          : `The book will have ${parsed.pages.length} pages (${countWords(parsed.text).toLocaleString('en-US')} words) instead of the current ${draft.pages.length}. Nothing is saved until you click Save.`,
        confirmLabel: pt ? 'Trocar o texto' : 'Replace text',
      })
      if (!ok) return
      setDraft(d => d && { ...d, pages: parsed.pages })
      setTab('text'); setPageNo(1)
      toast(pt ? 'Texto trocado. Revise e salve.' : 'Text replaced. Review and save.', { tone: 'info' })
    } catch {
      toast(pt ? 'Não consegui ler esse EPUB' : 'Could not read that EPUB', { tone: 'error', detail: pt ? 'Confira se o arquivo é um EPUB válido.' : 'Check that the file is a valid EPUB.' })
    } finally {
      setImporting(false)
    }
  }

  const save = async () => {
    if (!draft.title.trim()) { toast(pt ? 'O título não pode ficar vazio' : 'The title cannot be empty', { tone: 'warning' }); setTab('data'); return }
    if (draft.pages.every(p => !p.trim())) { toast(pt ? 'O livro precisa de pelo menos uma página com texto' : 'The book needs at least one page with text', { tone: 'warning' }); return }
    setSaving(true)
    try {
      await updateCatalogBook(id, {
        title: draft.title.trim(), author: draft.author.trim() || null, description: draft.description.trim() || null,
        languageCode: draft.languageCode || 'en', level: draft.level || null, category: draft.category || null,
        pages: draft.pages.filter(p => p.trim()).map(p => p.trim()),
        ...(coverChanged.current ? { coverData: draft.cover || null } : {}),
      })
      coverChanged.current = false
      const fresh = await getCatalogBook(id)
      setBook(fresh); if (fresh) setDraft(toDraft(fresh))
      toast(pt ? 'Livro salvo na galeria' : 'Book saved to the gallery')
    } catch {
      toast(pt ? 'Não foi possível salvar' : 'Could not save', { tone: 'error', detail: pt ? 'Confira se esta é a conta de admin e tente de novo.' : 'Check this is the admin account and try again.' })
    } finally {
      setSaving(false)
    }
  }

  const field = 'w-full rounded-lg border px-3 text-[14px] bg-transparent outline-none focus:border-[var(--theme-text)] transition-colors'
  const border = { borderColor: 'var(--theme-border)' }
  const muted = { color: 'var(--theme-text-secondary)' }

  return (
    <div className="max-w-3xl mx-auto pb-28">
      <button type="button" className="ui-hover -ml-2 inline-flex items-center gap-1.5 h-8 px-2 rounded-md text-[13.5px]" style={muted}
        onClick={async () => {
          if (dirty && !(await askConfirm(pt ? 'Sair sem salvar?' : 'Leave without saving?', { detail: pt ? 'As alterações deste livro serão perdidas.' : 'Your changes to this book will be lost.', confirmLabel: pt ? 'Sair sem salvar' : 'Leave without saving', danger: true }))) return
          navigate('/admin')
        }}>
        <ArrowLeft className="w-4 h-4" />{pt ? 'Área admin' : 'Admin'}
      </button>
      <header className="mt-4 flex items-start gap-4">
        {draft.cover && <img src={draft.cover} alt="" className="w-16 aspect-[2/3] object-cover rounded-md shrink-0" />}
        <div className="min-w-0">
          <h1 className="font-display text-[30px] leading-tight break-words">{pt ? 'Editar livro' : 'Edit book'}</h1>
          <p className="mt-1 text-[13.5px] tabular-nums" style={muted}>
            {draft.pages.length} {pt ? 'páginas' : 'pages'} · {words.toLocaleString(pt ? 'pt-BR' : 'en-US')} {pt ? 'palavras' : 'words'}
            {' · '}<Link to={`/gallery/${id}`} className="underline underline-offset-2">{pt ? 'Ver na galeria' : 'View in gallery'}</Link>
          </p>
        </div>
      </header>

      <div role="tablist" className="mt-6 flex gap-1 border-b" style={border}>
        {([['data', pt ? 'Dados e capa' : 'Details & cover'], ['text', pt ? 'Texto' : 'Text']] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className="relative h-10 px-3 text-[14px] transition-colors" style={{ color: tab === key ? 'var(--theme-text)' : 'var(--theme-text-secondary)', fontWeight: tab === key ? 500 : 400 }}>
            {label}
            {tab === key && <span aria-hidden className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full" style={{ backgroundColor: 'var(--theme-text)' }} />}
          </button>
        ))}
      </div>

      {tab === 'data' && (
        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-[13px] font-medium">{pt ? 'Título' : 'Title'}</span>
            <input value={draft.title} onChange={e => set('title', e.target.value)} className={`${field} h-10 mt-1`} style={border} />
          </label>
          <label className="block">
            <span className="text-[13px] font-medium">{pt ? 'Autor' : 'Author'}</span>
            <input value={draft.author} onChange={e => set('author', e.target.value)} className={`${field} h-10 mt-1`} style={border} />
          </label>
          <label className="block">
            <span className="text-[13px] font-medium">{pt ? 'Descrição' : 'Description'}</span>
            <textarea value={draft.description} onChange={e => set('description', e.target.value)} rows={5} className={`${field} py-2 mt-1 resize-y leading-relaxed`} style={border} />
          </label>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-[13px] font-medium">{pt ? 'Nível' : 'Level'}</span>
              <select value={draft.level} onChange={e => set('level', e.target.value as CefrId | '')} className={`${field} h-10 mt-1`} style={{ ...border, backgroundColor: 'var(--theme-bg)' }}>
                <option value="">{pt ? 'Sem nível' : 'No level'}</option>
                {CEFR.map(band => <option key={band.id} value={band.id}>{band.id} · {pt ? band.pt : band.en}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[13px] font-medium">{pt ? 'Categoria' : 'Category'}</span>
              <select value={draft.category} onChange={e => set('category', e.target.value as BookCategory | '')} className={`${field} h-10 mt-1`} style={{ ...border, backgroundColor: 'var(--theme-bg)' }}>
                <option value="">{pt ? 'Sem categoria' : 'No category'}</option>
                {BOOK_CATEGORIES.map(item => <option key={item.id} value={item.id}>{pt ? item.pt : item.en}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[13px] font-medium">{pt ? 'Idioma do livro' : 'Book language'}</span>
              <input value={draft.languageCode} onChange={e => set('languageCode', e.target.value.toLowerCase().slice(0, 5))} className={`${field} h-10 mt-1`} style={border} />
            </label>
          </div>
          <div>
            <span className="text-[13px] font-medium">{pt ? 'Capa' : 'Cover'}</span>
            <label className="ui-hover mt-1 inline-flex items-center gap-2 h-10 px-4 rounded-lg border text-[13.5px]" style={border}>
              <FileUp className="w-4 h-4" />{pt ? 'Trocar imagem da capa' : 'Change cover image'}
              <input type="file" accept="image/*" className="sr-only" onChange={e => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) void pickCover(f) }} />
            </label>
          </div>
        </div>
      )}

      {tab === 'text' && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex-1 min-w-[12rem]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={muted} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder={pt ? 'Procurar no texto' : 'Search the text'} className={`${field} h-10 pl-9`} style={border} />
            </label>
            <label className={`ui-hover inline-flex items-center gap-2 h-10 px-4 rounded-lg border text-[13.5px] ${importing ? 'opacity-60 pointer-events-none' : ''}`} style={border}>
              <FileUp className="w-4 h-4" />{importing ? (pt ? 'Lendo EPUB…' : 'Reading EPUB…') : (pt ? 'Trocar por um EPUB' : 'Replace with an EPUB')}
              <input type="file" accept=".epub,application/epub+zip" className="sr-only" onChange={e => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) void replaceWithEpub(f) }} />
            </label>
            <InfoHint title={pt ? 'Como editar o texto' : 'Editing the text'}>
              {pt ? 'Cada cartão é uma página do leitor. Edite, adicione uma página abaixo, mude a ordem ou apague. Quem já tem o livro na estante continua com a própria cópia; quem baixar depois recebe esta versão.' : 'Each card is a reader page. Edit, add a page below, reorder or delete. Readers who already have the book keep their copy; new downloads get this version.'}
            </InfoHint>
          </div>
          <p className="mt-2 text-[12.5px] tabular-nums" style={muted}>
            {query ? `${visible.length} ${pt ? 'páginas com o termo' : 'pages match'}` : `${draft.pages.length} ${pt ? 'páginas' : 'pages'}`}
          </p>

          <ul className="mt-3 space-y-3">
            {shown.map(({ text, index }) => (
              <li key={index} className="rounded-2xl border p-3" style={{ ...border, backgroundColor: 'var(--theme-card-bg)' }}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[12.5px] font-medium tabular-nums" style={muted}>{pt ? 'Página' : 'Page'} {index + 1} · {countWords(text)} {pt ? 'palavras' : 'words'}</span>
                  <div className="flex items-center gap-0.5">
                    <button type="button" className="ui-hover w-8 h-8 grid place-items-center rounded-md disabled:opacity-30" disabled={index === 0} aria-label={pt ? 'Mover para cima' : 'Move up'} onClick={() => movePage(index, -1)}><ArrowUp className="w-4 h-4" /></button>
                    <button type="button" className="ui-hover w-8 h-8 grid place-items-center rounded-md disabled:opacity-30" disabled={index === draft.pages.length - 1} aria-label={pt ? 'Mover para baixo' : 'Move down'} onClick={() => movePage(index, 1)}><ArrowDown className="w-4 h-4" /></button>
                    <button type="button" className="ui-hover w-8 h-8 grid place-items-center rounded-md" aria-label={pt ? 'Adicionar página abaixo' : 'Add page below'} onClick={() => addPageAfter(index)}><Plus className="w-4 h-4" /></button>
                    <button type="button" className="ui-hover w-8 h-8 grid place-items-center rounded-md" style={{ color: 'var(--color-destructive)' }} aria-label={pt ? 'Apagar página' : 'Delete page'} onClick={() => { void removePage(index) }}><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <textarea value={text} onChange={e => editPage(index, e.target.value)} rows={Math.min(14, Math.max(4, Math.ceil(text.length / 80)))}
                  className="w-full resize-y bg-transparent outline-none font-serif text-[15.5px] leading-[1.75]" />
              </li>
            ))}
          </ul>
          {visible.length === 0 && <p className="mt-6 text-center text-[14px]" style={muted}>{pt ? 'Nenhuma página com esse termo.' : 'No page has that term.'}</p>}

          {pageCount > 1 && (
            <nav className="mt-5 flex items-center justify-center gap-3" aria-label={pt ? 'Páginas do editor' : 'Editor pages'}>
              <button type="button" disabled={current <= 1} onClick={() => setPageNo(current - 1)} className="ui-hover h-9 px-3 rounded-lg border text-[13px] disabled:opacity-40" style={border}>{pt ? 'Anterior' : 'Previous'}</button>
              <span className="text-[13px] tabular-nums" style={muted}>{current} / {pageCount}</span>
              <button type="button" disabled={current >= pageCount} onClick={() => setPageNo(current + 1)} className="ui-hover h-9 px-3 rounded-lg border text-[13px] disabled:opacity-40" style={border}>{pt ? 'Próxima' : 'Next'}</button>
            </nav>
          )}
        </div>
      )}

      {/* Barra de salvar: fixa embaixo, só aparece com alterações. */}
      {dirty && (
        <div className="anim-fade-up fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full border pl-4 pr-2 py-2 shadow-xl backdrop-blur-md"
          style={{ backgroundColor: 'color-mix(in srgb, var(--theme-card-bg) 94%, transparent)', borderColor: 'var(--theme-border)' }}>
          <span className="text-[13.5px]">{pt ? 'Alterações não salvas' : 'Unsaved changes'}</span>
          <button type="button" disabled={saving} onClick={() => { if (original) { setDraft(original); coverChanged.current = false } }}
            className="ui-hover h-9 px-3 rounded-full inline-flex items-center gap-1.5 text-[13.5px]"><Undo2 className="w-4 h-4" />{pt ? 'Descartar' : 'Discard'}</button>
          <button type="button" disabled={saving} onClick={() => { void save() }}
            className="h-9 px-5 rounded-full text-[13.5px] font-medium disabled:opacity-60" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            {saving ? (pt ? 'Salvando…' : 'Saving…') : (pt ? 'Salvar' : 'Save')}
          </button>
        </div>
      )}
    </div>
  )
}
