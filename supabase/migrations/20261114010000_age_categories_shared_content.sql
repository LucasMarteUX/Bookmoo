-- Indicação de idade e categorias múltiplas dos livros da galeria, e conteúdo de IA compartilhado entre pessoas.
-- Tudo aditivo: nada é apagado nem reescrito.

-- Faixa etária editorial (Bookmoo) e detalhes mostrados no hover do selo.
alter table public.catalog_books add column if not exists age_min smallint;
alter table public.catalog_books add column if not exists age_info jsonb;
alter table public.catalog_books drop constraint if exists catalog_books_age_min_check;
alter table public.catalog_books add constraint catalog_books_age_min_check check (age_min is null or age_min between 0 and 21);

-- Um livro pode estar em várias categorias; `category` continua sendo a principal (primeira da lista).
alter table public.catalog_books add column if not exists categories text[] not null default '{}';
alter table public.catalog_books drop constraint if exists catalog_books_categories_check;
alter table public.catalog_books add constraint catalog_books_categories_check
  check (categories <@ array['classic','children','adventure','fantasy','mystery','romance','short','poetry','nonfiction','biography']::text[]);
update public.catalog_books set categories = array[category] where categories = '{}' and category is not null;

-- Textos de IA compartilhados: explicações de palavras e histórias. O primeiro que gera vale para todos;
-- notas pessoais e imagens em estilo próprio nunca entram aqui.
create table if not exists public.shared_content (
  kind text not null,
  key text not null,
  content jsonb not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (kind, key),
  constraint shared_content_kind check (kind in ('explain', 'variant-story')),
  constraint shared_content_key_len check (char_length(key) between 1 and 300)
);
alter table public.shared_content enable row level security;
drop policy if exists shared_content_read on public.shared_content;
create policy shared_content_read on public.shared_content for select to authenticated using (true);
drop policy if exists shared_content_insert on public.shared_content;
create policy shared_content_insert on public.shared_content for insert to authenticated with check (created_by = auth.uid());
revoke all on public.shared_content from anon;
grant select, insert on public.shared_content to authenticated;
