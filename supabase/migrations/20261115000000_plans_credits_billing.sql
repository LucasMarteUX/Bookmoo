-- Planos, créditos de IA, minutos de conversa, assinaturas e proteção do catálogo.
-- Regra de ouro: o navegador só lê o próprio estado; tudo que muda saldo, plano ou pagamento
-- passa por funções security definer chamadas pelas Edge Functions (service role).

-- ---------------------------------------------------------------------------
-- Admin por tabela (antes: e-mail fixo no código)
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
insert into public.admin_users (user_id)
  select id from auth.users where lower(email) = 'lucasmarteux@gmail.com'
  on conflict do nothing;

create or replace function public.is_global_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
revoke all on function public.is_global_admin() from public;
grant execute on function public.is_global_admin() to authenticated;

create or replace function public.is_admin_id(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = p_user);
$$;
revoke all on function public.is_admin_id(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Configurações globais (câmbio, teto diário de custo, taxas)
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
insert into public.app_settings (key, value) values
  ('usd_brl', '6.0'),
  ('ai_daily_budget_usd', '40'),
  ('gateway_fee_pct', '5'),
  ('tax_pct', '6'),
  ('past_due_grace_days', '3')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Planos
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id text primary key,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  monthly_credits integer not null,
  monthly_minutes integer not null,
  rank smallint not null unique,
  limits jsonb not null default '{}'::jsonb,
  provider_refs jsonb not null default '{}'::jsonb,
  active boolean not null default true
);
alter table public.plans enable row level security;
drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select to anon, authenticated using (true);

insert into public.plans (id, name, price_cents, monthly_credits, monthly_minutes, rank, limits) values
  ('free', 'Grátis', 0, 60, 3, 0, '{"library":false,"imports":0,"text_books":1,"pages":3,"mosaic":5,"custom_style":false,"tutor":false,"scenes":"demo","scenes_create":false,"free_talk":false,"insights":"none","stories":0,"max_scene_minutes":3,"feedback":"summary","monthly_report":false}'),
  ('essencial', 'Essencial', 2490, 200, 30, 1, '{"library":true,"imports":20,"text_books":null,"pages":null,"mosaic":null,"custom_style":true,"tutor":false,"scenes":"all","scenes_create":false,"free_talk":false,"insights":"none","stories":0,"max_scene_minutes":5,"feedback":"full","monthly_report":false}'),
  ('plus', 'Plus', 4490, 450, 120, 2, '{"library":true,"imports":100,"text_books":null,"pages":null,"mosaic":null,"custom_style":true,"tutor":true,"scenes":"all","scenes_create":true,"free_talk":true,"insights":"weekly","stories":12,"max_scene_minutes":5,"feedback":"detailed","monthly_report":false}'),
  ('pro', 'Pro', 8990, 900, 300, 3, '{"library":true,"imports":null,"text_books":null,"pages":null,"mosaic":null,"custom_style":true,"tutor":true,"scenes":"all","scenes_create":true,"free_talk":true,"insights":"on_demand","stories":null,"max_scene_minutes":10,"feedback":"detailed","monthly_report":true}')
on conflict (id) do update set name = excluded.name, price_cents = excluded.price_cents, monthly_credits = excluded.monthly_credits,
  monthly_minutes = excluded.monthly_minutes, rank = excluded.rank, limits = excluded.limits;

-- ---------------------------------------------------------------------------
-- Conta: passo do onboarding, nascimento e aceite (o Google não fornece)
-- ---------------------------------------------------------------------------
create table if not exists public.user_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  onboarding_step text not null default 'plans' check (onboarding_step in ('complete_profile', 'plans', 'gift', 'done')),
  birth_date date,
  terms_accepted_at timestamptz,
  flagged boolean not null default false,
  flag_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_accounts enable row level security;
drop policy if exists user_accounts_read on public.user_accounts;
create policy user_accounts_read on public.user_accounts for select to authenticated using (user_id = auth.uid());

-- Quem já usa o app não passa pelo onboarding novo.
insert into public.user_accounts (user_id, onboarding_step, birth_date, terms_accepted_at)
  select u.id, 'done',
    case when (u.raw_user_meta_data->>'birth_date') ~ '^\d{4}-\d{2}-\d{2}$' then (u.raw_user_meta_data->>'birth_date')::date end,
    u.created_at
  from auth.users u
on conflict (user_id) do nothing;

create or replace function public.handle_new_account()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_birth date;
begin
  if (new.raw_user_meta_data->>'birth_date') ~ '^\d{4}-\d{2}-\d{2}$' then
    v_birth := (new.raw_user_meta_data->>'birth_date')::date;
  end if;
  insert into public.user_accounts (user_id, onboarding_step, birth_date, terms_accepted_at)
  values (new.id, case when v_birth is null then 'complete_profile' else 'plans' end, v_birth,
          case when v_birth is null then null else now() end)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_account on auth.users;
create trigger on_auth_user_created_account after insert on auth.users
  for each row execute function public.handle_new_account();

