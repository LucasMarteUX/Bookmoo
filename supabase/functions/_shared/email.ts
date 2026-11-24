// E-mails transacionais via Resend, no visual da marca: papel claro, tinta preta, logotipo e um botão.
// Secrets: RESEND_API_KEY · EMAIL_FROM (ex.: "Upoonly <ola@upoonly.com>") · APP_URL (domínio do site) · ADMIN_EMAIL
// Sem RESEND_API_KEY, só registra no log (nunca quebra o fluxo de pagamento).
import { log } from './tts.ts'

const APP_URL = (Deno.env.get('APP_URL') ?? 'https://upoonly.com').replace(/\/+$/, '')
const FROM = Deno.env.get('EMAIL_FROM') ?? 'Upoonly <ola@upoonly.com>'
const REPLY_TO = Deno.env.get('EMAIL_REPLY_TO') ?? 'contato@upoonly.com'
// Imagens dos e-mails ficam no bucket público "web" do Storage (não dependem do deploy do site).
const ASSETS = (Deno.env.get('EMAIL_ASSETS_URL') ?? 'https://ywnmeacpvmcuhzhshpwz.supabase.co/storage/v1/object/public/web/email').replace(/\/+$/, '')

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const brl = (cents: number) => (Math.abs(cents) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type Block = { kicker?: string; title: string; body: string; cta?: { label: string; href: string }; rows?: [string, string][]; note?: string; preheader?: string }

/** Layout único dos e-mails (tabelas e estilos inline, para funcionar no Gmail, Outlook e Apple Mail). */
export function layout(b: Block | string, legacyBody?: string): string {
  const x: Block = typeof b === 'string' ? { title: b, body: legacyBody ?? '' } : b
  const rows = x.rows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;border-top:1px solid #1c1c1a">${x.rows.map(([k, v]) => `<tr><td style="padding:11px 0;border-bottom:1px solid #e3e0d6;font:400 13px/1.4 Arial,sans-serif;color:#6b6b66">${esc(k)}</td><td align="right" style="padding:11px 0;border-bottom:1px solid #e3e0d6;font:600 13.5px/1.4 Arial,sans-serif;color:#1c1c1a">${v}</td></tr>`).join('')}</table>`
    : ''
  const cta = x.cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:26px"><tr><td style="background:#1c1c1a;border-radius:8px"><a href="${x.cta.href}" style="display:inline-block;padding:14px 22px;font:600 15px/1 Arial,sans-serif;color:#ffffff;text-decoration:none">${esc(x.cta.label)} &rarr;</a></td></tr></table>` : ''
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(x.title)}</title></head>
<body style="margin:0;padding:0;background:#f6f3eb">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${esc(x.preheader ?? x.title)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3eb"><tr><td align="center" style="padding:36px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 22px"><a href="${APP_URL}"><img src="${ASSETS}/logo.png" width="134" height="44" alt="Upoonly" style="display:block;border:0"></a></td></tr>
<tr><td style="background:#ffffff;border:1px solid #e3e0d6;border-radius:6px;padding:36px 34px">
${x.kicker ? `<p style="margin:0 0 12px;font:600 11px/1.4 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#6b6b66">${esc(x.kicker)}</p>` : ''}
<h1 style="margin:0;font:400 32px/1.08 Georgia,'Times New Roman',serif;letter-spacing:-.02em;color:#1c1c1a">${x.title}</h1>
<div style="margin-top:16px;font:400 15.5px/1.6 Arial,sans-serif;color:#45453f">${x.body}</div>
${rows}${cta}
${x.note ? `<p style="margin:26px 0 0;padding-top:16px;border-top:1px solid #e3e0d6;font:400 12.5px/1.55 Arial,sans-serif;color:#6b6b66">${x.note}</p>` : ''}
</td></tr>
<tr><td style="padding:22px 4px 0;font:400 12px/1.6 Arial,sans-serif;color:#8a8a82">
Upoonly · Aprenda inglês dentro dos livros<br>
Dúvidas? Responda este e-mail ou escreva para <a href="mailto:${REPLY_TO}" style="color:#45453f">${REPLY_TO}</a>.
</td></tr>
</table></td></tr></table></body></html>`
}

/** Igual ao sendEmail, mas devolve o erro (o hook de autenticação precisa avisar o Supabase quando falha). */
export async function sendEmailStrict(to: string, subject: string, html: string): Promise<void> {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) throw new Error('resend_not_configured')
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, html }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!r.ok) throw new Error(`resend_${r.status}: ${(await r.text()).slice(0, 200)}`)
}

/** Envia sem quebrar o fluxo. Devolve true se o Resend aceitou. `replyTo` troca o endereço de resposta (ex.: o visitante do contato). */
export async function sendEmail(to: string | null | undefined, subject: string, html: string, replyTo?: string): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!to) return false
  if (!key) { log('email', 'skipped_no_key', { subject }); return false }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: replyTo ?? REPLY_TO, subject, html }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null)
  if (!r?.ok) log('email', 'send_failed', { subject, status: r?.status ?? 0 })
  return !!r?.ok
}

const cycleLabel = (c?: string | null) => c === 'annual' ? 'Anual' : 'Mensal'
const date = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'

export const emails = {
  welcome: (to: string, name?: string | null) => sendEmail(to, 'Bem-vindo(a) ao Upoonly',
    layout({ kicker: 'Sua conta está pronta', title: `Era uma vez${name ? `, ${esc(name.split(' ')[0])}` : ''}…`,
      preheader: 'Seu primeiro livro é um presente. Comece hoje.',
      body: '<p style="margin:0">…uma pessoa que aprendeu inglês lendo as histórias de que gosta. Ela ouvia a página narrada, tocava numa palavra para entender o sentido e conversava com um tutor sobre o que acabou de ler.</p><p style="margin:14px 0 0">Seu primeiro livro é um presente. Escolha um clássico e comece agora.</p>',
      cta: { label: 'Escolher meu livro', href: `${APP_URL}/gallery` } })),

  paymentConfirmed: (to: string, plan: string, cents: number, credits: number, opts: { cycle?: string | null; until?: string | null; extraDays?: number } = {}) => sendEmail(to, `Seu plano ${plan} está ativo`,
    layout({ kicker: 'Pagamento aprovado', title: `Bem-vindo(a) ao <i>${esc(plan)}</i>.`,
      preheader: `Recebemos ${brl(cents)}. A biblioteca inteira é sua.`,
      body: '<p style="margin:0">A biblioteca inteira é sua, com ilustrações, explicações e conversas por voz com os tutores.</p>',
      rows: [['Plano', esc(plan)], ['Ciclo', cycleLabel(opts.cycle)], ['Valor pago', brl(cents)], ['Créditos de IA por mês', String(credits)], ...(opts.extraDays ? [['Dias a mais pelo plano anterior', `+${opts.extraDays}`] as [string, string]] : []), ...(opts.until ? [['Próxima cobrança', date(opts.until)] as [string, string]] : [])],
      cta: { label: 'Começar a ler', href: `${APP_URL}/gallery` },
      note: `O recibo deste pagamento está em <a href="${APP_URL}/recibos" style="color:#45453f">Minha conta → Recibos</a>.` })),

  renewed: (to: string, plan: string, cents: number, until: string | null) => sendEmail(to, `Assinatura ${plan} renovada`,
    layout({ kicker: 'Renovação', title: 'Sua história continua.',
      preheader: `Renovamos o plano ${plan} por mais um ciclo.`,
      body: `<p style="margin:0">Renovamos o plano <b>${esc(plan)}</b>. Seus créditos de IA do novo período já estão disponíveis.</p>`,
      rows: [['Valor', brl(cents)], ['Válido até', date(until)]],
      cta: { label: 'Ver recibo', href: `${APP_URL}/recibos` } })),

  paymentFailed: (to: string, plan: string, days: number) => sendEmail(to, 'Não conseguimos cobrar sua assinatura',
    layout({ kicker: 'Pagamento pendente', title: 'Falta só um detalhe.',
      preheader: `Seu plano ${plan} continua por mais ${days} dias.`,
      body: `<p style="margin:0">A cobrança do plano <b>${esc(plan)}</b> não foi aprovada. Você continua com tudo por mais <b>${days} dias</b>. Depois disso, a conta volta para o plano Grátis até o pagamento ser regularizado.</p><p style="margin:14px 0 0">Se for o cartão, confira o limite ou troque por outro. No Pix Automático, verifique a autorização no app do banco.</p>`,
      cta: { label: 'Renovar assinatura', href: `${APP_URL}/planos` } })),

  movedToFree: (to: string, plan: string) => sendEmail(to, 'Sua conta voltou para o plano Grátis',
    layout({ kicker: 'Assinatura pausada', title: 'Guardamos o seu marcador.',
      body: `<p style="margin:0">Não recebemos o pagamento do plano <b>${esc(plan)}</b> e a conta voltou para o Grátis. Seu progresso, suas notas e seu vocabulário continuam guardados.</p>`,
      cta: { label: 'Renovar e continuar lendo', href: `${APP_URL}/planos` } })),

  canceled: (to: string, plan: string, until: string) => sendEmail(to, 'Cancelamento confirmado',
    layout({ kicker: 'Cancelamento', title: 'Até logo, leitor(a).',
      body: `<p style="margin:0">O plano <b>${esc(plan)}</b> continua ativo até <b>${esc(until)}</b>. Depois disso a conta volta para o Grátis, e seu progresso, notas e vocabulário ficam guardados.</p>`,
      cta: { label: 'Voltar a assinar', href: `${APP_URL}/planos` } })),

  downgradeScheduled: (to: string, from: string, next: string, until: string) => sendEmail(to, `Mudança para o plano ${next} agendada`,
    layout({ kicker: 'Mudança de plano', title: `No próximo ciclo, <i>${esc(next)}</i>.`,
      body: `<p style="margin:0">Você continua no <b>${esc(from)}</b> até <b>${esc(until)}</b>. A partir da próxima cobrança, o plano passa a ser <b>${esc(next)}</b>, com o valor dele.</p>`,
      cta: { label: 'Minha assinatura', href: `${APP_URL}/assinatura` } })),

  refunded: (to: string, cents: number) => sendEmail(to, 'Reembolso processado',
    layout({ kicker: 'Reembolso', title: 'Reembolso a caminho.',
      body: `<p style="margin:0">O valor de <b>${brl(cents)}</b> foi estornado e a conta voltou para o plano Grátis. No cartão, o estorno aparece na fatura em até dois ciclos; no Pix, na conta em alguns minutos.</p>`,
      cta: { label: 'Ver recibos', href: `${APP_URL}/recibos` } })),

  creditsLow: (to: string, left: number) => sendEmail(to, 'Seus créditos de IA estão acabando',
    layout({ kicker: 'Créditos de IA', title: `Restam ${left} créditos.`,
      body: '<p style="margin:0">Eles renovam no próximo ciclo. Se quiser continuar ilustrando e conversando agora, um plano maior traz mais créditos todo mês.</p>',
      cta: { label: 'Ver planos', href: `${APP_URL}/planos` } })),

  /** Mensagem do formulário /contato para a equipe; "Responder" vai direto ao visitante. */
  contactToAdmin: (m: { name: string; email: string; subject: string; message: string; ip: string }) => sendEmail(Deno.env.get('ADMIN_EMAIL'), `[contato] ${m.subject} · ${m.name}`,
    layout({ kicker: 'Formulário de contato', title: esc(m.subject), preheader: `${m.name} escreveu pelo site.`,
      body: `<p style="margin:0;white-space:pre-wrap">${esc(m.message)}</p>`,
      rows: [['Nome', esc(m.name)], ['E-mail', `<a href="mailto:${esc(m.email)}" style="color:#1c1c1a">${esc(m.email)}</a>`], ['Recebido em', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })], ['IP', esc(m.ip)]],
      note: 'Responda este e-mail para falar diretamente com a pessoa.' }), m.email),

  /** Confirmação automática para quem escreveu pelo /contato. */
  contactConfirmation: (to: string, name: string, subject: string) => sendEmail(to, 'Recebemos sua mensagem',
    layout({ kicker: 'Contato', title: `Obrigado${name ? `, ${esc(name.split(' ')[0])}` : ''}.`, preheader: 'Respondemos em até 2 dias úteis.',
      body: '<p style="margin:0">Sua mensagem chegou à equipe do Upoonly. Respondemos em até 2 dias úteis, neste mesmo endereço.</p>',
      rows: [['Assunto', esc(subject)]],
      note: 'Não foi você? Pode ignorar este e-mail: o texto enviado não é repetido aqui.' })),

  adminAlert: (subject: string, body: string) => sendEmail(Deno.env.get('ADMIN_EMAIL'), `[admin] ${subject}`,
    layout({ kicker: 'Alerta do sistema', title: esc(subject), body })),
}
