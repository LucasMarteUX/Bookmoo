// Formulário de contato do site (/contato). Público: publicar com `--no-verify-jwt`.
// Valida os campos, descarta bots (honeypot), limita envios por IP e manda duas mensagens:
// uma para ADMIN_EMAIL (responder vai direto ao visitante) e uma confirmação automática para o visitante.
import { emails } from '../_shared/email.ts'
import { log } from '../_shared/tts.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const SUBJECTS = ['Dúvida sobre a conta', 'Assinatura e pagamento', 'Sugestão de livro', 'Escolas e parcerias', 'Privacidade e dados', 'Denúncia', 'Outro'] as const

// Limite por IP em memória (por instância da função): 5 envios a cada hora. Simples e suficiente contra abuso casual.
const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 5
const hits = new Map<string, number[]>()
function limited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter(t => now - t < WINDOW_MS)
  if (recent.length >= MAX_PER_WINDOW) { hits.set(ip, recent); return true }
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < WINDOW_MS)) hits.delete(k)
  return false
}

const EMAIL_RE = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[a-z]{2,}$/i
const clean = (v: unknown, max: number) => typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max + 1) : ''

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json(400, { error: 'invalid_json' }) }

  // Honeypot preenchido: finge sucesso para o bot e não envia nada.
  if (clean(body.website, 200)) return json(200, { ok: true })

  const name = clean(body.name, 120).replace(/[\r\n]+/g, ' ')
  const email = clean(body.email, 254).toLowerCase()
  const subject = clean(body.subject, 80)
  const message = clean(body.message, 5000)

  const errors: Record<string, string> = {}
  if (name.length < 2 || name.length > 120) errors.name = 'Informe seu nome.'
  if (!EMAIL_RE.test(email) || email.length > 254) errors.email = 'Informe um e-mail válido.'
  if (!(SUBJECTS as readonly string[]).includes(subject)) errors.subject = 'Escolha um assunto.'
  if (message.length < 10) errors.message = 'Escreva pelo menos 10 caracteres.'
  else if (message.length > 5000) errors.message = 'A mensagem pode ter até 5000 caracteres.'
  if (Object.keys(errors).length) return json(422, { error: 'invalid_fields', fields: errors })

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('cf-connecting-ip') || 'unknown'
  if (limited(ip)) return json(429, { error: 'rate_limited' })

  const admin = Deno.env.get('ADMIN_EMAIL')
  if (!admin) { log('contact', 'no_admin_email', {}); return json(503, { error: 'not_configured' }) }

  const sent = await emails.contactToAdmin({ name, email, subject, message, ip })
  if (!sent) return json(502, { error: 'send_failed' })
  await emails.contactConfirmation(email, name, subject)
  log('contact', 'sent', { subject })
  return json(200, { ok: true })
})
