// Admin → Avisos: monta uma mensagem e escolhe o público (plano, idade, perfil do questionário, atividade).
// A contagem do público aparece antes de enviar. O aviso chega em Notificações e no sino.
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { askConfirm } from '@/components/ui/confirm'
import { toast } from '@/components/ui/toast'
import { SURVEY } from '@/lib/survey'

type Segment = {
  plans?: string[]; age_min?: number; age_max?: number; confirmed?: boolean; inactive_days?: number; has_gift?: boolean
  survey?: Partial<Record<'difficulty' | 'topics' | 'reason' | 'tried_books' | 'self_level' | 'daily_minutes', string[]>>
}
type Sent = { id: string; title: string; body: string | null; recipients: number; read: number; created_at: string; segment: Segment }

const PLANS = [['free', 'Grátis'], ['essencial', 'Essencial'], ['plus', 'Plus'], ['pro', 'Pro']]
const SURVEY_FILTERS = ['difficulty', 'topics', 'reason', 'tried_books', 'self_level', 'daily_minutes'] as const
const muted = { color: 'var(--theme-text-secondary)' }
const field = 'w-full h-10 rounded-lg border px-3 text-[14px] bg-transparent outline-none'
const bd = { borderColor: 'var(--theme-border)' }

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={on} className="h-8 px-3 rounded-full text-[12.5px] border" style={{ borderColor: on ? 'var(--theme-text)' : 'var(--theme-border)', fontWeight: on ? 600 : 400 }}>{children}</button>
}

