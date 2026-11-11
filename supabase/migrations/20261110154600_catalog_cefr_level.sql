-- Dificuldade do livro da galeria, escolhida na área admin.
-- É o nível do texto (A1–C2), separado do nível que a pessoa alcança estudando.
alter table public.catalog_books
  add column if not exists cefr_level text;

alter table public.catalog_books
  add column if not exists category text;

alter table public.catalog_books
  drop constraint if exists catalog_books_cefr_level_check;

alter table public.catalog_books
  add constraint catalog_books_cefr_level_check
  check (cefr_level is null or cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

alter table public.catalog_books
  drop constraint if exists catalog_books_category_check;

alter table public.catalog_books
  add constraint catalog_books_category_check
  check (category is null or category in (
    'classic', 'children', 'adventure', 'fantasy', 'mystery',
    'romance', 'short', 'poetry', 'nonfiction', 'biography'
  ));
