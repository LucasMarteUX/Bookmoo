-- Comunidade como rede social: banner do perfil, seguir, publicações, curtidas, comentários,
-- feed (publicações + quem começou e terminou livros) e leitores por livro da galeria.
-- Leituras de outras pessoas passam por funções que só mostram perfis abertos.
-- O Supabase dá execute ao anon em funções novas: toda função aqui revoga anon explicitamente.

-- Banner do perfil: um dos modelos do app (id curto).
alter table public.profiles add column if not exists banner text;
alter table public.profiles drop constraint if exists profiles_banner_format;
alter table public.profiles
  add constraint profiles_banner_format check (banner is null or banner ~ '^[a-z0-9-]{1,24}$');

-- Perfil aberto = público e com @. Usada nas políticas, por isso o authenticated executa.
create or replace function public.is_open_profile(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where user_id = p_user and is_public and handle is not null);
$$;
revoke all on function public.is_open_profile(uuid) from public, anon;
grant execute on function public.is_open_profile(uuid) to authenticated;

-- Cartão curto de quem publicou. Interna.
create or replace function public.community_author(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'user_id', p.user_id, 'handle', p.handle, 'name', p.username, 'avatar_url', p.avatar_url,
    'level', coalesce(p.placement_level, 'A1'), 'banner', p.banner, 'updated_at', p.updated_at
  )
  from public.profiles p where p.user_id = p_user;
$$;
revoke all on function public.community_author(uuid) from public, anon, authenticated;

-- Seguir: sem aprovação, só perfis abertos. Perfil fechado não aparece para ninguém.
create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id);
alter table public.follows enable row level security;

drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows
  for select to authenticated
  using (follower_id = auth.uid() or followee_id = auth.uid());

drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows
  for insert to authenticated
  with check (follower_id = auth.uid() and public.is_open_profile(followee_id));

drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows
  for delete to authenticated
  using (follower_id = auth.uid());

-- Publicações. Só quem tem perfil aberto publica; outras pessoas leem pelo feed.
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  catalog_id uuid references public.catalog_books(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint community_posts_body_len check (char_length(btrim(body)) between 1 and 1000)
);
create index if not exists community_posts_created_idx on public.community_posts (created_at desc);
create index if not exists community_posts_user_idx on public.community_posts (user_id, created_at desc);
alter table public.community_posts enable row level security;

drop policy if exists community_posts_own_read on public.community_posts;
create policy community_posts_own_read on public.community_posts
  for select to authenticated using (user_id = auth.uid());

drop policy if exists community_posts_insert on public.community_posts;
create policy community_posts_insert on public.community_posts
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_open_profile(auth.uid()));

drop policy if exists community_posts_delete on public.community_posts;
create policy community_posts_delete on public.community_posts
  for delete to authenticated
  using (user_id = auth.uid() or public.is_global_admin());

create table if not exists public.post_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_likes enable row level security;

drop policy if exists post_likes_own on public.post_likes;
create policy post_likes_own on public.post_likes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint post_comments_body_len check (char_length(btrim(body)) between 1 and 500)
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);
alter table public.post_comments enable row level security;

drop policy if exists post_comments_own_read on public.post_comments;
create policy post_comments_own_read on public.post_comments
  for select to authenticated using (user_id = auth.uid());

drop policy if exists post_comments_insert on public.post_comments;
create policy post_comments_insert on public.post_comments
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_open_profile(auth.uid()));

-- Apaga quem escreveu, quem é dono da publicação ou o admin.
drop policy if exists post_comments_delete on public.post_comments;
create policy post_comments_delete on public.post_comments
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.community_posts p where p.id = post_id and p.user_id = auth.uid())
    or public.is_global_admin()
  );

-- Limite simples contra spam: 20 publicações e 60 comentários por hora.
create or replace function public.community_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent int;
begin
  if tg_table_name = 'community_posts' then
    select count(*) into recent from public.community_posts where user_id = new.user_id and created_at > now() - interval '1 hour';
    if recent >= 20 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  else
    select count(*) into recent from public.post_comments where user_id = new.user_id and created_at > now() - interval '1 hour';
    if recent >= 60 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.community_rate_limit() from public, anon, authenticated;

drop trigger if exists community_posts_rate on public.community_posts;
create trigger community_posts_rate before insert on public.community_posts
  for each row execute function public.community_rate_limit();
drop trigger if exists post_comments_rate on public.post_comments;
create trigger post_comments_rate before insert on public.post_comments
  for each row execute function public.community_rate_limit();

