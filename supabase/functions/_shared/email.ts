// E-mails transacionais via Resend. Sem RESEND_API_KEY, só registra no log (não quebra o fluxo).
import { log } from './tts.ts'

const APP_NAME = Deno.env.get('APP_NAME') ?? 'Bookmoo'
const APP_URL = Deno.env.get('APP_URL') ?? 'https://bookmoo.vercel.app'
const FROM = Deno.env.get('EMAIL_FROM') ?? `${APP_NAME} <onboarding@resend.dev>`

function layout(title: string, body: string, cta?: { label: string; href: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Inter,Arial,sans-serif;color:#1c1b19">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-weight:600;font-size:15px;margin:0 0 24px">${APP_NAME}</p>
<div style="background:#fff;border-radius:16px;padding:28px">
<h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
<div style="font-size:15px;line-height:1.6;color:#4a4740">${body}</div>
${cta ? `<a href="${cta.href}" style="display:inline-block;margin-top:20px;background:#1c1b19;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600">${cta.label}</a>` : ''}
</div>
<p style="font-size:12px;color:#8a867d;margin-top:20px">Você recebeu este e-mail porque tem uma conta no ${APP_NAME}.</p>
</div></body></html>`
}

export async function sendEmail(to: string | null | undefined, subject: string, html: string) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!to) return
  if (!key) { log('email', 'skipped_no_key', { subject }); return }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null)
  if (!r?.ok) log('email', 'send_failed', { subject, status: r?.status ?? 0 })
}

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const emails = {
  paymentConfirmed: (to: string, plan: string, cents: number, credits: number) => sendEmail(to, `Bem-vindo(a) ao plano ${plan}! 🎉`,
    layout(`Seu plano ${plan} está ativo`, `<p>Recebemos o pagamento de <b>${brl(cents)}</b>. A biblioteca completa já é sua e você tem <b>${credits} créditos de IA</b> este mês.</p>`,
      { label: 'Escolher um livro', href: `${APP_URL}/gallery` })),
  paymentFailed: (to: string, plan: string, days: number) => sendEmail(to, 'Não conseguimos renovar sua assinatura',
    layout('Pagamento não aprovado', `<p>A renovação do plano <b>${plan}</b> não foi aprovada. Você mantém o acesso por mais <b>${days} dias</b>. Atualize a forma de pagamento para não perder a biblioteca.</p>`,
      { label: 'Ver minha assinatura', href: `${APP_URL}/assinatura` })),
  canceled: (to: string, plan: string, until: string) => sendEmail(to, 'Sua assinatura foi cancelada',
    layout('Cancelamento confirmado', `<p>O plano <b>${plan}</b> continua ativo até <b>${until}</b>. Depois disso sua conta volta para o Grátis — seu progresso, notas e vocabulário ficam guardados.</p>`,
      { label: 'Reativar', href: `${APP_URL}/assinatura` })),
  refunded: (to: string, cents: number) => sendEmail(to, 'Reembolso processado',
    layout('Reembolso processado', `<p>O valor de <b>${brl(cents)}</b> foi estornado. Sua conta voltou para o plano Grátis.</p>`)),
  creditsLow: (to: string, left: number) => sendEmail(to, 'Seus créditos de IA estão acabando',
    layout('Restam poucos créditos', `<p>Você tem <b>${left} créditos</b> até a renovação. Precisa de mais? Faça upgrade e continue ilustrando.</p>`,
      { label: 'Ver planos', href: `${APP_URL}/planos` })),
  adminAlert: (subject: string, body: string) => sendEmail(Deno.env.get('ADMIN_EMAIL'), `[admin] ${subject}`, layout(subject, body)),
}
