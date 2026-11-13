-- Dados da galeria para filtros e ordenação: leitores (total e nos últimos 30 dias),
-- média e número de avaliações, e páginas já ilustradas (qualquer estilo).
-- Mantém o formato antigo (readers, faces) e só acrescenta campos.
begin;

create or replace function public.catalog_social()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ids as (
    select catalog_id from public.book_links where catalog_id is not null
    union select catalog_id from public.book_reviews
    union select catalog_id from public.catalog_comic_pages
  )
  select coalesce(jsonb_object_agg(i.catalog_id, jsonb_build_object(
    'readers', coalesce(r.readers, 0),
    'recent', coalesce(r.recent, 0),
    'rating', v.rating,
    'ratings', coalesce(v.ratings, 0),
    'illustrated', coalesce(c.pages, 0),
    'faces', coalesce((
      select jsonb_agg(public.community_author(f.user_id))
      from (
        select distinct l2.user_id
        from public.book_links l2
        join public.profiles p2 on p2.user_id = l2.user_id
        where l2.catalog_id = i.catalog_id and p2.is_public and p2.handle is not null and p2.show_shelf
        limit 3
      ) f
    ), '[]'::jsonb)
  )), '{}'::jsonb)
  from ids i
  left join (
    select catalog_id, count(distinct user_id) as readers,
      count(distinct user_id) filter (where updated_at > now() - interval '30 days') as recent
    from public.book_links group by catalog_id
  ) r on r.catalog_id = i.catalog_id
  left join (
    select catalog_id, round(avg(rating)::numeric, 1) as rating, count(*) as ratings
    from public.book_reviews group by catalog_id
  ) v on v.catalog_id = i.catalog_id
  left join (
    select catalog_id, count(distinct page) as pages from public.catalog_comic_pages group by catalog_id
  ) c on c.catalog_id = i.catalog_id
  where auth.uid() is not null;
$$;
revoke all on function public.catalog_social() from public, anon;
grant execute on function public.catalog_social() to authenticated;

do $$ begin
  if has_function_privilege('anon', 'public.catalog_social()', 'execute') then raise exception 'catalog_social aberto para anon'; end if;
end $$;

commit;