-- Mapa de estudo de um ano (o perfil mostra até 53 semanas).
create or replace function public.profile_stats(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  points bigint := 0;
  active_days date[] := '{}';
  heat jsonb := '{}'::jsonb;
  words bigint := 0;
  learned bigint := 0;
  minutes bigint := 0;
  finished bigint := 0;
  reading bigint := 0;
  streak int := 0;
  cursor_day date;
begin
  begin
    select coalesce(sum(amount), 0) into points from xp_events where user_id = p_user;
    select coalesce(array_agg(distinct (created_at at time zone 'America/Sao_Paulo')::date), '{}')
      into active_days from xp_events where user_id = p_user;
    select coalesce(jsonb_object_agg(day, total), '{}'::jsonb) into heat
      from (
        select (created_at at time zone 'America/Sao_Paulo')::date as day, sum(amount) as total
        from xp_events
        where user_id = p_user and created_at >= now() - interval '372 days'
        group by 1
      ) d;
  exception when undefined_table then null;
  end;

  select count(*), count(*) filter (where status = 'learned') into words, learned
    from vocabulary where user_id = p_user;

  begin
    select coalesce(sum(seconds), 0) / 60 into minutes from study_days where user_id = p_user;
  exception when undefined_table then null;
  end;

  select count(*) filter (where progress >= 1), count(*) filter (where progress > 0 and progress < 1)
    into finished, reading
    from books where user_id = p_user;

  cursor_day := case when today = any(active_days) then today else today - 1 end;
  while cursor_day = any(active_days) loop
    streak := streak + 1;
    cursor_day := cursor_day - 1;
  end loop;

  return jsonb_build_object(
    'points', points, 'streak', streak, 'words', words, 'learned', learned,
    'minutes', minutes, 'books_finished', finished, 'books_reading', reading, 'days', heat
  );
end;
$$;
revoke all on function public.profile_stats(uuid) from public, anon, authenticated;

-- Perfil completo. A estante não traz capas (uma capa enviada passa de 300 KB): o app pede cada uma com shelf_cover.
create or replace function public.community_profile(p_handle text default null, p_user uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  p public.profiles;
  is_owner boolean;
  result jsonb;
begin
  if viewer is null then return null; end if;

  if p_handle is not null then
    select * into p from public.profiles where handle = lower(btrim(p_handle));
  else
    select * into p from public.profiles where user_id = coalesce(p_user, viewer);
  end if;
  if not found then return null; end if;

  is_owner := p.user_id = viewer;
  if not p.is_public and not is_owner then return null; end if;

  result := jsonb_build_object(
    'user_id', p.user_id,
    'handle', p.handle,
    'name', p.username,
    'bio', p.bio,
    'goal', p.goal,
    'avatar_url', p.avatar_url,
    'banner', p.banner,
    'level', coalesce(p.placement_level, 'A1'),
    'leveled', p.placement_level is not null,
    'is_public', p.is_public,
    'is_owner', is_owner,
    'show_shelf', p.show_shelf,
    'show_stats', p.show_stats,
    'show_socials', p.show_socials,
    'show_studying', p.show_studying,
    'followers', (select count(*) from public.follows f where f.followee_id = p.user_id),
    'following', (select count(*) from public.follows f where f.follower_id = p.user_id),
    'is_following', exists (select 1 from public.follows f where f.follower_id = viewer and f.followee_id = p.user_id),
    'posts', (select count(*) from public.community_posts c where c.user_id = p.user_id),
    'updated_at', p.updated_at
  );

  if is_owner or p.show_socials then
    result := result || jsonb_build_object('socials', p.socials);
  end if;

  if is_owner or p.show_stats then
    result := result || jsonb_build_object('stats', public.profile_stats(p.user_id));
  end if;

  if is_owner or p.show_shelf then
    result := result || jsonb_build_object('shelf', (
      select coalesce(jsonb_agg(item order by item->>'last_read' desc nulls last), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', b.id,
          'title', b.title,
          'author', b.author,
          'progress', round(coalesce(b.progress, 0) * 100),
          'last_read', b.last_read,
          'catalog_id', l.catalog_id,
          'has_cover', coalesce(c.cover_data, b.cover_data) is not null
        ) as item
        from public.books b
        left join public.book_links l on l.book_id = b.id
        left join public.catalog_books c on c.id = l.catalog_id
        where b.user_id = p.user_id
        order by b.last_read desc nulls last
        limit 36
      ) s
    ));
  end if;

  if is_owner or p.show_studying then
    result := result || jsonb_build_object('studying', (
      select coalesce(jsonb_agg(v.text order by v.created_at desc), '[]'::jsonb)
      from (
        select text, created_at from public.vocabulary
        where user_id = p.user_id and status in ('review', 'important')
        order by created_at desc
        limit 16
      ) v
    ));
  end if;

  return result;
end;
$$;
revoke all on function public.community_profile(text, uuid) from public, anon;
grant execute on function public.community_profile(text, uuid) to authenticated;

-- Capa de um livro da estante, com as mesmas regras do perfil.
create or replace function public.shelf_cover(p_book uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(c.cover_data, b.cover_data)
  from public.books b
  join public.profiles p on p.user_id = b.user_id
  left join public.book_links l on l.book_id = b.id
  left join public.catalog_books c on c.id = l.catalog_id
  where b.id = p_book
    and auth.uid() is not null
    and (b.user_id = auth.uid() or (p.is_public and p.show_shelf));
$$;
revoke all on function public.shelf_cover(uuid) from public, anon;
grant execute on function public.shelf_cover(uuid) to authenticated;

-- Pessoas com perfil aberto.
create or replace function public.community_people()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(person order by updated_at desc), '[]'::jsonb)
  from (
    select
      p.updated_at,
      public.community_author(p.user_id) || jsonb_build_object(
        'bio', p.bio,
        'followers', (select count(*) from public.follows f where f.followee_id = p.user_id),
        'is_following', exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.user_id),
        'is_me', p.user_id = auth.uid(),
        'reading', case when p.show_shelf then (
          select b.title from public.books b
          where b.user_id = p.user_id and b.progress > 0 and b.progress < 1
          order by b.last_read desc nulls last
          limit 1
        ) end
      ) as person
    from public.profiles p
    where p.is_public and p.handle is not null and auth.uid() is not null
    order by p.updated_at desc
    limit 80
  ) people;
