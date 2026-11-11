import { useRef, type KeyboardEvent } from 'react'
import { haptics } from '@/lib/haptics'
import { cn } from '@/lib/utils'

/** Segmented control do iOS, acessível como radiogroup (setas trocam a opção). */
export function SegmentedControl<T extends string>({ value, onChange, options, label, className }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  label: string
  className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const idx = options.findIndex(o => o.value === value)
  const onKey = (e: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const n = options.length
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (idx + (e.key === 'ArrowRight' ? 1 : -1) + n) % n
    onChange(options[next].value)
    haptics.selection()
    refs.current[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKey}
      className={cn('inline-flex p-0.5 rounded-[10px] gap-0.5', className)} style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
      {options.map((o, i) => {
        const active = o.value === value
        return (
          <button key={o.value} ref={el => { refs.current[i] = el }} type="button" role="radio" aria-checked={active} tabIndex={active ? 0 : -1}
            onClick={() => { if (!active) { onChange(o.value); haptics.selection() } }}
            className="flex-1 min-h-[2.25rem] px-3 rounded-[8px] text-[13px] font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-1"
            style={{
              backgroundColor: active ? 'var(--theme-card-bg)' : 'transparent',
              color: active ? 'var(--theme-text)' : 'var(--theme-text-secondary)',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.10), 0 1px 1px rgba(0,0,0,0.04)' : 'none',
            }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
