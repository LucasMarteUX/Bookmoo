-- Políticas de Storage para o bucket comic-pages.
-- 1) Crie o bucket: node scripts/create-comic-bucket.mjs
-- 2) Execute este SQL no Supabase Dashboard → SQL Editor.
-- Permite que usuários autenticados façam upload apenas em {auth.uid()}/{bookId}/{page}.jpg

create policy "Users can upload comic pages in their folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'comic-pages'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update their comic pages"
on storage.objects for update to authenticated
using (
  bucket_id = 'comic-pages'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Public read for comic pages"
on storage.objects for select to public
using (bucket_id = 'comic-pages');
