-- Memória de cada tutor sobre cada pessoa. Bia, Luck, Yuno e Yuri têm, cada um, o próprio contexto de quem conversa com eles:
-- o que falaram, o que a pessoa acertou, onde precisa melhorar. Um tutor também sabe (de forma resumida) que a pessoa
-- conversou com outro, e pode sugerir chamá-lo.
-- Só o servidor (service role) escreve; a pessoa só lê a própria memória.

create table if not exists public.tutor_memory (
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id text not null check (character_id in ('bookmoo-mulher', 'bookmoo-homem', 'bookmoo-yuno', 'bookmoo-yuri')),
  summary text not null default '',
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  topics text[] not null default '{}',
  sessions integer not null default 0,
  last_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, character_id)
);
alter table public.tutor_memory enable row level security;
drop policy if exists tutor_memory_read on public.tutor_memory;
create policy tutor_memory_read on public.tutor_memory for select to authenticated using (user_id = auth.uid());
-- Sem política de escrita: inserir e atualizar só pela Edge Function (service role).
revoke insert, update, delete on public.tutor_memory from anon, authenticated;
