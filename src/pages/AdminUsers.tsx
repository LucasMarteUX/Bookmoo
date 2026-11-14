// Admin → Usuários: buscar, ver plano e créditos, bloquear, dar créditos ou plano de cortesia, criar, excluir.
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Loader2, Plus, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { callFn } from '@/lib/billingApi'
import { askConfirm } from '@/components/ui/confirm'
import { toast } from '@/components/ui/toast'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SURVEY } from '@/lib/survey'

type Row = {
  id: string; email: string; name: string | null; created_at: string; last_sign_in_at: string | null; confirmed: boolean
  blocked: boolean; flagged: boolean; birth_date: string | null; step: string | null; is_admin: boolean; plan: string
  ai_plan?: string | null; plan_until?: string | null
  credits: number | null; survey: Record<string, string | string[]> | null
}
const FILTERS: [string, string][] = [['all', 'Todos'], ['free', 'Grátis'], ['essencial', 'Essencial'], ['plus', 'Plus'], ['pro', 'Pro'], ['blocked', 'Bloqueados'], ['unconfirmed', 'Sem e-mail confirmado']]
const muted = { color: 'var(--theme-text-secondary)' }
const field = 'w-full h-10 rounded-lg border px-3 text-[14px] bg-transparent outline-none'
const PLAN_NAME: Record<string, string> = { free: 'Grátis', essencial: 'Essencial', plus: 'Plus', pro: 'Pro' }
const NO_EXPIRY_YEAR = 2099

type Grant = { plan: string; aiPlan: string; days: string; forever: boolean }
/** Plano dado pelo admin: acesso (livros, biblioteca) e IA (créditos e recursos de IA) separados, com ou sem expiração. */
function GrantFields({ g, onChange, allowFree }: { g: Grant; onChange: (g: Grant) => void; allowFree?: boolean }) {
  const sel = { borderColor: 'var(--theme-border)' }
  return (
    <div className="grid grid-cols-2 gap-2 text-[13px]">
      <label className="space-y-1"><span style={muted}>Plano (acesso)</span>
        <select value={g.plan} onChange={e => onChange({ ...g, plan: e.target.value })} className={field} style={sel}>
          {allowFree && <option value="">Grátis</option>}
          <option value="essencial">Essencial</option><option value="plus">Plus</option><option value="pro">Pro</option>
        </select></label>
      <label className="space-y-1"><span style={muted}>IA usa o plano</span>
        <select value={g.aiPlan} onChange={e => onChange({ ...g, aiPlan: e.target.value })} disabled={allowFree && !g.plan} className={field} style={sel}>
          <option value="">Igual ao plano</option><option value="free">Grátis</option><option value="essencial">Essencial</option><option value="plus">Plus</option><option value="pro">Pro</option>
        </select></label>
      {(!allowFree || g.plan) && <>
        <label className="space-y-1"><span style={muted}>Dias</span>
          <input value={g.forever ? '' : g.days} disabled={g.forever} placeholder={g.forever ? 'Sem expiração' : '30'} onChange={e => onChange({ ...g, days: e.target.value.replace(/\D/g, '') })} className={field} style={sel} /></label>
        <label className="flex items-center gap-2 self-end h-10"><input type="checkbox" checked={g.forever} onChange={e => onChange({ ...g, forever: e.target.checked })} className="w-4 h-4 accent-[var(--theme-text)]" />Sem expiração</label>
      </>}
      <p className="col-span-2 text-[12px] leading-snug" style={muted}>O plano libera livros, biblioteca e importações. A IA (créditos do mês, ilustrações, tutora e cenas) segue o plano escolhido em "IA usa o plano".</p>
    </div>
  )
}
const date = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'
const age = (b: string | null) => b ? Math.floor((Date.now() - new Date(`${b}T12:00:00`).getTime()) / (365.25 * 86400_000)) : null

