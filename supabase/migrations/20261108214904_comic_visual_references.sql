insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comic-references', 'comic-references', false, 2097152,
        array['image/png', 'image/jpeg', 'image/webp']);

create policy "Book owners read comic references"
on storage.objects for select to authenticated
using (bucket_id = 'comic-references' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Book owners upload comic references"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'comic-references'
  and cardinality(storage.foldername(name)) = 2
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.books b
    where b.id::text = (storage.foldername(name))[2] and b.user_id = (select auth.uid())
  )
);

create policy "Book owners remove comic references"
on storage.objects for delete to authenticated
using (bucket_id = 'comic-references' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Page writes are scoped to one JSON key so generating in two tabs does not
-- replace unrelated pages. Stale writes to the same page fail explicitly.
create function public.save_comic_page(
  p_book uuid, p_page integer, p_image text, p_layout jsonb,
  p_previous_image text, p_previous_edit text,
  p_style jsonb default null, p_style_revision text default null,
  p_characters jsonb default null, p_previous_characters jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  book public.books%rowtype;
  page_key text := p_page::text;
begin
  select * into book from public.books
  where id = p_book and user_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'Book not found' using errcode = '42501';
  end if;

  if p_page < 0 or p_page > 100000
     or (book.comic_pages ->> page_key) is distinct from p_previous_image
     or (book.comic_layouts -> page_key ->> 'editRevision') is distinct from p_previous_edit
     or (p_characters is not null and coalesce(book.comic_characters, '[]'::jsonb) is distinct from p_previous_characters) then
    raise exception 'Comic data changed in another session' using errcode = '40001';
  end if;

  update public.books b set
    comic_pages = case when p_image is null then nullif(coalesce(book.comic_pages, '{}'::jsonb) - page_key, '{}'::jsonb)
      else jsonb_set(coalesce(book.comic_pages, '{}'::jsonb), array[page_key], to_jsonb(p_image)) end,
    comic_layouts = case when p_layout is null then book.comic_layouts - page_key
      else jsonb_set(book.comic_layouts, array[page_key], p_layout) end,
    comic_style_doc = case when p_style is not null and (book.comic_style_doc ->> 'revision') is not distinct from p_style_revision
      then p_style else book.comic_style_doc end,
    comic_characters = coalesce(p_characters, book.comic_characters)
  where b.id = p_book and b.user_id = (select auth.uid())
  returning b.* into book;

  return jsonb_build_object('comicPages', book.comic_pages, 'comicLayouts', book.comic_layouts,
    'comicStyleDoc', book.comic_style_doc, 'comicCharacters', book.comic_characters);
end;
$$;

revoke all on function public.save_comic_page(uuid, integer, text, jsonb, text, text, jsonb, text, jsonb, jsonb) from public, anon;
grant execute on function public.save_comic_page(uuid, integer, text, jsonb, text, text, jsonb, text, jsonb, jsonb) to authenticated;
