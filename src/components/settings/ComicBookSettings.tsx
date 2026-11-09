import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useBookStore, type Book } from '@/store/useBookStore'
import {
  REFERENCE_BUCKET, REFERENCE_BYTES, REFERENCE_LIMIT, REFERENCE_MIME, REFERENCE_TYPES, STYLE_FIELDS,
  type ArtDirection, type ComicReference, type StyleDocument,
} from '../../../supabase/functions/_shared/comicEditorial'

const LABELS = {
  'pt-BR': ['Nome do estilo', 'Técnica de ilustração', 'Espessura e qualidade do traço', 'Estilização dos rostos e corpos',
    'Cabelos e roupas', 'Colorização', 'Paleta', 'Iluminação', 'Cenários', 'Composição dos quadros', 'Estilo dos balões',
    'Tipografia', 'Nível de realismo', 'Características a evitar'],
  en: ['Style name', 'Illustration technique', 'Line weight and quality', 'Face and body stylization', 'Hair and costume',
    'Coloring', 'Palette', 'Lighting', 'Settings', 'Panel composition', 'Balloon appearance', 'Typography', 'Realism', 'Features to avoid'],
}

function Thumbnail({ path, name }: { path: string; name: string }) {
  const [src, setSrc] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setSrc('')
    setFailed(false)
    let disposed = false
    let url = ''
    supabase?.storage.from(REFERENCE_BUCKET).download(path).then(({ data }) => {
      if (disposed) return
      if (!data) { setFailed(true); return }
      url = URL.createObjectURL(data)
      setSrc(url)
    })
    return () => { disposed = true; if (url) URL.revokeObjectURL(url) }
  }, [path])
  return src ? <img src={src} alt={name} className="size-16 rounded-lg object-cover" />
    : <div role="img" className="grid size-16 place-items-center rounded-lg bg-black/5" aria-label={name}>{failed ? '!' : null}</div>
}

