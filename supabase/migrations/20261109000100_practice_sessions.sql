-- Resultados das práticas por página (Falar e Escrever/ditado), para as estatísticas.
create table if not exists public.practice_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('speak', 'write')),
  book_id uuid not null,
  book_title text not null default '',
  page integer not null check (page >= 0),
  accuracy integer not null check (accuracy between 0 and 100),
  ok integer not null default 0,
  close integer not null default 0,
  errors integer not null default 0,
  total integer not null default 0,
  stars integer not null default 0 check (stars between 0 and 3),
  missed text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists practice_sessions_user_created on public.practice_sessions (user_id, created_at desc);

alter table public.practice_sessions enable row level security;

create policy "practice_sessions_select_own" on public.practice_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "practice_sessions_insert_own" on public.practice_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "practice_sessions_delete_own" on public.practice_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.practice_sessions from anon;
grant select, insert, delete on public.practice_sessions to authenticated;
