import type { LucideIcon } from 'lucide-react'
import { Drawer } from 'vaul'
import { useLanguage } from '@/store/useLanguage'
import { haptics } from '@/lib/haptics'

export type ActionSheetAction = {
  label: string
  icon?: LucideIcon
  destructive?: boolean
  disabled?: boolean
  onSelect: () => void
}

/**
 * Action sheet no estilo iOS: grupo de ações + "Cancelar" separado, sobe de baixo, arrasta para fechar.
 * Usado no celular e no desktop (no desktop aparece igual, centralizado embaixo e com largura limitada).
 */
export function ActionSheet({ open, onOpenChange, title, message, actions }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  message?: string
  actions: ActionSheetAction[]
}) {
  const pt = useLanguage().locale === 'pt-BR'
  const row = 'w-full min-h-[3.5rem] px-4 flex items-center justify-center gap-2 text-[17px] transition-colors active:bg-[var(--theme-nav-active)] hover:bg-[var(--theme-nav-hover)] disabled:opacity-40 focus-visible:outline-2 focus-visible:-outline-offset-2'
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[70] bg-black/40" />
        <Drawer.Content aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-[71] mx-auto w-full max-w-md px-2 outline-none"
          style={{ paddingBottom: 'calc(0.5rem + var(--safe-b))' }}>
          <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: 'var(--theme-card-bg)' }}>
            {(title || message) ? (
              <div className="px-4 py-3 text-center border-b" style={{ borderColor: 'var(--theme-border-subtle)' }}>
                {title ? <Drawer.Title className="text-[13px] font-semibold" style={{ color: 'var(--theme-text-secondary)' }}>{title}</Drawer.Title> : null}
                {message ? <p className="text-[13px] mt-0.5" style={{ color: 'var(--theme-text-secondary)' }}>{message}</p> : null}
              </div>
            ) : <Drawer.Title className="sr-only">{pt ? 'Ações' : 'Actions'}</Drawer.Title>}
            <ul role="list">
              {actions.map((a, i) => {
                const Icon = a.icon
                return (
                  <li key={a.label} className={i > 0 ? 'border-t' : ''} style={{ borderColor: 'var(--theme-border-subtle)' }}>
                    <button type="button" disabled={a.disabled} className={row}
                      style={{ color: a.destructive ? 'var(--color-destructive)' : 'var(--theme-accent, var(--theme-text))' }}
                      onClick={() => {
                        a.destructive ? haptics.notify('warning') : haptics.selection()
                        onOpenChange(false)
                        // Deixa o sheet começar a fechar antes de abrir outro diálogo/navegar.
                        setTimeout(a.onSelect, 120)
                      }}>
                      {Icon ? <Icon className="w-5 h-5" aria-hidden /> : null}
                      {a.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
          <Drawer.Close className={`${row} mt-2 rounded-2xl font-semibold`} style={{ backgroundColor: 'var(--theme-card-bg)', color: 'var(--theme-text)' }}>
            {pt ? 'Cancelar' : 'Cancel'}
          </Drawer.Close>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
