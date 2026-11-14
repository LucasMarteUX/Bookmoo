-- Admin com IA ilimitada (custo segue registrado).
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

update public.credit_periods p set bonus_credits = 100000, seconds_granted = 600000
  where closed_at is null and ends_at > now() and exists (select 1 from public.admin_users a where a.user_id = p.user_id);

-- Funções de gatilho não precisam ser chamáveis por ninguém.
revoke all on function public.handle_new_account() from public, anon, authenticated;
revoke all on function public.book_links_require_access() from public, anon, authenticated;
revoke all on function public.books_enforce_plan() from public, anon, authenticated;
