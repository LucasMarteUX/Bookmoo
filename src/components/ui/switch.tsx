import { haptics } from '@/lib/haptics'
import { cn } from '@/lib/utils'

/** Interruptor do app (liga/desliga), acessível como role="switch". Um só desenho para todas as telas. */
export function Switch({ checked, onChange, disabled, label, className }: {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  /** Nome lido pelo leitor de tela quando não há rótulo visível ligado ao controle. */
  label?: string
  className?: string
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => { onChange(!checked); haptics.selection() }}
      className={cn('relative inline-flex h-[26px] w-[44px] shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-bg)] disabled:opacity-45 disabled:cursor-not-allowed', className)}
      style={{ backgroundColor: checked ? 'var(--theme-primary)' : 'color-mix(in srgb, var(--theme-text) 16%, transparent)' }}>
      <span aria-hidden className="absolute top-[3px] left-[3px] h-5 w-5 rounded-full transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(0)', backgroundColor: checked ? 'var(--theme-primary-text)' : '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
    </button>
  )
}
