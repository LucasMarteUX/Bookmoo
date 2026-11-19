# Segurança do Upoonly: revisão de 15/11/2026

## O que já estava bem
- **Funções do Supabase:** todas exigem JWT e chamam `getUser` (token validado no servidor). A única sem JWT é o webhook de pagamento, que confere a assinatura HMAC e falha fechado se o segredo não existir.
- **Banco:** as 65 tabelas do schema `public` têm RLS ligado. Nenhuma função `SECURITY DEFINER` pode ser executada por `anon`. Todas as `admin_*` checam `is_global_admin()` dentro da função.
- **Admin:** o papel vem de `app_metadata` e de `admin_users`, que só o service role escreve. O cliente nunca decide quem é admin.
- **Segredos:** `.env*` está no `.gitignore`. Nenhuma chave de serviço no repositório nem no bundle (só URL e chave `anon`, que são públicas por desenho).
- **XSS:** o texto do leitor e das legendas é escapado antes de ir para `dangerouslySetInnerHTML`.
- **Storage:** buckets de áudio, imagens de vocabulário e referências são privados, com pasta por usuário.

## Achados e o que foi feito
| # | Risco | Achado | Correção |
|---|-------|--------|----------|
| 1 | Alto | Nenhum limite de requisições nas funções (só o saldo de créditos). | Limitador no Postgres (`rate_limit_hit`) aplicado a todas as funções, por usuário/minuto; webhook por IP. Resposta 429 com `Retry-After`. |
| 2 | Médio | Funções `is_friend`, `is_blocked_between`, `follows_accepted`, `can_view_*` respondiam sobre quaisquer dois usuários (dava para saber quem bloqueou quem). | Só respondem quando quem chama é uma das pessoas da pergunta. Chamadas internas (gatilhos, cron) seguem iguais. |
| 3 | Médio | Anotações do vocabulário limpavam só `<script>`; `<img onerror=...>` passava. | Filtro por lista de permissão (`src/lib/sanitizeHtml.ts`). |
| 4 | Médio | Papel `anon` enxergava todas as tabelas (inclusive pelo GraphQL). | `anon` perdeu o acesso às tabelas (fica só `plans`). Com isso o GraphQL deixa de listar tabelas para quem não tem login. O schema do GraphQL pertence ao Supabase e não dá para fechar por SQL; o dado continua protegido pelo RLS. |
| 5 | Baixo | Senha mínima de 6 caracteres. | 8 no cadastro e mensagens para senha vazada/comum. |
| 6 | Baixo | Entrar e criar conta sem freio no aparelho. | Espera progressiva depois de 4 erros (`src/lib/authThrottle.ts`). |
| 7 | Baixo | Sem cabeçalhos de segurança no site. | `vercel.json`: nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS e CSP em modo relatório. |
| 8 | Baixo | 4 funções com `search_path` mutável. | Fixado em `public`. |

## O que só você consegue fazer (painel do Supabase)
O limite de entrada e cadastro **de verdade** fica no Supabase Auth, porque o endereço dele é público e qualquer pessoa pode chamá-lo sem passar pelo nosso site.
1. **Authentication → Rate Limits:** deixe "sign in/sign up" em no máximo 30 por 5 minutos por IP, "token refresh" no padrão e e-mails por hora de acordo com o seu SMTP.
2. **Authentication → Attack Protection:** ligue **CAPTCHA** (Cloudflare Turnstile é gratuito). Depois me avise: o formulário passa a enviar o token.
3. **Authentication → Providers → Email:** ligue **Leaked password protection**, defina **Minimum password length = 8** e exija letras e números.
4. **Authentication → URL Configuration:** deixe só o domínio de produção (e `http://localhost:3000` no desenvolvimento) em Site URL e Redirect URLs.
5. **Project Settings → API:** guarde a `service_role` só no Supabase (segredos das funções) e na Vercel como variável privada. Gire a chave se ela já passou por chat, e-mail ou arquivo compartilhado.
6. **Edge Functions → Secrets:** defina `TTS_ALLOWED_ORIGIN` com o domínio de produção para trocar o CORS `*` pelo domínio do app.
7. **Backups:** ative backups diários (plano Pro) e, de preferência, Point-in-Time Recovery.

## Risco aceito, por enquanto
- **CORS `*` nas funções:** a autenticação usa `Authorization: Bearer`, e não cookie, então outro site não consegue agir em nome do usuário. Mesmo assim, o item 6 acima fecha isso.
- **Buckets públicos** (`avatars`, `post-media`, `comic-pages`): as imagens são servidas por URL. O caminho inclui o id do usuário e não aparece em lista. Quem tem o link vê a imagem.
- **Função `ai-keys` (chave de IA do próprio usuário):** não é usada pelo app hoje, porque a IA é da plataforma. Se ninguém vai usar, o melhor é apagar a função (menos superfície).
- **CSP em modo relatório:** não bloqueia nada. Depois de uma semana sem violações no console, troque `Content-Security-Policy-Report-Only` por `Content-Security-Policy`.

## Rotina
- Rode `get_advisors` (segurança) depois de cada migração.
- Toda função nova: `getUser` + `rateLimit` logo no início.
- Toda função SQL `SECURITY DEFINER` nova: `set search_path = public` e checagem de `auth.uid()`.