$$;
revoke all on function public.community_people() from public, anon;
grant execute on function public.community_people() to authenticated;

-- Feed: publicações e quem começou ou terminou um livro (últimos 60 dias).
-- p_scope: 'all' (toda a comunidade), 'following' (quem eu sigo e eu) ou 'user' (uma pessoa).
create or replace function public.community_feed(
  p_scope text default 'all', p_user uuid default null, p_before timestamptz default null, p_limit int default 30
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
          'kind', 'post', 'id', po.id, 'at', po.created_at, 'body', po.body, 'catalog_id', po.catalog_id,
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
        where pr.is_public and pr.handle is not null and pr.show_shelf
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
revoke all on function public.community_feed(text, uuid, timestamptz, int) from public, anon;
grant execute on function public.community_feed(text, uuid, timestamptz, int) to authenticated;

-- Comentários de uma publicação visível.
create or replace function public.community_comments(p_post uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'at', m.created_at, 'body', m.body,
    'author', public.community_author(m.user_id),
    'can_delete', m.user_id = auth.uid() or po.user_id = auth.uid()
  ) order by m.created_at), '[]'::jsonb)
  from public.post_comments m
  join public.community_posts po on po.id = m.post_id
  join public.profiles pr on pr.user_id = po.user_id
  where m.post_id = p_post
    and auth.uid() is not null
    and ((pr.is_public and pr.handle is not null) or po.user_id = auth.uid());
$$;
revoke all on function public.community_comments(uuid) from public, anon;
grant execute on function public.community_comments(uuid) to authenticated;

-- Leitores por livro da galeria: total e até 3 rostos de perfis abertos.
create or replace function public.catalog_social()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(s.catalog_id, jsonb_build_object('readers', s.readers, 'faces', s.faces)), '{}'::jsonb)
  from (
    select
      l.catalog_id,
      count(distinct l.user_id) as readers,
      coalesce((
        select jsonb_agg(public.community_author(r.user_id))
        from (
          select distinct l2.user_id
          from public.book_links l2
          join public.profiles p2 on p2.user_id = l2.user_id
          where l2.catalog_id = l.catalog_id and p2.is_public and p2.handle is not null and p2.show_shelf
          limit 3
        ) r
      ), '[]'::jsonb) as faces
    from public.book_links l
    where auth.uid() is not null
    group by l.catalog_id
  ) s;
$$;
revoke all on function public.catalog_social() from public, anon;
grant execute on function public.catalog_social() to authenticated;
