// Peças da tela de Ajustes: seção com ícone, cartão com linhas e linha com rótulo à esquerda e controle à direita.
import { type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export function SettingsSection({ id, icon: Icon, title, description, action, children, plain }: {
  id: string; icon: LucideIcon; title: string; description?: string; action?: ReactNode; children: ReactNode
  /** Sem o cartão em volta (para conteúdos que já têm o próprio layout). */
  plain?: boolean
}) {
  return (
    <section id={id} data-settings-section className="scroll-mt-24">
      <header className="mb-3.5 flex items-start gap-3">
        <span className="mt-0.5 w-9 h-9 shrink-0 rounded-xl grid place-items-center" style={{ backgroundColor: 'var(--theme-bg-secondary)', color: 'var(--theme-text)' }}>
          <Icon className="w-[18px] h-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold leading-tight" style={{ color: 'var(--theme-text)' }}>{title}</h2>
          {description && <p className="mt-1 text-[13.5px] leading-snug" style={{ color: 'var(--theme-text-secondary)' }}>{description}</p>}
        </div>
        {action && <div className="shrink-0 self-center">{action}</div>}
      </header>
      {plain ? children : <SettingsCard>{children}</SettingsCard>}
    </section>
  )
}

export function SettingsCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border overflow-hidden divide-y', className)} style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
      {children}
    </div>
  )
}

/** Linha: rótulo e explicação à esquerda, controle à direita. No celular o controle desce para baixo do texto. */
export function SettingsRow({ label, hint, children, below, stack, inline }: {
  label: ReactNode; hint?: ReactNode; children?: ReactNode
  /** Conteúdo de largura total abaixo da linha (formulário que abre, aviso). */
  below?: ReactNode
  /** Controle sempre embaixo do texto (campos largos). */
  stack?: boolean
  /** Controle pequeno (um botão): fica à direita também no celular. */
  inline?: boolean
}) {
  return (
    <div className="px-5 py-4" style={{ borderColor: 'var(--theme-border)' }}>
      <div className={cn('flex gap-3', inline ? 'flex-row items-center justify-between gap-4' : 'flex-col', !stack && !inline && 'sm:flex-row sm:items-center sm:justify-between sm:gap-8')}>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-medium" style={{ color: 'var(--theme-text)' }}>{label}</p>
          {hint && <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: 'var(--theme-text-secondary)' }}>{hint}</p>}
        </div>
        {children != null && <div className={cn('min-w-0', inline ? 'shrink-0' : !stack && 'sm:shrink-0')}>{children}</div>}
      </div>
      {below}
    </div>
  )
}

/** Linha com interruptor: clicar em qualquer parte da linha liga ou desliga. */
export function SettingsToggle({ label, hint, checked, onChange, disabled }: { label: ReactNode; hint?: ReactNode; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-6 px-5 py-4', disabled ? 'opacity-55' : 'cursor-pointer')} style={{ borderColor: 'var(--theme-border)' }}
      onClick={e => { if (!disabled && !(e.target as HTMLElement).closest('button')) onChange(!checked) }}>
      <div className="min-w-0">
        <p className="text-[14.5px] font-medium" style={{ color: 'var(--theme-text)' }}>{label}</p>
        {hint && <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: 'var(--theme-text-secondary)' }}>{hint}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={typeof label === 'string' ? label : undefined} />
    </div>
  )
}

export function SettingsNote({ tone, children }: { tone: 'ok' | 'error'; children: ReactNode }) {
  return <p className="mt-2 text-[12.5px]" style={{ color: tone === 'ok' ? 'var(--pastel-green-fg)' : 'var(--color-destructive)' }}>{children}</p>
}
