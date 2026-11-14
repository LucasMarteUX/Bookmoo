// Painel financeiro do admin: receita × custo de IA, margem, assinantes, custo por operação/plano/usuário.
import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useEntitlements } from '@/store/useEntitlements'
import { formatBRL } from '@/lib/plans'
import { toast } from '@/components/ui/toast'

type Overview = {
  fx: number; tax_pct: number; daily_budget_usd: string
  revenue_cents: number; refunds_cents: number; fees_cents: number; ai_cost_usd: number; ai_calls: number; mrr_cents: number
  subscribers: Record<string, number>; users: number; users_confirmed: number; signups: number; gifts: number
  by_day: { day: string; revenue_cents: number; ai_cost_usd: number }[]
  by_operation: { operation: string; calls: number; cost_usd: number; credits: number; cache_hits: number; failed: number }[]
  by_plan: { plan: string; users: number; cost_usd: number }[]
  top_users: { user_id: string; email: string; plan: string; cost_usd: number; calls: number }[]
  credits: { granted: number; used: number }
  payment_errors: number
  recent_payments: { id: string; email: string; amount_cents: number; status: string; kind: string; paid_at: string }[]
}

const RANGES = [7, 30, 90] as const

export function AdminFinance() {
  const { isAdmin } = useAuth()
  const ent = useEntitlements(s => s.data)
  const [days, setDays] = useState<number>(30)
  const [data, setData] = useState<Overview | null>(null)
  const [err, setErr] = useState('')
  const [grant, setGrant] = useState({ email: '', credits: '50', reason: '' })
  const [courtesy, setCourtesy] = useState({ email: '', plan: 'essencial', days: '30' })

  const load = () => {
    if (!supabase) return
    const to = new Date()
    const from = new Date(Date.now() - days * 86400_000)
    void supabase.rpc('admin_finance_overview', { p_from: from.toISOString(), p_to: to.toISOString() }).then(({ data, error }) => {
      if (error) setErr(error.message); else { setErr(''); setData(data as Overview) }
    })
  }
  useEffect(load, [days])

  const view = useMemo(() => {
    if (!data) return null
    const fx = Number(data.fx) || 6
    const revenue = data.revenue_cents / 100
    const fees = data.fees_cents / 100
    const tax = revenue * (Number(data.tax_pct) || 0) / 100
    const net = revenue - fees - tax - data.refunds_cents / 100
    const ai = Number(data.ai_cost_usd) * fx
    return { fx, revenue, fees, tax, net, ai, result: net - ai, margin: net > 0 ? ((net - ai) / net) * 100 : 0 }
  }, [data])

  if (!isAdmin && !ent?.is_admin) return <Navigate to="/" replace />
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const maxDay = Math.max(1, ...(data?.by_day ?? []).map(d => Math.max(d.revenue_cents / 100, Number(d.ai_cost_usd) * (view?.fx ?? 6))))

  const doGrant = async () => {
    if (!supabase) return
    const { error } = await supabase.rpc('admin_grant', { p_email: grant.email, p_credits: Number(grant.credits), p_reason: grant.reason || 'admin' })
    toast(error ? `Erro: ${error.message}` : 'Créditos concedidos', { tone: error ? 'error' : 'success' })
  }
  const doCourtesy = async () => {
    if (!supabase) return
    const { error } = await supabase.rpc('admin_set_plan', { p_email: courtesy.email, p_plan: courtesy.plan, p_days: Number(courtesy.days) })
    toast(error ? `Erro: ${error.message}` : 'Plano de cortesia aplicado', { tone: error ? 'error' : 'success' })
  }
  const setSetting = async (key: string, value: string) => {
    if (!supabase) return
    const { error } = await supabase.rpc('admin_set_setting', { p_key: key, p_value: Number(value) })
    toast(error ? `Erro: ${error.message}` : 'Salvo', { tone: error ? 'error' : 'success' })
    load()
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[34px] leading-tight">Financeiro</h1>
          <p className="text-[14px]" style={{ color: 'var(--theme-text-secondary)' }}>Receita das assinaturas × custo de IA (OpenAI), em reais (câmbio de trabalho R$ {view?.fx.toFixed(2) ?? '–'}).</p>
        </div>
        <div className="flex gap-1">
          {RANGES.map(r => <button key={r} type="button" onClick={() => setDays(r)} className="h-9 px-3 rounded-full text-[13px] border" style={{ borderColor: days === r ? 'var(--theme-accent)' : 'var(--theme-border)' }}>{r} dias</button>)}
        </div>
      </header>
      {err && <p className="text-[14px]" style={{ color: '#b42318' }}>{err}</p>}
      {data && view && (
        <>
          <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Kpi label="Receita bruta" value={brl(view.revenue)} />
            <Kpi label="Receita líquida" value={brl(view.net)} hint={`taxas ${brl(view.fees)} · impostos ${brl(view.tax)} · estornos ${brl(data.refunds_cents / 100)}`} />
            <Kpi label="Custo de IA" value={brl(view.ai)} hint={`US$ ${Number(data.ai_cost_usd).toFixed(2)} · ${data.ai_calls} chamadas`} />
            <Kpi label="Resultado" value={brl(view.result)} hint={`margem ${view.margin.toFixed(0)}%`} tone={view.result >= 0 ? 'good' : 'bad'} />
            <Kpi label="MRR" value={formatBRL(data.mrr_cents)} />
            <Kpi label="Assinantes" value={String(Object.values(data.subscribers).reduce((a, n) => a + n, 0))} hint={Object.entries(data.subscribers).map(([k, n]) => `${k}: ${n}`).join(' · ') || '—'} />
            <Kpi label="Usuários" value={String(data.users)} hint={`${data.users_confirmed} confirmados · ${data.signups} novos · ${data.gifts} presentes`} />
            <Kpi label="Créditos" value={`${data.credits.used}/${data.credits.granted}`} hint="usados / concedidos no período" />
          </section>

          <section>
            <h2 className="text-[15px] font-semibold">Receita × custo de IA por dia</h2>
            <div className="mt-3 h-44 flex items-end gap-[3px] rounded-2xl border p-3" style={{ borderColor: 'var(--theme-border)' }}>
              {data.by_day.map(d => (
                <div key={d.day} className="flex-1 flex items-end gap-[1px] h-full" title={`${d.day}: receita ${brl(d.revenue_cents / 100)} · IA ${brl(Number(d.ai_cost_usd) * view.fx)}`}>
                  <div className="flex-1 rounded-t" style={{ height: `${(d.revenue_cents / 100 / maxDay) * 100}%`, backgroundColor: '#10b981' }} />
                  <div className="flex-1 rounded-t" style={{ height: `${(Number(d.ai_cost_usd) * view.fx / maxDay) * 100}%`, backgroundColor: '#f97316' }} />
                </div>
              ))}
            </div>
            <p className="mt-1 text-[12px]" style={{ color: 'var(--theme-text-secondary)' }}>🟩 receita · 🟧 custo de IA</p>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Table title="Custo por operação" head={['Operação', 'Chamadas', 'Cache', 'Falhas', 'Custo']}
              rows={data.by_operation.map(o => [o.operation, o.calls, o.cache_hits, o.failed, brl(Number(o.cost_usd) * view.fx)])} />
            <Table title="Custo por plano" head={['Plano', 'Usuários', 'Custo', 'Custo/usuário']}
              rows={data.by_plan.map(p => [p.plan, p.users, brl(Number(p.cost_usd) * view.fx), brl(Number(p.cost_usd) * view.fx / Math.max(1, p.users))])} />
            <Table title="Top 20 usuários por custo" head={['E-mail', 'Plano', 'Chamadas', 'Custo']}
              rows={data.top_users.map(u => [u.email, u.plan, u.calls, brl(Number(u.cost_usd) * view.fx)])} />
            <Table title={`Pagamentos recentes${data.payment_errors ? ` · ⚠️ ${data.payment_errors} eventos com erro` : ''}`} head={['E-mail', 'Tipo', 'Status', 'Valor']}
              rows={data.recent_payments.map(p => [p.email, p.kind, p.status, formatBRL(p.amount_cents)])} />
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border p-4 space-y-2" style={{ borderColor: 'var(--theme-border)' }}>
              <h2 className="text-[15px] font-semibold">Dar créditos bônus</h2>
              <input value={grant.email} onChange={e => setGrant({ ...grant, email: e.target.value })} placeholder="e-mail" className="w-full h-10 rounded-lg border px-3 bg-transparent" style={{ borderColor: 'var(--theme-border)' }} />
              <input value={grant.credits} onChange={e => setGrant({ ...grant, credits: e.target.value })} placeholder="créditos" className="w-full h-10 rounded-lg border px-3 bg-transparent" style={{ borderColor: 'var(--theme-border)' }} />
              <input value={grant.reason} onChange={e => setGrant({ ...grant, reason: e.target.value })} placeholder="motivo" className="w-full h-10 rounded-lg border px-3 bg-transparent" style={{ borderColor: 'var(--theme-border)' }} />
              <button type="button" onClick={doGrant} className="h-10 w-full rounded-lg text-[14px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>Conceder</button>
            </div>
            <div className="rounded-2xl border p-4 space-y-2" style={{ borderColor: 'var(--theme-border)' }}>
              <h2 className="text-[15px] font-semibold">Plano de cortesia</h2>
              <input value={courtesy.email} onChange={e => setCourtesy({ ...courtesy, email: e.target.value })} placeholder="e-mail" className="w-full h-10 rounded-lg border px-3 bg-transparent" style={{ borderColor: 'var(--theme-border)' }} />
              <select value={courtesy.plan} onChange={e => setCourtesy({ ...courtesy, plan: e.target.value })} className="w-full h-10 rounded-lg border px-3 bg-transparent" style={{ borderColor: 'var(--theme-border)' }}>
                <option value="essencial">Essencial</option><option value="plus">Plus</option><option value="pro">Pro</option>
              </select>
              <input value={courtesy.days} onChange={e => setCourtesy({ ...courtesy, days: e.target.value })} placeholder="dias" className="w-full h-10 rounded-lg border px-3 bg-transparent" style={{ borderColor: 'var(--theme-border)' }} />
              <button type="button" onClick={doCourtesy} className="h-10 w-full rounded-lg text-[14px] font-medium" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>Aplicar</button>
            </div>
            <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: 'var(--theme-border)' }}>
              <h2 className="text-[15px] font-semibold">Ajustes</h2>
              <Setting label="Câmbio US$ → R$" value={String(data.fx)} onSave={v => setSetting('usd_brl', v)} />
              <Setting label="Teto diário de IA (US$)" value={String(data.daily_budget_usd ?? '')} onSave={v => setSetting('ai_daily_budget_usd', v)} />
              <Setting label="Impostos (%)" value={String(data.tax_pct)} onSave={v => setSetting('tax_pct', v)} />
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }}>
      <p className="text-[12.5px]" style={{ color: 'var(--theme-text-secondary)' }}>{label}</p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums" style={{ color: tone === 'good' ? '#059669' : tone === 'bad' ? '#dc2626' : undefined }}>{value}</p>
      {hint && <p className="mt-0.5 text-[11.5px] leading-snug" style={{ color: 'var(--theme-text-secondary)' }}>{hint}</p>}
    </div>
  )
}