/** Completa o cadastro (contas do Google) e avança o onboarding. */
create or replace function public.complete_profile(p_birth date, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if not p_accept then raise exception 'terms_required'; end if;
  if p_birth is null or p_birth > current_date or p_birth < date '1900-01-01' then raise exception 'invalid_birth_date'; end if;
  insert into public.user_accounts (user_id, onboarding_step, birth_date, terms_accepted_at)
  values (auth.uid(), 'plans', p_birth, now())
  on conflict (user_id) do update set birth_date = excluded.birth_date, terms_accepted_at = now(),
    onboarding_step = case when public.user_accounts.onboarding_step = 'complete_profile' then 'plans' else public.user_accounts.onboarding_step end,
    updated_at = now();
end;
$$;
revoke all on function public.complete_profile(date, boolean) from public, anon;
grant execute on function public.complete_profile(date, boolean) to authenticated;

/** A pessoa só avança o próprio onboarding (nunca volta, nunca pula 'complete_profile'). */
create or replace function public.set_onboarding_step(p_step text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_now text;
  v_order constant text[] := array['complete_profile', 'plans', 'gift', 'done'];
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if not (p_step = any(v_order)) then raise exception 'invalid_step'; end if;
  select onboarding_step into v_now from public.user_accounts where user_id = auth.uid();
  if v_now is null then
    insert into public.user_accounts (user_id, onboarding_step) values (auth.uid(), 'complete_profile');
    v_now := 'complete_profile';
  end if;
  if v_now = 'complete_profile' then raise exception 'profile_incomplete'; end if;
  if array_position(v_order, p_step) > array_position(v_order, v_now) then
    update public.user_accounts set onboarding_step = p_step, updated_at = now() where user_id = auth.uid();
  end if;
end;
$$;
revoke all on function public.set_onboarding_step(text) from public, anon;
grant execute on function public.set_onboarding_step(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Assinaturas e pagamentos
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null check (status in ('pending', 'active', 'past_due', 'canceled', 'expired', 'refunded', 'disputed')),
  price_cents integer not null,
  provider text not null default 'zouti',
  provider_subscription_id text,
  provider_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  pending_plan_id text references public.plans(id),
  grace_until timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists subscriptions_one_live on public.subscriptions (user_id) where status in ('active', 'past_due');
create unique index if not exists subscriptions_provider_ref on public.subscriptions (provider, provider_subscription_id) where provider_subscription_id is not null;
alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_read on public.subscriptions;
create policy subscriptions_read on public.subscriptions for select to authenticated using (user_id = auth.uid());

create table if not exists public.checkout_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.plans(id),
  kind text not null check (kind in ('new', 'upgrade')),
  amount_cents integer not null,
  proration_cents integer not null default 0,
  bonus_credits integer not null default 0,
  from_subscription_id uuid references public.subscriptions(id),
  status text not null default 'open' check (status in ('open', 'paid', 'expired', 'canceled')),
  provider text not null default 'zouti',
  provider_ref text,
  checkout_url text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 day'
);
create index if not exists checkout_intents_user on public.checkout_intents (user_id, created_at desc);
alter table public.checkout_intents enable row level security;
drop policy if exists checkout_intents_read on public.checkout_intents;
create policy checkout_intents_read on public.checkout_intents for select to authenticated using (user_id = auth.uid());

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  intent_id uuid references public.checkout_intents(id) on delete set null,
  provider text not null,
  provider_charge_id text not null,
  amount_cents integer not null,
  fee_cents integer not null default 0,
  method text,
  status text not null check (status in ('paid', 'refunded', 'failed', 'disputed', 'pending')),
  kind text not null check (kind in ('new', 'renewal', 'upgrade', 'refund', 'manual')),
  paid_at timestamptz,
  invoice_url text,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_charge_id)
);
create index if not exists payments_paid_at on public.payments (paid_at);
alter table public.payments enable row level security;
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated using (user_id = auth.uid());

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  type text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (provider, provider_event_id)
);
alter table public.payment_events enable row level security;

-- ---------------------------------------------------------------------------
-- Créditos e minutos (períodos, reservas, extrato)
-- ---------------------------------------------------------------------------
create table if not exists public.credit_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.plans(id),
  subscription_id uuid references public.subscriptions(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  credits_granted integer not null default 0,
  credits_used integer not null default 0,
  credits_reserved integer not null default 0,
  bonus_credits integer not null default 0,
  seconds_granted integer not null default 0,
  seconds_used integer not null default 0,
  seconds_reserved integer not null default 0,
  usage jsonb not null default '{}'::jsonb,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  check (credits_used + credits_reserved <= credits_granted + bonus_credits),
  check (seconds_used + seconds_reserved <= seconds_granted)
);
create index if not exists credit_periods_user on public.credit_periods (user_id, ends_at desc);
alter table public.credit_periods enable row level security;
drop policy if exists credit_periods_read on public.credit_periods;
create policy credit_periods_read on public.credit_periods for select to authenticated using (user_id = auth.uid());

