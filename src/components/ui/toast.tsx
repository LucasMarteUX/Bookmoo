import { create } from 'zustand'
import { useEffect } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'
import { haptics } from '@/lib/haptics'

type Tone = 'success' | 'error' | 'info'
type Toast = { id: number; message: string; tone: Tone; action?: { label: string; onClick: () => void }; duration: number }

const useToasts = create<{ items: Toast[]; push: (t: Omit<Toast, 'id'>) => void; dismiss: (id: number) => void }>(set => ({
  items: [],
  push: t => set(s => ({ items: [...s.items.slice(-2), { ...t, id: Date.now() + Math.random() }] })),
  dismiss: id => set(s => ({ items: s.items.filter(i => i.id !== id) })),
}))

/** toast('Salvo') · toast('Falhou', { tone: 'error' }) — erros ficam mais tempo na tela. */
export function toast(message: string, opts: { tone?: Tone; action?: Toast['action']; duration?: number } = {}) {
  const tone = opts.tone ?? 'success'
  if (tone === 'error') haptics.notify('error')
  else if (tone === 'success') haptics.notify('success')
  useToasts.getState().push({ message, tone, action: opts.action, duration: opts.duration ?? (tone === 'error' ? 8000 : 4000) })
}

function Item({ t }: { t: Toast }) {
  const dismiss = useToasts(s => s.dismiss)
  useEffect(() => {
    const id = setTimeout(() => dismiss(t.id), t.duration)
    return () => clearTimeout(id)
  }, [t, dismiss])
  const Icon = t.tone === 'error' ? AlertTriangle : t.tone === 'info' ? Info : CheckCircle2
  const color = t.tone === 'error' ? 'var(--color-destructive)' : t.tone === 'info' ? 'var(--theme-text-secondary)' : 'var(--color-success)'
  return (
    <div role={t.tone === 'error' ? 'alert' : 'status'}
      className="toast-in pointer-events-auto flex items-center gap-3 rounded-2xl border pl-4 pr-1 py-1 min-h-[3rem] shadow-lg backdrop-blur-md w-full max-w-sm"
      style={{ backgroundColor: 'color-mix(in srgb, var(--theme-card-bg) 92%, transparent)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}>
      <Icon className="w-5 h-5 shrink-0" style={{ color }} aria-hidden />
      <p className="flex-1 text-[15px] leading-snug py-2">{t.message}</p>
      {t.action ? (
        <button type="button" className="min-h-[var(--hit)] px-3 text-[15px] font-semibold" style={{ color: 'var(--theme-accent, var(--theme-text))' }}
          onClick={() => { t.action!.onClick(); dismiss(t.id) }}>{t.action.label}</button>
      ) : null}
      <button type="button" aria-label="OK" className="w-11 h-11 grid place-items-center rounded-full" style={{ color: 'var(--theme-text-secondary)' }} onClick={() => dismiss(t.id)}>
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

/** Banners no topo (abaixo da barra de status), como notificações do iOS. */
export function Toaster() {
  const items = useToasts(s => s.items)
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 z-[90] flex flex-col items-center gap-2 px-3"
      style={{ top: 'calc(var(--safe-t) + 0.5rem)' }}>
      {items.map(t => <Item key={t.id} t={t} />)}
    </div>
  )
}