function Table({ title, head, rows }: { title: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <div>
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <div className="mt-2 overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--theme-border)' }}>
        <table className="w-full text-[13px]">
          <thead><tr>{head.map(h => <th key={h} className="text-left font-medium px-3 py-2" style={{ color: 'var(--theme-text-secondary)' }}>{h}</th>)}</tr></thead>
          <tbody>{rows.length ? rows.map((r, i) => <tr key={i} className="border-t" style={{ borderColor: 'var(--theme-border)' }}>{r.map((c, j) => <td key={j} className="px-3 py-2 tabular-nums truncate max-w-[220px]">{c}</td>)}</tr>) : <tr><td className="px-3 py-3" colSpan={head.length} style={{ color: 'var(--theme-text-secondary)' }}>Sem dados no período.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  )
}

function Setting({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <label className="block text-[13px]">{label}
      <span className="mt-1 flex gap-2">
        <input value={v} onChange={e => setV(e.target.value)} className="flex-1 h-9 rounded-lg border px-2 bg-transparent" style={{ borderColor: 'var(--theme-border)' }} />
        <button type="button" onClick={() => onSave(v)} className="h-9 px-3 rounded-lg border" style={{ borderColor: 'var(--theme-border)' }}>Salvar</button>
      </span>
    </label>
  )
}
