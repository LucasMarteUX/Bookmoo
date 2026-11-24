# E-mails do Upoonly (Resend · domínio upoonly.com)

## 1. Secrets das Edge Functions (Supabase → Edge Functions → Secrets)

| Nome | Valor | Quem grava |
| --- | --- | --- |
| `RESEND_API_KEY` | a chave de API do Resend (`re_...`) | você (não passar pelo chat) |
| `ADMIN_EMAIL` | o e-mail que recebe os alertas do sistema | você |
| `EMAIL_FROM` | `Upoonly <ola@upoonly.com>` | já gravado |
| `EMAIL_REPLY_TO` | `contato@upoonly.com` | já gravado |
| `APP_URL` | `https://www.upoonly.com` | já gravado |

Nada disso vai no `.env` do projeto nem na Vercel: os e-mails saem só das funções do servidor.

## 2. E-mails de autenticação (pela API do Resend, via Send Email Hook)

Todos os e-mails de login (confirmar cadastro, redefinir senha, link mágico, troca de e-mail, convite, código de verificação, avisos de senha/e-mail alterados) são montados e enviados pela função `auth-email`, direto pela API do Resend, com o mesmo visual dos e-mails transacionais.

- Supabase → Authentication → Auth Hooks → **Send Email hook** → tipo HTTPS
- URL: `https://ywnmeacpvmcuhzhshpwz.supabase.co/functions/v1/auth-email`
- Secret: gerado no próprio diálogo (`v1,whsec_...`) e gravado também como secret das Edge Functions com o nome `SEND_EMAIL_HOOK_SECRET`

Com o hook ligado, os templates e o SMTP abaixo deixam de ser usados (ficam só como reserva, caso o hook seja desligado).

### Reserva: SMTP (Authentication → Emails → SMTP Settings → Enable custom SMTP)

| Campo | Valor |
| --- | --- |
| Sender email | `ola@upoonly.com` |
| Sender name | `Upoonly` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a mesma chave do Resend (`re_...`) |

### Templates (Authentication → Emails → Templates)

Cole o conteúdo de cada arquivo em `supabase/templates/` no template correspondente:

| Template no Supabase | Arquivo | Assunto |
| --- | --- | --- |
| Confirm signup | `confirmation.html` | Confirme seu e-mail no Upoonly |
| Reset password | `recovery.html` | Redefinir sua senha do Upoonly |
| Magic link | `magic_link.html` | Seu link de acesso ao Upoonly |
| Change email address | `email_change.html` | Confirme seu novo e-mail no Upoonly |
| Invite user | `invite.html` | Você foi convidado(a) para o Upoonly |
| Reauthentication | `reauthentication.html` | Seu código de verificação do Upoonly |

Para gerar de novo (depois de mudar o visual em `supabase/functions/_shared/email.ts`):

```bash
APP_URL=https://www.upoonly.com npx -y deno@2 run --allow-env --allow-write supabase/functions/_shared/_gen_auth_templates.ts
```

## 3. E-mails transacionais (saem das funções)

| E-mail | Quando |
| --- | --- |
| Boas-vindas | uma vez por conta, quando a pessoa termina o primeiro acesso |
| Pagamento aprovado | primeira cobrança de um plano (com dias a mais do upgrade, se houver) |
| Assinatura renovada | cada renovação paga |
| Pagamento pendente | cobrança recusada (3 dias de tolerância) |
| Conta voltou para o Grátis | tentativas esgotadas ou autorização do Pix Automático cancelada |
| Cancelamento confirmado | cancelamento pedido no app |
| Mudança de plano agendada | downgrade (vale na próxima cobrança) |
| Reembolso processado | estorno |
| Créditos acabando | créditos de IA no fim |
| Alerta do sistema | para o `ADMIN_EMAIL` (pagamento para revisar, recurso da AbacatePay não liberado etc.) |