export function AdminBroadcasts() {
  const { isAdmin } = useAuth()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [link, setLink] = useState('')
  const [seg, setSeg] = useState<Segment>({})
  const [count, setCount] = useState<number | null>(null)
  const [sent, setSent] = useState<Sent[]>([])
  const [busy, setBusy] = useState(false)

  const clean = useMemo<Segment>(() => {
    const out: Segment = {}
    if (seg.plans?.length) out.plans = seg.plans
    if (seg.age_min != null) out.age_min = seg.age_min
    if (seg.age_max != null) out.age_max = seg.age_max
    if (seg.confirmed != null) out.confirmed = seg.confirmed
    if (seg.inactive_days) out.inactive_days = seg.inactive_days
    if (seg.has_gift != null) out.has_gift = seg.has_gift
    const sv: NonNullable<Segment['survey']> = {}
    for (const k of SURVEY_FILTERS) if (seg.survey?.[k]?.length) sv[k] = seg.survey[k]
    if (Object.keys(sv).length) out.survey = sv
    return out
  }, [seg])

  useEffect(() => {
    if (!supabase) return
    const t = setTimeout(() => { void supabase!.rpc('admin_broadcast_preview', { p_segment: clean }).then(({ data }) => setCount(typeof data === 'number' ? data : null)) }, 350)
    return () => clearTimeout(t)
  }, [clean])
  const loadSent = () => { void supabase?.rpc('admin_list_broadcasts').then(({ data }) => setSent((data ?? []) as Sent[])) }
  useEffect(loadSent, [])
  if (!isAdmin) return <Navigate to="/" replace />

  const toggleIn = (list: string[] | undefined, v: string) => (list ?? []).includes(v) ? (list ?? []).filter(x => x !== v) : [...(list ?? []), v]
  const setSurvey = (k: typeof SURVEY_FILTERS[number], v: string) => setSeg(s => ({ ...s, survey: { ...s.survey, [k]: toggleIn(s.survey?.[k], v) } }))
  const numOrUndef = (v: string) => v.trim() === '' ? undefined : Math.max(0, Number(v))

  const send = async () => {
    if (title.trim().length < 2) { toast('Escreva um título.', { tone: 'error' }); return }
    if (link && !(link.startsWith('/') || link.startsWith('https://'))) { toast('O link precisa começar com / ou https://', { tone: 'error' }); return }
    if (!await askConfirm(`Enviar para ${count ?? '?'} ${count === 1 ? 'pessoa' : 'pessoas'}?`, { detail: 'O aviso aparece em Notificações e não dá para apagar depois de enviado.', confirmLabel: 'Enviar' })) return
    setBusy(true)
    const { data, error } = await supabase!.rpc('admin_send_broadcast', { p_title: title, p_body: body || null, p_link: link || null, p_segment: clean })
    setBusy(false)
    if (error) { toast(`Erro: ${error.message}`, { tone: 'error' }); return }
    toast(`Enviado para ${data} ${data === 1 ? 'pessoa' : 'pessoas'}`)
    setTitle(''); setBody(''); setLink(''); loadSent()
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10">
      <header>
        <Link to="/admin" className="text-[13px]" style={muted}>← Admin</Link>
        <h1 className="mt-1 font-display text-[34px] leading-tight">Avisos</h1>
        <p className="text-[14px]" style={muted}>Envie uma mensagem para todo mundo ou só para um público.</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-[15px] font-semibold">Mensagem</h2>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Título" className={field} style={bd} />
          <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={1000} rows={4} placeholder="Texto (opcional)" className="w-full rounded-lg border px-3 py-2 text-[14px] bg-transparent outline-none" style={bd} />
          <input value={link} onChange={e => setLink(e.target.value)} placeholder="Link ao tocar (opcional): /planos, /conversar, https://…" className={field} style={bd} />
          <div className="rounded-2xl border p-4" style={bd}>
            <p className="text-[12px] uppercase tracking-wide" style={muted}>Prévia</p>
            <p className="mt-1 text-[14.5px] font-medium">{title || 'Título do aviso'}</p>
            {(body || !title) && <p className="mt-0.5 text-[13.5px]" style={muted}>{body || 'O texto aparece aqui.'}</p>}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-[15px] font-semibold">Público</h2>
            <span className="text-[13px] tabular-nums" style={muted}>{count == null ? '…' : `${count} ${count === 1 ? 'pessoa' : 'pessoas'}`}</span></div>
          <div><p className="text-[12.5px] mb-1.5" style={muted}>Plano atual</p><div className="flex flex-wrap gap-1.5">{PLANS.map(([id, l]) => <Chip key={id} on={!!seg.plans?.includes(id)} onClick={() => setSeg(s => ({ ...s, plans: toggleIn(s.plans, id) }))}>{l}</Chip>)}</div></div>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[12.5px]" style={muted}>Idade mín.<input inputMode="numeric" value={seg.age_min ?? ''} onChange={e => setSeg(s => ({ ...s, age_min: numOrUndef(e.target.value) }))} className={`${field} mt-1`} style={bd} /></label>
            <label className="text-[12.5px]" style={muted}>Idade máx.<input inputMode="numeric" value={seg.age_max ?? ''} onChange={e => setSeg(s => ({ ...s, age_max: numOrUndef(e.target.value) }))} className={`${field} mt-1`} style={bd} /></label>
            <label className="text-[12.5px]" style={muted}>Inativos há (dias)<input inputMode="numeric" value={seg.inactive_days ?? ''} onChange={e => setSeg(s => ({ ...s, inactive_days: numOrUndef(e.target.value) }))} className={`${field} mt-1`} style={bd} /></label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[12.5px]" style={muted}>E-mail confirmado
              <select value={seg.confirmed == null ? '' : String(seg.confirmed)} onChange={e => setSeg(s => ({ ...s, confirmed: e.target.value === '' ? undefined : e.target.value === 'true' }))} className={`${field} mt-1`} style={bd}><option value="">Todos</option><option value="true">Confirmado</option><option value="false">Pendente</option></select></label>
            <label className="text-[12.5px]" style={muted}>Escolheu o livro-presente
              <select value={seg.has_gift == null ? '' : String(seg.has_gift)} onChange={e => setSeg(s => ({ ...s, has_gift: e.target.value === '' ? undefined : e.target.value === 'true' }))} className={`${field} mt-1`} style={bd}><option value="">Todos</option><option value="true">Sim</option><option value="false">Ainda não</option></select></label>
          </div>
          {SURVEY_FILTERS.map(k => {
            const q = SURVEY.find(s => s.key === k)!
            return (
              <div key={k}><p className="text-[12.5px] mb-1.5" style={muted}>{q.title.pt}</p>
                <div className="flex flex-wrap gap-1.5">{q.options.map(o => <Chip key={o.value} on={!!seg.survey?.[k]?.includes(o.value)} onClick={() => setSurvey(k, o.value)}>{o.pt}</Chip>)}</div></div>
            )
          })}
          <button type="button" onClick={() => setSeg({})} className="text-[13px] underline" style={muted}>Limpar filtros</button>
        </section>
      </div>

      <button type="button" disabled={busy || !title.trim() || count === 0} onClick={send} className="h-12 w-full sm:w-auto sm:px-8 rounded-xl text-[15px] font-semibold disabled:opacity-40" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
        {busy ? 'Enviando…' : `Enviar para ${count ?? '…'} ${count === 1 ? 'pessoa' : 'pessoas'}`}
      </button>

      <section>
        <h2 className="text-[15px] font-semibold">Enviados</h2>
        <ul className="mt-3 divide-y rounded-2xl border" style={bd}>
          {sent.length === 0 && <li className="p-4 text-[14px]" style={muted}>Nenhum aviso enviado ainda.</li>}
          {sent.map(s => (
            <li key={s.id} className="p-4 flex flex-wrap items-center justify-between gap-2" style={bd}>
              <div className="min-w-0"><p className="text-[14.5px] font-medium truncate">{s.title}</p><p className="text-[12.5px]" style={muted}>{new Date(s.created_at).toLocaleString('pt-BR')}</p></div>
              <p className="text-[13px] tabular-nums" style={muted}>{s.recipients} enviados · {s.read} lidos ({s.recipients ? Math.round((s.read / s.recipients) * 100) : 0}%)</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
