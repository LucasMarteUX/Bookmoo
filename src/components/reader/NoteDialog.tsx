import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

type Draft = {
  quote?: string
  note: string
}

/** Caixa para escrever a anotação do pin. O trecho marcado fica visível em cima. */
export function NoteDialog({
  open, draft, pt, onClose, onSave, onDelete,
}: {
  open: boolean
  draft: Draft | null
  pt: boolean
  onClose: () => void
  onSave: (note: string) => void
  onDelete?: () => void
}) {
  const [note, setNote] = useState(draft?.note ?? '')
  useEffect(() => { if (open) setNote(draft?.note ?? '') }, [open, draft?.note])
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogTitle>{pt ? 'Sua nota' : 'Your note'}</DialogTitle>
        {draft?.quote && (
          <p className="text-[14px] leading-snug rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--theme-pastel-3)', color: 'var(--theme-pastel-text)' }}>
            {draft.quote}
          </p>
        )}
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={5}
          autoFocus
          placeholder={pt ? 'Escreva o que quiser lembrar deste trecho…' : 'Write whatever you want to remember…'}
          className="w-full rounded-xl border px-3 py-2 text-[14px] outline-none resize-none"
          style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)' }}
        />
        <div className="flex items-center justify-between gap-2">
          {onDelete ? (
            <button type="button" onClick={onDelete} className="text-[13px] underline" style={{ color: 'var(--pastel-rose-fg)' }}>
              {pt ? 'Apagar pin' : 'Remove pin'}
            </button>
          ) : <span />}
          <button type="button" disabled={!note.trim()} onClick={() => onSave(note.trim())}
            className="h-9 px-4 rounded-lg text-[13.5px] font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
            {pt ? 'Salvar' : 'Save'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