export function ComicBookSettings({ book, userId, pt }: { book: Book; userId?: string; pt: boolean }) {
  const [art, setArt] = useState<ArtDirection>(() => Object.fromEntries(STYLE_FIELDS.map(key => [key, book.comicStyleDoc?.[key] ?? ''])))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState(false)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const references = book.comicStyleDoc?.references ?? []
  const storage = supabase?.storage.from(REFERENCE_BUCKET)
  const folder = `${userId}/${book.id}`
  const inputStyle = 'w-full rounded-lg border px-2.5 py-2 bg-transparent'
  const artLabels = LABELS[pt ? 'pt-BR' : 'en']
  const latest = () => useBookStore.getState().books.find(b => b.id === book.id)?.comicStyleDoc ?? {}
  const persist = async (updates: Partial<StyleDocument>) => {
    if (!supabase || !userId) throw new Error(pt ? 'Entre na sua conta.' : 'Sign in first.')
    const before = latest()
    const comicStyleDoc = { ...before, ...updates, revision: crypto.randomUUID() }
    const query = supabase.from('books').update({ comic_style_doc: comicStyleDoc }).eq('id', book.id).eq('user_id', userId)
    const result = await (before.revision
      ? query.eq('comic_style_doc->>revision', before.revision)
      : query.is('comic_style_doc->>revision', null)).select('id').maybeSingle()
    if (result.error) throw new Error(result.error.message)
    if (!result.data) {
      const { data } = await supabase.from('books').select('comic_style_doc').eq('id', book.id).eq('user_id', userId).maybeSingle()
      if (data) useBookStore.getState().updateBook(book.id, { comicStyleDoc: data.comic_style_doc })
      throw new Error(pt ? 'O livro mudou em outra sessão. Confira as configurações atuais.' : 'The book changed in another session. Check the current settings.')
    }
    useBookStore.getState().updateBook(book.id, { comicStyleDoc })
  }
  const execute = async (work: () => Promise<void>) => {
    setBusy(true)
    setFailure(false)
    setMessage('')
    try {
      await work()
      setMessage(pt ? 'Configurações salvas.' : 'Settings saved.')
    } catch (e) {
      setFailure(true)
      setMessage(e instanceof Error ? e.message : pt ? 'Não foi possível salvar.' : 'Could not save changes.')
    } finally {
      setBusy(false)
    }
  }

  const upload = async (files: File[]) => {
    if (!storage || !userId || !files.length) return
    await execute(async () => {
      const current = latest().references ?? []
      if (current.length + files.length > REFERENCE_LIMIT) throw new Error(pt ? 'O limite é de seis referências por livro.' : 'Each book can have up to six references.')
      const prepared = files.map(file => {
        const ext = REFERENCE_MIME[file.type as keyof typeof REFERENCE_MIME]
        if (!ext || file.size > REFERENCE_BYTES || file.size === 0) {
          throw new Error(pt ? 'Selecione imagens PNG, JPG ou WebP de até 2 MB.' : 'Choose PNG, JPG or WebP images up to 2 MB.')
        }
        const id = crypto.randomUUID()
        return { file, ref: { id, file: `${id}.${ext}`, name: file.name.slice(0, 160), type: 'style', instructions: '' } as ComicReference }
      })
      const uploaded: string[] = []
      try {
        for (const { file, ref } of prepared) {
          const path = `${folder}/${ref.file}`
          const { error } = await storage.upload(path, file, { contentType: file.type })
          if (error) throw new Error(error.message)
          uploaded.push(path)
        }
        await persist({ references: [...current, ...prepared.map(p => p.ref)] })
      } catch (e) {
        if (uploaded.length) await storage.remove(uploaded)
        throw e
      }
    })
  }

  const updateRef = (ref: ComicReference, updates: Partial<ComicReference>) =>
    execute(() => persist({ references: (latest().references ?? []).map(r => r.id === ref.id ? { ...r, ...updates } : r) }))
  const reorder = (id: string, to: number) => execute(async () => {
    const next = [...(latest().references ?? [])]
    const from = next.findIndex(r => r.id === id)
    if (from < 0 || to < 0 || to >= next.length) return
    const [ref] = next.splice(from, 1)
    next.splice(to, 0, ref)
    await persist({ references: next })
  })
  const remove = (ref: ComicReference) => execute(async () => {
    if (!storage) return
    const old = latest().references ?? []
    await persist({ references: old.filter(r => r.id !== ref.id) })
    const { error } = await storage.remove([`${folder}/${ref.file}`])
    if (error) {
      await persist({ references: old })
      throw new Error(error.message)
    }
  })

  return <section className="grid gap-5">
    <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
      {pt ? 'As mudanças valem para novas gerações. As páginas prontas mantêm a direção de arte usada quando foram geradas.'
        : 'Changes apply to new generations. Existing pages keep the art direction used when they were created.'}
    </p>
    {book.comicStyleDoc?.research?.sources.length ? (
      <details className="text-sm">
        <summary>{pt ? 'Fontes da direção de arte' : 'Art direction sources'}</summary>
        <ul className="mt-2 space-y-1">
          {book.comicStyleDoc.research.sources.filter(source => /^https?:\/\//i.test(source.url)).map(source => (
            <li key={source.url}><a className="underline" href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>
          ))}
        </ul>
      </details>
    ) : null}
    <fieldset disabled={!userId || busy} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {STYLE_FIELDS.map((key, i) => <label className="grid gap-1 text-sm" key={key}>{artLabels[i]}
        {key === 'fonts' || key === 'lettering' || key === 'realism' ? <select className={inputStyle} value={art[key]} onChange={e => setArt({ ...art, [key]: e.target.value })}>
          <option value="">{pt ? 'Automático' : 'Automatic'}</option>
          {key === 'fonts' && <><option value="humanist">{pt ? 'Humanista' : 'Humanist'}</option><option value="serif">{pt ? 'Com serifa' : 'Serif'}</option><option value="sans">{pt ? 'Sem serifa' : 'Sans serif'}</option></>}
          {key === 'lettering' && <><option value="white">{pt ? 'Branco' : 'White'}</option><option value="paper">{pt ? 'Papel quente' : 'Warm paper'}</option></>}
          {key === 'realism' && <><option value="illustrated">{pt ? 'Ilustrado' : 'Illustrated'}</option><option value="stylized">{pt ? 'Estilizado' : 'Stylized'}</option><option value="realistic">{pt ? 'Traço realista' : 'Realistic line art'}</option></>}
          {art[key] && !(key === 'fonts' ? ['humanist', 'serif', 'sans'] : key === 'lettering' ? ['white', 'paper'] : ['illustrated', 'stylized', 'realistic']).includes(art[key]) &&
            <option value={art[key]}>{art[key]}</option>}
        </select> : <input className={inputStyle} maxLength={700} value={art[key]} onChange={e => setArt({ ...art, [key]: e.target.value })} />}
      </label>)}
      <button type="button" className="justify-self-start font-semibold underline" onClick={() => execute(() => persist(art))}>
        {pt ? 'Salvar direção de arte' : 'Save art direction'}
      </button>
    </fieldset>
    <fieldset className="grid gap-3" disabled={!userId || busy}>
      <legend className="mb-2 text-base font-semibold">{pt ? 'Referências Visuais' : 'Visual References'}</legend>
      <label className="grid gap-1 text-sm">{pt ? 'Adicionar imagens (PNG, JPG ou WebP, até 2 MB)' : 'Add images (PNG, JPG or WebP, up to 2 MB)'}
        <input type="file" accept={Object.keys(REFERENCE_MIME).join(',')} multiple disabled={references.length >= REFERENCE_LIMIT}
          onChange={e => { const files = Array.from<File>(e.currentTarget.files ?? []); e.target.value = ''; void upload(files) }} />
      </label>
      {!userId && <p>{pt ? 'Entre na sua conta para salvar a direção de arte e as referências.' : 'Sign in to save art direction and references.'}</p>}
      <ol className="grid gap-3">
        {references.map((ref, i) => <li key={ref.id} className="flex gap-3 rounded-lg border p-3 text-sm">
          <Thumbnail path={`${folder}/${ref.file}`} name={ref.name} />
          <div className="grid flex-1 min-w-0 gap-2">
            <div className="break-all font-medium">{i + 1}. {ref.name} {i === 0 && (pt ? '(Principal)' : '(Primary)')}</div>
            <label>{pt ? 'Tipo' : 'Type'} <select value={ref.type} onChange={e => void updateRef(ref, { type: e.target.value as ComicReference['type'] })}>
              {REFERENCE_TYPES.map((type, index) => <option key={type} value={type}>{pt ? ['Estilo', 'Personagem', 'Cenário', 'Paleta'][index] : type}</option>)}
            </select></label>
            <label className="grid gap-1">{pt ? 'Instruções' : 'Instructions'}
              <input className={inputStyle} maxLength={400} value={notes[ref.id] ?? ref.instructions} onChange={e => setNotes({ ...notes, [ref.id]: e.target.value })} />
            </label>
            <div className="flex flex-wrap gap-3">
              {notes[ref.id] !== undefined && notes[ref.id] !== ref.instructions && <button type="button" className="underline" onClick={() => updateRef(ref, { instructions: notes[ref.id] })}>{pt ? 'Salvar instruções' : 'Save instructions'}</button>}
              {i > 0 && <button type="button" className="underline" onClick={() => reorder(ref.id, 0)}>{pt ? 'Tornar principal' : 'Make primary'}</button>}
              {i > 0 && <button type="button" aria-label={pt ? 'Aumentar prioridade' : 'Raise priority'} onClick={() => reorder(ref.id, i - 1)}>↑</button>}
              {i < references.length - 1 && <button type="button" aria-label={pt ? 'Diminuir prioridade' : 'Lower priority'} onClick={() => reorder(ref.id, i + 1)}>↓</button>}
              <button type="button" className="underline" onClick={() => remove(ref)}>{pt ? 'Remover' : 'Remove'}</button>
            </div>
          </div>
        </li>)}
      </ol>
    </fieldset>
    <p role={failure ? 'alert' : 'status'} className={failure ? 'text-red-600 text-sm' : 'text-sm'}>{message}</p>
  </section>
}