create table if not exists public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_id uuid not null references public.credit_periods(id) on delete cascade,
  unit text not null check (unit in ('credits', 'seconds')),
  amount integer not null check (amount >= 0),
  cap_field text,
  operation text not null,
  ref text,
  status text not null default 'held' check (status in ('held', 'committed', 'released')),
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes'
);
create index if not exists credit_reservations_held on public.credit_reservations (user_id) where status = 'held';
alter table public.credit_reservations enable row level security;

create table if not exists public.credit_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_id uuid references public.credit_periods(id) on delete cascade,
  unit text not null check (unit in ('credits', 'seconds')),
  delta integer not null,
  kind text not null check (kind in ('grant', 'commit', 'expire', 'bonus', 'admin', 'refund')),
  operation text,
  ref text,
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_user on public.credit_ledger (user_id, created_at desc);
alter table public.credit_ledger enable row level security;
drop policy if exists credit_ledger_read on public.credit_ledger;
create policy credit_ledger_read on public.credit_ledger for select to authenticated using (user_id = auth.uid());

create table if not exists public.ai_usage (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  operation text not null,
  provider text,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  images integer not null default 0,
  image_quality text,
  cost_usd numeric(12, 6) not null default 0,
  credits integer not null default 0,
  seconds integer not null default 0,
  status text not null check (status in ('ok', 'failed', 'cache_hit')),
  latency_ms integer,
  plan_id text,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_created on public.ai_usage (created_at);
create index if not exists ai_usage_user on public.ai_usage (user_id, created_at desc);
alter table public.ai_usage enable row level security;

create or replace function public.user_id_by_email(p_email text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;
revoke all on function public.user_id_by_email(text) from public, anon, authenticated;

create or replace function public.ai_spent_today()
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(cost_usd), 0) from public.ai_usage where created_at >= date_trunc('day', now());
$$;
revoke all on function public.ai_spent_today() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Livro-presente
-- ---------------------------------------------------------------------------
create table if not exists public.gift_redemptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  catalog_id uuid not null references public.catalog_books(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  swapped_at timestamptz
);
alter table public.gift_redemptions enable row level security;
drop policy if exists gift_redemptions_read on public.gift_redemptions;
create policy gift_redemptions_read on public.gift_redemptions for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Plano atual e período de créditos
-- ---------------------------------------------------------------------------
create or replace function public.live_subscription(p_user uuid)
returns public.subscriptions language sql stable security definer set search_path = public as $$
  select s.* from public.subscriptions s
  where s.user_id = p_user
    and (
      (s.status = 'active' and s.current_period_end > now())
      or (s.status = 'past_due' and coalesce(s.grace_until, s.current_period_end) > now())
    )
  order by s.created_at desc
  limit 1;
$$;
revoke all on function public.live_subscription(uuid) from public, anon, authenticated;

create or replace function public.current_plan_id(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select plan_id from public.live_subscription(p_user)), 'free');
$$;
revoke all on function public.current_plan_id(uuid) from public, anon, authenticated;

/** Período vigente; cria (concedendo créditos e minutos) quando não existe ou quando o plano mudou. */
create or replace function public.ensure_period(p_user uuid)
returns public.credit_periods language plpgsql security definer set search_path = public as $$
declare
  v_period public.credit_periods;
  v_sub public.subscriptions;
  v_plan public.plans;
  v_plan_id text;
  v_start timestamptz;
  v_end timestamptz;
  v_anchor timestamptz;
  v_confirmed boolean;
  v_had boolean;
  v_grant boolean := true;
  n integer;
