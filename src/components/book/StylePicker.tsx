// Seletor do banco de estilos. Cards de altura fixa (alinhados), estilos prontos separados dos
// "Em breve" e uma barra fixa embaixo com o escolhido. Tocar só seleciona; aplicar é no botão.
// No celular o Dialog vira bottom sheet: 2 colunas, barra presa ao fim com a área segura.
import { useEffect, useState } from 'react'
import { Check, Clock } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { applyBookStyle, loadStyleBank, stylePreview, type BankStyle } from '@/lib/comicStyles'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/toast'
import type { Book } from '@/store/useBookStore'

const muted = { color: 'var(--theme-text-secondary)' }

export function useStyleBank(pt: boolean) {
  const [styles, setStyles] = useState<BankStyle[] | null>(null)
  useEffect(() => { void loadStyleBank(pt).then(setStyles) }, [pt])
  return styles
}

/**
 * Trocar o estilo do livro: grava e avisa. A confirmação (páginas que serão apagadas) é feita no
 * próprio modal com `warn` — nada de window.confirm, que o app/WebView pode bloquear.
 * Devolve true quando trocou.
 */
export function useApplyBookStyle(book: Book, userId: string | undefined, pt: boolean, styles: BankStyle[] | null) {
  const [busy, setBusy] = useState(false)
  const generated = Object.keys(book.comicPages ?? {}).length
  const warn = (styleId: string) => {
    if (!generated || styleId === book.comicStyleDoc?.styleId) return null
    const name = styles?.find(style => style.id === styleId)?.name ?? styleId
    return pt ? `Isso apaga as ${generated} páginas desenhadas deste livro e recomeça em ${name}.` : `This deletes the ${generated} drawn pages of this book and starts over in ${name}.`
  }
  const apply = async (styleId: string) => {
    if (styleId === book.comicStyleDoc?.styleId) return true
    const name = styles?.find(style => style.id === styleId)?.name ?? styleId
    setBusy(true)
    try {
      await applyBookStyle(book, styleId, userId)
      toast(pt ? `Estilo trocado para ${name}. As próximas páginas usam o novo estilo.` : `Style changed to ${name}. New pages use it.`, { tone: 'success' })
      return true
    } catch (e) {
      toast(e instanceof Error ? e.message : pt ? 'Não foi possível trocar o estilo.' : 'Could not change the style.', { tone: 'error' })
      return false
    } finally {
      setBusy(false)
    }
  }
  return { apply, busy, warn }
}

type CardStyle = Pick<BankStyle, 'id' | 'name' | 'look' | 'ready'>

/** Card do estilo. Mesma altura em toda a grade: nome em 1 linha, linguagem em 2, nota em 1. */
export function StyleCard({ style, selected, onClick, note, compact = false, pt, preview }: {
  style: CardStyle
  /** Imagem no lugar da prévia do banco (o "Estilo original" usa a capa do livro). */
  preview?: string
  selected?: boolean
  onClick?: () => void
  note?: string
  compact?: boolean
  pt: boolean
}) {
  const soon = !style.ready
  const body = (
    <>
      <span className="relative block aspect-square overflow-hidden rounded-xl" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
        <img src={preview ?? stylePreview(style.id)} alt="" loading="lazy" decoding="async" draggable={false}
          className={cn('w-full h-full object-cover transition-transform duration-500 motion-reduce:transition-none', onClick && !soon && 'group-hover:scale-[1.04]', soon && 'saturate-[0.55]')} />
        {selected && (
          <span className="absolute right-2 top-2 w-7 h-7 grid place-items-center rounded-full shadow-sm" style={{ backgroundColor: 'var(--theme-text)', color: 'var(--theme-bg)' }}>
            <Check className="w-4 h-4" strokeWidth={2.5} />
          </span>
        )}
        {soon && (
          <span className="absolute left-2 top-2 h-6 px-2 inline-flex items-center gap-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: 'var(--theme-card-bg)', color: 'var(--theme-text-secondary)' }}>
            <Clock className="w-3 h-3" />{pt ? 'Em breve' : 'Soon'}
          </span>
        )}
      </span>
      <span className="block px-1 pt-2.5">
        <span className="block text-[13.5px] font-semibold leading-tight truncate">{style.name}</span>
        {!compact && <span className="mt-1 block text-[12px] leading-[1.35] line-clamp-2 min-h-[2.7em]" style={muted}>{style.look}</span>}
        {note !== undefined && <span className="mt-1 block text-[11.5px] font-medium truncate min-h-[1.35em]" style={muted}>{note}</span>}
      </span>
    </>
  )
  const frame = 'relative flex flex-col text-left rounded-2xl border p-2 pb-2.5 h-full'
  const frameStyle = {
    borderColor: selected ? 'var(--theme-text)' : 'var(--theme-border)',
    backgroundColor: 'var(--theme-card-bg)',
    boxShadow: selected ? '0 0 0 1px var(--theme-text)' : undefined,
    opacity: soon ? 0.72 : 1,
  }
  if (!onClick || soon) return <div className={frame} style={frameStyle} aria-disabled={soon || undefined}>{body}</div>
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={cn(frame, 'group transition-[border-color,box-shadow,transform] duration-200 active:scale-[0.98] motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2')}
      style={frameStyle}>
      {body}
    </button>
  )
}

const GRID = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4'

/**
 * Banco inteiro. `value` é o estilo atual; tocar só seleciona e a barra de baixo confirma.
 * `notes` aparece no card (por exemplo, quantas páginas já existem nesse estilo).
 */
