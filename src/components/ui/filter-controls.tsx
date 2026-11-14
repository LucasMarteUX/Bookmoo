// Controles de filtro padronizados (iguais aos da Biblioteca na home): abas segmentadas, busca, seletor e chip.
import type { ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const text = { color: 'var(--theme-text)' }
const muted = { color: 'var(--theme-text-secondary)' }
const field = { borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }

/** Abas segmentadas: trilho cinza com a aba ativa em card. `stretch` divide a largura entre as abas. */
export function SegmentedTabs<T extends string>({ value, onChange, options, label, stretch = false, className }: {
  value: T
  onChange: (value: T) => void
  options: { id: T; label: ReactNode; icon?: ReactNode; className?: string }[]
  label?: string
  stretch?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex p-0.5 rounded-lg', stretch ? 'w-full' : 'w-fit', 'max-w-full overflow-x-auto no-scrollbar', className)} style={{ backgroundColor: 'var(--theme-bg-secondary)' }} role="tablist" aria-label={label}>
      {options.map(option => {
        const on = value === option.id
        return (
          <button key={option.id} type="button" role="tab" aria-selected={on} onClick={() => onChange(option.id)}
            className={cn('h-7 px-2.5 inline-flex items-center justify-center gap-1.5 shrink-0 rounded-md text-[12.5px] font-medium whitespace-nowrap transition-colors', stretch && 'flex-1', option.className)}
            style={{ backgroundColor: on ? 'var(--theme-card-bg)' : 'transparent', color: on ? 'var(--theme-text)' : 'var(--theme-text-secondary)', boxShadow: on ? '0 1px 2px rgba(0,0,0,0.08)' : undefined }}>
            {option.icon}{option.label}
          </button>
        )
      })}
    </div>
  )
}

export function FilterSearch({ value, onChange, placeholder, className, label, grow = false }: { value: string; onChange: (value: string) => void; placeholder: string; className?: string; label?: string; /** Ocupa o espaço que sobrar na linha. */ grow?: boolean }) {
  return (
    <label className={cn('relative', grow && 'flex-1 min-w-[180px]', className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={muted} aria-hidden />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={label ?? placeholder}
        className={cn('h-8 rounded-lg border pl-8 pr-2 text-[13px] outline-none transition-colors focus:border-[var(--theme-text-secondary)]', grow ? 'w-full' : 'w-36')} style={field} />
    </label>
  )
}

export function FilterSelect({ value, onChange, options, label, active, className }: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  label: string
  /** Destaca o contorno quando o filtro está em uso. */
  active?: boolean
  className?: string
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} aria-label={label}
      className={cn('h-8 min-w-0 flex-1 basis-[7.5rem] sm:flex-none sm:basis-auto max-w-full sm:max-w-[11rem] rounded-lg border px-2 text-[13px] outline-none cursor-pointer', className)}
      style={{ ...field, borderColor: active ? 'var(--theme-text)' : 'var(--theme-border)', color: active === false ? 'var(--theme-text-secondary)' : 'var(--theme-text)' }}>
      {options.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
    </select>
  )
}

export function FilterChip({ on, onClick, children, className }: { on: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={cn('h-8 px-2.5 shrink-0 inline-flex items-center gap-1.5 rounded-lg border text-[13px] font-medium whitespace-nowrap transition-colors', className)}
      style={{ borderColor: on ? 'var(--theme-text)' : 'var(--theme-border)', backgroundColor: on ? 'var(--theme-text)' : 'var(--theme-bg)', color: on ? 'var(--theme-bg)' : 'var(--theme-text-secondary)' }}>
      {children}
    </button>
  )
}

export function FilterClear({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="h-8 px-2.5 shrink-0 inline-flex items-center gap-1 rounded-lg text-[13px] whitespace-nowrap hover:bg-[var(--ui-hover)]" style={muted}>
      <X className="w-3.5 h-3.5" />{children}
    </button>
  )
}
void text
