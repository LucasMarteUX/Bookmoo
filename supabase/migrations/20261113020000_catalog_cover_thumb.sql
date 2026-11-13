-- Miniatura da capa para listas (galeria, comunidade): ~15 KB no lugar de ~250 KB por livro.
-- A capa completa continua em cover_data e é usada na página do livro.
begin;
alter table public.catalog_books add column if not exists cover_thumb text;
commit;