export function StylePickerDialog({ open, onOpenChange, value, initial, onPick, pt, notes, title, description, confirmLabel, busy, secondary, warn }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value?: string | null
  /** Pré-seleção (ex.: estilo sugerido) sem ser o atual. */
  initial?: string | null
  onPick: (styleId: string) => void
  pt: boolean
  notes?: Record<string, string>
  title?: string
  description?: string
  confirmLabel?: string
  busy?: boolean
  /** Link discreto no rodapé (ex.: direção de arte avançada). */
  secondary?: { label: string; onClick: () => void }
  /** Aviso a confirmar antes de aplicar (ex.: páginas que serão apagadas). null = aplica direto. */
  warn?: (styleId: string) => string | null
}) {
  const styles = useStyleBank(pt)
  const [draft, setDraft] = useState<string | null>(initial ?? value ?? null)
  const [asking, setAsking] = useState(false)
  useEffect(() => { if (open) setDraft(initial ?? value ?? null) }, [open, value, initial])
  useEffect(() => { setAsking(false) }, [draft, open])
  const warning = draft ? warn?.(draft) ?? null : null
  const ready = (styles ?? []).filter(style => style.ready)
  const soon = (styles ?? []).filter(style => !style.ready)
  const chosen = ready.find(style => style.id === draft)
  const changed = !!draft && draft !== value
  const hasNotes = !!notes && Object.keys(notes).length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl sm:max-w-4xl p-0 sm:p-0 gap-0 overflow-hidden">
        <div className="max-h-[min(84vh,860px)] overflow-y-auto overscroll-contain">
          <DialogHeader className="px-5 sm:px-7 pt-6 sm:pt-7 pb-4 pr-14">
            <DialogTitle className="font-display text-[26px] sm:text-[30px] leading-tight">{title ?? (pt ? 'Banco de estilos' : 'Style bank')}</DialogTitle>
            <DialogDescription className="mt-1 max-w-2xl text-[13.5px] leading-relaxed">
              {description ?? (pt ? 'Escolha como as páginas deste livro vão ser desenhadas.' : 'Choose how this book’s pages will be drawn.')}
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 sm:px-7 pb-6 space-y-7">
            {secondary && (
              <button type="button" onClick={secondary.onClick} className="-mt-2 text-[13px] font-medium underline underline-offset-4" style={muted}>
                {secondary.label}
              </button>
            )}
            {styles === null
              ? <div className={GRID}>{Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[3/4] rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />)}</div>
              : <>
                  <section aria-labelledby="styles-ready">
                    <h3 id="styles-ready" className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em]" style={muted}>
                      {pt ? `Disponíveis · ${ready.length}` : `Available · ${ready.length}`}
                    </h3>
                    <div className={GRID}>
                      {ready.map(style => (
                        <StyleCard key={style.id} style={style} pt={pt} selected={draft === style.id}
                          note={hasNotes ? (notes?.[style.id] ?? (style.id === value ? (pt ? 'Estilo atual' : 'Current style') : '')) : (style.id === value ? (pt ? 'Estilo atual' : 'Current style') : undefined)}
                          onClick={() => setDraft(style.id)} />
                      ))}
                    </div>
                  </section>
                  {soon.length > 0 && (
                    <section aria-labelledby="styles-soon">
                      <h3 id="styles-soon" className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em]" style={muted}>
                        {pt ? `Em breve · ${soon.length}` : `Coming soon · ${soon.length}`}
                      </h3>
                      <div className={GRID}>
                        {soon.map(style => <StyleCard key={style.id} style={style} pt={pt} />)}
                      </div>
                    </section>
                  )}
                </>}
          </div>

          {/* Barra presa ao fim da rolagem: o escolhido e o botão. No celular respeita a área segura. */}
          <div className="sticky bottom-0 z-10 border-t px-5 sm:px-7 py-3.5 flex items-center gap-3"
            style={{ borderColor: 'var(--theme-border)', backgroundColor: 'color-mix(in srgb, var(--theme-card-bg) 94%, transparent)', backdropFilter: 'blur(12px)', paddingBottom: 'max(0.875rem, var(--safe-b, 0px))' }}>
            {asking && warning
              ? <span role="alert" className="flex-1 min-w-0 text-[13px] font-medium leading-snug" style={{ color: 'var(--pastel-rose-fg)' }}>{warning}</span>
              : chosen
              ? <>
                  <img src={stylePreview(chosen.id)} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-[14px] font-semibold truncate">{chosen.name}</span>
                    <span className="block text-[12px] truncate" style={muted}>{chosen.id === value ? (pt ? 'Este livro já usa este estilo. As próximas páginas saem nele.' : 'This book already uses it. New pages come out in it.') : chosen.use}</span>
                  </span>
                </>
              : <span className="flex-1 text-[13px]" style={muted}>{pt ? 'Toque num estilo para ver aqui.' : 'Tap a style to select it.'}</span>}
            <button type="button" onClick={() => asking ? setAsking(false) : onOpenChange(false)} className={cn(asking ? 'inline-flex' : 'hidden sm:inline-flex', 'h-10 px-4 shrink-0 items-center rounded-full text-[13.5px]')} style={muted}>
              {asking ? (pt ? 'Voltar' : 'Back') : (pt ? 'Cancelar' : 'Cancel')}
            </button>
            <button type="button" disabled={!changed || busy} onClick={() => { if (!draft) return; if (warning && !asking) { setAsking(true); return } onPick(draft) }}
              className="h-11 sm:h-10 px-5 shrink-0 inline-flex items-center rounded-full text-[14px] font-medium transition-opacity disabled:opacity-40"
              style={asking ? { backgroundColor: 'var(--pastel-rose-fg)', color: '#fff' } : { backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
              {asking ? (pt ? 'Apagar e usar' : 'Delete and use') : !changed && draft && draft === value ? (pt ? 'Já é o estilo atual' : 'Already in use') : confirmLabel ?? (pt ? 'Usar este estilo' : 'Use this style')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
