# Cobrança pela AbacatePay

Como as assinaturas são cobradas hoje. Substitui a parte de pagamento do `PLANO_PLANOS_E_ACESSO.md`,
escrita na época da Zouti.

## Planos e ciclos

`plans` guarda Grátis, Essencial, Plus e Pro. Os pagos existem no ciclo **mensal** e **anual**.
Cada plano e ciclo tem um produto na AbacatePay, guardado em `plans.provider_refs`:

| chave | o que é |
| - | - |
| `abacate_monthly` / `abacate_annual` | produto recorrente (`cycle: MONTHLY`/`ANNUALLY`), usado na assinatura |
| `abacate_monthly_once` / `abacate_annual_once` | produto sem ciclo, usado nas faturas Pix avulsas |

Os produtos são criados sozinhos no primeiro checkout, ou de uma vez em
`GET /abacate-webhook?setup=<ABACATEPAY_WEBHOOK_SECRET>`.

## Formas de pagamento

- **Cartão de crédito** — débito recorrente. No anual, o valor do ano é cobrado de uma vez e pode ser
  parcelado em até 12x, com os juros repassados a quem assina (`card.passFeesToCustomer`).
- **Pix Automático** — débito recorrente autorizado no app do banco. Liberado nesta conta.

`pixAutomaticoEnabled()` decide entre os dois caminhos do Pix. O padrão é ligado; o secret
`ABACATEPAY_PIX_AUTOMATICO=0` volta ao Pix por fatura (ver abaixo). Se a API recusar um recurso
(Pix Automático, parcelamento ou repasse de juros), `createSubscriptionCheckout` tenta de novo sem ele
e manda um alerta para `ADMIN_EMAIL`: a venda nunca trava.

### Pix por fatura (modo antigo, ainda em uso)

As assinaturas criadas antes do Pix Automático têm `provider = 'abacatepay_pix'` e não têm recorrência
no gateway. Para elas, `billing-cycle` roda todo dia às 9h (cron `billing-cycle`, 12h UTC) e:

1. até 5 dias do vencimento, cria a fatura do ciclo seguinte (`checkout_intents.kind = 'renewal'`,
   checkout ONE_TIME com Pix e cartão) e manda `invoiceReady`;
2. vencida sem pagamento, passa para `past_due` com 3 dias de tolerância e manda `invoiceOverdue`;
3. acabada a tolerância, encerra e manda `movedToFree`.

Quem está nesse modo pode migrar para o cartão recorrente: um checkout `kind = 'switch'` no mesmo plano,
e os dias já pagos viram dias a mais.

## Ciclo de vida

| evento | o que acontece |
| - | - |
| `subscription.completed` | libera o plano, cria o período de créditos, manda `paymentConfirmed` |
| `subscription.renewed` | estende o período a partir do fim do anterior, manda `renewed` |
| `subscription.payment_failed` | `past_due` + 3 dias de tolerância, manda `paymentFailed` |
| `subscription.cancelled` | acesso até o fim do período pago (ou estorno, conforme `cancelledDueTo`) |
| `checkout.completed` (ONE_TIME) | fatura Pix paga: estende a assinatura |
| `checkout.refunded` | encerra o acesso e manda `refunded` |
| `checkout.disputed` / `checkout.lost` | chargeback: encerra na hora e sinaliza a conta |

Upgrade vale na hora e o que sobrou do plano antigo vira dias a mais. Downgrade e troca para um ciclo
mais barato valem a partir da próxima cobrança. Cancelar mantém o acesso até o fim do período pago.
Reembolso de arrependimento: até 7 dias da primeira compra (CDC art. 49), pedido pelo app e estornado
no painel da AbacatePay — o webhook de estorno encerra o acesso sozinho.

## Secrets

| secret | para quê |
| - | - |
| `ABACATEPAY_API_KEY` | Bearer da API v2 |
| `ABACATEPAY_WEBHOOK_SECRET` | prova a origem do webhook (`?webhookSecret=` ou header) e libera o `?setup=` |
| `ABACATEPAY_PIX_AUTOMATICO` | só para desligar (`0`) o Pix recorrente |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `ADMIN_EMAIL`, `APP_URL` | e-mails |

## Funções

- `billing` — ações do app: `status`, `quote`, `checkout`, `invoice`, `intent-status`, `cancel`,
  `resume`, `downgrade`, `refund`, `claim`, `claim-other`, `welcome`.
- `abacate-webhook` — recebe os eventos (sem JWT; confere o secret e o HMAC) e aplica em `payments.ts`.
- `billing-cycle` — rotina diária das assinaturas por fatura Pix (sem JWT, chamada pelo pg_cron).
