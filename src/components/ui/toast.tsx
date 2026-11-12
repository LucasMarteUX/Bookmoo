import { create } from 'zustand'
import { useEffect, useState } from 'react'
import { AlertTriangle, AlertCircle, Info, Loader2, X } from 'lucide-react'
import { haptics } from '@/lib/haptics'

// Feedback do sistema (ver DESIGN_SYSTEM_INTERACOES.md):
// success = algo foi salvo/feito · error = falhou, diga o que fazer · warning = atenção, nada quebrou
// info = aviso neutro · loading = operação demorada (vira success/error com toastAsync)
type Tone = 'success' | 'error' | 'warning' | 'info' | 'loading'
type Toast = { id: number; message: string; detail?: string; tone: Tone; action?: { label: string; onClick: () => void }; duration: number; leaving?: boolean }

const useToasts = create<{
  items: Toast[]
  push: (t: Omit<Toast, 'id'>) => number
  update: (id: number, t: Partial<Omit<Toast, 'id'>>) => void
  leave: (id: number) => void
  dismiss: (id: number) => void
}>(set => ({
  items: [],
  push: t => { const id = Date.now() + Math.random(); set(s => ({ items: [...s.items.slice(-2), { ...t, id }] })); return id },
  update: (id, t) => set(s => ({ items: s.items.map(i => i.id === id ? { ...i, ...t } : i) })),
  leave: id => set(s => ({ items: s.items.map(i => i.id === id ? { ...i, leaving: true } : i) })),
  dismiss: id => set(s => ({ items: s.items.filter(i => i.id !== id) })),
}))

const DURATION: Record<Tone, number> = { success: 3500, info: 4500, warning: 6500, error: 8000, loading: 0 }

function buzz(tone: Tone) {
  if (tone === 'error') haptics.notify('error')
  else if (tone === 'warning') haptics.notify('warning')
  else if (tone === 'success') haptics.notify('success')
}

/** toast('Salvo') · toast('Falhou', { tone: 'error', detail: 'Tente de novo.' }) — erros ficam mais tempo na tela. */
export function toast(message: string, opts: { tone?: Tone; detail?: string; action?: Toast['action']; duration?: number } = {}) {
  const tone = opts.tone ?? 'success'
  buzz(tone)
  return useToasts.getState().push({ message, detail: opts.detail, tone, action: opts.action, duration: opts.duration ?? DURATION[tone] })
}

/** Mostra "carregando…" e troca por sucesso ou erro quando a promessa termina. */
export async function toastAsync<T>(promise: Promise<T>, msgs: { loading: string; success: string | ((v: T) => string); error: string | ((e: unknown) => string) }): Promise<T> {
  const id = toast(msgs.loading, { tone: 'loading' })
  const { update } = useToasts.getState()
  try {
    const v = await promise
    buzz('success')
    update(id, { tone: 'success', message: typeof msgs.success === 'function' ? msgs.success(v) : msgs.success, duration: DURATION.success })
    return v
  } catch (e) {
    buzz('error')
    update(id, { tone: 'error', message: typeof msgs.error === 'function' ? msgs.error(e) : msgs.error, duration: DURATION.error })
    throw e
  }
}

const TONE: Record<Tone, { color: string }> = {
  success: { color: 'var(--color-success)' },
  error: { color: 'var(--color-destructive)' },
  warning: { color: 'var(--color-warning)' },
  info: { color: 'var(--theme-text-secondary)' },
  loading: { color: 'var(--theme-text-secondary)' },
}

function SuccessIcon() {
  // Check desenhado (microanimação de sucesso).
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 anim-pop anim-check" aria-hidden fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" strokeWidth={2} opacity={0.25} />
      <path d="M7.5 12.5l3 3 6-6.5" />
    </svg>
  )
}

function Item({ t }: { t: Toast }) {
  const leave = useToasts(s => s.leave)
  const dismiss = useToasts(s => s.dismiss)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (!t.duration || paused || t.leaving) return
    const id = setTimeout(() => leave(t.id), t.duration)
    return () => clearTimeout(id)
  }, [t.duration, t.id, t.tone, t.leaving, paused, leave])
  useEffect(() => {
    if (!t.leaving) return
    const id = setTimeout(() => dismiss(t.id), 220)
    return () => clearTimeout(id)
  }, [t.leaving, t.id, dismiss])
  const { color } = TONE[t.tone]
  const Icon = t.tone === 'error' ? AlertCircle : t.tone === 'warning' ? AlertTriangle : t.tone === 'info' ? Info : null
  return (
    <div role={t.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      className={`${t.leaving ? 'toast-out' : 'toast-in'} ${t.tone === 'error' && !t.leaving ? 'anim-shake' : ''} relative pointer-events-auto flex items-center gap-3 rounded-2xl border pl-4 pr-1 py-1 min-h-[3rem] shadow-lg backdrop-blur-md w-full max-w-sm overflow-hidden`}
      style={{ backgroundColor: 'color-mix(in srgb, var(--theme-card-bg) 94%, transparent)', borderColor: 'var(--theme-border)', color: 'var(--theme-text)' }}>
      <span key={t.tone} style={{ color }} className="shrink-0 grid place-items-center">
        {t.tone === 'success' ? <SuccessIcon />
          : t.tone === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
          : Icon ? <Icon className="w-5 h-5 anim-pop" aria-hidden /> : null}
      </span>
      <div className="flex-1 py-2 min-w-0">
        <p className="text-[15px] leading-snug">{t.message}</p>
        {t.detail && <p className="text-[13px] leading-snug mt-0.5" style={{ color: 'var(--theme-text-secondary)' }}>{t.detail}</p>}
      </div>
      {t.action ? (
        <button type="button" className="ui-hover rounded-lg min-h-[var(--hit)] px-3 text-[15px] font-semibold" style={{ color: 'var(--theme-accent, var(--theme-text))' }}
          onClick={() => { t.action!.onClick(); leave(t.id) }}>{t.action.label}</button>
      ) : null}
      {t.tone !== 'loading' && (
        <button type="button" aria-label="Fechar" data-no-tip className="ui-hover w-11 h-11 grid place-items-center rounded-full" style={{ color: 'var(--theme-text-secondary)' }} onClick={() => leave(t.id)}>
          <X className="w-4 h-4" />
        </button>
      )}
      {!!t.duration && !t.leaving && (
        <span key={`${t.tone}-${t.message}`} aria-hidden className="toast-bar"
          style={{ backgroundColor: color, animationDuration: `${t.duration}ms`, animationPlayState: paused ? 'paused' : 'running' }} />
      )}
    </div>
  )
}

/** Banners no topo (abaixo da barra de status), como notificações do iOS. */
export function Toaster() {
  const items = useToasts(s => s.items)
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 z-[290] flex flex-col items-center gap-2 px-3"
      style={{ top: 'calc(var(--safe-t) + 0.5rem)' }}>
      {items.map(t => <Item key={t.id} t={t} />)}
    </div>
  )
}
