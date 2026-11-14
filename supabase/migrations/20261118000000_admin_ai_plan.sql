-- Duas liberações separadas para planos dados pelo admin:
--   plano de acesso (livros, biblioteca, importações) e plano de IA (créditos do mês e recursos de IA).
-- Ex.: acesso Pro com IA do Essencial. E plano de cortesia sem data de expiração.

alter table public.subscriptions add column if not exists ai_plan_id text references public.plans(id);
alter table public.credit_periods add column if not exists ai_plan_id text references public.plans(id);

-- Limites que NÃO são de IA (seguem o plano de acesso); todo o resto segue o plano de IA.
create or replace function public.merge_plan_limits(p_access jsonb, p_ai jsonb)
returns jsonb language sql immutable as $$
  select coalesce(p_access, '{}'::jsonb) || (coalesce(p_ai, '{}'::jsonb) - 'library' - 'imports' - 'text_books');
$$;

create or replace function public.ensure_period(p_user uuid)
returns credit_periods language plpgsql security definer set search_path = public as $function$
declare
  v_period public.credit_periods;
  v_sub public.subscriptions;
  v_plan public.plans;
  v_ai public.plans;
  v_plan_id text;
  v_ai_id text;
  v_start timestamptz;
  v_end timestamptz;
  v_anchor timestamptz;
  v_confirmed boolean;
  v_had boolean;
  v_grant boolean := true;
  n integer;
begin
  perform pg_advisory_xact_lock(hashtext('credit_period:' || p_user::text));
  v_sub := public.live_subscription(p_user);
  v_plan_id := coalesce(v_sub.plan_id, 'free');
  v_ai_id := coalesce(v_sub.ai_plan_id, v_plan_id);

  select * into v_period from public.credit_periods
   where user_id = p_user and closed_at is null and starts_at <= now() and ends_at > now()
   order by created_at desc limit 1
   for update;
  v_had := found;

  if v_had and v_period.plan_id = v_plan_id and coalesce(v_period.ai_plan_id, v_period.plan_id) = v_ai_id
     and (v_sub.id is null or v_period.subscription_id is not distinct from v_sub.id) then
    if v_ai_id = 'free' and v_period.credits_granted = 0
       and exists (select 1 from auth.users where id = p_user and email_confirmed_at is not null) then
      select * into v_ai from public.plans where id = 'free';
      update public.credit_periods set credits_granted = v_ai.monthly_credits, seconds_granted = v_ai.monthly_minutes * 60
       where id = v_period.id returning * into v_period;
      insert into public.credit_ledger (user_id, period_id, unit, delta, kind, operation)
      values (p_user, v_period.id, 'credits', v_ai.monthly_credits, 'grant', 'free'),
             (p_user, v_period.id, 'seconds', v_ai.monthly_minutes * 60, 'grant', 'free');
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
  select * into v_ai from public.plans where id = v_ai_id;

  if v_sub.id is not null and v_sub.status = 'past_due' then
    v_start := now();
    v_end := greatest(coalesce(v_sub.grace_until, now() + interval '3 days'), now() + interval '1 minute');
    v_grant := false;
  elsif v_sub.id is not null then
    v_start := least(coalesce(v_sub.current_period_start, now()), now());
    v_end := v_sub.current_period_end;
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
    v_grant := coalesce(v_confirmed, false) or public.is_admin_id(p_user);
  end if;

  insert into public.credit_periods (user_id, plan_id, ai_plan_id, subscription_id, starts_at, ends_at, credits_granted, seconds_granted, bonus_credits)
  values (p_user, v_plan_id, v_ai_id, v_sub.id, v_start, v_end,
          case when v_grant then v_ai.monthly_credits else 0 end,
          case when public.is_admin_id(p_user) then 600000 when v_grant then v_ai.monthly_minutes * 60 else 0 end,
          case when public.is_admin_id(p_user) then 100000 else 0 end)
  returning * into v_period;

  insert into public.credit_ledger (user_id, period_id, unit, delta, kind, operation)
  values (p_user, v_period.id, 'credits', v_period.credits_granted, 'grant', v_ai_id),
         (p_user, v_period.id, 'seconds', v_period.seconds_granted, 'grant', v_ai_id);
  return v_period;
