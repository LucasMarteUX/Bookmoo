-- Endurecimento de segurança (revisão de 15/11/2026).
-- 1) Limitador de requisições usado pelas Edge Functions.
-- 2) Funções auxiliares de privacidade (amizade, bloqueio, visibilidade) deixam de responder sobre terceiros.
-- 3) O papel anônimo perde acesso às tabelas e ao GraphQL (o app usa só PostgREST e RPC com login).
-- 4) search_path fixo nas funções que ainda não tinham.

-- ───────── 1. Limitador (janela fixa) ─────────
create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.rate_limits;
  now_ts timestamptz := now();
begin
  insert into public.rate_limits as t (key, window_start, hits) values (p_key, now_ts, 1)
  on conflict (key) do update set
    window_start = case when t.window_start < now_ts - make_interval(secs => p_window_seconds) then now_ts else t.window_start end,
    hits = case when t.window_start < now_ts - make_interval(secs => p_window_seconds) then 1 else t.hits + 1 end
  returning * into r;
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now_ts - interval '1 day';
  end if;
  return jsonb_build_object(
    'ok', r.hits <= p_limit,
    'hits', r.hits,
    'retry_after', greatest(1, ceil(extract(epoch from (r.window_start + make_interval(secs => p_window_seconds) - now_ts)))::int)
  );
end;
$$;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- ───────── 2. Funções de privacidade: só respondem quando a própria pessoa faz parte da pergunta ─────────
-- Chamadas internas (gatilhos, cron, service role) não têm login: seguem como antes.
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or auth.uid() in (a, b))
     and exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

create or replace function public.is_friend(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or auth.uid() in (a, b))
     and exists (
       select 1 from public.friend_requests
        where status = 'accepted' and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a))
     );
$$;

create or replace function public.follows_accepted(f uuid, t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or auth.uid() in (f, t))
     and exists (select 1 from public.follows where follower_id = f and followee_id = t and status = 'accepted');
$$;

-- can_view_profile e can_view_post: o "viewer" informado precisa ser quem está logado.
create or replace function public.can_view_profile(viewer uuid, owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select viewer is not null and (auth.uid() is null or auth.uid() = viewer) and (
    viewer = owner or (
      exists (
        select 1 from public.profiles p
         where p.user_id = owner and p.handle is not null
           and (p.is_public or public.follows_accepted(viewer, owner) or public.is_friend(viewer, owner))
      )
      and not public.is_blocked_between(viewer, owner)
    )
  );
$$;

create or replace function public.can_view_post(viewer uuid, p_post uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or auth.uid() = viewer) and exists (
    select 1 from public.community_posts po
     where po.id = p_post
       and (
         po.user_id = viewer
         or (
           po.hidden_at is null
           and public.can_view_profile(viewer, po.user_id)
           and public.post_sharing_on(po.user_id, po.kind)
           and (
             po.audience = 'public'
             or (po.audience = 'followers' and (public.follows_accepted(viewer, po.user_id) or public.is_friend(viewer, po.user_id)))
             or (po.audience = 'friends' and public.is_friend(viewer, po.user_id))
           )
         )
       )
  );
$$;

-- ───────── 3. Papel anônimo: sem tabelas (exceto os planos, que a página de preços lê) e sem GraphQL ─────────
revoke all on all tables in schema public from anon;
grant select on public.plans to anon;
alter default privileges in schema public revoke all on tables from anon;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'graphql_public') then
    revoke usage on schema graphql_public from anon, authenticated;
  end if;
  if exists (select 1 from pg_namespace where nspname = 'graphql') then
    revoke usage on schema graphql from anon, authenticated;
  end if;
exception when others then
  raise notice 'graphql: %', sqlerrm;
end $$;

-- Funções utilitárias puras: só quem tem login.
revoke execute on function public.merge_plan_limits(jsonb, jsonb) from public, anon;
grant execute on function public.merge_plan_limits(jsonb, jsonb) to authenticated, service_role;
revoke execute on function public.survey_match_arr(jsonb, jsonb, text) from public, anon;
grant execute on function public.survey_match_arr(jsonb, jsonb, text) to authenticated, service_role;
revoke execute on function public.survey_match_scalar(jsonb, jsonb, text) from public, anon;
grant execute on function public.survey_match_scalar(jsonb, jsonb, text) to authenticated, service_role;

-- ───────── 4. search_path fixo ─────────
alter function public.collections_touch() set search_path = public;
alter function public.survey_match_arr(jsonb, jsonb, text) set search_path = public;
alter function public.survey_match_scalar(jsonb, jsonb, text) set search_path = public;
alter function public.merge_plan_limits(jsonb, jsonb) set search_path = public;
