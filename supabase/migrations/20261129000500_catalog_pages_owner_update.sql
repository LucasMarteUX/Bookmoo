-- Quem publicou a imagem de uma página da galeria pode trocá-la ao refazer a página (antes ficava presa à primeira
-- versão, e essa versão antiga cobria a nova no leitor). Só a própria linha, só com imagem da própria pasta.
drop policy if exists "catalog_pages_owner_update" on public.catalog_comic_pages;
create policy "catalog_pages_owner_update" on public.catalog_comic_pages
  for update to authenticated
  using (created_by = (select auth.uid()))
  with check (
    created_by = (select auth.uid())
    and image_url like '%/storage/v1/object/public/comic-pages/' || (select auth.uid())::text || '/%'
  );
grant update (image_url) on public.catalog_comic_pages to authenticated;
