import * as React from 'react'
import * as RDialog from '@radix-ui/react-dialog'
import { Drawer } from 'vaul'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useLanguage } from '@/store/useLanguage'

/**
 * Diálogo acessível (Radix: foco preso e devolvido, Esc, scroll travado, aria ligado ao título).
 * No celular vira bottom sheet nativo (vaul): arrasta para fechar, alça no topo, respeita safe area.
 * A API pública é a mesma de antes: <Dialog open onOpenChange><DialogContent>…</DialogContent></Dialog>.
 */
type Mode = 'sheet' | 'modal'
const DialogContext = React.createContext<{ open: boolean; onOpenChange: (open: boolean) => void; mode: Mode }>({
  open: false,
  onOpenChange: () => {},
  mode: 'modal',
})

export function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
  const isMobile = useIsMobile()
  const mode: Mode = isMobile ? 'sheet' : 'modal'
  const ctx = React.useMemo(() => ({ open, onOpenChange, mode }), [open, onOpenChange, mode])
  if (mode === 'sheet') {
    return (
      <DialogContext.Provider value={ctx}>
        <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>{children}</Drawer.Root>
      </DialogContext.Provider>
    )
  }
  return (
    <DialogContext.Provider value={ctx}>
      <RDialog.Root open={open} onOpenChange={onOpenChange}>{children}</RDialog.Root>
    </DialogContext.Provider>
  )
}

function CloseButton() {
  const pt = useLanguage().locale === 'pt-BR'
  const { mode } = React.useContext(DialogContext)
  const Close = mode === 'sheet' ? Drawer.Close : RDialog.Close
  return (
    <Close
      className="absolute right-2 top-2 z-10 w-11 h-11 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--ui-hover)] active:bg-[var(--theme-nav-active)] focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ color: 'var(--theme-text-secondary)' }}
      aria-label={pt ? 'Fechar' : 'Close'}
    >
      <X className="w-[18px] h-[18px]" />
    </Close>
  )
}

export function DialogContent({ className, children, style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { mode } = React.useContext(DialogContext)

  if (mode === 'sheet') {
    return (
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className={cn(
            'elevated sheet-content fixed inset-x-0 bottom-0 z-[61] grid gap-4 p-5 pt-7 outline-none',
            'max-h-[92dvh] overflow-y-auto overscroll-contain',
            className,
            // O sheet sempre ocupa a largura toda, independente do tamanho pedido para o desktop.
            // (e preso embaixo mesmo se a tela passar "relative" para o layout de desktop).
            '!w-full !max-w-none !m-0 !fixed !inset-x-0 !bottom-0 !top-auto',
          )}
          style={{
            color: 'var(--theme-text)',
            ...style,
            width: '100%',
            maxWidth: 'none',
            borderRadius: 'var(--sheet-radius) var(--sheet-radius) 0 0',
            paddingBottom: 'calc(1.25rem + var(--safe-b))',
          }}
          {...props}
        >
          <div aria-hidden className="absolute left-1/2 top-2 -translate-x-1/2 h-[5px] w-9 rounded-full" style={{ backgroundColor: 'var(--theme-border)' }} />
          <CloseButton />
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    )
  }

  return (
    <RDialog.Portal>
      <RDialog.Overlay className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px] dialog-fade" />
      <div className="fixed inset-0 z-[61] flex items-start justify-center overflow-y-auto py-6 sm:py-[8vh] px-4 sm:px-0 pointer-events-none">
        <RDialog.Content
          aria-describedby={undefined}
          className={cn('elevated dialog-pop pointer-events-auto relative grid w-full max-w-lg gap-4 p-6 sm:max-w-md outline-none', className)}
          style={{ color: 'var(--theme-text)', borderRadius: '16px', ...style }}
          {...props}
        >
          <CloseButton />
          {children}
        </RDialog.Content>
      </div>
    </RDialog.Portal>
  )
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 text-left pr-10', className)} {...props} />
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const { mode } = React.useContext(DialogContext)
  const Title = mode === 'sheet' ? Drawer.Title : RDialog.Title
  return <Title className={cn('text-[17px] font-semibold tracking-tight pr-10', className)} {...props} />
}

export function DialogDescription({ className, style, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const { mode } = React.useContext(DialogContext)
  const Desc = mode === 'sheet' ? Drawer.Description : RDialog.Description
  return <Desc className={cn('text-[13px] leading-relaxed transition-colors', className)} style={{ color: 'var(--theme-text-secondary)', ...style }} {...props} />
}
