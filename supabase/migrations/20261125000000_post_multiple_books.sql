-- Publicações com vários livros marcados ("Qual desses você me indica?"). O livro principal continua em catalog_id /
-- book_*; os outros (até 4) ficam em extra_books: [{ "catalog_id": "..." }] ou [{ "title": "...", "author": "..." }].
alter table public.community_posts
  add column if not exists extra_books jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.community_posts add constraint community_posts_extra_books_max
    check (jsonb_typeof(extra_books) = 'array' and jsonb_array_length(extra_books) <= 4);
exception when duplicate_object then null; end $$;

-- O feed passa a devolver os livros extras, com título e autor da galeria quando são livros do catálogo.
do $$
declare
  def text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p where p.proname = 'community_post_item';
  if def not like '%extra_books%' then
    def := replace(def,
      $r$'catalog_id', po.catalog_id, 'book_id', po.book_id,$r$,
      $r$'catalog_id', po.catalog_id, 'book_id', po.book_id,
    'extra_books', coalesce((
      select jsonb_agg(case when e->>'catalog_id' is not null
        then jsonb_build_object('catalog_id', e->>'catalog_id', 'title', cb.title, 'author', cb.author)
        else jsonb_build_object('title', left(e->>'title', 200), 'author', left(e->>'author', 120)) end)
      from jsonb_array_elements(po.extra_books) e
      left join public.catalog_books cb on cb.id::text = e->>'catalog_id'
      where e->>'catalog_id' is null or cb.id is not null
    ), '[]'::jsonb),$r$);
    execute def;
  end if;
end $$;
