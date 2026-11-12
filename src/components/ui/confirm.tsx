// Confirmação do próprio app no lugar de window.confirm: o navegador do app e o WebView do iOS
// podem bloquear o diálogo nativo (aí o clique "não fazia nada"). Uso: if (!(await askConfirm('Apagar?'))) return
import { create } from 'zustand'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useLanguage } from '@/store/useLanguage'

type Ask = { message: string; detail?: string; confirmLabel?: string; danger: boolean; resolve: (ok: boolean) => void }

const useConfirm = create<{ ask: Ask | null; set: (ask: Ask | null) => void }>(set => ({ ask: null, set: ask => set({ ask }) }))

/** Abre a confirmação e resolve true (confirmou) ou false (cancelou/fechou). Ações destrutivas por padrão. */
export function askConfirm(message: string, opts: { detail?: string; confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise(resolve => {
    useConfirm.getState().ask?.resolve(false)
    useConfirm.getState().set({ message, detail: opts.detail, confirmLabel: opts.confirmLabel, danger: opts.danger ?? true, resolve })
  })
}

export function ConfirmHost() {
  const { ask, set } = useConfirm()
  const pt = useLanguage().locale === 'pt-BR'
  const close = (ok: boolean) => { ask?.resolve(ok); set(null) }
  return (
    <Dialog open={!!ask} onOpenChange={open => { if (!open) close(false) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[17px] leading-snug">{ask?.message}</DialogTitle>
          {ask?.detail && <DialogDescription>{ask.detail}</DialogDescription>}
        </DialogHeader>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={() => close(false)} className="h-10 px-4 rounded-full text-[14px] font-medium"
            style={{ color: 'var(--theme-text-secondary)' }}>{pt ? 'Cancelar' : 'Cancel'}</button>
          <button type="button" autoFocus onClick={() => close(true)} className="h-10 px-5 rounded-full text-[14px] font-semibold"
            style={ask?.danger ? { backgroundColor: 'var(--color-destructive, #c0392b)', color: '#fff' } : { backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            {ask?.confirmLabel ?? (pt ? 'Confirmar' : 'Confirm')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
