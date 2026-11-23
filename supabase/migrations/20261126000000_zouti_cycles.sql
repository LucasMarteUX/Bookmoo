-- Zouti com dois links (mensal e anual). O plano é decidido pelo valor pago; o ciclo, pelo link/webhook.
-- Compras feitas antes de existir conta com aquele e-mail ficam guardadas e são liberadas no primeiro login
-- com o e-mail confirmado.

alter table public.subscriptions add column if not exists billing_cycle text not null default 'monthly';
alter table public.subscriptions drop constraint if exists subscriptions_billing_cycle_check;
alter table public.subscriptions add constraint subscriptions_billing_cycle_check check (billing_cycle in ('monthly', 'annual'));

alter table public.checkout_intents add column if not exists billing_cycle text not null default 'monthly';
alter table public.checkout_intents drop constraint if exists checkout_intents_billing_cycle_check;
alter table public.checkout_intents add constraint checkout_intents_billing_cycle_check check (billing_cycle in ('monthly', 'annual'));

-- Preço anual (total do ano, em centavos) ao lado do mensal.
alter table public.plans add column if not exists annual_price_cents integer;
update public.plans set annual_price_cents = case id when 'essencial' then 23904 when 'plus' then 43080 when 'pro' then 86304 else 0 end;

create table if not exists public.pending_purchases (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  plan_id text not null references public.plans(id),
  billing_cycle text not null check (billing_cycle in ('monthly', 'annual')),
  amount_cents integer not null,
  event_row_id uuid references public.payment_events(id) on delete set null,
  provider_charge_id text,
  provider_subscription_id text,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists pending_purchases_email on public.pending_purchases (lower(email)) where claimed_at is null;
create unique index if not exists pending_purchases_charge on public.pending_purchases (provider_charge_id) where provider_charge_id is not null;
alter table public.pending_purchases enable row level security;
-- Sem políticas: só o servidor (service role) lê e escreve.
