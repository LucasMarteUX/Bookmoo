// Auth Hook "Send Email": o Supabase deixa de enviar e-mails e chama esta função a cada confirmação de cadastro,
// redefinição de senha, link de acesso, convite, troca de e-mail e código de verificação. Enviamos pela API do Resend,
// no mesmo visual dos outros e-mails. Secret: SEND_EMAIL_HOOK_SECRET ("v1,whsec_..."), gerado em Auth → Hooks.
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { layout, sendEmailStrict } from '../_shared/email.ts'
import { log } from '../_shared/tts.ts'

type EmailData = { token: string; token_hash: string; redirect_to: string; email_action_type: string; site_url: string; token_new: string; token_hash_new: string }
type User = { email: string; new_email?: string; user_metadata?: { full_name?: string; name?: string } }

const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '')

function verifyUrl(hash: string, type: string, redirectTo: string) {
  const u = new URL(`${SUPABASE_URL}/auth/v1/verify`)
  u.searchParams.set('token', hash)
  u.searchParams.set('type', type)
  if (redirectTo) u.searchParams.set('redirect_to', redirectTo)
  return u.toString()
}

const code = (t: string) => `<p style="margin:18px 0 0;font:600 26px/1 Arial,sans-serif;letter-spacing:.22em;color:#1c1c1a">${t}</p>`

function build(type: string, url: string, token: string, user: User): { subject: string; html: string } | null {
  const first = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? '').split(' ')[0]
  switch (type) {
    case 'signup':
      return { subject: 'Confirme seu e-mail no Upoonly', html: layout({ kicker: 'Falta um passo', title: `Confirme seu e-mail${first ? `, ${first}` : ''}.`, preheader: 'Um toque e sua conta está pronta.',
        body: '<p style="margin:0">Toque no botão para confirmar o endereço e abrir a sua conta. Seu primeiro livro é um presente.</p>' + (token ? `<p style="margin:14px 0 0;color:#6b6b66">Ou digite este código no app:</p>${code(token)}` : ''),
        cta: { label: 'Confirmar meu e-mail', href: url }, note: 'Se você não criou uma conta no Upoonly, pode ignorar este e-mail.' }) }
    case 'recovery':
      return { subject: 'Redefinir sua senha do Upoonly', html: layout({ kicker: 'Senha', title: 'Vamos criar uma senha nova.', preheader: 'O link vale por 1 hora.',
        body: '<p style="margin:0">Recebemos um pedido para redefinir a senha da sua conta. O link vale por 1 hora.</p>',
        cta: { label: 'Criar nova senha', href: url }, note: 'Não pediu? Ignore este e-mail: sua senha continua a mesma.' }) }
    case 'magiclink':
      return { subject: 'Seu link de acesso ao Upoonly', html: layout({ kicker: 'Acesso', title: 'Entre com um toque.', preheader: 'Seu link de acesso chegou.',
        body: '<p style="margin:0">Use o botão abaixo para entrar na sua conta. O link vale por 1 hora e só funciona uma vez.</p>' + (token ? `<p style="margin:14px 0 0;color:#6b6b66">Ou use o código:</p>${code(token)}` : ''),
        cta: { label: 'Entrar no Upoonly', href: url }, note: 'Se não foi você, ignore este e-mail.' }) }
    case 'invite':
      return { subject: 'Você foi convidado(a) para o Upoonly', html: layout({ kicker: 'Convite', title: 'Uma história espera por você.',
        body: '<p style="margin:0">Você recebeu um convite para ler clássicos em inglês no Upoonly. Aceite para criar sua conta.</p>',
        cta: { label: 'Aceitar convite', href: url }, note: 'Se não esperava este convite, pode ignorar.' }) }
    case 'email_change':
      return { subject: 'Confirme a troca de e-mail no Upoonly', html: layout({ kicker: 'Conta', title: 'Confirme a troca de e-mail.',
        body: `<p style="margin:0">Você pediu para trocar o e-mail da conta${user.new_email ? ` para <b>${user.new_email}</b>` : ''}. Confirme para concluir.</p>`,
        cta: { label: 'Confirmar troca de e-mail', href: url }, note: 'Se você não pediu essa troca, ignore este e-mail: a conta continua com o endereço atual.' }) }
    case 'reauthentication':
      return { subject: `${token} é o seu código do Upoonly`, html: layout({ kicker: 'Verificação', title: 'Seu código de verificação.',
        body: `<p style="margin:0">Digite este código no Upoonly para confirmar a operação. Ele vale por poucos minutos.</p>${code(token)}`, note: 'Se não foi você, troque sua senha.' }) }
    case 'password_changed_notification':
      return { subject: 'Sua senha do Upoonly foi alterada', html: layout({ kicker: 'Segurança', title: 'Senha alterada.',
        body: '<p style="margin:0">A senha da sua conta acabou de ser alterada. Se foi você, está tudo certo.</p>', note: 'Não foi você? Redefina a senha agora e escreva para contato@upoonly.com.' }) }
    case 'email_changed_notification':
      return { subject: 'O e-mail da sua conta Upoonly foi alterado', html: layout({ kicker: 'Segurança', title: 'E-mail alterado.',
        body: '<p style="margin:0">O e-mail de acesso da sua conta foi alterado. Se foi você, está tudo certo.</p>', note: 'Não foi você? Escreva para contato@upoonly.com.' }) }
    default:
      return null
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('not allowed', { status: 405 })
  const secret = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? '').replace('v1,whsec_', '')
  const payload = await req.text()
  let user: User, email_data: EmailData
  try {
    ;({ user, email_data } = new Webhook(secret).verify(payload, Object.fromEntries(req.headers)) as { user: User; email_data: EmailData })
  } catch {
    return new Response(JSON.stringify({ error: { http_code: 401, message: 'invalid signature' } }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }
  const type = email_data.email_action_type
  try {
    const sends: { to: string; hash: string; token: string }[] = []
    if (type === 'email_change') {
      // Nomes invertidos por compatibilidade: token_hash_new vai para o e-mail ATUAL; token_hash para o NOVO.
      if (email_data.token_hash_new) sends.push({ to: user.email, hash: email_data.token_hash_new, token: email_data.token })
      if (user.new_email) sends.push({ to: user.new_email, hash: email_data.token_hash, token: email_data.token_new || email_data.token })
    } else {
      sends.push({ to: user.email, hash: email_data.token_hash, token: email_data.token })
    }
    for (const s of sends) {
      const msg = build(type, verifyUrl(s.hash, type, email_data.redirect_to || email_data.site_url), s.token, user)
      if (!msg) { log('auth-email', 'type_ignored', { type }); continue }
      await sendEmailStrict(s.to, msg.subject, msg.html)
    }
    log('auth-email', 'sent', { type, n: sends.length })
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    const message = String((e as Error)?.message ?? e).slice(0, 200)
    log('auth-email', 'send_failed', { type, message })
    return new Response(JSON.stringify({ error: { http_code: 500, message } }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
