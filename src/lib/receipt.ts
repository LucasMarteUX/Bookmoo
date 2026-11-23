// Recibo de pagamento em PDF (A4, preto e branco, com o logotipo). Gerado no navegador com jsPDF (carregado sob demanda).
import { formatBRL, planById } from '@/lib/plans'

export type ReceiptData = {
  id: string
  number: string
  paidAt: string
  amountCents: number
  status: string
  kind: string
  method: string | null
  installments: number | null
  plan: string | null
  cycle: 'monthly' | 'annual' | null
  periodStart: string | null
  periodEnd: string | null
  chargeRef: string
  customerName: string
  customerEmail: string
}

export const METHOD_LABEL = (m: string | null, installments: number | null) => {
  const x = (m ?? '').toUpperCase()
  const base = x.includes('PIX') ? 'Pix' : x.includes('CARD') || x.includes('CREDIT') ? 'Cartão de crédito' : x.includes('BOLETO') ? 'Boleto' : 'Pagamento online'
  return installments && installments > 1 ? `${base} em ${installments}x` : base
}

export const KIND_LABEL: Record<string, string> = { new: 'Assinatura', renewal: 'Renovação', upgrade: 'Mudança de plano', refund: 'Reembolso', manual: 'Ajuste' }
export const STATUS_LABEL: Record<string, string> = { paid: 'Pago', refunded: 'Reembolsado', disputed: 'Contestado', failed: 'Não aprovado', pending: 'Pendente' }

export function receiptTitle(r: Pick<ReceiptData, 'plan' | 'cycle' | 'kind'>) {
  const plan = r.plan ? planById(r.plan).name : 'Upoonly'
  const cycle = r.cycle === 'annual' ? 'Anual' : r.cycle === 'monthly' ? 'Mensal' : ''
  return `Plano ${plan}${cycle ? ` · ${cycle}` : ''}`
}

const fmtDate = (iso: string | null, long = false) => iso
  ? new Date(iso).toLocaleDateString('pt-BR', long ? { day: '2-digit', month: 'long', year: 'numeric' } : { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—'

/** Logotipo (SVG da marca) rasterizado em alta resolução para o PDF. */
async function logoPng(): Promise<{ data: string; ratio: number } | null> {
  try {
    const svg = await (await fetch('/site/upoonly-final.svg')).text()
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const img = new Image()
    await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error('logo')); img.src = url })
    // ~600 dpi no tamanho impresso (13 mm de altura), em JPEG sobre fundo branco: nítido e leve.
    const w = 1200, h = Math.round(1200 * 625 / 1904)
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    URL.revokeObjectURL(url)
    return { data: c.toDataURL('image/jpeg', 0.9), ratio: w / h }
  } catch { return null }
}

export async function downloadReceipt(r: ReceiptData) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const W = 210, M = 20
  const ink: [number, number, number] = [20, 20, 20]
  const muted: [number, number, number] = [110, 110, 110]
  const line = (y: number, weight = 0.2) => { doc.setDrawColor(20, 20, 20); doc.setLineWidth(weight); doc.line(M, y, W - M, y) }
  const label = (t: string, x: number, y: number) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...muted); doc.text(t.toUpperCase(), x, y, { charSpace: 0.6 }) }
  const value = (t: string, x: number, y: number, size = 10.5, bold = false) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...ink); doc.text(t, x, y) }

  // Cabeçalho
  const logo = await logoPng()
  if (logo) doc.addImage(logo.data, 'JPEG', M, 18, 13 * logo.ratio, 13)
  else value('upoonly', M, 28, 20, true)
  label('Recibo', W - M - 28, 22)
  value(`Nº ${r.number}`, W - M - 28, 28, 11, true)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...muted)
  doc.text(fmtDate(r.paidAt, true), W - M - 28, 33)
  line(42, 0.6)

  // Valor em destaque
  label(r.kind === 'refund' ? 'Valor reembolsado' : 'Valor recebido', M, 56)
  doc.setFont('times', 'normal'); doc.setFontSize(40); doc.setTextColor(...ink)
  doc.text(formatBRL(Math.abs(r.amountCents)), M, 72)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...ink)
  const st = (STATUS_LABEL[r.status] ?? r.status).toUpperCase()
  const stW = doc.getTextWidth(st) + 8
  doc.setLineWidth(0.4); doc.roundedRect(W - M - stW, 64, stW, 8, 1.2, 1.2)
  doc.text(st, W - M - stW + 4, 69.4)

  // Partes
  const top = 90
  label('Recebemos de', M, top)
  value(r.customerName || r.customerEmail, M, top + 7, 11.5, true)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...muted); doc.text(r.customerEmail, M, top + 13)
  label('Emitido por', 115, top)
  value('Upoonly', 115, top + 7, 11.5, true)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...muted); doc.text('contato@upoonly.com', 115, top + 13)

  // Item
  const ty = 122
  line(ty, 0.6)
  label('Descrição', M, ty + 8); label('Período', 105, ty + 8); label('Valor', W - M - 22, ty + 8)
  line(ty + 12)
  value(receiptTitle(r), M, ty + 21, 11)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...muted); doc.text(KIND_LABEL[r.kind] ?? 'Assinatura', M, ty + 27)
  value(r.periodStart ? `${fmtDate(r.periodStart)} a ${fmtDate(r.periodEnd)}` : '—', 105, ty + 21, 10)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...ink)
  doc.text(formatBRL(Math.abs(r.amountCents)), W - M, ty + 21, { align: 'right' })
  line(ty + 34)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Total', M, ty + 43)
  doc.text(formatBRL(Math.abs(r.amountCents)), W - M, ty + 43, { align: 'right' })
  line(ty + 48, 0.6)

  // Detalhes do pagamento
  const dy = 190
  const rows: [string, string][] = [
    ['Forma de pagamento', METHOD_LABEL(r.method, r.installments)],
    ['Data do pagamento', fmtDate(r.paidAt)],
    ['Código da transação', r.chargeRef],
  ]
  rows.forEach(([k, v], i) => {
    const x = M + i * 57
    label(k, x, dy)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...ink)
    doc.text(doc.splitTextToSize(v, 52), x, dy + 6)
  })

  // Rodapé
  line(268)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...muted)
  doc.text('Este recibo comprova o pagamento da assinatura do Upoonly. Não substitui nota fiscal.', M, 275)
  doc.text('upoonly.com', W - M, 275, { align: 'right' })

  doc.save(`recibo-upoonly-${r.number}.pdf`)
}
