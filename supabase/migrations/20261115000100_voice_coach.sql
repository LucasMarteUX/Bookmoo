-- Conversa por voz, Cenas, Tutor de leitura, Análise de perfil e Histórias de reforço.
-- Cenas prontas vivem no código (supabase/functions/_shared/scenes.ts); aqui ficam as criadas pela pessoa.

create table if not exists public.scenes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 80),
  category text not null default 'custom',
  setting text not null check (char_length(setting) between 3 and 400),
  persona jsonb not null,
  goals jsonb not null default '[]'::jsonb,
  twists jsonb not null default '[]'::jsonb,
  useful_phrases jsonb not null default '[]'::jsonb,
  opening text,
  level text not null default 'B1',
  ambient text,
  moderation_status text not null default 'approved' check (moderation_status in ('approved', 'rejected')),
  created_at timestamptz not null default now()
);
create index if not exists scenes_owner on public.scenes (owner_id, created_at desc);
alter table public.scenes enable row level security;
drop policy if exists scenes_own_read on public.scenes;
create policy scenes_own_read on public.scenes for select to authenticated using (owner_id = auth.uid());
drop policy if exists scenes_own_delete on public.scenes;
create policy scenes_own_delete on public.scenes for delete to authenticated using (owner_id = auth.uid());

create table if not exists public.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('scene', 'tutor', 'reader')),
  scene_key text,
  book_id uuid,
  title text,
  context jsonb not null default '{}'::jsonb,
  planned_seconds integer not null default 0,
  reservation_id uuid references public.credit_reservations(id) on delete set null,
  started_at timestamptz not null default now(),
  last_turn_at timestamptz not null default now(),
  ended_at timestamptz,
  used_seconds integer not null default 0,
  turns integer not null default 0,
  status text not null default 'active' check (status in ('active', 'ended')),
  score integer
);
create index if not exists conversation_sessions_user on public.conversation_sessions (user_id, started_at desc);
create unique index if not exists conversation_one_active on public.conversation_sessions (user_id) where status = 'active' and kind = 'scene';
alter table public.conversation_sessions enable row level security;
drop policy if exists conversation_sessions_read on public.conversation_sessions;
create policy conversation_sessions_read on public.conversation_sessions for select to authenticated using (user_id = auth.uid());
drop policy if exists conversation_sessions_delete on public.conversation_sessions;
create policy conversation_sessions_delete on public.conversation_sessions for delete to authenticated using (user_id = auth.uid());

create table if not exists public.conversation_turns (
  id bigserial primary key,
  session_id uuid not null references public.conversation_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'ai')),
  text text not null,
  stt_confidence real,
  created_at timestamptz not null default now()
);
create index if not exists conversation_turns_session on public.conversation_turns (session_id, id);
alter table public.conversation_turns enable row level security;
drop policy if exists conversation_turns_read on public.conversation_turns;
create policy conversation_turns_read on public.conversation_turns for select to authenticated
  using (exists (select 1 from public.conversation_sessions s where s.id = session_id and s.user_id = auth.uid()));

create table if not exists public.conversation_feedback (
  session_id uuid primary key references public.conversation_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null,
  cefr text,
  criteria jsonb not null default '{}'::jsonb,
  summary text,
  tips jsonb not null default '[]'::jsonb,
  corrections jsonb not null default '[]'::jsonb,
  new_words jsonb not null default '[]'::jsonb,
  goals_met jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.conversation_feedback enable row level security;
drop policy if exists conversation_feedback_read on public.conversation_feedback;
create policy conversation_feedback_read on public.conversation_feedback for select to authenticated using (user_id = auth.uid());

create table if not exists public.learner_errors (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  kind text not null,
  example text,
  correction text,
  created_at timestamptz not null default now()
);
create index if not exists learner_errors_user on public.learner_errors (user_id, created_at desc);
alter table public.learner_errors enable row level security;
drop policy if exists learner_errors_read on public.learner_errors;
create policy learner_errors_read on public.learner_errors for select to authenticated using (user_id = auth.uid());

create table if not exists public.profile_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  summary jsonb not null,
  report jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists profile_insights_user on public.profile_insights (user_id, created_at desc);
alter table public.profile_insights enable row level security;
drop policy if exists profile_insights_read on public.profile_insights;
create policy profile_insights_read on public.profile_insights for select to authenticated using (user_id = auth.uid());

create table if not exists public.reinforcement_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  level text,
  target_words jsonb not null default '[]'::jsonb,
  grammar_focus text,
  quiz jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists reinforcement_stories_user on public.reinforcement_stories (user_id, created_at desc);
alter table public.reinforcement_stories enable row level security;
drop policy if exists reinforcement_stories_read on public.reinforcement_stories;
create policy reinforcement_stories_read on public.reinforcement_stories for select to authenticated using (user_id = auth.uid());
drop policy if exists reinforcement_stories_delete on public.reinforcement_stories;
create policy reinforcement_stories_delete on public.reinforcement_stories for delete to authenticated using (user_id = auth.uid());

-- Resumos por capítulo para o Tutor de leitura (sem spoiler: só até onde a pessoa leu).
create table if not exists public.catalog_page_summaries (
  catalog_id uuid not null references public.catalog_books(id) on delete cascade,
  page integer not null,
  summary text not null,
  created_at timestamptz not null default now(),
  primary key (catalog_id, page)
);
alter table public.catalog_page_summaries enable row level security;

create table if not exists public.book_page_summaries (
  book_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  page integer not null,
  summary text not null,
  created_at timestamptz not null default now(),
  primary key (book_id, page)
);
alter table public.book_page_summaries enable row level security;
