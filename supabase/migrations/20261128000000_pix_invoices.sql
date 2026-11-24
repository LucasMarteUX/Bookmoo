-- Pix por fatura (enquanto o Pix Automático não está liberado na AbacatePay).
-- renewal: fatura do próximo ciclo de uma assinatura paga por Pix · switch: troca da fatura Pix para o cartão recorrente.
alter table public.checkout_intents drop constraint if exists checkout_intents_kind_check;
alter table public.checkout_intents add constraint checkout_intents_kind_check check (kind in ('new', 'upgrade', 'renewal', 'switch'));
create index if not exists checkout_intents_from_sub on public.checkout_intents (from_subscription_id, kind, status);
create index if not exists subscriptions_provider_live on public.subscriptions (provider, status);

-- Rotina diária (9h de Brasília): gera faturas, avisa vencimentos e encerra após os 3 dias de tolerância.
-- A função é idempotente e não recebe dados; a chave anon (pública) só identifica o projeto.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('billing-cycle') where exists (select 1 from cron.job where jobname = 'billing-cycle');
select cron.schedule('billing-cycle', '0 12 * * *', $$
  select net.http_post(
    url := 'https://ywnmeacpvmcuhzhshpwz.supabase.co/functions/v1/billing-cycle',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_8_SDFkolp0qhUc5yDNdM3A_n59uIlKp"}'::jsonb,
    body := '{}'::jsonb
  );
$$);
