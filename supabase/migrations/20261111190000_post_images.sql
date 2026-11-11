-- Timeline: foto nas publicações e publicação aberta por link (/post/:id).
-- O Supabase dá execute ao anon em funções novas: toda função aqui revoga anon explicitamente.

-- Foto no post (Storage, bucket post-media). Publicar exige foto ou texto.
alter table public.community_posts add column if not exists image_url text;
alter table public.community_posts alter column body set default '';
alter table public.community_posts drop constraint if exists community_posts_body_len;
alter table public.community_posts drop constraint if exists community_posts_content;
alter table public.community_posts
  add constraint community_posts_content check (
    char_length(body) <= 1000
    and (char_length(btrim(body)) > 0 or image_url is not null)
  );
alter table public.community_posts drop constraint if exists community_posts_image_url;
alter table public.community_posts
  add constraint community_posts_image_url check (image_url is null or image_url ~ '^https://[^\s]+$');

-- Fotos: leitura pública (como os avatares), escrita e remoção só na pasta da própria pessoa.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists post_media_read on storage.objects;
create policy post_media_read on storage.objects
  for select to public using (bucket_id = 'post-media');

drop policy if exists post_media_insert_own on storage.objects;
create policy post_media_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists post_media_delete_own on storage.objects;
create policy post_media_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Feed com foto e com o escopo 'post' (uma publicação pelo id).
drop function if exists public.community_feed(text, uuid, timestamptz, int);
create or replace function public.community_feed(
  p_scope text default 'all', p_user uuid default null, p_before timestamptz default null,
  p_limit int default 30, p_post uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  lim int := least(greatest(coalesce(p_limit, 30), 1), 50);
  before_ts timestamptz := coalesce(p_before, now() + interval '1 minute');
  followed uuid[];
begin
  if viewer is null then return '[]'::jsonb; end if;
  select coalesce(array_agg(followee_id), '{}') into followed from public.follows where follower_id = viewer;

  return coalesce((
    select jsonb_agg(item order by at desc)
    from (
      select at, item from (
        select po.created_at as at, jsonb_build_object(
          'kind', 'post', 'id', po.id, 'at', po.created_at, 'body', po.body, 'image_url', po.image_url,
          'catalog_id', po.catalog_id,
          'book', case when c.id is not null then jsonb_build_object('title', c.title, 'author', c.author) end,
          'author', public.community_author(po.user_id),
          'likes', (select count(*) from public.post_likes l where l.post_id = po.id),
          'liked', exists (select 1 from public.post_likes l where l.post_id = po.id and l.user_id = viewer),
          'comments', (select count(*) from public.post_comments m where m.post_id = po.id),
          'mine', po.user_id = viewer
        ) as item
        from public.community_posts po
        join public.profiles pr on pr.user_id = po.user_id
        left join public.catalog_books c on c.id = po.catalog_id
        where po.created_at < before_ts
          and ((pr.is_public and pr.handle is not null) or po.user_id = viewer)
          and (
            p_scope = 'all'
            or (p_scope = 'following' and (po.user_id = viewer or po.user_id = any(followed)))
            or (p_scope = 'user' and po.user_id = p_user)
            or (p_scope = 'post' and po.id = p_post)
          )
        order by po.created_at desc
        limit lim
      ) posts
      union all
      select at, item from (
        select ev.at, jsonb_build_object(
          'kind', ev.kind, 'id', ev.kind || ':' || ev.book_id, 'at', ev.at, 'catalog_id', ev.catalog_id,
          'book', jsonb_build_object('title', ev.title, 'author', ev.author),
          'author', public.community_author(ev.user_id)
        ) as item
        from (
          select b.user_id, b.id as book_id, b.title, b.author, l.catalog_id, 'started'::text as kind, b.created_at as at
          from public.books b left join public.book_links l on l.book_id = b.id
          union all
          select b.user_id, b.id, b.title, b.author, l.catalog_id, 'finished', b.last_read
          from public.books b left join public.book_links l on l.book_id = b.id
          where b.progress >= 1
        ) ev
        join public.profiles pr on pr.user_id = ev.user_id
        where p_scope in ('all', 'following', 'user')
          and pr.is_public and pr.handle is not null and pr.show_shelf
          and ev.at is not null and ev.at < before_ts and ev.at > now() - interval '60 days'
          and (
            p_scope = 'all'
            or (p_scope = 'following' and (ev.user_id = viewer or ev.user_id = any(followed)))
            or (p_scope = 'user' and ev.user_id = p_user)
          )
        order by ev.at desc
        limit lim
      ) events
      order by at desc
      limit lim
    ) feed
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.community_feed(text, uuid, timestamptz, int, uuid) from public, anon;
grant execute on function public.community_feed(text, uuid, timestamptz, int, uuid) to authenticated;
