-- "Decifrar a página": explicação gramatical por página, gerada uma vez e reaproveitada pela comunidade.
-- Livros da galeria: compartilhada (chave = livro + página + hash do texto + idioma). Livros da pessoa: privada.
-- "Desafio": quiz pessoal por página e nível de dificuldade. Tudo é lido e escrito só pela Edge Function `grammar`.

create table if not exists public.page_grammar (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid references public.catalog_books(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  book_id uuid,
  page integer not null check (page >= 0),
  text_hash text not null,
  lang text not null default 'pt',
  content jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((catalog_id is not null and owner_id is null) or (catalog_id is null and owner_id is not null))
);
create unique index if not exists page_grammar_shared_key on public.page_grammar (catalog_id, page, text_hash, lang) where catalog_id is not null;
create unique index if not exists page_grammar_private_key on public.page_grammar (owner_id, book_id, page, text_hash, lang) where owner_id is not null;
alter table public.page_grammar enable row level security;

create table if not exists public.page_quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null,
  page integer not null check (page >= 0),
  tier smallint not null check (tier between 1 and 3),
  text_hash text not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, book_id, page, tier, text_hash)
);
alter table public.page_quizzes enable row level security;
drop policy if exists page_quizzes_own on public.page_quizzes;
create policy page_quizzes_own on public.page_quizzes for select to authenticated using (user_id = auth.uid());

-- Resultado de cada desafio (histórico e ajuste de dificuldade).
create table if not exists public.quiz_results (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null,
  page integer not null,
  tier smallint not null,
  correct smallint not null,
  total smallint not null,
  created_at timestamptz not null default now()
);
create index if not exists quiz_results_user on public.quiz_results (user_id, book_id, created_at desc);
alter table public.quiz_results enable row level security;
drop policy if exists quiz_results_own on public.quiz_results;
create policy quiz_results_own on public.quiz_results for select to authenticated using (user_id = auth.uid());