begin
  -- Uma criação de período por pessoa por vez (duas abas não geram dois períodos).
  perform pg_advisory_xact_lock(hashtext('credit_period:' || p_user::text));
  v_sub := public.live_subscription(p_user);
  v_plan_id := coalesce(v_sub.plan_id, 'free');

  select * into v_period from public.credit_periods
   where user_id = p_user and closed_at is null and starts_at <= now() and ends_at > now()
   order by created_at desc limit 1
   for update;
  v_had := found;

  if v_had and v_period.plan_id = v_plan_id
     and (v_sub.id is null or v_period.subscription_id is not distinct from v_sub.id) then
    -- Grátis que confirmou o e-mail depois: recebe os créditos do período agora.
    if v_plan_id = 'free' and v_period.credits_granted = 0
       and exists (select 1 from auth.users where id = p_user and email_confirmed_at is not null) then
      select * into v_plan from public.plans where id = 'free';
      update public.credit_periods set credits_granted = v_plan.monthly_credits, seconds_granted = v_plan.monthly_minutes * 60
       where id = v_period.id returning * into v_period;
      insert into public.credit_ledger (user_id, period_id, unit, delta, kind, operation)
      values (p_user, v_period.id, 'credits', v_plan.monthly_credits, 'grant', 'free'),
             (p_user, v_period.id, 'seconds', v_plan.monthly_minutes * 60, 'grant', 'free');
    end if;
    return v_period;
  end if;

  if v_had then
    update public.credit_periods set closed_at = now(), ends_at = least(ends_at, now()) where id = v_period.id;
    insert into public.credit_ledger (user_id, period_id, unit, delta, kind, operation)
      select p_user, v_period.id, 'credits', -greatest(0, v_period.credits_granted + v_period.bonus_credits - v_period.credits_used - v_period.credits_reserved), 'expire', 'plan_change'
      where v_period.credits_granted + v_period.bonus_credits - v_period.credits_used - v_period.credits_reserved > 0;
  end if;

  select * into v_plan from public.plans where id = v_plan_id;

  if v_sub.id is not null and v_sub.status = 'past_due' then
    -- Carência: mantém a biblioteca, mas créditos novos só depois do pagamento.
    v_start := now();
    v_end := greatest(coalesce(v_sub.grace_until, now() + interval '3 days'), now() + interval '1 minute');
    v_grant := false;
  elsif v_sub.id is not null then
    v_start := least(coalesce(v_sub.current_period_start, now()), now());
    v_end := v_sub.current_period_end;
    -- Plano anual (futuro): créditos mensais, nunca o ano todo de uma vez.
    if v_end - v_start > interval '35 days' then
      n := floor(extract(epoch from (now() - v_start)) / (30 * 86400));
      v_start := v_start + n * interval '30 days';
      v_end := least(v_start + interval '30 days', v_sub.current_period_end);
    end if;
  else
    select created_at, email_confirmed_at is not null into v_anchor, v_confirmed from auth.users where id = p_user;
    v_anchor := coalesce(v_anchor, now());
    n := floor(extract(epoch from (now() - v_anchor)) / (30 * 86400));
    v_start := v_anchor + n * interval '30 days';
    v_end := v_start + interval '30 days';
    -- Créditos do Grátis só com e-mail confirmado (anti-abuso).
    v_grant := coalesce(v_confirmed, false) or public.is_admin_id(p_user);
  end if;

  insert into public.credit_periods (user_id, plan_id, subscription_id, starts_at, ends_at, credits_granted, seconds_granted, bonus_credits)
  values (p_user, v_plan_id, v_sub.id, v_start, v_end,
          case when v_grant then v_plan.monthly_credits else 0 end,
          case when public.is_admin_id(p_user) then 600000 when v_grant then v_plan.monthly_minutes * 60 else 0 end,
          -- Admin: IA sem limite prático (o custo continua registrado em ai_usage).
          case when public.is_admin_id(p_user) then 100000 else 0 end)
  returning * into v_period;

  insert into public.credit_ledger (user_id, period_id, unit, delta, kind, operation)
  values (p_user, v_period.id, 'credits', v_period.credits_granted, 'grant', v_plan_id),
         (p_user, v_period.id, 'seconds', v_period.seconds_granted, 'grant', v_plan_id);
  return v_period;
end;
$$;
revoke all on function public.ensure_period(uuid) from public, anon, authenticated;

