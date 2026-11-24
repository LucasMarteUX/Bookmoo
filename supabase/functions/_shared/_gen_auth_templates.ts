// Gera os templates de e-mail da autenticação do Supabase (supabase/templates/*.html) no visual da marca.
// Rodar: APP_URL=https://upoonly.com deno run --allow-env --allow-write supabase/functions/_shared/_gen_auth_templates.ts
import { layout } from './email.ts'

const T: Record<string, { subject: string; kicker: string; title: string; body: string; cta?: string; note: string }> = {
  confirmation: { subject: 'Confirme seu e-mail no Upoonly', kicker: 'Falta um passo', title: 'Confirme seu e-mail.', body: '<p style="margin:0">Toque no botão para confirmar o endereço e abrir a sua conta. Seu primeiro livro é um presente.</p>', cta: 'Confirmar meu e-mail', note: 'Se você não criou uma conta no Upoonly, pode ignorar este e-mail.' },
  recovery: { subject: 'Redefinir sua senha do Upoonly', kicker: 'Senha', title: 'Vamos criar uma senha nova.', body: '<p style="margin:0">Recebemos um pedido para redefinir a senha da sua conta. O link vale por 1 hora.</p>', cta: 'Criar nova senha', note: 'Não pediu? Ignore este e-mail: sua senha continua a mesma.' },
  magic_link: { subject: 'Seu link de acesso ao Upoonly', kicker: 'Acesso', title: 'Entre com um toque.', body: '<p style="margin:0">Use o botão abaixo para entrar na sua conta. O link vale por 1 hora e só funciona uma vez.</p>', cta: 'Entrar no Upoonly', note: 'Se não foi você, ignore este e-mail.' },
  email_change: { subject: 'Confirme seu novo e-mail no Upoonly', kicker: 'Conta', title: 'Confirme o novo e-mail.', body: '<p style="margin:0">Você pediu para trocar o e-mail da conta para <b>{{ .NewEmail }}</b>. Confirme para concluir.</p>', cta: 'Confirmar novo e-mail', note: 'Se você não pediu essa troca, ignore este e-mail e a conta continua com o endereço atual.' },
  invite: { subject: 'Você foi convidado(a) para o Upoonly', kicker: 'Convite', title: 'Uma história espera por você.', body: '<p style="margin:0">Você recebeu um convite para ler clássicos em inglês no Upoonly. Aceite para criar sua conta.</p>', cta: 'Aceitar convite', note: 'Se não esperava este convite, pode ignorar.' },
  reauthentication: { subject: 'Seu código de verificação do Upoonly', kicker: 'Verificação', title: 'Seu código: <span style="font-family:Arial,sans-serif;letter-spacing:.18em">{{ .Token }}</span>', body: '<p style="margin:0">Digite este código no Upoonly para confirmar a operação. Ele vale por poucos minutos.</p>', note: 'Se não foi você, troque sua senha.' },
}

for (const [name, t] of Object.entries(T)) {
  const html = layout({ kicker: t.kicker, title: t.title, body: t.body, note: t.note, preheader: t.subject, ...(t.cta ? { cta: { label: t.cta, href: '{{ .ConfirmationURL }}' } } : {}) })
  await Deno.writeTextFile(`supabase/templates/${name}.html`, html)
  console.log(`${name}.html  →  assunto: ${t.subject}`)
}
