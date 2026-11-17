// Admin da English Proficiency Test: versões do banco, geração por IA, aprovação humana, áudios pré-gerados, sessões e
// custos. Tudo passa pela função `proficiency` (ações admin_*), que confere is_admin no servidor.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Check, Loader2, Play, RefreshCw, Sparkles, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { askConfirm } from '@/components/ui/confirm'
import { toast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { fmtBand, profAdmin, profErrorText, ProfError, TASK_LABEL, type AdminItem, type AdminOverview, type AdminSession, type AudioTodo, type TaskType } from '@/lib/proficiencyApi'
import { synthesizeScript } from '@/lib/proficiencyAudio'

const muted = { color: 'var(--theme-text-secondary)' }
const cardStyle = { borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card-bg)' }
const TASKS = Object.keys(TASK_LABEL) as TaskType[]
const ADAPTIVE = (t: TaskType) => ['complete_words', 'daily_life', 'academic_passage', 'choose_response', 'conversation', 'announcement', 'academic_talk'].includes(t)
type Tab = 'overview' | 'items' | 'generate' | 'audio' | 'sessions'

/** Quanto o banco precisa por tipo e estágio (blueprint × 2 de folga para sortear). */
const NEED: { task: TaskType; stage: string; count: number }[] = [
  { task: 'complete_words', stage: 'router', count: 1 }, { task: 'complete_words', stage: 'easy', count: 2 }, { task: 'complete_words', stage: 'hard', count: 2 },
  { task: 'daily_life', stage: 'router', count: 3 }, { task: 'daily_life', stage: 'easy', count: 2 }, { task: 'daily_life', stage: 'hard', count: 2 },
  { task: 'academic_passage', stage: 'router', count: 1 }, { task: 'academic_passage', stage: 'easy', count: 1 }, { task: 'academic_passage', stage: 'hard', count: 1 },
  { task: 'choose_response', stage: 'router', count: 8 }, { task: 'choose_response', stage: 'easy', count: 7 }, { task: 'choose_response', stage: 'hard', count: 7 },
  { task: 'conversation', stage: 'router', count: 3 }, { task: 'conversation', stage: 'easy', count: 3 }, { task: 'conversation', stage: 'hard', count: 3 },
  { task: 'announcement', stage: 'router', count: 2 }, { task: 'announcement', stage: 'easy', count: 2 }, { task: 'announcement', stage: 'hard', count: 2 },
  { task: 'academic_talk', stage: 'router', count: 1 }, { task: 'academic_talk', stage: 'easy', count: 2 }, { task: 'academic_talk', stage: 'hard', count: 2 },
  { task: 'build_sentence', stage: 'any', count: 10 }, { task: 'write_email', stage: 'any', count: 1 }, { task: 'academic_discussion', stage: 'any', count: 1 },
  { task: 'listen_repeat', stage: 'any', count: 7 }, { task: 'interview', stage: 'any', count: 1 },
]

export function AdminProficiency() {
  const { isAdmin, loading } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')
  const [ov, setOv] = useState<AdminOverview | null>(null)
  const [versionId, setVersionId] = useState('')
  const reload = useCallback(async () => {
    try {
      const o = await profAdmin.overview()
      setOv(o)
      setVersionId(v => v || (o.versions.find(x => x.status === 'draft') ?? o.versions[0])?.id || '')
    } catch (e) { toast(profErrorText(e), { tone: 'error' }) }
  }, [])
  useEffect(() => { if (isAdmin) void reload() }, [isAdmin, reload])
  if (loading) return null
  if (!isAdmin) return <Navigate to="/" replace />
  const version = ov?.versions.find(v => v.id === versionId)

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      <header>
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-[13px]" style={muted}><ArrowLeft className="w-4 h-4" />Área admin</Link>
        <h1 className="mt-2 font-display text-[34px] leading-none">Prova de proficiência</h1>
        <p className="mt-2 text-[14.5px]" style={muted}>Banco de questões, geração, aprovação, áudios, sessões e custos.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <select value={versionId} onChange={e => setVersionId(e.target.value)} className="h-9 rounded-lg border px-2 text-[14px]" style={cardStyle} aria-label="Versão">
          {ov?.versions.map(v => <option key={v.id} value={v.id}>{v.code} · {v.status === 'published' ? 'publicada' : v.status === 'draft' ? 'rascunho' : 'arquivada'}</option>)}
        </select>
        <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>
          {([['overview', 'Visão geral'], ['items', 'Questões'], ['generate', 'Gerar'], ['audio', 'Áudios'], ['sessions', 'Sessões']] as [Tab, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className="h-8 px-3 rounded-md text-[13.5px] font-medium" style={tab === k ? { backgroundColor: 'var(--theme-card-bg)', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' } : muted}>{l}</button>
          ))}
        </div>
      </div>

      {!ov ? <Loader2 className="w-5 h-5 animate-spin" />
        : tab === 'overview' ? <Overview ov={ov} versionId={versionId} onChange={reload} onSelect={setVersionId} />
        : !version ? <p style={muted}>Crie uma versão na visão geral.</p>
        : tab === 'items' ? <Items versionId={versionId} locked={version.status !== 'draft'} />
        : tab === 'generate' ? <Generate versionId={versionId} ov={ov} locked={version.status !== 'draft'} onDone={reload} />
        : tab === 'audio' ? <AudioTab versionId={versionId} />
        : <Sessions />}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
function Overview({ ov, versionId, onChange, onSelect }: { ov: AdminOverview; versionId: string; onChange: () => void; onSelect: (id: string) => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [minRank, setMinRank] = useState<number | null>(null)
  useEffect(() => { profAdmin.settings().then(r => setMinRank(r.minPlanRank), () => {}) }, [])
  const counts = ov.counts[versionId] ?? {}
  const short = ov.shortfalls[versionId] ?? []
  const totalCost = Object.values(ov.costs).reduce((a, c) => a + c.usd, 0)
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try { await fn(); toast(ok); onChange() } catch (e) {
      const missing = e instanceof ProfError && Array.isArray(e.extra.missing) ? ` Faltam: ${(e.extra.missing as string[]).slice(0, 4).join('; ')}` : ''
      toast(profErrorText(e) + missing, { tone: 'error' })
    } finally { setBusy(false) }
  }
  const version = ov.versions.find(v => v.id === versionId)
  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-4">
        {[['Sessões (30 dias)', Object.values(ov.sessions).reduce((a, b) => a + b, 0)], ['Concluídas', (ov.sessions.scored ?? 0) + (ov.sessions.inconclusive ?? 0)], ['Em avaliação', ov.sessions.scoring ?? 0], ['Custo IA (30 dias)', `US$ ${totalCost.toFixed(2)}`]].map(([l, v]) => (
          <div key={String(l)} className="rounded-2xl border px-4 py-3" style={cardStyle}><p className="text-[12px]" style={muted}>{l}</p><p className="mt-1 font-display text-[26px] leading-none tabular-nums">{v}</p></div>
        ))}
      </section>

      <section className="rounded-2xl border p-5 space-y-4" style={cardStyle}>
        <h2 className="text-[16px] font-semibold">Versões</h2>
        <ul className="divide-y" style={{ borderColor: 'var(--theme-border)' }}>
          {ov.versions.map(v => (
            <li key={v.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
              <button onClick={() => onSelect(v.id)} className="text-left">
                <p className="text-[14.5px] font-medium">{v.code} {v.id === versionId && <span className="text-[12px]" style={muted}>· selecionada</span>}</p>
                <p className="text-[12.5px]" style={muted}>{v.status === 'published' ? `Publicada em ${new Date(v.published_at!).toLocaleDateString('pt-BR')}` : v.status === 'draft' ? 'Rascunho' : 'Arquivada'} · {v.blueprint_version} · {v.difficulty_model} · {v.rubric_version}</p>
              </button>
              <div className="flex gap-2">
                {v.status === 'draft' && <Button size="sm" disabled={busy} onClick={() => void run(() => profAdmin.publish(v.id), 'Versão publicada')}>Publicar</Button>}
                {v.status !== 'archived' && <Button size="sm" variant="outline" disabled={busy} onClick={async () => { if (await askConfirm(`Arquivar ${v.code}?`, { detail: v.status === 'published' ? 'A prova fica indisponível até outra versão ser publicada.' : undefined })) void run(() => profAdmin.archive(v.id), 'Versão arquivada') }}>Arquivar</Button>}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 items-center">
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="Código (ex.: 2026.12)" className="h-9 rounded-lg border px-3 text-[14px]" style={cardStyle} />
          <Button size="sm" disabled={busy} onClick={() => void run(() => profAdmin.createVersion(code), 'Versão criada')}>Nova versão vazia</Button>
          {version && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => profAdmin.createVersion(code, version.id), 'Versão criada com as questões aprovadas')}>Nova a partir de {version.code}</Button>}
        </div>
      </section>

      {version && (
        <section className="rounded-2xl border p-5" style={cardStyle}>
          <h2 className="text-[16px] font-semibold">Banco da versão {version.code}</h2>
          {short.length ? (
            <div className="mt-2 rounded-xl px-3 py-2.5 text-[13.5px]" style={{ backgroundColor: 'var(--pastel-amber-bg)', color: 'var(--pastel-amber-fg)' }}>
              Ainda não monta uma prova completa (questões aprovadas com áudio). Faltam: {short.slice(0, 8).join('; ')}{short.length > 8 ? '…' : ''}
            </div>
          ) : <p className="mt-2 text-[13.5px]" style={{ color: 'var(--pastel-green-fg)' }}>Banco completo: monta todos os caminhos da prova.</p>}
          <table className="mt-4 w-full text-[13px]">
            <thead><tr className="text-left" style={muted}><th className="py-1.5 font-medium">Tipo · estágio</th><th className="font-medium text-right">Necessário</th><th className="font-medium text-right">Aprovadas</th><th className="font-medium text-right">Em revisão</th><th className="font-medium text-right">Rejeitadas</th></tr></thead>
            <tbody>{NEED.map(n => {
              const c = counts[`${n.task}|${n.stage}`] ?? {}
              const ok = (c.approved ?? 0) >= n.count
              return (
                <tr key={`${n.task}|${n.stage}`} className="border-t" style={{ borderColor: 'var(--theme-border)' }}>
                  <td className="py-1.5">{TASK_LABEL[n.task]} <span style={muted}>· {n.stage}</span></td>
                  <td className="text-right tabular-nums">{n.count}</td>
                  <td className="text-right tabular-nums font-medium" style={{ color: ok ? 'var(--pastel-green-fg)' : undefined }}>{c.approved ?? 0}</td>
                  <td className="text-right tabular-nums">{c.review ?? 0}</td>
                  <td className="text-right tabular-nums" style={muted}>{c.rejected ?? 0}</td>
                </tr>
              )
            })}</tbody>
          </table>
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border p-5" style={cardStyle}>
          <h2 className="text-[16px] font-semibold">Custos de IA (30 dias)</h2>
          <ul className="mt-3 space-y-1.5 text-[13.5px]">
            {Object.entries(ov.costs).map(([op, c]) => <li key={op} className="flex justify-between"><span>{op.replace('proficiency-', '')}</span><span className="tabular-nums" style={muted}>{c.calls} chamadas{c.failed ? ` (${c.failed} falhas)` : ''} · US$ {c.usd.toFixed(3)}</span></li>)}
            {!Object.keys(ov.costs).length && <li style={muted}>Nenhum uso ainda.</li>}
          </ul>
        </div>
        <div className="rounded-2xl border p-5 space-y-3" style={cardStyle}>
          <h2 className="text-[16px] font-semibold">Acesso e privacidade</h2>
          <label className="flex items-center justify-between gap-3 text-[14px]">Plano mínimo
            <select value={minRank ?? 3} onChange={async e => { const n = Number(e.target.value); setMinRank(n); await profAdmin.settings(n); toast('Plano mínimo atualizado') }} className="h-9 rounded-lg border px-2" style={cardStyle}>
              <option value={0}>Grátis</option><option value={1}>Essencial</option><option value={2}>Plus</option><option value={3}>Pro</option>
            </select>
          </label>
          <Button size="sm" variant="outline" disabled={busy} onClick={async () => { if (await askConfirm('Apagar gravações com mais de 30 dias?', { detail: 'As transcrições e as notas continuam. Não dá para desfazer.', danger: true, confirmLabel: 'Apagar' })) void run(async () => { const r = await profAdmin.purge(); toast(`${r.removed} gravações apagadas`) }, 'Limpeza concluída') }}><Trash2 className="w-4 h-4" />Apagar gravações antigas (LGPD)</Button>
        </div>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
function Items({ versionId, locked }: { versionId: string; locked: boolean }) {
  const [f, setF] = useState({ task: '', stage: '', status: 'review' })
  const [items, setItems] = useState<AdminItem[] | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const load = useCallback(() => { setItems(null); profAdmin.items(versionId, { task: f.task || undefined, stage: f.stage || undefined, status: f.status || undefined }).then(r => { setItems(r.items); setSel(new Set()) }, e => toast(profErrorText(e), { tone: 'error' })) }, [versionId, f])
  useEffect(() => { load() }, [load])
  const review = async (ids: string[], status: 'approved' | 'rejected' | 'review' | 'retired') => {
    try { const r = await profAdmin.review(ids, status); toast(`${r.updated} atualizada(s)${r.skipped ? `, ${r.skipped} bloqueada(s) na versão publicada` : ''}`); load() } catch (e) { toast(profErrorText(e), { tone: 'error' }) }
  }
  const sel1 = (k: keyof typeof f, opts: [string, string][]) => (
    <select value={f[k]} onChange={e => setF(x => ({ ...x, [k]: e.target.value }))} className="h-9 rounded-lg border px-2 text-[13.5px]" style={cardStyle}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
  )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {sel1('task', [['', 'Todos os tipos'], ...TASKS.map(t => [t, TASK_LABEL[t]] as [string, string])])}
        {sel1('stage', [['', 'Todos os estágios'], ['router', 'router'], ['easy', 'easy'], ['hard', 'hard'], ['any', 'any']])}
        {sel1('status', [['', 'Todos'], ['review', 'Em revisão'], ['approved', 'Aprovadas'], ['rejected', 'Rejeitadas'], ['retired', 'Aposentadas']])}
        <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        {sel.size > 0 && !locked && <>
          <Button size="sm" onClick={() => void review([...sel], 'approved')}><Check className="w-4 h-4" />Aprovar {sel.size}</Button>
          <Button size="sm" variant="outline" onClick={() => void review([...sel], 'rejected')}><X className="w-4 h-4" />Rejeitar {sel.size}</Button>
        </>}
        {items && items.length > 0 && !locked && <button className="text-[13px] underline underline-offset-4" style={muted} onClick={() => setSel(new Set(items.map(i => i.id)))}>Selecionar todas</button>}
      </div>
      {locked && <p className="text-[13px]" style={muted}>Versão publicada ou arquivada: as questões estão congeladas. Só é possível aposentar uma questão.</p>}
      {!items ? <Loader2 className="w-5 h-5 animate-spin" /> : !items.length ? <p style={muted}>Nenhuma questão com esses filtros.</p> : (
        <ul className="space-y-3">{items.map(it => <ItemCard key={it.id} it={it} locked={locked} selected={sel.has(it.id)} onToggle={() => setSel(s => { const n = new Set(s); if (n.has(it.id)) n.delete(it.id); else n.add(it.id); return n })} onReview={st => void review([it.id], st)} />)}</ul>
      )}
    </div>
  )
}

function ItemCard({ it, locked, selected, onToggle, onReview }: { it: AdminItem; locked: boolean; selected: boolean; onToggle: () => void; onReview: (s: 'approved' | 'rejected' | 'review' | 'retired') => void }) {
  const [open, setOpen] = useState(false)
  const c = it.content as Record<string, unknown>
  const answer = it.answer as { choices?: Record<string, number>; gaps?: Record<string, string>; order?: string[]; text?: string }
  const playAudio = async (key: string) => { try { const r = await profAdmin.audioUrl(it.id, key); if (r.url) void new Audio(r.url).play() } catch (e) { toast(profErrorText(e), { tone: 'error' }) } }
  const STATUS: Record<string, string> = { review: 'Em revisão', approved: 'Aprovada', rejected: 'Rejeitada', retired: 'Aposentada', draft: 'Rascunho' }
  return (
    <li className="rounded-2xl border p-4" style={{ ...cardStyle, ...(selected ? { borderColor: 'var(--theme-text)' } : {}) }}>
      <div className="flex items-start gap-3">
        {!locked && <input type="checkbox" checked={selected} onChange={onToggle} className="mt-1 w-4 h-4" aria-label="Selecionar" />}
        <div className="flex-1 min-w-0">
          <p className="text-[13px]" style={muted}>{TASK_LABEL[it.task_type]} · {it.stage} · dif. {Number(it.difficulty).toFixed(1)} · {it.cefr ?? '–'} · {STATUS[it.status]}{it.validation?.topic ? ` · ${it.validation.topic}` : ''}</p>
          <p className="mt-1 text-[14.5px] line-clamp-2">{String(c.title ?? c.a_says ?? c.scenario ?? c.context ?? c.passage ?? c.body ?? (c.professor as { post?: string } | undefined)?.post ?? JSON.stringify(c.raw ?? c).slice(0, 160))}</p>
          {!!it.validation?.issues?.length && <ul className="mt-2 text-[12.5px] space-y-0.5" style={{ color: 'var(--pastel-rose-fg)' }}>{it.validation.issues.map((x, i) => <li key={i}>• {x}</li>)}</ul>}
          {it.audio.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{it.audio.map(a => a.ready
            ? <button key={a.key} onClick={() => void playAudio(a.key)} className="inline-flex items-center gap-1 text-[12.5px] rounded-md border px-2 h-7" style={cardStyle}><Play className="w-3 h-3" />{a.key}{a.stale ? ' (desatualizado)' : ''}</button>
            : <span key={a.key} className="text-[12.5px] rounded-md px-2 h-7 inline-flex items-center" style={{ backgroundColor: 'var(--pastel-amber-bg)', color: 'var(--pastel-amber-fg)' }}>sem áudio: {a.key}</span>)}</div>}
          {open && (
            <div className="mt-3 space-y-2 text-[13px]">
              <pre className="whitespace-pre-wrap rounded-lg p-3 overflow-x-auto" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>{JSON.stringify(c, null, 2)}</pre>
              {it.script && <pre className="whitespace-pre-wrap rounded-lg p-3" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>Roteiro: {JSON.stringify(it.script, null, 2)}</pre>}
              <p><span className="font-medium">Gabarito:</span> {answer.choices ? Object.entries(answer.choices).map(([q, i]) => `${q}: ${'ABCD'[i]}`).join(' · ') : answer.gaps ? Object.entries(answer.gaps).map(([g, v]) => `${g}: ${v}`).join(' · ') : answer.order ? answer.order.join(' / ') : answer.text ?? `rubrica ${it.rubric ?? '–'}`}</p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(o => !o)}>{open ? 'Fechar' : 'Ver tudo'}</Button>
            {!locked && it.status !== 'approved' && <Button size="sm" onClick={() => onReview('approved')}><Check className="w-4 h-4" />Aprovar</Button>}
            {!locked && it.status !== 'rejected' && <Button size="sm" variant="outline" onClick={() => onReview('rejected')}>Rejeitar</Button>}
            {locked && it.status === 'approved' && <Button size="sm" variant="outline" onClick={() => onReview('retired')}>Aposentar</Button>}
          </div>
        </div>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
function Generate({ versionId, ov, locked, onDone }: { versionId: string; ov: AdminOverview; locked: boolean; onDone: () => void }) {
  const [task, setTask] = useState<TaskType>('daily_life')
  const [stage, setStage] = useState('router')
  const [count, setCount] = useState(3)
  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const counts = ov.counts[versionId] ?? {}
  const add = (s: string) => setLog(l => [s, ...l].slice(0, 80))
  const gen = async (t: TaskType, st: string, n: number) => {
    try { const r = await profAdmin.generate(versionId, t, st, n); add(`${TASK_LABEL[t]} · ${st}: ${r.created} para revisão, ${r.rejected} rejeitadas`); return r }
    catch (e) { add(`${TASK_LABEL[t]} · ${st}: erro (${profErrorText(e)})`); return null }
  }
  const fillBank = async () => {
    if (!(await askConfirm('Gerar o banco inicial?', { detail: 'Gera o dobro do necessário para cada tipo e estágio que ainda não tem questões suficientes (em revisão ou aprovadas). Pode levar alguns minutos e usa créditos de IA da plataforma.', confirmLabel: 'Gerar' }))) return
    setBusy(true)
    for (const n of NEED) {
      const c = counts[`${n.task}|${n.stage}`] ?? {}
      let missing = n.count * 2 - (c.approved ?? 0) - (c.review ?? 0)
      const per = ['choose_response', 'build_sentence', 'listen_repeat'].includes(n.task) ? 8 : 4
      while (missing > 0) { const r = await gen(n.task, n.stage, Math.min(per, missing)); if (!r) break; missing -= Math.max(1, r.created) }
    }
    setBusy(false); onDone()
  }
  if (locked) return <p style={muted}>Gere questões numa versão em rascunho.</p>
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border p-5 space-y-3" style={cardStyle}>
        <p className="text-[14px]" style={muted}>A IA escreve as questões, o código confere a estrutura e um segundo prompt resolve as questões sem o gabarito. As que passam ficam "Em revisão" e só entram na prova depois da sua aprovação.</p>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={task} onChange={e => { const t = e.target.value as TaskType; setTask(t); setStage(ADAPTIVE(t) ? 'router' : 'any') }} className="h-9 rounded-lg border px-2 text-[14px]" style={cardStyle}>{TASKS.map(t => <option key={t} value={t}>{TASK_LABEL[t]}</option>)}</select>
          <select value={stage} onChange={e => setStage(e.target.value)} disabled={!ADAPTIVE(task)} className="h-9 rounded-lg border px-2 text-[14px]" style={cardStyle}>{(ADAPTIVE(task) ? ['router', 'easy', 'hard'] : ['any']).map(s => <option key={s}>{s}</option>)}</select>
          <input type="number" min={1} max={8} value={count} onChange={e => setCount(Number(e.target.value))} className="h-9 w-20 rounded-lg border px-2 text-[14px]" style={cardStyle} />
          <Button disabled={busy} onClick={async () => { setBusy(true); await gen(task, stage, count); setBusy(false); onDone() }}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}Gerar</Button>
          <Button variant="outline" disabled={busy} onClick={() => void fillBank()}>Gerar banco inicial</Button>
        </div>
      </section>
      {!!log.length && <ul className="rounded-2xl border p-4 space-y-1 text-[13px] tabular-nums" style={cardStyle}>{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
function AudioTab({ versionId }: { versionId: string }) {
  const [todo, setTodo] = useState<AudioTodo[] | null>(null)
  const [total, setTotal] = useState(0)
  const [progress, setProgress] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => { profAdmin.audioTodo(versionId).then(r => { setTodo(r.todo); setTotal(r.total) }, e => toast(profErrorText(e), { tone: 'error' })) }, [versionId])
  useEffect(() => { load() }, [load])
  const run = async () => {
    if (!todo) return
    setBusy(true)
    for (const t of todo) {
      const k = `${t.itemId}|${t.key}`
      try {
        setProgress(p => ({ ...p, [k]: 'sintetizando' }))
        const { blob, durationMs } = await synthesizeScript(t.lines, (d, n) => setProgress(p => ({ ...p, [k]: `sintetizando ${d}/${n}` })))
        setProgress(p => ({ ...p, [k]: 'enviando' }))
        const up = await profAdmin.audioUpload(t.itemId, t.key)
        const { error } = await supabase!.storage.from('proficiency-audio').uploadToSignedUrl(up.path, up.token, blob, { contentType: 'audio/wav', upsert: true })
        if (error) throw error
        await profAdmin.audioRegister({ itemId: t.itemId, key: t.key, path: up.path, durationMs, voice: [...new Set(t.lines.map(l => l.voice))].join(','), hash: t.hash })
        setProgress(p => ({ ...p, [k]: 'pronto' }))
      } catch (e) { setProgress(p => ({ ...p, [k]: `erro: ${String((e as Error)?.message ?? e).slice(0, 60)}` })) }
    }
    setBusy(false); load()
  }
  const pendingCount = useMemo(() => todo?.length ?? 0, [todo])
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border p-5 space-y-3" style={cardStyle}>
        <p className="text-[14px]" style={muted}>Os áudios são gerados aqui, antes da prova, com as vozes do leitor (Kokoro, no navegador), e ficam num armazenamento privado. Na primeira vez o modelo de voz é baixado (cerca de 90 MB). Deixe esta aba aberta até terminar.</p>
        <div className="flex items-center gap-3">
          <Button disabled={busy || !pendingCount} onClick={() => void run()}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}Gerar {pendingCount} áudio(s)</Button>
          <span className="text-[13px]" style={muted}>{total} questões com áudio (aprovadas ou em revisão)</span>
        </div>
      </section>
      {todo && todo.length > 0 && (
        <ul className="rounded-2xl border divide-y text-[13px]" style={cardStyle}>
          {todo.map(t => {
            const k = `${t.itemId}|${t.key}`
            return <li key={k} className="px-4 py-2 flex justify-between gap-3" style={{ borderColor: 'var(--theme-border)' }}>
              <span className="truncate">{TASK_LABEL[t.task]} · {t.key} · <span style={muted}>{t.lines.map(l => l.text).join(' ').slice(0, 80)}</span></span>
              <span className="shrink-0" style={muted}>{progress[k] ?? t.status}</span>
            </li>
          })}
        </ul>
      )}
      {todo && !todo.length && <p style={muted}>Todos os áudios estão prontos.</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------------
function Sessions() {
  const [rows, setRows] = useState<AdminSession[] | null>(null)
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)
  const load = useCallback(() => { profAdmin.sessions().then(r => setRows(r.sessions), e => toast(profErrorText(e), { tone: 'error' })) }, [])
  useEffect(() => { load() }, [load])
  const STATUS: Record<string, string> = { active: 'Em andamento', scoring: 'Em avaliação', scored: 'Concluída', inconclusive: 'Inconclusiva', abandoned: 'Abandonada', failed: 'Falhou' }
  return (
    <div className="space-y-4">
      {!rows ? <Loader2 className="w-5 h-5 animate-spin" /> : !rows.length ? <p style={muted}>Nenhuma sessão ainda.</p> : (
        <div className="rounded-2xl border overflow-x-auto" style={cardStyle}>
          <table className="w-full text-[13px]">
            <thead><tr className="text-left" style={muted}><th className="px-3 py-2 font-medium">Pessoa</th><th className="font-medium">Início</th><th className="font-medium">Status</th><th className="font-medium">Caminho R/L</th><th className="font-medium text-right">Geral</th><th /></tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.id} className="border-t" style={{ borderColor: 'var(--theme-border)' }}>
                <td className="px-3 py-2">{r.person?.display_name || r.person?.handle || r.user_id.slice(0, 8)}</td>
                <td className="tabular-nums">{new Date(r.started_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td>{STATUS[r.status] ?? r.status}{r.status === 'active' ? ` · ${r.section}` : ''}{r.error ? <span title={r.error} style={{ color: 'var(--pastel-rose-fg)' }}> · erro</span> : null}</td>
                <td className="tabular-nums">{['reading', 'listening'].map(k => r.route[k] ? `${r.route[k]!.module} ${Math.round((r.route[k]!.pct ?? 0) * 100)}%` : '–').join(' / ')}</td>
                <td className="text-right tabular-nums font-medium">{r.result ? (r.result.status === 'inconclusive' ? 'inc.' : `${fmtBand(r.result.overall)} ${r.result.cefr}`) : '–'}</td>
                <td className="px-3 text-right whitespace-nowrap">
                  <button className="underline underline-offset-4 mr-3" onClick={() => profAdmin.session(r.id).then(setDetail, e => toast(profErrorText(e), { tone: 'error' }))}>Detalhes</button>
                  {['scoring', 'scored', 'inconclusive', 'failed'].includes(r.status) && <button className="underline underline-offset-4" onClick={async () => { if (await askConfirm('Recalcular a nota desta sessão?', { detail: 'Transcreve e avalia de novo (usa IA).' })) { try { await profAdmin.rescore(r.id); toast('Nota recalculada'); load() } catch (e) { toast(profErrorText(e), { tone: 'error' }) } } }}>Recalcular</button>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {detail && (
        <section className="rounded-2xl border p-5 space-y-3" style={cardStyle}>
          <div className="flex justify-between"><h2 className="text-[16px] font-semibold">Detalhes da sessão</h2><button onClick={() => setDetail(null)} aria-label="Fechar"><X className="w-4 h-4" /></button></div>
          <SessionDetail d={detail} />
        </section>
      )}
    </div>
  )
}

function SessionDetail({ d }: { d: Record<string, unknown> }) {
  const items = (d.items ?? []) as { id: string; section: string; module: string; position: number; prof_items: { task_type: TaskType; answer: Record<string, unknown> } }[]
  const responses = (d.responses ?? []) as { session_item_id: string; part: string; response: Record<string, unknown>; transcript: string | null; auto_score: number | null }[]
  const evals = (d.evaluations ?? []) as { task_type: string; score: number; rationale: string; criteria: Record<string, unknown> }[]
  const session = d.session as { path?: Record<string, unknown> } | undefined
  return (
    <div className="space-y-4 text-[13px]">
      <pre className="whitespace-pre-wrap rounded-lg p-3" style={{ backgroundColor: 'var(--theme-bg-secondary)' }}>Caminho: {JSON.stringify(session?.path ?? {}, null, 2)}</pre>
      {evals.map((e, i) => <p key={i}><span className="font-medium">{e.task_type}</span>: {e.score}/5 · {e.rationale}</p>)}
      <ul className="space-y-1">
        {items.map(it => {
          const rs = responses.filter(r => r.session_item_id === it.id)
          return <li key={it.id}><span style={muted}>{it.section}/{it.module} #{it.position + 1} {TASK_LABEL[it.prof_items.task_type]}:</span> {rs.length ? rs.map(r => `${r.part}=${r.transcript ?? JSON.stringify(r.response).slice(0, 80)}${r.auto_score != null ? ` (${r.auto_score})` : ''}`).join(' · ') : 'sem resposta'}</li>
        })}
      </ul>
    </div>
  )
}
