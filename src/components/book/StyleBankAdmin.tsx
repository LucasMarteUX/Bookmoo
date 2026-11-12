// Área admin: o super prompt de cada estilo do banco. Estilo com prompt fica pronto para escolha.
import { useEffect, useState } from 'react'
import { Check, Clock } from 'lucide-react'
import { toast } from '@/components/ui/toast'
import { adminSaveStylePrompt, adminStylePrompts, loadStyleBank, stylePreview, type BankStyle } from '@/lib/comicStyles'

export function StyleBankAdmin({ pt }: { pt: boolean }) {
  const [styles, setStyles] = useState<BankStyle[] | null>(null)
  const [prompts, setPrompts] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    const [bank, saved] = await Promise.all([loadStyleBank(pt, true), adminStylePrompts()])
    setStyles(bank); setPrompts(saved)
  }
  useEffect(() => { void reload() }, [pt])

  const save = async (id: string) => {
    setBusy(true)
    try {
      await adminSaveStylePrompt(id, drafts[id] ?? prompts[id] ?? '')
      toast(pt ? 'Prompt salvo.' : 'Prompt saved.', { tone: 'success' })
      setDrafts(current => { const next = { ...current }; delete next[id]; return next })
      await reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : (pt ? 'Não salvou.' : 'Not saved.'), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const readyCount = styles?.filter(style => style.ready).length ?? 0
  return (
    <section>
      <h2 className="text-[15px] font-semibold">{pt ? 'Banco de estilos' : 'Style bank'}</h2>
      <p className="mt-1 text-[13px]" style={{ color: 'var(--theme-text-secondary)' }}>
        {pt ? `${readyCount} de ${styles?.length ?? 16} estilos prontos. Cole o super prompt de cada estilo; com prompt, ele passa a aparecer para escolha e na escolha automática.`
          : `${readyCount} of ${styles?.length ?? 16} styles ready. Paste each style’s prompt; once saved it can be picked.`}
      </p>
      <ul className="mt-3 grid gap-2">
        {(styles ?? []).map(style => {
          const value = drafts[style.id] ?? prompts[style.id] ?? ''
          const expanded = open === style.id
          return (
            <li key={style.id} className="rounded-2xl border" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
              <button type="button" onClick={() => setOpen(expanded ? null : style.id)} aria-expanded={expanded} className="w-full p-3 flex items-center gap-3 text-left">
                <img src={stylePreview(style.id)} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">{String(style.position).padStart(2, '0')}. {style.name}</span>
                  <span className="block text-[12.5px] truncate" style={{ color: 'var(--theme-text-secondary)' }}>{style.use}</span>
                </span>
                <span className="shrink-0 h-7 px-2.5 inline-flex items-center gap-1 rounded-full text-[12px]"
                  style={style.ready ? { backgroundColor: 'var(--pastel-green-bg)', color: 'var(--pastel-green-fg)' } : { backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text-secondary)' }}>
                  {style.ready ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}{style.ready ? (pt ? 'Pronto' : 'Ready') : (pt ? 'Sem prompt' : 'No prompt')}
                </span>
              </button>
              {expanded && (
                <div className="px-3 pb-3 grid gap-2">
                  <textarea value={value} onChange={e => setDrafts({ ...drafts, [style.id]: e.target.value })} rows={12} maxLength={40000}
                    placeholder={pt ? 'Cole aqui o MASTER STYLE PROMPT deste estilo (pode incluir a parte SCENE TO ILLUSTRATE: ela é preenchida pelo app).' : 'Paste this style’s MASTER STYLE PROMPT.'}
                    className="w-full rounded-xl border px-3 py-2 text-[13px] leading-relaxed font-mono bg-transparent outline-none resize-y" style={{ borderColor: 'var(--theme-border)' }} />
                  <div className="flex items-center gap-3">
                    <button type="button" disabled={busy || value === (prompts[style.id] ?? '')} onClick={() => { void save(style.id) }}
                      className="h-9 px-4 rounded-full text-[13px] font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
                      {pt ? 'Salvar prompt' : 'Save prompt'}
                    </button>
                    <span className="text-[12px] tabular-nums" style={{ color: 'var(--theme-text-secondary)' }}>{value.length.toLocaleString()} {pt ? 'caracteres' : 'characters'}{value && value.length < 400 ? (pt ? ' · mínimo 400' : ' · min 400') : ''}</span>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
