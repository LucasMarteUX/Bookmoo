-- Segurança: a página da galeria compartilhada só pode apontar para uma imagem guardada na pasta da própria pessoa
-- no Storage do Upoonly. Antes a inserção conferia quem criou e o estilo, mas não o endereço da imagem: chamando a API
-- direto, alguém podia cadastrar uma "página ilustrada" de um clássico com qualquer imagem da internet, e ela aparecia
-- para todos os leitores daquele livro. A edição já tinha esta trava (20261129000500); agora a criação também.
drop policy if exists catalog_pages_insert on public.catalog_comic_pages;
create policy catalog_pages_insert on public.catalog_comic_pages
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and image_url like '%/storage/v1/object/public/comic-pages/' || (select auth.uid())::text || '/%'
    and exists (select 1 from public.comic_styles s where s.id = style_id and (s.ready or s.id = 'legacy'))
  );
