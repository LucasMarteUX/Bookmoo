-- Presente definitivo, plano Grátis enxuto, questionário de perfil, avisos segmentados,
-- gestão de usuários pelo admin e bucket do espelho de vozes.

-- ---------------------------------------------------------------------------
-- Livro-presente: escolha definitiva (sem troca)
-- ---------------------------------------------------------------------------
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
  if found then
    if v_gift.catalog_id = p_catalog then return jsonb_build_object('catalog_id', p_catalog); end if;
    raise exception 'gift_already_used';
  end if;
  insert into public.gift_redemptions (user_id, catalog_id) values (v_user, p_catalog);
  update public.user_accounts set onboarding_step = 'done', updated_at = now()
   where user_id = v_user and onboarding_step in ('plans', 'gift');
  return jsonb_build_object('catalog_id', p_catalog);
end;
$$;
revoke all on function public.redeem_gift(uuid) from public, anon;
grant execute on function public.redeem_gift(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Plano Grátis enxuto (custo de aquisição controlado)
-- ---------------------------------------------------------------------------
update public.plans set monthly_credits = 40, limits = jsonb_set(limits, '{mosaic}', '3') where id = 'free';
update public.credit_periods set credits_granted = 40
 where plan_id = 'free' and closed_at is null and ends_at > now() and credits_granted > 40 and credits_used + credits_reserved <= 40;

-- ---------------------------------------------------------------------------
-- Questionário de perfil (onboarding): coleta gostos e dificuldades para segmentar
-- ---------------------------------------------------------------------------
create table if not exists public.user_surveys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  skipped boolean not null default false,
  completed_at timestamptz not null default now()
);
alter table public.user_surveys enable row level security;
drop policy if exists user_surveys_read on public.user_surveys;
create policy user_surveys_read on public.user_surveys for select to authenticated using (user_id = auth.uid());

alter table public.user_accounts drop constraint if exists user_accounts_onboarding_step_check;
alter table public.user_accounts add constraint user_accounts_onboarding_step_check
  check (onboarding_step in ('complete_profile', 'survey', 'plans', 'gift', 'done'));

create or replace function public.handle_new_account()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_birth date;
begin
  if (new.raw_user_meta_data->>'birth_date') ~ '^\d{4}-\d{2}-\d{2}$' then
    v_birth := (new.raw_user_meta_data->>'birth_date')::date;
  end if;
  insert into public.user_accounts (user_id, onboarding_step, birth_date, terms_accepted_at)
  values (new.id, case when v_birth is null then 'complete_profile' else 'survey' end, v_birth,
          case when v_birth is null then null else now() end)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_account() from public, anon, authenticated;

