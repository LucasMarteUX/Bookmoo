-- Nova categoria "Histórias Bíblicas" (id bible-stories). Só amplia as listas permitidas; nada é apagado nem reescrito.
alter table public.catalog_books drop constraint if exists catalog_books_category_check;
alter table public.catalog_books add constraint catalog_books_category_check
  check (category is null or category = any (array['classic','children','bible-stories','adventure','fantasy','mystery','romance','short','poetry','nonfiction','biography']::text[]));
alter table public.catalog_books drop constraint if exists catalog_books_categories_check;
alter table public.catalog_books add constraint catalog_books_categories_check
  check (categories <@ array['classic','children','bible-stories','adventure','fantasy','mystery','romance','short','poetry','nonfiction','biography']::text[]);
