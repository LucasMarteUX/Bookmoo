// Seletor do banco de estilos: grade de prévias. Estilo sem prompt aparece como "Em breve".
import { useEffect, useState } from 'react'
import { Check, Clock } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { loadStyleBank, stylePreview, type BankStyle } from '@/lib/comicStyles'
import { cn } from '@/lib/utils'

const muted = { color: 'var(--theme-text-secondary)' }

export function useStyleBank(pt: boolean) {
  const [styles, setStyles] = useState<BankStyle[] | null>(null)
  useEffect(() => { void loadStyleBank(pt).then(setStyles) }, [pt])
  return styles
}

export function StyleCard({ style, selected, onClick, note, compact = false, pt }: {
  style: Pick<BankStyle, 'id' | 'name' | 'look' | 'ready'> & { use?: string }
  selected?: boolean
  onClick?: () => void
  note?: string
  compact?: boolean
  pt: boolean
}) {
  const disabled = !style.ready
  const body = (
    <>
      <span className="relative block aspect-square overflow-hidden rounded-xl" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
        <img src={stylePreview(style.id)} alt="" loading="lazy" decoding="async"
          className={cn('w-full h-full object-cover transition-transform duration-500 motion-reduce:transition-none', !disabled && 'group-hover:scale-[1.04]', disabled && 'opacity-60 grayscale-[35%]')} />
        {selected && (
          <span className="absolute right-2 top-2 w-6 h-6 grid place-items-center rounded-full" style={{ backgroundColor: 'var(--theme-text)', color: 'var(--theme-bg)' }}>
            <Check className="w-3.5 h-3.5" />
          </span>
        )}
        {disabled && (
          <span className="absolute left-2 top-2 h-6 px-2 inline-flex items-center gap-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: 'var(--theme-card-bg)', color: 'var(--theme-text)' }}>
            <Clock className="w-3 h-3" />{pt ? 'Em breve' : 'Soon'}
          </span>
        )}
      </span>
      <span className="mt-2 block text-[13.5px] font-medium leading-snug">{style.name}</span>
      {!compact && <span className="block text-[12px] leading-snug" style={muted}>{style.look}</span>}
      {note && <span className="mt-0.5 block text-[12px] font-medium" style={muted}>{note}</span>}
    </>
  )
  if (!onClick) return <div className="block text-left">{body}</div>
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected}
      className="group block text-left rounded-2xl p-1.5 -m-1.5 transition-colors outline-offset-2 hover:bg-[var(--theme-nav-hover)] disabled:cursor-not-allowed disabled:hover:bg-transparent"
      style={selected ? { boxShadow: '0 0 0 2px var(--theme-text)' } : undefined}>
      {body}
    </button>
  )
}

/** Diálogo com o banco inteiro. `notes` mostra, por estilo, quantas páginas já existem. */
export function StylePickerDialog({ open, onOpenChange, value, onPick, pt, notes, title, description }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value?: string | null
  onPick: (styleId: string) => void
  pt: boolean
  notes?: Record<string, string>
  title?: string
  description?: string
}) {
  const styles = useStyleBank(pt)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title ?? (pt ? 'Banco de estilos' : 'Style bank')}</DialogTitle>
          <DialogDescription>{description ?? (pt ? 'Escolha como as páginas deste livro vão ser desenhadas.' : 'Choose how this book’s pages will be drawn.')}</DialogDescription>
        </DialogHeader>
        <div className="mt-3 max-h-[64vh] overflow-y-auto -mx-1 px-1 pb-2">
          {styles === null
            ? <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-square rounded-xl animate-pulse" style={{ backgroundColor: 'var(--theme-bg-secondary)' }} />)}</div>
            : <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-5">
                {styles.map(style => (
                  <StyleCard key={style.id} style={style} pt={pt} selected={value === style.id} note={notes?.[style.id]}
                    onClick={() => onPick(style.id)} />
                ))}
              </div>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