/** Libera reservas vencidas da pessoa (processo caiu no meio da geração). */
create or replace function public.release_stale_reservations(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select * from public.credit_reservations where user_id = p_user and status = 'held' and expires_at < now() for update skip locked loop
    perform public.credits_release(r.id);
  end loop;
end;
$$;
revoke all on function public.release_stale_reservations(uuid) from public, anon, authenticated;

/**
 * Reserva créditos (ou segundos) de forma atômica. Erros: no_credits, no_minutes, cap_reached.
 * p_cap_field/p_cap: teto mensal por recurso (ex.: 'pages' = 3 no Grátis).
 */
create or replace function public.credits_reserve(p_user uuid, p_unit text, p_amount integer, p_operation text, p_ref text,
  p_key text default null, p_cap_field text default null, p_cap integer default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_period public.credit_periods;
  v_id uuid;
  v_used integer;
begin
  if p_key is not null then
    select id into v_id from public.credit_reservations where idempotency_key = p_key;
    if found then return v_id; end if;
  end if;
  perform public.release_stale_reservations(p_user);
  v_period := public.ensure_period(p_user);
  select * into v_period from public.credit_periods where id = v_period.id for update;

  if p_cap_field is not null and p_cap is not null then
    v_used := coalesce((v_period.usage->>p_cap_field)::integer, 0);
    if v_used + 1 > p_cap then raise exception 'cap_reached' using detail = p_cap_field; end if;
  end if;

  if p_unit = 'credits' then
    if v_period.credits_granted + v_period.bonus_credits - v_period.credits_used - v_period.credits_reserved < p_amount then
      raise exception 'no_credits';
    end if;
    update public.credit_periods set credits_reserved = credits_reserved + p_amount,
      usage = case when p_cap_field is null then usage else jsonb_set(usage, array[p_cap_field], to_jsonb(coalesce((usage->>p_cap_field)::integer, 0) + 1)) end
     where id = v_period.id;
  elsif p_unit = 'seconds' then
    if v_period.seconds_granted - v_period.seconds_used - v_period.seconds_reserved < p_amount then
      raise exception 'no_minutes';
    end if;
    update public.credit_periods set seconds_reserved = seconds_reserved + p_amount,
      usage = case when p_cap_field is null then usage else jsonb_set(usage, array[p_cap_field], to_jsonb(coalesce((usage->>p_cap_field)::integer, 0) + 1)) end
     where id = v_period.id;
  else
    raise exception 'invalid_unit';
  end if;

  insert into public.credit_reservations (user_id, period_id, unit, amount, cap_field, operation, ref, idempotency_key)
  values (p_user, v_period.id, p_unit, p_amount, p_cap_field, p_operation, p_ref, p_key)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.credits_reserve(uuid, text, integer, text, text, text, text, integer) from public, anon, authenticated;

/** Confirma a reserva. p_actual (≤ reservado) devolve a sobra — usado pelos minutos de conversa. */
create or replace function public.credits_commit(p_reservation uuid, p_actual integer default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.credit_reservations;
  v_amount integer;
begin
  select * into r from public.credit_reservations where id = p_reservation for update;
  if not found or r.status <> 'held' then return; end if;
  v_amount := least(r.amount, greatest(0, coalesce(p_actual, r.amount)));
  if r.unit = 'credits' then
    update public.credit_periods set credits_reserved = greatest(0, credits_reserved - r.amount), credits_used = credits_used + v_amount where id = r.period_id;
  else
    update public.credit_periods set seconds_reserved = greatest(0, seconds_reserved - r.amount), seconds_used = seconds_used + v_amount where id = r.period_id;
  end if;
  update public.credit_reservations set status = 'committed' where id = r.id;
  if v_amount > 0 then
    insert into public.credit_ledger (user_id, period_id, unit, delta, kind, operation, ref)
    values (r.user_id, r.period_id, r.unit, -v_amount, 'commit', r.operation, r.ref);
  end if;
end;
$$;
revoke all on function public.credits_commit(uuid, integer) from public, anon, authenticated;

create or replace function public.credits_release(p_reservation uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.credit_reservations;
begin
  select * into r from public.credit_reservations where id = p_reservation for update;
  if not found or r.status <> 'held' then return; end if;
  if r.unit = 'credits' then
    update public.credit_periods set credits_reserved = greatest(0, credits_reserved - r.amount),
      usage = case when r.cap_field is null then usage else jsonb_set(usage, array[r.cap_field], to_jsonb(greatest(0, coalesce((usage->>r.cap_field)::integer, 0) - 1))) end
     where id = r.period_id;
  else
    update public.credit_periods set seconds_reserved = greatest(0, seconds_reserved - r.amount),
      usage = case when r.cap_field is null then usage else jsonb_set(usage, array[r.cap_field], to_jsonb(greatest(0, coalesce((usage->>r.cap_field)::integer, 0) - 1))) end
     where id = r.period_id;
  end if;
  update public.credit_reservations set status = 'released' where id = r.id;
end;
$$;
revoke all on function public.credits_release(uuid) from public, anon, authenticated;

/** Conta um uso de recurso com teto mensal sem gastar créditos (ex.: histórias de reforço). */
create or replace function public.usage_bump(p_user uuid, p_field text, p_cap integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_period public.credit_periods;
begin
  v_period := public.ensure_period(p_user);
  select * into v_period from public.credit_periods where id = v_period.id for update;
  if p_cap is not null and coalesce((v_period.usage->>p_field)::integer, 0) + 1 > p_cap then
    raise exception 'cap_reached' using detail = p_field;
  end if;
  update public.credit_periods set usage = jsonb_set(usage, array[p_field], to_jsonb(coalesce((usage->>p_field)::integer, 0) + 1)) where id = v_period.id;
end;
$$;
revoke all on function public.usage_bump(uuid, text, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Acesso aos livros da galeria
-- ---------------------------------------------------------------------------
create or replace function public.has_book_access(p_user uuid, p_catalog uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_id(p_user)
      or coalesce((select (limits->>'library')::boolean from public.plans where id = public.current_plan_id(p_user)), false)
      or exists (select 1 from public.gift_redemptions where user_id = p_user and catalog_id = p_catalog);
$$;
revoke all on function public.has_book_access(uuid, uuid) from public, anon, authenticated;

/** Estado completo da pessoa logada: plano, saldos, tetos, presente e onboarding. */
create or replace function public.get_entitlements()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_period public.credit_periods;
  v_plan public.plans;
  v_sub public.subscriptions;
  v_last public.subscriptions;
  v_gift public.gift_redemptions;
  v_acc public.user_accounts;
  v_confirmed boolean;
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  v_period := public.ensure_period(v_user);
  v_sub := public.live_subscription(v_user);
  select * into v_last from public.subscriptions where user_id = v_user order by created_at desc limit 1;
  select * into v_plan from public.plans where id = v_period.plan_id;
  select * into v_gift from public.gift_redemptions where user_id = v_user;
  select * into v_acc from public.user_accounts where user_id = v_user;
  select email_confirmed_at is not null into v_confirmed from auth.users where id = v_user;
  return jsonb_build_object(
    'plan', v_plan.id,
    'plan_name', v_plan.name,
    'plan_rank', v_plan.rank,
    'limits', v_plan.limits,
    'is_admin', public.is_admin_id(v_user),
    'email_confirmed', coalesce(v_confirmed, false),
    'credits', jsonb_build_object('granted', v_period.credits_granted + v_period.bonus_credits, 'used', v_period.credits_used, 'reserved', v_period.credits_reserved,
      'available', greatest(0, v_period.credits_granted + v_period.bonus_credits - v_period.credits_used - v_period.credits_reserved)),
    'seconds', jsonb_build_object('granted', v_period.seconds_granted, 'used', v_period.seconds_used, 'reserved', v_period.seconds_reserved,
      'available', greatest(0, v_period.seconds_granted - v_period.seconds_used - v_period.seconds_reserved)),
    'usage', v_period.usage,
    'period', jsonb_build_object('starts_at', v_period.starts_at, 'ends_at', v_period.ends_at),
    'subscription', case when v_sub.id is null then null else jsonb_build_object(
      'id', v_sub.id, 'status', v_sub.status, 'plan', v_sub.plan_id, 'price_cents', v_sub.price_cents, 'provider', v_sub.provider,
      'current_period_end', v_sub.current_period_end, 'cancel_at_period_end', v_sub.cancel_at_period_end,
      'pending_plan', v_sub.pending_plan_id, 'grace_until', v_sub.grace_until) end,
    'last_subscription_status', v_last.status,
    'gift', case when v_gift.user_id is null then null else jsonb_build_object('catalog_id', v_gift.catalog_id, 'redeemed_at', v_gift.redeemed_at, 'swapped', v_gift.swapped_at is not null) end,
    'onboarding_step', coalesce(v_acc.onboarding_step, 'done'),
    'birth_date', v_acc.birth_date,
    'flagged', coalesce(v_acc.flagged, false)
  );
end;
$$;
revoke all on function public.get_entitlements() from public, anon;
grant execute on function public.get_entitlements() to authenticated;

/** Versão para as Edge Functions. */
create or replace function public.entitlements_for(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_period public.credit_periods;
  v_plan public.plans;
begin
  v_period := public.ensure_period(p_user);
  select * into v_plan from public.plans where id = v_period.plan_id;
  return jsonb_build_object('plan', v_plan.id, 'plan_rank', v_plan.rank, 'limits', v_plan.limits, 'is_admin', public.is_admin_id(p_user),
    'usage', v_period.usage,
    'credits_available', greatest(0, v_period.credits_granted + v_period.bonus_credits - v_period.credits_used - v_period.credits_reserved),
    'seconds_available', greatest(0, v_period.seconds_granted - v_period.seconds_used - v_period.seconds_reserved),
    'birth_date', (select birth_date from public.user_accounts where user_id = p_user));
end;
$$;
revoke all on function public.entitlements_for(uuid) from public, anon, authenticated;

/** Escolhe o livro-presente. Um por conta; troca uma única vez nos primeiros 7 dias. */
create or replace function public.redeem_gift(p_catalog uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_gift public.gift_redemptions;
  v_age_min smallint;
  v_birth date;
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  select age_min into v_age_min from public.catalog_books where id = p_catalog;
  if not found then raise exception 'book_not_found'; end if;
  select birth_date into v_birth from public.user_accounts where user_id = v_user;
  if v_age_min is not null and v_birth is not null and extract(year from age(v_birth)) < v_age_min then
    raise exception 'age_restricted';
  end if;
  select * into v_gift from public.gift_redemptions where user_id = v_user for update;
  if not found then
    insert into public.gift_redemptions (user_id, catalog_id) values (v_user, p_catalog);
  elsif v_gift.catalog_id = p_catalog then
    null;
  elsif v_gift.swapped_at is null and v_gift.redeemed_at > now() - interval '7 days' then
    update public.gift_redemptions set catalog_id = p_catalog, swapped_at = now() where user_id = v_user;
  else
    raise exception 'gift_already_used';
  end if;
  update public.user_accounts set onboarding_step = 'done', updated_at = now()
   where user_id = v_user and onboarding_step in ('plans', 'gift');
  return jsonb_build_object('catalog_id', p_catalog);
end;
$$;
revoke all on function public.redeem_gift(uuid) from public, anon;
grant execute on function public.redeem_gift(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Catálogo: metadados abertos, texto só com acesso
-- ---------------------------------------------------------------------------
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'catalog_books' and column_name <> 'pages';
  execute 'revoke select on public.catalog_books from anon, authenticated';
  execute format('grant select (%s) on public.catalog_books to authenticated', cols);
end $$;

/** Texto completo do livro para quem tem acesso (assinante, presente ou admin). */
create or replace function public.catalog_open(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_pages jsonb;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if not public.has_book_access(auth.uid(), p_id) then raise exception 'plan_required'; end if;
  select pages into v_pages from public.catalog_books where id = p_id;
  if v_pages is null then raise exception 'book_not_found'; end if;
  return v_pages;
end;
$$;
revoke all on function public.catalog_open(uuid) from public, anon;
grant execute on function public.catalog_open(uuid) to authenticated;

/** Amostra grátis: as 3 primeiras páginas. */
create or replace function public.catalog_sample(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(e.value order by e.ord), '[]'::jsonb)
    from public.catalog_books c, jsonb_array_elements(c.pages) with ordinality as e(value, ord)
   where c.id = p_id and e.ord <= 3;
$$;
revoke all on function public.catalog_sample(uuid) from public, anon;
grant execute on function public.catalog_sample(uuid) to authenticated;

/** Total de páginas sem expor o texto. */
create or replace function public.catalog_page_count(p_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select jsonb_array_length(pages) from public.catalog_books where id = p_id;
$$;
revoke all on function public.catalog_page_count(uuid) from public, anon;
grant execute on function public.catalog_page_count(uuid) to authenticated;

-- Vincular um livro da galeria à estante exige acesso (o vínculo existente continua valendo para sincronizar).
create or replace function public.book_links_require_access()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.catalog_id is not null
     and (tg_op = 'INSERT' or old.catalog_id is distinct from new.catalog_id)
     and not exists (select 1 from public.book_links where book_id = new.book_id and catalog_id = new.catalog_id)
     and not public.has_book_access(new.user_id, new.catalog_id) then
    raise exception 'plan_required';
  end if;
  return new;
end;
$$;
drop trigger if exists book_links_require_access on public.book_links;
create trigger book_links_require_access before insert or update of catalog_id on public.book_links
  for each row execute function public.book_links_require_access();

-- Origem do livro para os limites de importação (EPUB/PDF só nos planos pagos).
alter table public.books add column if not exists source text check (source is null or source in ('epub', 'pdf', 'text', 'catalog', 'story'));

create or replace function public.books_enforce_plan()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_limits jsonb;
  v_count integer;
begin
  if exists (select 1 from public.books where id = new.id) then return new; end if; -- sincronização de livro existente
  if public.is_admin_id(new.user_id) then return new; end if;
  select limits into v_limits from public.plans where id = public.current_plan_id(new.user_id);
  if new.source in ('epub', 'pdf') then
    if (v_limits->>'imports') is not null then
      select count(*) into v_count from public.books where user_id = new.user_id and source in ('epub', 'pdf');
      if v_count >= (v_limits->>'imports')::integer then raise exception 'plan_required' using detail = 'imports'; end if;
    end if;
  elsif new.source = 'text' then
    if (v_limits->>'text_books') is not null then
      select count(*) into v_count from public.books where user_id = new.user_id and source = 'text';
      if v_count >= (v_limits->>'text_books')::integer then raise exception 'plan_required' using detail = 'text_books'; end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists books_enforce_plan on public.books;
create trigger books_enforce_plan before insert on public.books
  for each row execute function public.books_enforce_plan();

-- ---------------------------------------------------------------------------
-- Admin: finanças e ajustes
-- ---------------------------------------------------------------------------
create or replace function public.admin_finance_overview(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_fx numeric := coalesce((select (value #>> '{}')::numeric from public.app_settings where key = 'usd_brl'), 6);
  v_tax numeric := coalesce((select (value #>> '{}')::numeric from public.app_settings where key = 'tax_pct'), 0);
begin
  if not public.is_global_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'fx', v_fx,
    'tax_pct', v_tax,
    'daily_budget_usd', (select value #>> '{}' from public.app_settings where key = 'ai_daily_budget_usd'),
    'revenue_cents', coalesce((select sum(amount_cents) from public.payments where status = 'paid' and paid_at between p_from and p_to), 0),
    'refunds_cents', coalesce((select sum(amount_cents) from public.payments where status in ('refunded', 'disputed') and paid_at between p_from and p_to), 0),
    'fees_cents', coalesce((select sum(fee_cents) from public.payments where status = 'paid' and paid_at between p_from and p_to), 0),
    'ai_cost_usd', coalesce((select sum(cost_usd) from public.ai_usage where created_at between p_from and p_to), 0),
    'ai_calls', (select count(*) from public.ai_usage where created_at between p_from and p_to and status <> 'cache_hit'),
    'mrr_cents', coalesce((select sum(price_cents) from public.subscriptions where status in ('active', 'past_due') and current_period_end > now()), 0),
    'subscribers', coalesce((select jsonb_object_agg(plan_id, n) from (select plan_id, count(*) n from public.subscriptions where status in ('active', 'past_due') and current_period_end > now() group by plan_id) t), '{}'::jsonb),
    'users', (select count(*) from auth.users),
    'users_confirmed', (select count(*) from auth.users where email_confirmed_at is not null),
    'signups', (select count(*) from auth.users where created_at between p_from and p_to),
    'gifts', (select count(*) from public.gift_redemptions),
    'by_day', coalesce((select jsonb_agg(d order by d->>'day') from (
        select jsonb_build_object('day', day,
          'revenue_cents', coalesce((select sum(amount_cents) from public.payments p where p.status = 'paid' and p.paid_at::date = day), 0),
          'ai_cost_usd', coalesce((select sum(cost_usd) from public.ai_usage u where u.created_at::date = day), 0)) d
        from generate_series(p_from::date, p_to::date, interval '1 day') as g(day)) x), '[]'::jsonb),
    'by_operation', coalesce((select jsonb_agg(t order by (t->>'cost_usd')::numeric desc) from (
        select jsonb_build_object('operation', operation, 'calls', count(*), 'cost_usd', sum(cost_usd), 'credits', sum(credits),
          'cache_hits', count(*) filter (where status = 'cache_hit'), 'failed', count(*) filter (where status = 'failed')) t
        from public.ai_usage where created_at between p_from and p_to group by operation) y), '[]'::jsonb),
    'by_plan', coalesce((select jsonb_agg(t) from (
        select jsonb_build_object('plan', coalesce(plan_id, 'free'), 'users', count(distinct user_id), 'cost_usd', sum(cost_usd)) t
        from public.ai_usage where created_at between p_from and p_to group by plan_id) y), '[]'::jsonb),
    'top_users', coalesce((select jsonb_agg(t order by (t->>'cost_usd')::numeric desc) from (
        select jsonb_build_object('user_id', u.user_id, 'email', au.email, 'plan', public.current_plan_id(u.user_id), 'cost_usd', sum(u.cost_usd), 'calls', count(*)) t
        from public.ai_usage u left join auth.users au on au.id = u.user_id
        where u.created_at between p_from and p_to and u.user_id is not null
        group by u.user_id, au.email order by sum(u.cost_usd) desc limit 20) y), '[]'::jsonb),
    'credits', (select jsonb_build_object('granted', coalesce(sum(credits_granted + bonus_credits), 0), 'used', coalesce(sum(credits_used), 0))
                 from public.credit_periods where starts_at between p_from and p_to),
    'payment_errors', (select count(*) from public.payment_events where error is not null and received_at between p_from and p_to),
    'recent_payments', coalesce((select jsonb_agg(t) from (
        select jsonb_build_object('id', p.id, 'email', au.email, 'amount_cents', p.amount_cents, 'status', p.status, 'kind', p.kind, 'paid_at', p.paid_at) t
        from public.payments p left join auth.users au on au.id = p.user_id order by p.created_at desc limit 20) y), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.admin_finance_overview(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_finance_overview(timestamptz, timestamptz) to authenticated;

create or replace function public.admin_grant(p_email text, p_credits integer, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_period public.credit_periods;
begin
  if not public.is_global_admin() then raise exception 'forbidden'; end if;
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then raise exception 'user_not_found'; end if;
  v_period := public.ensure_period(v_user);
  update public.credit_periods set bonus_credits = bonus_credits + p_credits where id = v_period.id;
  insert into public.credit_ledger (user_id, period_id, unit, delta, kind, operation, ref)
  values (v_user, v_period.id, 'credits', p_credits, 'admin', 'admin_grant', left(p_reason, 200));
end;
$$;
revoke all on function public.admin_grant(text, integer, text) from public, anon;
grant execute on function public.admin_grant(text, integer, text) to authenticated;

/** Cortesia: dá um plano por N dias sem cobrança (ex.: Fundadores). */
create or replace function public.admin_set_plan(p_email text, p_plan text, p_days integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not public.is_global_admin() then raise exception 'forbidden'; end if;
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then raise exception 'user_not_found'; end if;
  if not exists (select 1 from public.plans where id = p_plan and id <> 'free') then raise exception 'invalid_plan'; end if;
  update public.subscriptions set status = 'canceled', canceled_at = now(), updated_at = now()
   where user_id = v_user and status in ('active', 'past_due') and provider = 'admin';
  if exists (select 1 from public.subscriptions where user_id = v_user and status in ('active', 'past_due')) then
    raise exception 'has_paid_subscription';
  end if;
  insert into public.subscriptions (user_id, plan_id, status, price_cents, provider, current_period_start, current_period_end)
  values (v_user, p_plan, 'active', 0, 'admin', now(), now() + make_interval(days => greatest(1, least(p_days, 366))));
end;
$$;
revoke all on function public.admin_set_plan(text, text, integer) from public, anon;
grant execute on function public.admin_set_plan(text, text, integer) to authenticated;

create or replace function public.admin_set_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_global_admin() then raise exception 'forbidden'; end if;
  if p_key not in ('usd_brl', 'ai_daily_budget_usd', 'gateway_fee_pct', 'tax_pct', 'past_due_grace_days') then raise exception 'invalid_key'; end if;
  insert into public.app_settings (key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end;
$$;
revoke all on function public.admin_set_setting(text, jsonb) from public, anon;
grant execute on function public.admin_set_setting(text, jsonb) to authenticated;