end;
$function$;

create or replace function public.entitlements_for(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $function$
declare
  v_period public.credit_periods;
  v_plan public.plans;
  v_ai public.plans;
begin
  perform public.assert_not_blocked(p_user);
  v_period := public.ensure_period(p_user);
  select * into v_plan from public.plans where id = v_period.plan_id;
  select * into v_ai from public.plans where id = coalesce(v_period.ai_plan_id, v_period.plan_id);
  return jsonb_build_object('plan', v_plan.id, 'plan_rank', v_plan.rank, 'ai_plan', v_ai.id,
    'limits', public.merge_plan_limits(v_plan.limits, v_ai.limits), 'is_admin', public.is_admin_id(p_user),
    'usage', v_period.usage,
    'credits_available', greatest(0, v_period.credits_granted + v_period.bonus_credits - v_period.credits_used - v_period.credits_reserved),
    'seconds_available', greatest(0, v_period.seconds_granted - v_period.seconds_used - v_period.seconds_reserved),
    'birth_date', (select birth_date from public.user_accounts where user_id = p_user));
end;
$function$;

-- get_entitlements (do aparelho) também passa a usar os limites mesclados e informa o plano de IA.
do $$
declare def text;
begin
  select pg_get_functiondef('public.get_entitlements()'::regprocedure) into def;
  if def not like '%merge_plan_limits%' and def like '%''limits'', v_plan.limits%' then
    def := replace(def, '''limits'', v_plan.limits', '''limits'', public.merge_plan_limits(v_plan.limits, (select limits from public.plans where id = coalesce(v_period.ai_plan_id, v_period.plan_id))), ''ai_plan'', coalesce(v_period.ai_plan_id, v_period.plan_id)');
    execute def;
  end if;
end $$;

-- Plano de cortesia: dias (ou sem expiração) e plano de IA opcional.
drop function if exists public.admin_set_plan(text, text, integer);
create or replace function public.admin_set_plan(p_email text, p_plan text, p_days integer, p_ai_plan text default null)
returns void language plpgsql security definer set search_path = public as $function$
declare v_user uuid;
begin
  if not public.is_global_admin() then raise exception 'forbidden'; end if;
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then raise exception 'user_not_found'; end if;
  if not exists (select 1 from public.plans where id = p_plan and id <> 'free') then raise exception 'invalid_plan'; end if;
  if p_ai_plan is not null and not exists (select 1 from public.plans where id = p_ai_plan) then raise exception 'invalid_ai_plan'; end if;
  update public.subscriptions set status = 'canceled', canceled_at = now(), updated_at = now()
   where user_id = v_user and status in ('active', 'past_due') and provider = 'admin';
  if exists (select 1 from public.subscriptions where user_id = v_user and status in ('active', 'past_due')) then
    raise exception 'has_paid_subscription';
  end if;
  insert into public.subscriptions (user_id, plan_id, ai_plan_id, status, price_cents, provider, current_period_start, current_period_end)
  values (v_user, p_plan, nullif(p_ai_plan, p_plan), 'active', 0, 'admin', now(),
          case when coalesce(p_days, 0) <= 0 then timestamptz '2099-12-31 23:59:59+00'
               else now() + make_interval(days => least(p_days, 3660)) end);
end;
$function$;
revoke all on function public.admin_set_plan(text, text, integer, text) from public, anon;
grant execute on function public.admin_set_plan(text, text, integer, text) to authenticated;

-- Lista de usuários mostra também o plano de IA.
do $$
declare def text;
begin
  select pg_get_functiondef('public.admin_list_users(text, text, integer, integer)'::regprocedure) into def;
  if def not like '%''ai_plan''%' then
    def := replace(def, '''plan'', public.current_plan_id(u.id),', '''plan'', public.current_plan_id(u.id), ''ai_plan'', (select coalesce(s.ai_plan_id, s.plan_id) from public.live_subscription(u.id) s), ''plan_until'', (select s.current_period_end from public.live_subscription(u.id) s),');
    execute def;
  end if;
end $$;
