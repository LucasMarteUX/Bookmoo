-- Vocabulário: colunas que o app já envia, mais a anotação livre da pessoa.
alter table public.vocabulary
  add column if not exists grammar_examples jsonb not null default '[]'::jsonb,
  add column if not exists usage_note text,
  add column if not exists variant_story text,
  add column if not exists personal_note text;

create or replace function public.is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid() and lower(email) = 'lucasmarteux@gmail.com'
  );
$$;

revoke all on function public.is_global_admin() from public;
grant execute on function public.is_global_admin() to authenticated;

-- Perfil da comunidade. Privado até a pessoa escolher o contrário.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text,
  bio text,
  english_level text,
  is_public boolean not null default false,
  socials jsonb not null default '{}'::jsonb,
  reading jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated
  using (is_public or user_id = auth.uid());

drop policy if exists profiles_write on public.profiles;
create policy profiles_write on public.profiles
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Pinos de anotação no texto ou no quadrinho. Só a pessoa vê os dela.
create table if not exists public.story_pins (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null,
  page integer not null,
  kind text not null check (kind in ('word', 'comic')),
  word_index integer,
  quote text,
  x double precision,
  y double precision,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.story_pins enable row level security;

drop policy if exists story_pins_own on public.story_pins;
create policy story_pins_own on public.story_pins
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Livros gratuitos da galeria. EPUBs enviados pela pessoa não entram aqui.
create table if not exists public.catalog_books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  description text,
  language_code text not null default 'en',
  cover_data text,
  pages jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.catalog_books enable row level security;

drop policy if exists catalog_books_read on public.catalog_books;
create policy catalog_books_read on public.catalog_books
  for select to authenticated using (true);

drop policy if exists catalog_books_admin_write on public.catalog_books;
create policy catalog_books_admin_write on public.catalog_books
  for insert to authenticated
  with check (public.is_global_admin());

drop policy if exists catalog_books_admin_update on public.catalog_books;
create policy catalog_books_admin_update on public.catalog_books
  for update to authenticated
  using (public.is_global_admin())
  with check (public.is_global_admin());

drop policy if exists catalog_books_admin_delete on public.catalog_books;
create policy catalog_books_admin_delete on public.catalog_books
  for delete to authenticated
  using (public.is_global_admin());

-- Imagem canônica de cada página. Quem gera uma página que ainda não existe publica para todos.
-- Não há update para leitor comum: gerar de novo não apaga o que os outros já veem.
create table if not exists public.catalog_comic_pages (
  catalog_id uuid not null references public.catalog_books(id) on delete cascade,
  page integer not null,
  image_url text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (catalog_id, page)
);

alter table public.catalog_comic_pages enable row level security;

drop policy if exists catalog_pages_read on public.catalog_comic_pages;
create policy catalog_pages_read on public.catalog_comic_pages
  for select to authenticated using (true);

drop policy if exists catalog_pages_insert on public.catalog_comic_pages;
create policy catalog_pages_insert on public.catalog_comic_pages
  for insert to authenticated
  with check (auth.uid() is not null);

-- Versão pessoal publicada. Não substitui a imagem canônica.
create table if not exists public.catalog_versions (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null references public.catalog_books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text,
  images jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.catalog_versions enable row level security;

drop policy if exists catalog_versions_read on public.catalog_versions;
create policy catalog_versions_read on public.catalog_versions
  for select to authenticated using (true);

drop policy if exists catalog_versions_insert on public.catalog_versions;
create policy catalog_versions_insert on public.catalog_versions
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists catalog_versions_delete on public.catalog_versions;
create policy catalog_versions_delete on public.catalog_versions
  for delete to authenticated
  using (user_id = auth.uid() or public.is_global_admin());

create table if not exists public.catalog_version_stars (
  version_id uuid not null references public.catalog_versions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stars integer not null check (stars between 1 and 5),
  primary key (version_id, user_id)
);

alter table public.catalog_version_stars enable row level security;

drop policy if exists version_stars_read on public.catalog_version_stars;
create policy version_stars_read on public.catalog_version_stars
  for select to authenticated using (true);

drop policy if exists version_stars_write on public.catalog_version_stars;
create policy version_stars_write on public.catalog_version_stars
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists version_stars_update on public.catalog_version_stars;
create policy version_stars_update on public.catalog_version_stars
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.book_feedback (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null references public.catalog_books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.book_feedback enable row level security;

drop policy if exists book_feedback_read on public.book_feedback;
create policy book_feedback_read on public.book_feedback
  for select to authenticated using (true);

drop policy if exists book_feedback_insert on public.book_feedback;
create policy book_feedback_insert on public.book_feedback
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists book_feedback_delete on public.book_feedback;
create policy book_feedback_delete on public.book_feedback
  for delete to authenticated
  using (user_id = auth.uid() or public.is_global_admin());

-- Liga a cópia da estante ao livro da galeria, sem colocar isso na tabela books
-- (EPUB enviado pela pessoa não tem linha aqui).
create table if not exists public.book_links (
  book_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  catalog_id uuid not null references public.catalog_books(id) on delete cascade,
  image_mode text not null default 'shared' check (image_mode in ('shared', 'personal')),
  updated_at timestamptz not null default now()
);

alter table public.book_links enable row level security;

drop policy if exists book_links_own on public.book_links;
create policy book_links_own on public.book_links
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_global_admin() then
    raise exception 'forbidden';
  end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'readers_today', (select count(distinct user_id) from public.study_days where date = current_date),
    'books', (select count(*) from public.books),
    'catalog', (select count(*) from public.catalog_books)
  );
end;
$$;

revoke all on function public.admin_overview() from public;
grant execute on function public.admin_overview() to authenticated;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects
  for select to public
  using (bucket_id = 'avatars');

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