create or replace function public.complete_profile(p_birth date, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if not p_accept then raise exception 'terms_required'; end if;
  if p_birth is null or p_birth > current_date or p_birth < date '1900-01-01' then raise exception 'invalid_birth_date'; end if;
  insert into public.user_accounts (user_id, onboarding_step, birth_date, terms_accepted_at)
  values (auth.uid(), 'survey', p_birth, now())
  on conflict (user_id) do update set birth_date = excluded.birth_date, terms_accepted_at = now(),
    onboarding_step = case when public.user_accounts.onboarding_step = 'complete_profile' then 'survey' else public.user_accounts.onboarding_step end,
    updated_at = now();
end;
$$;
revoke all on function public.complete_profile(date, boolean) from public, anon;
grant execute on function public.complete_profile(date, boolean) to authenticated;

create or replace function public.set_onboarding_step(p_step text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_now text;
  v_order constant text[] := array['complete_profile', 'survey', 'plans', 'gift', 'done'];
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if not (p_step = any(v_order)) then raise exception 'invalid_step'; end if;
  select onboarding_step into v_now from public.user_accounts where user_id = auth.uid();
  if v_now is null then
    insert into public.user_accounts (user_id, onboarding_step) values (auth.uid(), 'complete_profile');
    v_now := 'complete_profile';
  end if;
  if v_now in ('complete_profile', 'survey') then raise exception 'profile_incomplete'; end if;
  if array_position(v_order, p_step) > array_position(v_order, v_now) then
    update public.user_accounts set onboarding_step = p_step, updated_at = now() where user_id = auth.uid();
  end if;
end;
$$;
revoke all on function public.set_onboarding_step(text) from public, anon;
grant execute on function public.set_onboarding_step(text) to authenticated;

/** Salva as respostas (ou pula) e segue para os planos. Só aceita chaves conhecidas, com tamanho limitado. */
create or replace function public.save_survey(p_answers jsonb, p_skip boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_clean jsonb := '{}'::jsonb;
  k text;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if not p_skip and p_answers is not null and jsonb_typeof(p_answers) = 'object' then
    foreach k in array array['reason', 'self_level', 'difficulty', 'tried_books', 'topics', 'daily_minutes', 'how_found', 'goal_text'] loop
      if p_answers ? k then
        if jsonb_typeof(p_answers->k) = 'array' then
          v_clean := v_clean || jsonb_build_object(k, (select coalesce(jsonb_agg(left(x, 40)), '[]'::jsonb) from (select jsonb_array_elements_text(p_answers->k) x limit 12) t));
        else
          v_clean := v_clean || jsonb_build_object(k, left(p_answers->>k, 200));
        end if;
      end if;
    end loop;
  end if;
  insert into public.user_surveys (user_id, answers, skipped) values (auth.uid(), v_clean, p_skip)
  on conflict (user_id) do update set answers = excluded.answers, skipped = excluded.skipped, completed_at = now();
  update public.user_accounts set onboarding_step = 'plans', updated_at = now() where user_id = auth.uid() and onboarding_step = 'survey';
end;
$$;
revoke all on function public.save_survey(jsonb, boolean) from public, anon;
grant execute on function public.save_survey(jsonb, boolean) to authenticated;

-- Quem já estava na tela de planos passa pelo questionário uma vez.
update public.user_accounts a set onboarding_step = 'survey'
 where onboarding_step = 'plans' and not exists (select 1 from public.user_surveys s where s.user_id = a.user_id);

-- ---------------------------------------------------------------------------
-- Conta bloqueada
-- ---------------------------------------------------------------------------
alter table public.user_accounts add column if not exists blocked boolean not null default false;
alter table public.user_accounts add column if not exists blocked_at timestamptz;

create or replace function public.assert_not_blocked(p_user uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if exists (select 1 from public.user_accounts where user_id = p_user and blocked) then raise exception 'account_blocked'; end if;
end;
$$;
revoke all on function public.assert_not_blocked(uuid) from public, anon, authenticated;

-- get_entitlements e entitlements_for passam a recusar contas bloqueadas.
do $$
declare
  def text;
begin
  select pg_get_functiondef('public.get_entitlements()'::regprocedure) into def;
  if def not like '%assert_not_blocked%' then
    def := replace(def, E'  if v_user is null then raise exception ''unauthorized''; end if;', E'  if v_user is null then raise exception ''unauthorized''; end if;\n  perform public.assert_not_blocked(v_user);');
    execute def;
  end if;
  select pg_get_functiondef('public.entitlements_for(uuid)'::regprocedure) into def;
  if def not like '%assert_not_blocked%' then
    def := replace(def, E'begin\n  v_period := public.ensure_period(p_user);', E'begin\n  perform public.assert_not_blocked(p_user);\n  v_period := public.ensure_period(p_user);');
    execute def;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Seguir: amigos se seguem sem pedido
-- ---------------------------------------------------------------------------
create or replace function public.follows_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.status := case
      when exists (select 1 from public.profiles where user_id = new.followee_id and is_public) then 'accepted'
      when public.is_friend(new.follower_id, new.followee_id) then 'accepted'
      else 'pending' end;
    new.created_at := now();
  else
    new.follower_id := old.follower_id;
    new.followee_id := old.followee_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
revoke all on function public.follows_guard() from public, anon, authenticated;

-- Pedidos de seguir pendentes entre quem já é amigo viram seguidores.
update public.follows f set status = 'accepted'
 where status = 'pending' and public.is_friend(f.follower_id, f.followee_id);

-- ---------------------------------------------------------------------------
-- Avisos do admin (segmentados)
-- ---------------------------------------------------------------------------
create table if not exists public.app_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  body text check (body is null or char_length(body) <= 1000),
  link text check (link is null or (char_length(link) <= 300 and (left(link, 1) = '/' or link ~ '^https://'))),
  segment jsonb not null default '{}'::jsonb,
  recipients integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.app_announcements enable row level security;

create table if not exists public.announcement_recipients (
  announcement_id uuid not null references public.app_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);
create index if not exists announcement_recipients_user on public.announcement_recipients (user_id, created_at desc);
alter table public.announcement_recipients enable row level security;
drop policy if exists announcement_recipients_read on public.announcement_recipients;
create policy announcement_recipients_read on public.announcement_recipients for select to authenticated using (user_id = auth.uid());

create or replace function public.survey_match_arr(ans jsonb, seg jsonb, k text)
returns boolean language sql immutable as $$
  select case when seg->'survey'->k is null or jsonb_typeof(seg->'survey'->k) <> 'array' or jsonb_array_length(seg->'survey'->k) = 0 then true
    else coalesce(ans->k ?| array(select jsonb_array_elements_text(seg->'survey'->k)), false) end;
$$;
create or replace function public.survey_match_scalar(ans jsonb, seg jsonb, k text)
returns boolean language sql immutable as $$
  select case when seg->'survey'->k is null or jsonb_typeof(seg->'survey'->k) <> 'array' or jsonb_array_length(seg->'survey'->k) = 0 then true
    else coalesce((ans->>k) = any(array(select jsonb_array_elements_text(seg->'survey'->k))), false) end;
$$;

/** Quem entra no público (nunca contas bloqueadas). */
create or replace function public.segment_user_ids(p_segment jsonb)
returns table (user_id uuid) language sql stable security definer set search_path = public as $$
  select u.id
    from auth.users u
    left join public.user_accounts a on a.user_id = u.id
    left join public.user_surveys sv on sv.user_id = u.id
   where coalesce(a.blocked, false) = false
     and (p_segment->'plans' is null or jsonb_typeof(p_segment->'plans') <> 'array' or jsonb_array_length(p_segment->'plans') = 0
          or public.current_plan_id(u.id) in (select jsonb_array_elements_text(p_segment->'plans')))
     and (p_segment->>'age_min' is null or (a.birth_date is not null and extract(year from age(a.birth_date)) >= (p_segment->>'age_min')::int))
     and (p_segment->>'age_max' is null or (a.birth_date is not null and extract(year from age(a.birth_date)) <= (p_segment->>'age_max')::int))
     and (p_segment->>'confirmed' is null or (u.email_confirmed_at is not null) = (p_segment->>'confirmed')::boolean)
     and (p_segment->>'joined_after' is null or u.created_at >= (p_segment->>'joined_after')::timestamptz)
     and (p_segment->>'joined_before' is null or u.created_at <= (p_segment->>'joined_before')::timestamptz)
     and (p_segment->>'inactive_days' is null or coalesce(u.last_sign_in_at, u.created_at) < now() - make_interval(days => (p_segment->>'inactive_days')::int))
     and (p_segment->>'has_gift' is null or exists (select 1 from public.gift_redemptions g where g.user_id = u.id) = (p_segment->>'has_gift')::boolean)
     and public.survey_match_arr(coalesce(sv.answers, '{}'::jsonb), p_segment, 'difficulty')
     and public.survey_match_arr(coalesce(sv.answers, '{}'::jsonb), p_segment, 'topics')
     and public.survey_match_arr(coalesce(sv.answers, '{}'::jsonb), p_segment, 'reason')
     and public.survey_match_scalar(coalesce(sv.answers, '{}'::jsonb), p_segment, 'tried_books')
     and public.survey_match_scalar(coalesce(sv.answers, '{}'::jsonb), p_segment, 'self_level')
     and public.survey_match_scalar(coalesce(sv.answers, '{}'::jsonb), p_segment, 'daily_minutes');
$$;
revoke all on function public.segment_user_ids(jsonb) from public, anon, authenticated;

create or replace function public.admin_broadcast_preview(p_segment jsonb)
returns integer language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_global_admin() then raise exception 'forbidden'; end if;
  return (select count(*) from public.segment_user_ids(coalesce(p_segment, '{}'::jsonb)))::integer;
end;
$$;
revoke all on function public.admin_broadcast_preview(jsonb) from public, anon;
grant execute on function public.admin_broadcast_preview(jsonb) to authenticated;

create or replace function public.admin_send_broadcast(p_title text, p_body text, p_link text, p_segment jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_n integer;
begin
  if not public.is_global_admin() then raise exception 'forbidden'; end if;
  insert into public.app_announcements (title, body, link, segment, created_by)
  values (btrim(p_title), nullif(btrim(coalesce(p_body, '')), ''), nullif(btrim(coalesce(p_link, '')), ''), coalesce(p_segment, '{}'::jsonb), auth.uid())
  returning id into v_id;
  insert into public.announcement_recipients (announcement_id, user_id)
    select v_id, s.user_id from public.segment_user_ids(coalesce(p_segment, '{}'::jsonb)) s;
  get diagnostics v_n = row_count;
  update public.app_announcements set recipients = v_n where id = v_id;
  return v_n;
end;
$$;
revoke all on function public.admin_send_broadcast(text, text, text, jsonb) from public, anon;
grant execute on function public.admin_send_broadcast(text, text, text, jsonb) to authenticated;

create or replace function public.admin_list_broadcasts()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_global_admin() then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(t order by t->>'created_at' desc) from (
    select jsonb_build_object('id', a.id, 'title', a.title, 'body', a.body, 'link', a.link, 'segment', a.segment,
      'recipients', a.recipients, 'read', (select count(*) from public.announcement_recipients r where r.announcement_id = a.id and r.read_at is not null),
      'created_at', a.created_at) t
    from public.app_announcements a order by a.created_at desc limit 50) x), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_list_broadcasts() from public, anon;
grant execute on function public.admin_list_broadcasts() to authenticated;

create or replace function public.my_announcements(p_limit integer default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'body', a.body, 'link', a.link, 'at', r.created_at, 'read', r.read_at is not null) order by r.created_at desc), '[]'::jsonb)
    from (select * from public.announcement_recipients where user_id = auth.uid() order by created_at desc limit least(greatest(coalesce(p_limit, 30), 1), 50)) r
    join public.app_announcements a on a.id = r.announcement_id
   where auth.uid() is not null;
$$;
revoke all on function public.my_announcements(integer) from public, anon;
grant execute on function public.my_announcements(integer) to authenticated;

create or replace function public.unread_announcements()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.announcement_recipients where user_id = auth.uid() and read_at is null;
$$;
revoke all on function public.unread_announcements() from public, anon;
grant execute on function public.unread_announcements() to authenticated;

create or replace function public.mark_announcement_read(p_id uuid default null)
returns void language sql security definer set search_path = public as $$
  update public.announcement_recipients set read_at = now()
   where user_id = auth.uid() and read_at is null and (p_id is null or announcement_id = p_id);
$$;
revoke all on function public.mark_announcement_read(uuid) from public, anon;
grant execute on function public.mark_announcement_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: gestão de usuários
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_users(p_query text default null, p_filter text default 'all', p_limit integer default 30, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if not public.is_global_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'total', (select count(*) from auth.users u left join public.user_accounts a on a.user_id = u.id
               where (v_q is null or u.email ilike '%' || v_q || '%' or coalesce(u.raw_user_meta_data->>'full_name', '') ilike '%' || v_q || '%')
                 and (p_filter = 'all' or (p_filter = 'blocked' and coalesce(a.blocked, false)) or (p_filter = 'unconfirmed' and u.email_confirmed_at is null)
                      or (p_filter in ('free', 'essencial', 'plus', 'pro') and public.current_plan_id(u.id) = p_filter))),
    'users', coalesce((select jsonb_agg(t) from (
      select jsonb_build_object(
        'id', u.id, 'email', u.email, 'name', u.raw_user_meta_data->>'full_name',
        'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at, 'confirmed', u.email_confirmed_at is not null,
        'blocked', coalesce(a.blocked, false), 'flagged', coalesce(a.flagged, false), 'birth_date', a.birth_date,
        'step', a.onboarding_step, 'is_admin', exists (select 1 from public.admin_users x where x.user_id = u.id),
        'plan', public.current_plan_id(u.id),
        'credits', (select greatest(0, p.credits_granted + p.bonus_credits - p.credits_used - p.credits_reserved) from public.credit_periods p where p.user_id = u.id and p.closed_at is null and p.ends_at > now() order by p.created_at desc limit 1),
        'survey', (select s.answers from public.user_surveys s where s.user_id = u.id)
      ) t
      from auth.users u left join public.user_accounts a on a.user_id = u.id
      where (v_q is null or u.email ilike '%' || v_q || '%' or coalesce(u.raw_user_meta_data->>'full_name', '') ilike '%' || v_q || '%')
        and (p_filter = 'all' or (p_filter = 'blocked' and coalesce(a.blocked, false)) or (p_filter = 'unconfirmed' and u.email_confirmed_at is null)
             or (p_filter in ('free', 'essencial', 'plus', 'pro') and public.current_plan_id(u.id) = p_filter))
      order by u.created_at desc
      limit least(greatest(coalesce(p_limit, 30), 1), 100) offset greatest(coalesce(p_offset, 0), 0)) x), '[]'::jsonb));
end;
$$;
revoke all on function public.admin_list_users(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_users(text, text, integer, integer) to authenticated;

create or replace function public.admin_set_blocked(p_user uuid, p_blocked boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_global_admin() then raise exception 'forbidden'; end if;
  if p_user = auth.uid() or public.is_admin_id(p_user) then raise exception 'cannot_block_admin'; end if;
  insert into public.user_accounts (user_id, onboarding_step) values (p_user, 'done') on conflict (user_id) do nothing;
  update public.user_accounts set blocked = p_blocked, blocked_at = case when p_blocked then now() end,
    flag_reason = case when p_blocked then left(coalesce(p_reason, 'admin'), 200) else null end, updated_at = now()
   where user_id = p_user;
  update auth.users set banned_until = case when p_blocked then 'infinity'::timestamptz else null end where id = p_user;
  if p_blocked then delete from auth.sessions where user_id = p_user; end if;
end;
$$;
revoke all on function public.admin_set_blocked(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_blocked(uuid, boolean, text) to authenticated;

create or replace function public.admin_delete_user(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_global_admin() then raise exception 'forbidden'; end if;
  if p_user = auth.uid() or public.is_admin_id(p_user) then raise exception 'cannot_delete_admin'; end if;
  if exists (select 1 from public.subscriptions where user_id = p_user and status in ('active', 'past_due') and provider <> 'admin') then
    raise exception 'has_paid_subscription';
  end if;
  delete from auth.users where id = p_user;
end;
$$;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

create or replace function public.admin_set_admin(p_email text, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not public.is_global_admin() then raise exception 'forbidden'; end if;
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then raise exception 'user_not_found'; end if;
  if p_on then insert into public.admin_users (user_id) values (v_user) on conflict do nothing;
  else
    if v_user = auth.uid() then raise exception 'cannot_remove_self'; end if;
    delete from public.admin_users where user_id = v_user;
  end if;
end;
$$;
revoke all on function public.admin_set_admin(text, boolean) from public, anon;
grant execute on function public.admin_set_admin(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Espelho das vozes e modelos (cópia própria; o app tenta aqui antes do Hugging Face)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('voice-models', 'voice-models', true, 419430400)
on conflict (id) do update set public = true, file_size_limit = 419430400;

create or replace function public.admin_end_sessions(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from auth.sessions where user_id = p_user;
end;
$$;
revoke all on function public.admin_end_sessions(uuid) from public, anon, authenticated;