export function AdminUsers() {
  const { isAdmin } = useAuth()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState<Row | null>(null)
  const [creating, setCreating] = useState(false)
  const PAGE = 25

  const load = () => {
    if (!supabase) return
    setLoading(true)
    void supabase.rpc('admin_list_users', { p_query: q || null, p_filter: filter, p_limit: PAGE, p_offset: page * PAGE }).then(({ data, error }) => {
      setLoading(false)
      if (error) { toast(`Erro: ${error.message}`, { tone: 'error' }); return }
      const d = data as { total: number; users: Row[] }
      setRows(d.users); setTotal(d.total)
    })
  }
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [q, filter, page]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/admin" className="text-[13px]" style={muted}>← Admin</Link>
          <h1 className="mt-1 font-display text-[34px] leading-tight">Usuários</h1>
          <p className="text-[14px]" style={muted}>{total} {total === 1 ? 'conta' : 'contas'}</p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="h-10 px-4 rounded-xl text-[14px] font-medium inline-flex items-center gap-2" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}><Plus className="w-4 h-4" />Adicionar usuário</button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={muted} />
          <input value={q} onChange={e => { setQ(e.target.value); setPage(0) }} placeholder="Buscar por e-mail ou nome" className={`${field} pl-9`} style={{ borderColor: 'var(--theme-border)' }} />
        </label>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(([id, label]) => <button key={id} type="button" onClick={() => { setFilter(id); setPage(0) }} className="h-9 px-3 rounded-full text-[13px] border" style={{ borderColor: filter === id ? 'var(--theme-text)' : 'var(--theme-border)', fontWeight: filter === id ? 600 : 400 }}>{label}</button>)}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--theme-border)' }}>
        <table className="w-full text-[13.5px]">
          <thead><tr className="text-left" style={muted}>{['Usuário', 'Plano', 'Créditos', 'Cadastro', 'Último acesso', 'Status'].map(h => <th key={h} className="font-medium px-3 py-2.5">{h}</th>)}</tr></thead>
          <tbody>
            {loading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center"><Loader2 className="w-4 h-4 animate-spin inline" /></td></tr>}
            {rows.map(r => (
              <tr key={r.id} onClick={() => setOpen(r)} className="border-t cursor-pointer hover:bg-[var(--ui-hover)]" style={{ borderColor: 'var(--theme-border)' }}>
                <td className="px-3 py-2.5"><span className="block font-medium truncate max-w-[260px]">{r.name || r.email}</span><span className="block text-[12px] truncate max-w-[260px]" style={muted}>{r.name ? r.email : ''}</span></td>
                <td className="px-3 py-2.5">{PLAN_NAME[r.plan] ?? r.plan}{r.ai_plan && r.ai_plan !== r.plan && <span className="block text-[12px]" style={muted}>IA {PLAN_NAME[r.ai_plan] ?? r.ai_plan}</span>}</td>
                <td className="px-3 py-2.5 tabular-nums">{r.is_admin ? '∞' : r.credits ?? '—'}</td>
                <td className="px-3 py-2.5 tabular-nums">{date(r.created_at)}</td>
                <td className="px-3 py-2.5 tabular-nums">{date(r.last_sign_in_at)}</td>
                <td className="px-3 py-2.5 space-x-1">
                  {r.is_admin && <Badge>Admin</Badge>}{r.blocked && <Badge danger>Bloqueado</Badge>}{!r.confirmed && <Badge>E-mail pendente</Badge>}{r.flagged && <Badge danger>Sinalizado</Badge>}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center" style={muted}>Nenhum usuário encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-[13px]" style={muted}>
        <span>Página {page + 1} de {Math.max(1, Math.ceil(total / PAGE))}</span>
        <span className="flex gap-2">
          <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-9 px-3 rounded-lg border disabled:opacity-40" style={{ borderColor: 'var(--theme-border)' }}>Anterior</button>
          <button type="button" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(p => p + 1)} className="h-9 px-3 rounded-lg border disabled:opacity-40" style={{ borderColor: 'var(--theme-border)' }}>Próxima</button>
        </span>
      </div>

      {open && <UserDialog row={open} onClose={() => setOpen(null)} onChanged={() => { setOpen(null); load() }} />}
      {creating && <CreateDialog onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load() }} />}
    </div>
  )
}

