-- Teste de nível (docs/TESTE-DE-NIVEL.md): tentativas, histórico de nível, emblemas e a opção de mostrar o nível.
-- Tudo o que muda nível, estado e emblemas é gravado só pela Edge Function `placement` (service role).

alter table public.profiles
  add column if not exists show_level boolean not null default true,
  add column if not exists level_emblems text[] not null default '{}',
  add column if not exists level_verified_at timestamptz;

-- Emblemas e data de verificação também só pelo servidor.
create or replace function public.profiles_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  new.handle := nullif(lower(btrim(new.handle)), '');
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.placement_level := null;
      new.level_state := 'pending';
      new.level_emblems := '{}';
      new.level_verified_at := null;
    else
      new.placement_level := old.placement_level;
      new.level_state := old.level_state;
      new.level_emblems := old.level_emblems;
      new.level_verified_at := old.level_verified_at;
    end if;
  end if;
  return new;
end;
$$;

create table if not exists public.placement_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  kind text not null check (kind in ('confirm', 'promotion')),
  status text not null default 'active' check (status in ('active', 'scored', 'abandoned')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  items jsonb not null,                    -- itens sorteados, com o gabarito (nunca vai para o cliente)
  answers jsonb not null default '{}'::jsonb,
  turns jsonb not null default '[]'::jsonb, -- conversa da parte 3
  scores jsonb,
  total numeric,
  outcome text check (outcome in ('confirmed', 'promote', 'step_down', 'retry', 'promoted', 'not_promoted'))
);
create index if not exists placement_attempts_user on public.placement_attempts (user_id, started_at desc);
alter table public.placement_attempts enable row level security;
drop policy if exists placement_attempts_read on public.placement_attempts;
create policy placement_attempts_read on public.placement_attempts for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.placement_attempts from anon, authenticated;
-- O gabarito fica no servidor: a pessoa lê as tentativas, mas não a coluna de itens.
revoke select on public.placement_attempts from anon, authenticated;
grant select (id, user_id, level, kind, status, started_at, finished_at, scores, total, outcome) on public.placement_attempts to authenticated;

create table if not exists public.level_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now(),
  from_level text,
  to_level text not null,
  reason text not null check (reason in ('declared', 'test_confirmed', 'test_promoted', 'step_down', 'manual_admin'))
);
create index if not exists level_history_user on public.level_history (user_id, at desc);
alter table public.level_history enable row level security;
drop policy if exists level_history_read on public.level_history;
create policy level_history_read on public.level_history for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.level_history from anon, authenticated;

-- Comunidade: o nível só aparece para os outros se a pessoa deixar (show_level, ligado por padrão). A própria pessoa
-- sempre vê. Sem teste, mostra o nível declarado (com "leveled" falso = pendente).
do $$
declare
  def text;
begin
  select pg_get_functiondef('public.community_profile(text, uuid)'::regprocedure) into def;
  if def not like '%show_level%' then
    def := replace(def,
      $r$'level', coalesce(p.placement_level, 'A1'), 'leveled', p.placement_level is not null$r$,
      $r$'level', case when p.show_level or p.user_id = auth.uid() then coalesce(p.placement_level, p.declared_level, 'A1') end, 'leveled', p.placement_level is not null and p.level_state = 'verified' and (p.show_level or p.user_id = auth.uid()), 'emblems', case when p.show_level or p.user_id = auth.uid() then p.level_emblems else '{}'::text[] end$r$);
    execute def;
  end if;
  select pg_get_functiondef('public.community_author(uuid)'::regprocedure) into def;
  if def not like '%show_level%' then
    def := replace(def,
      $r$'level', coalesce(p.placement_level, 'A1')$r$,
      $r$'level', case when p.show_level or p.user_id = auth.uid() then coalesce(p.placement_level, p.declared_level, 'A1') end, 'leveled', p.placement_level is not null and p.level_state = 'verified' and (p.show_level or p.user_id = auth.uid())$r$);
    execute def;
  end if;
end $$;
