-- Coleções de livros: agrupam referências a livros que já estão em catalog_books (sem duplicar nada).
-- Um livro pode estar em várias coleções; a ordem de cada coleção fica em sort_order.
-- Leitura: coleções publicadas para quem está logado. Escrita: só o admin global (is_global_admin).
-- O banner é guardado como data URL (webp/jpeg), como as capas, e é independente da capa dos livros.

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  description text,
  author_name text,
  category text,
  language_code text not null default 'en',
  banner_data text,
  is_featured boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collections_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint collections_title_len check (char_length(title) between 1 and 160),
  constraint collections_banner_type check (banner_data is null or banner_data ~ '^data:image/(webp|jpeg|png);base64,')
);
create unique index if not exists collections_slug_key on public.collections (slug);
create index if not exists collections_featured_idx on public.collections (is_published, is_featured, created_at desc);

create table if not exists public.collection_books (
  collection_id uuid not null references public.collections(id) on delete cascade,
  book_id uuid not null references public.catalog_books(id) on delete cascade,
  sort_order int not null,
  created_at timestamptz not null default now(),
  primary key (collection_id, book_id),
  constraint collection_books_order_unique unique (collection_id, sort_order) deferrable initially deferred
);
create index if not exists collection_books_book_idx on public.collection_books (book_id);

alter table public.collections enable row level security;
alter table public.collection_books enable row level security;

drop policy if exists collections_read on public.collections;
create policy collections_read on public.collections for select to authenticated
  using (is_published or public.is_global_admin());
drop policy if exists collections_admin_write on public.collections;
create policy collections_admin_write on public.collections for all to authenticated
  using (public.is_global_admin()) with check (public.is_global_admin());

drop policy if exists collection_books_read on public.collection_books;
create policy collection_books_read on public.collection_books for select to authenticated
  using (public.is_global_admin() or exists (select 1 from public.collections c where c.id = collection_id and c.is_published));
drop policy if exists collection_books_admin_write on public.collection_books;
create policy collection_books_admin_write on public.collection_books for all to authenticated
  using (public.is_global_admin()) with check (public.is_global_admin());

revoke all on public.collections, public.collection_books from anon;
grant select on public.collections, public.collection_books to authenticated;
grant insert, update, delete on public.collections, public.collection_books to authenticated; -- a RLS limita ao admin

create or replace function public.collections_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists collections_touch on public.collections;
create trigger collections_touch before update on public.collections for each row execute function public.collections_touch();