function Badge({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return <span className="inline-flex h-5 px-2 rounded-full text-[11px] font-medium items-center border" style={{ borderColor: danger ? '#dc2626' : 'var(--theme-border)', color: danger ? '#dc2626' : 'var(--theme-text-secondary)' }}>{children}</span>
}

function UserDialog({ row, onClose, onChanged }: { row: Row; onClose: () => void; onChanged: () => void }) {
  const [credits, setCredits] = useState('50')
  const [grant, setGrant] = useState<Grant>({ plan: 'essencial', aiPlan: '', days: '30', forever: false })
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState('')

  const run = async (fn: () => Promise<unknown>, ok: string, done = true) => {
    setBusy(true)
    try { await fn(); toast(ok); if (done) onChanged() } catch (e) { toast(`Erro: ${(e as { code?: string; message?: string }).code ?? (e as Error).message}`, { tone: 'error' }) } finally { setBusy(false) }
  }
  const rpc = async (name: string, args: Record<string, unknown>) => { const { error } = await supabase!.rpc(name, args); if (error) throw new Error(error.message) }
  const labelOf = (key: string, v: string) => SURVEY.find(s => s.key === key)?.options.find(o => o.value === v)?.pt ?? v

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{row.name || row.email}</DialogTitle>
          <DialogDescription>{row.email} · plano {PLAN_NAME[row.plan] ?? row.plan}{row.ai_plan && row.ai_plan !== row.plan ? ` (IA ${PLAN_NAME[row.ai_plan] ?? row.ai_plan})` : ''}{row.plan_until ? ` até ${new Date(row.plan_until).getFullYear() >= NO_EXPIRY_YEAR ? 'sem expiração' : date(row.plan_until)}` : ''} · {age(row.birth_date) ?? '?'} anos · cadastro {date(row.created_at)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 text-[14px]">
          <section className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <p>Dar créditos bônus</p>
            <span className="flex gap-2"><input value={credits} onChange={e => setCredits(e.target.value)} className={`${field} w-20`} style={{ borderColor: 'var(--theme-border)' }} /><button type="button" disabled={busy} onClick={() => run(() => rpc('admin_grant', { p_email: row.email, p_credits: Number(credits), p_reason: 'admin' }), 'Créditos concedidos')} className="h-10 px-3 rounded-lg border" style={{ borderColor: 'var(--theme-border)' }}>Dar</button></span>
          </section>
          <section className="space-y-2">
            <p>Plano de cortesia</p>
            <GrantFields g={grant} onChange={setGrant} />
            <button type="button" disabled={busy || (!grant.forever && !Number(grant.days))} onClick={() => run(() => rpc('admin_set_plan', { p_email: row.email, p_plan: grant.plan, p_days: grant.forever ? 0 : Number(grant.days), p_ai_plan: grant.aiPlan || null }), 'Plano aplicado')}
              className="h-10 px-4 rounded-lg border" style={{ borderColor: 'var(--theme-border)' }}>Aplicar plano</button>
          </section>

          <section className="flex flex-wrap gap-2">
            {!row.confirmed && <Act busy={busy} onClick={() => run(() => callFn('admin-users', { action: 'confirm-email', userId: row.id }, { paywall: false }), 'E-mail confirmado')}>Confirmar e-mail</Act>}
            <Act busy={busy} onClick={() => run(async () => { const r = await callFn<{ link: string | null }>('admin-users', { action: 'reset-link', email: row.email }, { paywall: false }); setLink(r.link ?? '') }, 'Link gerado', false)}>Gerar link de nova senha</Act>
            <Act busy={busy} onClick={() => run(() => callFn('admin-users', { action: 'sign-out', userId: row.id }, { paywall: false }), 'Sessões encerradas')}>Encerrar sessões</Act>
            {!row.is_admin && (
              row.blocked
                ? <Act busy={busy} onClick={() => run(() => rpc('admin_set_blocked', { p_user: row.id, p_blocked: false }), 'Conta liberada')}>Desbloquear</Act>
                : <Act busy={busy} danger onClick={async () => { if (await askConfirm(`Bloquear ${row.email}?`, { detail: 'A pessoa é desconectada na hora e não consegue entrar até você desbloquear.', confirmLabel: 'Bloquear', danger: true })) await run(() => rpc('admin_set_blocked', { p_user: row.id, p_blocked: true, p_reason: 'admin' }), 'Conta bloqueada') }}>Bloquear</Act>
            )}
            {!row.is_admin && <Act busy={busy} danger onClick={async () => { if (await askConfirm(`Excluir ${row.email} para sempre?`, { detail: 'Apaga a conta e os dados dela. Não dá para desfazer. Assinaturas pagas precisam ser encerradas antes.', confirmLabel: 'Excluir', danger: true })) await run(() => rpc('admin_delete_user', { p_user: row.id }), 'Conta excluída') }}>Excluir</Act>}
            <Act busy={busy} onClick={() => run(() => rpc('admin_set_admin', { p_email: row.email, p_on: !row.is_admin }), row.is_admin ? 'Admin removido' : 'Admin concedido')}>{row.is_admin ? 'Remover admin' : 'Tornar admin'}</Act>
          </section>
          {link && <div className="rounded-lg border p-3 break-all text-[12.5px]" style={{ borderColor: 'var(--theme-border)' }}>{link}<button type="button" onClick={() => { void navigator.clipboard.writeText(link); toast('Link copiado') }} className="ml-2 underline">copiar</button></div>}

          {row.survey && Object.keys(row.survey).length > 0 && (
            <section>
              <p className="font-medium mb-1.5">Perfil informado</p>
              <ul className="space-y-1 text-[13px]" style={muted}>
                {Object.entries(row.survey).map(([k, v]) => <li key={k}><b style={{ color: 'var(--theme-text)' }}>{SURVEY.find(s => s.key === k)?.title.pt ?? k}</b>: {(Array.isArray(v) ? v : [v]).map(x => labelOf(k, x)).join(', ')}</li>)}
              </ul>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Act({ children, onClick, busy, danger }: { children: React.ReactNode; onClick: () => void; busy: boolean; danger?: boolean }) {
  return <button type="button" disabled={busy} onClick={onClick} className="h-9 px-3 rounded-lg border text-[13px] disabled:opacity-50" style={{ borderColor: danger ? '#dc2626' : 'var(--theme-border)', color: danger ? '#dc2626' : undefined }}>{children}</button>
}

function CreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ email: '', name: '', password: '' })
  const [grant, setGrant] = useState<Grant>({ plan: '', aiPlan: '', days: '30', forever: false })
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState('')
  const save = async () => {
    setBusy(true)
    try {
      const r = await callFn<{ recovery_link: string | null; password_set: boolean }>('admin-users', { action: 'create', email: f.email, name: f.name, password: f.password || undefined, plan: grant.plan || undefined, days: grant.forever ? 0 : Number(grant.days || 30), aiPlan: grant.plan ? grant.aiPlan || undefined : undefined }, { paywall: false })
      toast('Usuário criado')
      if (!r.password_set && r.recovery_link) setLink(r.recovery_link); else onCreated()
    } catch (e) { toast(`Erro: ${(e as { code?: string }).code ?? 'falhou'}`, { tone: 'error' }) } finally { setBusy(false) }
  }
  return (
    <Dialog open onOpenChange={o => { if (!o) (link ? onCreated : onClose)() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Adicionar usuário</DialogTitle><DialogDescription>A conta já nasce com e-mail confirmado.</DialogDescription></DialogHeader>
        {link ? (
          <div className="space-y-3 text-[14px]">
            <p>Envie este link para a pessoa criar a senha:</p>
            <div className="rounded-lg border p-3 break-all text-[12.5px]" style={{ borderColor: 'var(--theme-border)' }}>{link}</div>
            <button type="button" onClick={() => { void navigator.clipboard.writeText(link); toast('Link copiado') }} className="h-10 px-4 rounded-lg border" style={{ borderColor: 'var(--theme-border)' }}>Copiar link</button>
          </div>
        ) : (
          <div className="space-y-3">
            <input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="E-mail" className={field} style={{ borderColor: 'var(--theme-border)' }} />
            <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Nome (opcional)" className={field} style={{ borderColor: 'var(--theme-border)' }} />
            <input value={f.password} onChange={e => setF({ ...f, password: e.target.value })} placeholder="Senha (opcional, mín. 8). Sem senha, gera um link" className={field} style={{ borderColor: 'var(--theme-border)' }} />
            <GrantFields g={grant} onChange={setGrant} allowFree />
            <button type="button" disabled={busy || !f.email} onClick={save} className="h-11 w-full rounded-xl text-[14.5px] font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>{busy ? 'Criando…' : 'Criar usuário'}</button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
