import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Rounded container that groups related tools (one visual unit in the reader toolbar). */
export function ToolGroup({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div role="group" aria-label={label}
      className={cn('flex items-center gap-0.5 p-1 rounded-xl border backdrop-blur-md shadow-[0_1px_2px_rgba(15,15,15,0.05),0_6px_20px_-10px_rgba(15,15,15,0.25)]', className)}
      style={{ backgroundColor: 'color-mix(in srgb, var(--theme-card-bg) 86%, transparent)', borderColor: 'var(--theme-border)' }}>
      {children}
    </div>
  )
}

export function ToolDivider() {
  return <span aria-hidden className="mx-1 h-5 w-px" style={{ backgroundColor: 'var(--theme-border-subtle)' }} />
}

type ToolButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode
  /** Visible text. Omit for icon-only buttons (then `hint` becomes the accessible name). */
  label?: ReactNode
  /** Short explanation shown on hover. */
  hint?: string
  active?: boolean
  tone?: 'default' | 'danger' | 'primary'
  /** Hide the label on small screens, keeping only the icon. */
  compact?: boolean
}

/** Single tool: icon + optional label, same size and states everywhere in the reader. */
export const ToolButton = forwardRef<HTMLButtonElement, ToolButtonProps>(function ToolButton(
  { icon, label, hint, active, tone = 'default', compact, className, style, ...props }, ref) {
  return (
    <button ref={ref} type="button" title={hint} aria-label={label ? undefined : hint} aria-pressed={active}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 h-8 min-w-8 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all',
        'disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)]/40',
        label ? 'px-2.5' : 'px-0',
        !active && 'hover:bg-[var(--theme-nav-hover)]',
        className,
      )}
      style={{
        backgroundColor: active ? 'var(--theme-nav-active)' : tone === 'primary' ? 'var(--theme-primary)' : undefined,
        color: tone === 'danger' ? 'var(--pastel-rose-fg)' : tone === 'primary' ? 'var(--theme-primary-text)' : active ? 'var(--theme-text)' : 'var(--theme-text-secondary)',
        boxShadow: undefined,
        ...style,
      }}
      {...props}>
      {icon}
      {label && <span className={compact ? 'hidden md:inline' : undefined}>{label}</span>}
    </button>
  )
})

/** Item inside a tool menu (popover), with optional description line. */
export function MenuItem({ icon, label, description, onClick, tone, disabled }: {
  icon: ReactNode; label: string; description?: string; onClick: () => void; tone?: 'danger'; disabled?: boolean
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="w-full flex items-start gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors hover:bg-[var(--theme-nav-hover)] disabled:opacity-40"
      style={{ color: tone === 'danger' ? 'var(--pastel-rose-fg)' : 'var(--theme-text)' }}>
      <span className="mt-0.5 shrink-0 opacity-70 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium">{label}</span>
        {description && <span className="block text-xs mt-0.5" style={{ color: 'var(--theme-text-secondary)' }}>{description}</span>}
      </span>
    </button>
  )
}

export function MenuSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-2.5 pt-1.5 pb-1 text-[11.5px] font-medium" style={{ color: 'var(--theme-text-secondary)' }}>{title}</p>
      {children}
    </div>
  )
}
