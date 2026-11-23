// Painel de recibos: todos os pagamentos da conta, com pré-visualização em papel (preto e branco) e download em PDF.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Download, FileText, Loader2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatBRL } from '@/lib/plans'
import { downloadReceipt, KIND_LABEL, METHOD_LABEL, receiptTitle, STATUS_LABEL, type ReceiptData } from '@/lib/receipt'
import { Logo } from '@/components/brand/Logo'

type Row = {
  id: string; amount_cents: number; status: string; kind: string; paid_at: string | null; method: string | null
  provider_charge_id: string; raw: { cycle?: 'monthly' | 'annual'; plan?: string; installments?: number | null } | null
  subscriptions: { plan_id: string; billing_cycle: 'monthly' | 'annual' | null; current_period_start: string | null; current_period_end: string | null } | null
}

const ink = 'var(--theme-text)'
const muted = 'var(--theme-text-secondary)'
const line = 'var(--theme-border)'
const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function toReceipt(r: Row, name: string, email: string): ReceiptData {
  return {
    id: r.id,
    number: r.id.replace(/-/g, '').slice(0, 8).toUpperCase(),
    paidAt: r.paid_at ?? new Date().toISOString(),
    amountCents: r.amount_cents,
    status: r.status,
    kind: r.kind,
    method: r.method,
    installments: r.raw?.installments ?? null,
    plan: r.raw?.plan ?? r.subscriptions?.plan_id ?? null,
    cycle: r.raw?.cycle ?? r.subscriptions?.billing_cycle ?? null,
    periodStart: r.subscriptions?.current_period_start ?? null,
    periodEnd: r.subscriptions?.current_period_end ?? null,
    chargeRef: r.provider_charge_id.split(':')[0],
    customerName: name,
    customerEmail: email,
  }
}

