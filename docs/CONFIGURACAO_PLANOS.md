# Configuração — planos, pagamento, e-mail e login (o que falta ligar)

> O código e o banco já estão no ar (2026-11-15). Estes passos são configurações de painel que só você pode fazer.
> Enquanto algo não estiver configurado, o app continua funcionando: o recurso correspondente fica indisponível com mensagem clara.

## 1. IA da plataforma (urgente)

Secrets das Edge Functions (Supabase → Project Settings → Edge Functions → Secrets):

| Secret | Para quê | Status |
|---|---|---|
| `OPENAI_API_KEY` | Ilustrações dos quadrinhos (gpt-image-2) e direção de arte | ❌ **falta** — sem ele, só quem ainda tem chave própria conectada gera quadrinhos |
| `GEMINI_API_KEY` | Texto (explicações, conversas, Raio-X) e mosaico, enquanto não houver OpenAI | ✅ já existe |

Depois de criar o `OPENAI_API_KEY`, defina um limite mensal de gasto no painel da OpenAI (Settings → Limits). O app também tem um teto diário próprio (Admin → Financeiro → Ajustes, padrão US$ 40/dia).

## 2. Zouti (pagamento)

1. Crie **3 produtos de assinatura mensal**: Essencial R$ 24,90 · Plus R$ 44,90 · Pro R$ 89,90.
2. Em cada produto, configure a **URL de retorno após pagamento**: `https://SEU-DOMINIO/checkout/retorno`
3. Webhook (Configurações → Webhooks): URL `https://ywnmeacpvmcuhzhshpwz.supabase.co/functions/v1/billing-webhook`, marcando os eventos de pedido aprovado, assinatura ativada/renovada, recusado, cancelado, estornado e chargeback.
4. Secrets no Supabase:

| Secret | Valor |
|---|---|
| `ZOUTI_CHECKOUT_URL_ESSENCIAL` / `_PLUS` / `_PRO` | Link de checkout de cada produto |
| `ZOUTI_PRODUCT_ESSENCIAL` / `_PLUS` / `_PRO` | ID do produto/oferta como aparece no webhook |
| `ZOUTI_WEBHOOK_SECRET` | Segredo do webhook (assinatura HMAC no header `x-zouti-signature`) |
| `ZOUTI_REF_PARAM` (opcional) | Nome do parâmetro de URL que a Zouti devolve no webhook (padrão `src`) |

5. Use o botão "Testar webhook" da Zouti e confira em **Admin → Financeiro → Pagamentos recentes** (eventos com erro aparecem lá). O formato do corpo do webhook da Zouti não é público: a leitura é tolerante, mas valide com um pagamento de teste antes de abrir as vendas.

> Cancelamento, downgrade e reembolso pedidos no app geram um alerta por e-mail para o admin (`ADMIN_EMAIL`): a recorrência precisa ser cancelada/estornada no painel da Zouti, e o webhook de estorno encerra o acesso automaticamente.

## 3. Resend (e-mails)

1. Compre o domínio e verifique-o na Resend (registros SPF, DKIM e DMARC).
2. **E-mails de login/cadastro**: Supabase → Authentication → Emails → SMTP Settings → host `smtp.resend.com`, porta 465, usuário `resend`, senha = API key da Resend, remetente `nao-responda@SEU-DOMINIO`. Traduza os templates (confirmação, recuperação de senha) para pt-BR.
3. **E-mails transacionais** (pagamento confirmado, falha, cancelamento, reembolso, alertas): secrets

| Secret | Exemplo |
|---|---|
| `RESEND_API_KEY` | `re_…` |
| `EMAIL_FROM` | `Upoonly <ola@SEU-DOMINIO>` |
| `APP_URL` | `https://SEU-DOMINIO` |
| `APP_NAME` | nome final do app |
| `ADMIN_EMAIL` | e-mail que recebe os alertas de cobrança e custo |

## 4. Login e cadastro

Supabase → Authentication:
- **Confirm email: ligado** (os créditos grátis só liberam com e-mail confirmado).
- **URL Configuration**: Site URL = seu domínio; Redirect URLs incluir `https://SEU-DOMINIO/**` e `http://localhost:3000/**` (o link de nova senha vai para `/nova-senha`).
- **Google**: Google Cloud Console → OAuth client (Web) → redirect `https://ywnmeacpvmcuhzhshpwz.supabase.co/auth/v1/callback` → copie Client ID/Secret em Authentication → Providers → Google. Tela de consentimento com nome, logo e link da política de privacidade.
- **Leaked password protection**: ligar (alerta do Supabase).

Quem entra pelo Google cai em `/completar-cadastro` (data de nascimento + aceite dos termos) antes dos planos.

## 5. Contas atuais

- Contas que já existiam entram como **Grátis**, com o onboarding marcado como concluído (não passam pela tela de planos).
- Livros da galeria que já estão na estante dessas contas ficam **travados** (progresso guardado) até escolherem o presente ou assinarem.
- Para dar o mês grátis de "Fundadores": Admin → Financeiro → Plano de cortesia (e-mail, plano Essencial, 30 dias).

## 6. Pendências de produto

- Nome do app e domínio.
- Confirmar com a Zouti: formato do webhook, cancelamento/estorno via API (para automatizar o que hoje vira alerta), valor diferente na primeira cobrança (hoje o pró-rata do upgrade vira créditos bônus).
- CNPJ e regime tributário (ajustar `Impostos (%)` em Admin → Financeiro).
- Teste técnico da voz no iPhone e no Android (latência do Tutor e das Cenas).

## 7. Custo do plano Grátis (revisão de 2026-11-15)

Pior caso por pessoa no Grátis, em um mês (câmbio R$ 6,00): 3 páginas ilustradas × ~US$ 0,07–0,10 = **~R$ 1,30–1,80**, mais ~10 créditos de texto/voz (~R$ 0,10). Total **≈ R$ 1,50–2,00**. O uso típico fica perto de **R$ 0,40–0,70**, porque as páginas que a comunidade já gerou não custam nada e a maioria não usa tudo.

Receita de quem converte (Essencial, líquida): ~R$ 22/mês, com sobra de ~R$ 9–10 depois do custo de IA.

| Cenário | Conversão grátis→pago necessária para o Grátis se pagar |
|---|---|
| Uso típico (R$ 0,55) | ~2,5% |
| Pior caso (R$ 2,00) | ~9% |

Ajustes feitos: créditos do Grátis 60 → 40, mosaicos 5 → 3 por mês, e crédito só com e-mail confirmado. O que realmente pesa é o teto de **3 páginas ilustradas**. Se o custo medido no Admin → Financeiro passar de ~R$ 1,00 por usuário grátis, a alavanca certa é reduzir esse teto (por exemplo 3 páginas só no 1º mês e 1 por mês depois), não os créditos.

## 8. Espelho das vozes (para não depender do Hugging Face)

1. `npx tsx scripts/models/backup-models.mts` (a cópia local em `content/models-backup` já existe, 630 MB).
2. A migration cria o bucket público `voice-models`. Suba os arquivos: `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/models/upload-models.mts`. O modelo completo tem ~310 MB: o limite de upload do projeto (Settings → Storage) precisa ser maior que isso.
3. No Vercel, defina `VITE_MODEL_HOST=https://ywnmeacpvmcuhzhshpwz.supabase.co/storage/v1/object/public/voice-models`. O app passa a baixar daí e cai no Hugging Face só se o espelho falhar.
