-- Banco compartilhado de vocabulário: conteúdos gerados por IA (explicações, histórias,
-- exemplos e imagens) são reaproveitados por todos os usuários, para que só os primeiros
-- gastem API. Leitura para usuários logados; escrita de conteúdo só via Edge Function
-- (service role). Favoritos de imagem são do próprio usuário (RLS por auth.uid()).
--
-- Privacidade: a coluna created_by existe só para limite de uso/moderação e NÃO é
-- concedida a anon/authenticated (grants por coluna abaixo).

-- ---------------------------------------------------------------------------
-- Termos normalizados (texto em minúsculas + idioma do termo)
-- ---------------------------------------------------------------------------
create table if not exists public.vocab_terms (
  id uuid primary key default gen_random_uuid(),
  term_norm text not null check (char_length(term_norm) between 1 and 120 and term_norm = lower(term_norm)),
  lang text not null check (lang ~ '^[a-z]{2}$'),
  created_at timestamptz not null default now(),
  unique (term_norm, lang)
);

-- ---------------------------------------------------------------------------
-- Explicações (por idioma da interface: pt ou en)
-- ---------------------------------------------------------------------------
create table if not exists public.vocab_explanations (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.vocab_terms(id) on delete cascade,
  ui_lang text not null check (ui_lang in ('pt', 'en')),
  definition text not null check (char_length(definition) <= 1500),
  pronunciation text not null default '' check (char_length(pronunciation) <= 120),
  examples jsonb not null default '[]'::jsonb check (jsonb_typeof(examples) = 'array' and pg_column_size(examples) <= 4000),
  grammar_examples jsonb not null default '[]'::jsonb check (jsonb_typeof(grammar_examples) = 'array' and pg_column_size(grammar_examples) <= 6000),
  usage_note text not null default '' check (char_length(usage_note) <= 800),
  provider text check (provider in ('openai', 'gemini')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists vocab_explanations_term_idx on public.vocab_explanations (term_id, ui_lang, created_at);
create index if not exists vocab_explanations_creator_idx on public.vocab_explanations (created_by, created_at);

-- ---------------------------------------------------------------------------
-- Variantes de história
-- ---------------------------------------------------------------------------
create table if not exists public.vocab_stories (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.vocab_terms(id) on delete cascade,
  ui_lang text not null check (ui_lang in ('pt', 'en')),
  story text not null check (char_length(story) between 1 and 2000),
  provider text check (provider in ('openai', 'gemini')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists vocab_stories_term_idx on public.vocab_stories (term_id, ui_lang, created_at);
create index if not exists vocab_stories_creator_idx on public.vocab_stories (created_by, created_at);

-- ---------------------------------------------------------------------------
-- Exemplos editáveis (frases enviadas pelos usuários; sem duplicatas por termo)
-- ---------------------------------------------------------------------------
create table if not exists public.vocab_examples (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.vocab_terms(id) on delete cascade,
  sentence text not null check (char_length(sentence) between 3 and 300),
  sentence_norm text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (term_id, sentence_norm)
);
create index if not exists vocab_examples_creator_idx on public.vocab_examples (created_by, created_at);

-- ---------------------------------------------------------------------------
-- Imagens de mosaico (arquivo no Storage, bucket vocab-images) + favoritos por usuário
-- ---------------------------------------------------------------------------
create table if not exists public.vocab_images (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.vocab_terms(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 200),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  bytes int not null check (bytes > 0 and bytes <= 5000000),
  concept text not null default '' check (char_length(concept) <= 200),
  star_count int not null default 0,
  provider text check (provider in ('openai', 'gemini')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists vocab_images_term_idx on public.vocab_images (term_id, star_count desc, created_at desc);
create index if not exists vocab_images_creator_idx on public.vocab_images (created_by, created_at);

create table if not exists public.vocab_image_stars (
  image_id uuid not null references public.vocab_images(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (image_id, user_id)
);
create index if not exists vocab_image_stars_user_idx on public.vocab_image_stars (user_id);

-- Mantém vocab_images.star_count (ordenação pelas mais favoritadas).
create or replace function public.vocab_image_star_count()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.vocab_images set star_count = star_count + 1 where id = new.image_id;
  elsif tg_op = 'DELETE' then
    update public.vocab_images set star_count = greatest(star_count - 1, 0) where id = old.image_id;
  end if;
  return null;
end $$;
revoke all on function public.vocab_image_star_count() from public, anon, authenticated;

drop trigger if exists vocab_image_stars_count on public.vocab_image_stars;
create trigger vocab_image_stars_count
after insert or delete on public.vocab_image_stars
for each row execute function public.vocab_image_star_count();

-- ---------------------------------------------------------------------------
-- RLS e grants
-- ---------------------------------------------------------------------------
alter table public.vocab_terms enable row level security;
alter table public.vocab_explanations enable row level security;
alter table public.vocab_stories enable row level security;
alter table public.vocab_examples enable row level security;
alter table public.vocab_images enable row level security;
alter table public.vocab_image_stars enable row level security;

revoke all on public.vocab_terms, public.vocab_explanations, public.vocab_stories,
  public.vocab_examples, public.vocab_images, public.vocab_image_stars from anon, authenticated;

-- Leitura de conteúdo: só usuários logados, e sem a coluna created_by.
grant select (id, term_norm, lang, created_at) on public.vocab_terms to authenticated;
grant select (id, term_id, ui_lang, definition, pronunciation, examples, grammar_examples, usage_note, created_at)
  on public.vocab_explanations to authenticated;
grant select (id, term_id, ui_lang, story, created_at) on public.vocab_stories to authenticated;
grant select (id, term_id, sentence, created_at) on public.vocab_examples to authenticated;
grant select (id, term_id, storage_path, mime, concept, star_count, created_at) on public.vocab_images to authenticated;

drop policy if exists vocab_terms_read on public.vocab_terms;
create policy vocab_terms_read on public.vocab_terms for select to authenticated using (true);
drop policy if exists vocab_explanations_read on public.vocab_explanations;
create policy vocab_explanations_read on public.vocab_explanations for select to authenticated using (true);
drop policy if exists vocab_stories_read on public.vocab_stories;
create policy vocab_stories_read on public.vocab_stories for select to authenticated using (true);
drop policy if exists vocab_examples_read on public.vocab_examples;
create policy vocab_examples_read on public.vocab_examples for select to authenticated using (true);
drop policy if exists vocab_images_read on public.vocab_images;
create policy vocab_images_read on public.vocab_images for select to authenticated using (true);

-- Favoritos: cada usuário vê, cria e remove só os seus.
grant select (image_id, user_id, created_at), insert (image_id), delete on public.vocab_image_stars to authenticated;
drop policy if exists vocab_image_stars_own_read on public.vocab_image_stars;
create policy vocab_image_stars_own_read on public.vocab_image_stars for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists vocab_image_stars_own_insert on public.vocab_image_stars;
create policy vocab_image_stars_own_insert on public.vocab_image_stars for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists vocab_image_stars_own_delete on public.vocab_image_stars;
create policy vocab_image_stars_own_delete on public.vocab_image_stars for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage: bucket privado; leitura para logados, escrita só pelo service role.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vocab-images', 'vocab-images', false, 5000000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists vocab_images_storage_read on storage.objects;
create policy vocab_images_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'vocab-images');