/** O recibo em papel, igual ao PDF. */
function Paper({ r }: { r: ReceiptData }) {
  const k = 'text-[9.5px] uppercase tracking-[0.12em] text-[#6e6e6e]'
  return (
    <div className="bg-white text-[#141414] w-full max-w-[560px] aspect-[210/297] shadow-[0_30px_60px_-30px_rgba(0,0,0,.45)] px-[7%] py-[7%] flex flex-col text-left">
      <div className="flex items-start justify-between">
        <Logo height={30} style={{ color: '#141414' }} />
        <div className="text-right"><p className={k}>Recibo</p><p className="text-[13px] font-semibold mt-1">Nº {r.number}</p><p className="text-[11px] text-[#6e6e6e]">{new Date(r.paidAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p></div>
      </div>
      <div className="h-[2px] bg-[#141414] mt-5" />
      <div className="mt-7 flex items-end justify-between">
        <div><p className={k}>{r.kind === 'refund' ? 'Valor reembolsado' : 'Valor recebido'}</p><p className="font-display text-[44px] leading-none mt-2">{formatBRL(Math.abs(r.amountCents))}</p></div>
        <span className="border border-[#141414] rounded-[4px] px-2 py-1 text-[10px] font-bold tracking-[0.1em]">{(STATUS_LABEL[r.status] ?? r.status).toUpperCase()}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-8">
        <div><p className={k}>Recebemos de</p><p className="text-[13px] font-semibold mt-1.5">{r.customerName || r.customerEmail}</p><p className="text-[11.5px] text-[#6e6e6e]">{r.customerEmail}</p></div>
        <div><p className={k}>Emitido por</p><p className="text-[13px] font-semibold mt-1.5">Upoonly</p><p className="text-[11.5px] text-[#6e6e6e]">contato@upoonly.com</p></div>
      </div>
      <div className="mt-7 border-y-2 border-[#141414]">
        <div className="grid grid-cols-[1.4fr_1fr_auto] gap-3 py-2 border-b border-[#141414]"><p className={k}>Descrição</p><p className={k}>Período</p><p className={k}>Valor</p></div>
        <div className="grid grid-cols-[1.4fr_1fr_auto] gap-3 py-3 border-b border-[#141414] text-[12px]">
          <div><p className="font-medium">{receiptTitle(r)}</p><p className="text-[10.5px] text-[#6e6e6e]">{KIND_LABEL[r.kind] ?? 'Assinatura'}</p></div>
          <p>{r.periodStart ? `${new Date(r.periodStart).toLocaleDateString('pt-BR')} a ${new Date(r.periodEnd ?? r.periodStart).toLocaleDateString('pt-BR')}` : '—'}</p>
          <p className="font-semibold text-right">{formatBRL(Math.abs(r.amountCents))}</p>
        </div>
        <div className="flex justify-between py-2.5 text-[13px] font-bold"><span>Total</span><span>{formatBRL(Math.abs(r.amountCents))}</span></div>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-7 text-[11.5px]">
        <div><p className={k}>Forma de pagamento</p><p className="mt-1.5">{METHOD_LABEL(r.method, r.installments)}</p></div>
        <div><p className={k}>Data do pagamento</p><p className="mt-1.5">{new Date(r.paidAt).toLocaleDateString('pt-BR')}</p></div>
        <div className="min-w-0"><p className={k}>Código da transação</p><p className="mt-1.5 break-all">{r.chargeRef}</p></div>
      </div>
      <div className="mt-auto pt-4 border-t border-[#141414] flex justify-between text-[9.5px] text-[#6e6e6e]">
        <span>Este recibo comprova o pagamento da assinatura do Upoonly. Não substitui nota fiscal.</span><span>upoonly.com</span>
      </div>
    </div>
  )
}

export function ReceiptsPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [open, setOpen] = useState<ReceiptData | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const name = String((user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? '')
  const email = user?.email ?? ''

  useEffect(() => {
    if (!supabase) return
    void supabase.from('payments')
      .select('id, amount_cents, status, kind, paid_at, method, provider_charge_id, raw, subscriptions(plan_id, billing_cycle, current_period_start, current_period_end)')
      .order('paid_at', { ascending: false }).limit(200)
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]))
  }, [])

  const receipts = useMemo(() => (rows ?? []).map(r => toReceipt(r, name, email)), [rows, name, email])
  const total = receipts.filter(r => r.status === 'paid').reduce((s, r) => s + r.amountCents, 0)
  const download = async (r: ReceiptData) => { setBusy(r.id); try { await downloadReceipt(r) } finally { setBusy(null) } }

  return (
    <div className="mx-auto max-w-4xl px-5 sm:px-8 py-8 sm:py-12" style={{ color: ink }}>
      <Link to="/assinatura" className="inline-flex items-center gap-1.5 text-[13.5px]" style={{ color: muted }}><ArrowLeft className="w-4 h-4" />Minha assinatura</Link>
      <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.1em]" style={{ color: muted }}>Pagamentos</p>
          <h1 className="font-display text-[44px] sm:text-[56px] leading-none mt-2">Recibos</h1>
        </div>
        {receipts.length > 0 && <p className="text-[13.5px]" style={{ color: muted }}>{receipts.length} {receipts.length === 1 ? 'recibo' : 'recibos'} · {formatBRL(total)} pagos</p>}
      </header>

      {rows === null ? (
        <div className="py-20 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin" style={{ color: muted }} /></div>
      ) : receipts.length === 0 ? (
        <div className="mt-10 border-t py-16 text-center" style={{ borderColor: line }}>
          <FileText className="w-8 h-8 mx-auto" style={{ color: muted }} />
          <p className="font-display text-[26px] mt-4">Nenhum recibo ainda</p>
          <p className="mt-2 text-[14.5px]" style={{ color: muted }}>Quando você assinar um plano, os recibos de cada pagamento aparecem aqui.</p>
          <Link to="/planos" className="mt-6 inline-flex h-11 px-5 rounded-lg items-center text-[14.5px] font-semibold" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>Ver os planos</Link>
        </div>
      ) : (
        <ul className="mt-10 border-t" style={{ borderColor: line }}>
          {receipts.map(r => (
            <li key={r.id} className="border-b py-4 sm:py-5 grid grid-cols-[1fr_auto] sm:grid-cols-[110px_1fr_auto_auto] items-center gap-x-5 gap-y-1" style={{ borderColor: line }}>
              <p className="text-[13px] tabular-nums order-3 sm:order-none col-span-2 sm:col-span-1" style={{ color: muted }}>{fmt(r.paidAt)}</p>
              <button type="button" onClick={() => setOpen(r)} className="text-left min-w-0">
                <p className="font-display text-[20px] leading-tight truncate">{receiptTitle(r)}</p>
                <p className="text-[12.5px] mt-0.5" style={{ color: muted }}>{KIND_LABEL[r.kind] ?? 'Assinatura'} · {METHOD_LABEL(r.method, r.installments)} · Nº {r.number}</p>
              </button>
              <div className="text-right">
                <p className="text-[15px] font-semibold tabular-nums">{formatBRL(Math.abs(r.amountCents))}</p>
                <p className="text-[11.5px]" style={{ color: r.status === 'paid' ? 'var(--pastel-green-fg, #2d6040)' : muted }}>{STATUS_LABEL[r.status] ?? r.status}</p>
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <button type="button" onClick={() => setOpen(r)} className="h-9 px-3 rounded-lg border text-[13px]" style={{ borderColor: line }}>Ver</button>
                <button type="button" onClick={() => download(r)} disabled={busy === r.id} aria-label="Baixar PDF" className="h-9 w-9 rounded-lg grid place-items-center" style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}>
                  {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 overflow-y-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ backgroundColor: 'rgba(20,20,18,.55)', backdropFilter: 'blur(4px)' }} onClick={() => setOpen(null)}>
            <div className="min-h-full grid place-items-center p-4 sm:p-8" >
              <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                className="w-full max-w-[560px] flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
                <div className="w-full flex justify-between">
                  <button type="button" onClick={() => download(open)} disabled={busy === open.id} className="h-10 px-4 rounded-lg inline-flex items-center gap-2 text-[14px] font-semibold bg-white text-[#141414]">
                    {busy === open.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}Baixar PDF
                  </button>
                  <button type="button" onClick={() => setOpen(null)} aria-label="Fechar" className="h-10 w-10 rounded-lg grid place-items-center bg-white/90 text-[#141414]"><X className="w-5 h-5" /></button>
                </div>
                <Paper r={open} />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
