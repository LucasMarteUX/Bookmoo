-- Bookmoo Social: seguir com aprovação, amizades, bloqueio, denúncias, notificações,
-- avaliações e resenhas, metas, estante e eventos de leitura.
-- Todas as pessoas são o id do Supabase Auth (auth.users.id). Nenhum id paralelo.
-- O Supabase dá execute ao anon em funções novas: toda função aqui revoga anon explicitamente.
-- Documento: docs/SOCIAL_ARQUITETURA.md

-- ───────────────────────── Perfil ─────────────────────────
alter table public.profiles
  add column if not exists cover_url text,
  add column if not exists share_reading boolean not null default false,
  add column if not exists share_progress boolean not null default false,
  add column if not exists share_goals boolean not null default false;

alter table public.profiles drop constraint if exists profiles_cover_url;
alter table public.profiles add constraint profiles_cover_url check (cover_url is null or cover_url ~ '^https://[^\s]+$');

-- Quem já mostrava a estante num perfil aberto já via "começou/terminou" no feed: mantém.
update public.profiles set share_reading = true where is_public and show_shelf and not share_reading;

-- ───────────────────────── Livros ─────────────────────────
alter table public.books
  add column if not exists finished_at timestamptz,
  add column if not exists shelf_status text,
  add column if not exists favorite boolean not null default false;

alter table public.books drop constraint if exists books_shelf_status;
alter table public.books add constraint books_shelf_status check (shelf_status is null or shelf_status in ('abandoned'));

update public.books set finished_at = coalesce(last_read, updated_at, created_at) where progress >= 1 and finished_at is null;
create index if not exists books_user_finished_idx on public.books (user_id, finished_at) where finished_at is not null;

-- Data de conclusão: marcada uma vez e nunca apagada (reler não "desconclui").
create or replace function public.books_mark_finished()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.progress, 0) >= 1 and new.finished_at is null then
    new.finished_at := now();
  end if;
  if tg_op = 'UPDATE' and old.finished_at is not null and new.finished_at is null then
    new.finished_at := old.finished_at;
  end if;
  return new;
end;
$$;
revoke all on function public.books_mark_finished() from public, anon, authenticated;

drop trigger if exists books_mark_finished on public.books;
create trigger books_mark_finished before insert or update of progress, finished_at on public.books
  for each row execute function public.books_mark_finished();

-- ───────────────────────── Relações ─────────────────────────
create or replace function public.has_handle(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = p_user and handle is not null);
$$;
revoke all on function public.has_handle(uuid) from public, anon;
grant execute on function public.has_handle(uuid) to authenticated;

create table if not exists public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);
alter table public.blocks enable row level security;

drop policy if exists blocks_own on public.blocks;
create policy blocks_own on public.blocks
  for all to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid());

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;
revoke all on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

-- Seguir: 'accepted' na hora para perfil aberto, 'pending' para perfil fechado.
alter table public.follows add column if not exists status text not null default 'accepted';
alter table public.follows drop constraint if exists follows_status;
alter table public.follows add constraint follows_status check (status in ('accepted', 'pending'));

create or replace function public.follows_accepted(f uuid, t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.follows where follower_id = f and followee_id = t and status = 'accepted');
$$;
revoke all on function public.follows_accepted(uuid, uuid) from public, anon;
grant execute on function public.follows_accepted(uuid, uuid) to authenticated;

create table if not exists public.friend_requests (
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (requester_id, addressee_id),
  constraint friend_requests_not_self check (requester_id <> addressee_id),
  constraint friend_requests_status check (status in ('pending', 'accepted'))
);
-- Um registro por par, em qualquer direção.
create unique index if not exists friend_requests_pair_key on public.friend_requests (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friend_requests_addressee_idx on public.friend_requests (addressee_id, status);
alter table public.friend_requests enable row level security;

create or replace function public.is_friend(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friend_requests
    where status = 'accepted' and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a))
  );
$$;
revoke all on function public.is_friend(uuid, uuid) from public, anon;
grant execute on function public.is_friend(uuid, uuid) to authenticated;

-- Pode ver o conteúdo do perfil (estante, resultados, publicações): dona, perfil aberto, ou
-- perfil fechado com seguidor aprovado ou amizade. Bloqueio corta tudo.
create or replace function public.can_view_profile(viewer uuid, owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select viewer is not null and (
    viewer = owner
    or (
      exists (
        select 1 from public.profiles p
        where p.user_id = owner and p.handle is not null
          and (p.is_public or public.follows_accepted(viewer, owner) or public.is_friend(viewer, owner))
      )
      and not public.is_blocked_between(viewer, owner)
    )
  );
$$;
revoke all on function public.can_view_profile(uuid, uuid) from public, anon;
grant execute on function public.can_view_profile(uuid, uuid) to authenticated;

drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows
  for select to authenticated
  using (follower_id = auth.uid() or followee_id = auth.uid());

drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows
  for insert to authenticated
  with check (follower_id = auth.uid() and public.has_handle(followee_id) and not public.is_blocked_between(follower_id, followee_id));

-- Só quem é seguido aprova um pedido.
drop policy if exists follows_approve on public.follows;
create policy follows_approve on public.follows
  for update to authenticated
  using (followee_id = auth.uid())
  with check (followee_id = auth.uid() and status = 'accepted');

-- Deixar de seguir, cancelar pedido, recusar pedido ou remover seguidor.
drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows
  for delete to authenticated
  using (follower_id = auth.uid() or followee_id = auth.uid());

create or replace function public.follows_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.status := case when exists (select 1 from public.profiles where user_id = new.followee_id and is_public) then 'accepted' else 'pending' end;
    new.created_at := now();
  else
    -- Na atualização só o status muda.
    new.follower_id := old.follower_id;
    new.followee_id := old.followee_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
revoke all on function public.follows_guard() from public, anon, authenticated;
drop trigger if exists follows_guard on public.follows;
create trigger follows_guard before insert or update on public.follows
  for each row execute function public.follows_guard();

drop policy if exists friend_requests_read on public.friend_requests;
create policy friend_requests_read on public.friend_requests
  for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists friend_requests_insert on public.friend_requests;
create policy friend_requests_insert on public.friend_requests
  for insert to authenticated
  with check (
    requester_id = auth.uid() and status = 'pending'
    and public.has_handle(requester_id) and public.has_handle(addressee_id)
    and not public.is_blocked_between(requester_id, addressee_id)
  );

drop policy if exists friend_requests_accept on public.friend_requests;
create policy friend_requests_accept on public.friend_requests
  for update to authenticated
  using (addressee_id = auth.uid())
  with check (addressee_id = auth.uid() and status = 'accepted');

drop policy if exists friend_requests_delete on public.friend_requests;
create policy friend_requests_delete on public.friend_requests
  for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Pedido cruzado vira amizade: se a outra pessoa já tinha pedido, aceita o pedido dela.
create or replace function public.friend_requests_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.friend_requests where requester_id = new.addressee_id and addressee_id = new.requester_id and status = 'pending') then
      update public.friend_requests set status = 'accepted', responded_at = now()
        where requester_id = new.addressee_id and addressee_id = new.requester_id;
      return null;
    end if;
    new.status := 'pending';
    new.created_at := now();
    new.responded_at := null;
  else
    new.requester_id := old.requester_id;
    new.addressee_id := old.addressee_id;
    new.created_at := old.created_at;
    if new.status = 'accepted' and old.status <> 'accepted' then new.responded_at := now(); end if;
  end if;
  return new;
end;
$$;
revoke all on function public.friend_requests_guard() from public, anon, authenticated;
drop trigger if exists friend_requests_guard on public.friend_requests;
create trigger friend_requests_guard before insert or update on public.friend_requests
  for each row execute function public.friend_requests_guard();

-- Bloquear desfaz seguir e amizade nos dois sentidos.
create or replace function public.blocks_cleanup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.follows
    where (follower_id = new.blocker_id and followee_id = new.blocked_id) or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  delete from public.friend_requests
    where (requester_id = new.blocker_id and addressee_id = new.blocked_id) or (requester_id = new.blocked_id and addressee_id = new.blocker_id);
  return null;
end;
$$;
revoke all on function public.blocks_cleanup() from public, anon, authenticated;
drop trigger if exists blocks_cleanup on public.blocks;
create trigger blocks_cleanup after insert on public.blocks
  for each row execute function public.blocks_cleanup();

-- ───────────────────────── Avaliações e resenhas ─────────────────────────
create table if not exists public.book_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  catalog_id uuid not null references public.catalog_books(id) on delete cascade,
  rating numeric(2, 1) not null,
  title text,
  body text,
  spoiler boolean not null default false,
  visibility text not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint book_reviews_one_per_book unique (user_id, catalog_id),
  constraint book_reviews_rating check (rating between 0.5 and 5 and (rating * 2) = trunc(rating * 2)),
  constraint book_reviews_title_len check (title is null or char_length(title) <= 120),
  constraint book_reviews_body_len check (body is null or char_length(body) <= 4000),
  constraint book_reviews_visibility check (visibility in ('public', 'followers', 'friends', 'private'))
);
create index if not exists book_reviews_catalog_idx on public.book_reviews (catalog_id, updated_at desc);
alter table public.book_reviews enable row level security;

-- A pessoa mexe nas dela; leitura de outras pessoas só pelas funções.
drop policy if exists book_reviews_own on public.book_reviews;
create policy book_reviews_own on public.book_reviews
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.has_handle(user_id));

-- ───────────────────────── Metas ─────────────────────────
create table if not exists public.reading_goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  year int not null,
  target int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, year),
  constraint reading_goals_target check (target between 1 and 500),
  constraint reading_goals_year check (year between 2000 and 2100)
);
alter table public.reading_goals enable row level security;

drop policy if exists reading_goals_own on public.reading_goals;
create policy reading_goals_own on public.reading_goals
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ───────────────────────── Publicações ─────────────────────────
alter table public.community_posts
  add column if not exists kind text not null default 'post',
  add column if not exists audience text not null default 'public',
  add column if not exists book_id uuid,
  add column if not exists book_title text,
  add column if not exists book_author text,
  add column if not exists milestone int,
  add column if not exists review_id uuid references public.book_reviews(id) on delete cascade,
  add column if not exists edited_at timestamptz,
  add column if not exists hidden_at timestamptz;

alter table public.community_posts drop constraint if exists community_posts_kind;
alter table public.community_posts add constraint community_posts_kind check (kind in ('post', 'started', 'progress', 'finished', 'review', 'goal'));
alter table public.community_posts drop constraint if exists community_posts_audience;
alter table public.community_posts add constraint community_posts_audience check (audience in ('public', 'followers', 'friends'));

-- Post manual precisa de texto ou foto; eventos automáticos não.
alter table public.community_posts drop constraint if exists community_posts_content;
alter table public.community_posts
  add constraint community_posts_content check (
    char_length(body) <= 1000
    and (kind <> 'post' or char_length(btrim(body)) > 0 or image_url is not null)
  );

-- Um evento por livro e marco; uma meta por ano; um post por resenha.
create unique index if not exists community_posts_event_key on public.community_posts (user_id, kind, book_id, milestone)
  where kind in ('started', 'progress', 'finished');
create unique index if not exists community_posts_goal_key on public.community_posts (user_id, milestone) where kind = 'goal';
create unique index if not exists community_posts_review_key on public.community_posts (review_id) where review_id is not null;

-- Posts antigos de "começou" e "terminou" eram calculados na leitura. Agora viram registros.
insert into public.community_posts (user_id, kind, body, book_id, book_title, book_author, catalog_id, milestone, created_at)
select b.user_id, 'started', '', b.id, b.title, b.author, l.catalog_id, 0, b.created_at
from public.books b
join public.profiles p on p.user_id = b.user_id and p.share_reading and p.handle is not null
left join public.book_links l on l.book_id = b.id
where b.progress > 0
on conflict do nothing;

insert into public.community_posts (user_id, kind, body, book_id, book_title, book_author, catalog_id, milestone, created_at)
select b.user_id, 'finished', '', b.id, b.title, b.author, l.catalog_id, 0, b.finished_at
from public.books b
join public.profiles p on p.user_id = b.user_id and p.share_reading and p.handle is not null
left join public.book_links l on l.book_id = b.id
where b.finished_at is not null
on conflict do nothing;

-- O evento aparece só enquanto a pessoa continua compartilhando aquele tipo.
create or replace function public.post_sharing_on(p_user uuid, p_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_kind in ('post', 'review') then true
    when p_kind in ('started', 'finished') then coalesce((select share_reading from public.profiles where user_id = p_user), false)
    when p_kind = 'progress' then coalesce((select share_reading and share_progress from public.profiles where user_id = p_user), false)
    when p_kind = 'goal' then coalesce((select share_goals from public.profiles where user_id = p_user), false)
    else false
  end;
$$;
revoke all on function public.post_sharing_on(uuid, text) from public, anon;
grant execute on function public.post_sharing_on(uuid, text) to authenticated;

create or replace function public.can_view_post(viewer uuid, p_post uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.community_posts po
    where po.id = p_post and (
      po.user_id = viewer
      or (
        po.hidden_at is null
        and public.can_view_profile(viewer, po.user_id)
        and public.post_sharing_on(po.user_id, po.kind)
        and (
          po.audience = 'public'
          or (po.audience = 'followers' and (public.follows_accepted(viewer, po.user_id) or public.is_friend(viewer, po.user_id)))
          or (po.audience = 'friends' and public.is_friend(viewer, po.user_id))
        )
      )
    )
  );
$$;
revoke all on function public.can_view_post(uuid, uuid) from public, anon;
grant execute on function public.can_view_post(uuid, uuid) to authenticated;

-- Publicar: qualquer pessoa com @ (perfil fechado publica para quem ela aprovou). Só posts manuais.
drop policy if exists community_posts_insert on public.community_posts;
create policy community_posts_insert on public.community_posts
  for insert to authenticated
  with check (user_id = auth.uid() and kind = 'post' and public.has_handle(auth.uid()));

drop policy if exists community_posts_update on public.community_posts;
create policy community_posts_update on public.community_posts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Editar muda só texto, foto, livro e audiência. Nada de trocar dona, tipo ou data.
create or replace function public.community_posts_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.hidden_at := null;
      new.edited_at := null;
      new.review_id := null;
      new.created_at := now();
    else
      new.user_id := old.user_id;
      new.kind := old.kind;
      new.created_at := old.created_at;
      new.review_id := old.review_id;
      new.hidden_at := old.hidden_at;
      new.book_id := old.book_id;
      new.milestone := old.milestone;
      if new.body is distinct from old.body or new.image_url is distinct from old.image_url
        or new.catalog_id is distinct from old.catalog_id or new.audience is distinct from old.audience then
        new.edited_at := now();
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.community_posts_guard() from public, anon, authenticated;
drop trigger if exists community_posts_guard on public.community_posts;
create trigger community_posts_guard before insert or update on public.community_posts
  for each row execute function public.community_posts_guard();

-- Curtir: só o que a pessoa pode ver.
drop policy if exists post_likes_own on public.post_likes;
drop policy if exists post_likes_read on public.post_likes;
create policy post_likes_read on public.post_likes for select to authenticated using (user_id = auth.uid());
drop policy if exists post_likes_insert on public.post_likes;
create policy post_likes_insert on public.post_likes for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_post(auth.uid(), post_id));
drop policy if exists post_likes_delete on public.post_likes;
create policy post_likes_delete on public.post_likes for delete to authenticated using (user_id = auth.uid());

-- Comentários com resposta de um nível.
alter table public.post_comments add column if not exists parent_id uuid references public.post_comments(id) on delete cascade;
create index if not exists post_comments_parent_idx on public.post_comments (parent_id) where parent_id is not null;

drop policy if exists post_comments_insert on public.post_comments;
create policy post_comments_insert on public.post_comments
  for insert to authenticated
  with check (user_id = auth.uid() and public.has_handle(auth.uid()) and public.can_view_post(auth.uid(), post_id));

create or replace function public.post_comments_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  parent public.post_comments;
begin
  if new.parent_id is not null then
    select * into parent from public.post_comments where id = new.parent_id;
    if not found or parent.post_id <> new.post_id then raise exception 'invalid_parent' using errcode = '23514'; end if;
    -- Resposta de resposta vira resposta ao comentário principal (um nível só).
    if parent.parent_id is not null then new.parent_id := parent.parent_id; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.post_comments_guard() from public, anon, authenticated;
drop trigger if exists post_comments_guard on public.post_comments;
create trigger post_comments_guard before insert on public.post_comments
  for each row execute function public.post_comments_guard();

-- Limites por hora: posts, comentários, pedidos de amizade e denúncias.
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
    if new.kind <> 'post' then return new; end if;
    select count(*) into recent from public.community_posts where user_id = new.user_id and kind = 'post' and created_at > now() - interval '1 hour';
    if recent >= 20 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  elsif tg_table_name = 'post_comments' then
    select count(*) into recent from public.post_comments where user_id = new.user_id and created_at > now() - interval '1 hour';
    if recent >= 60 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  elsif tg_table_name = 'friend_requests' then
    select count(*) into recent from public.friend_requests where requester_id = new.requester_id and created_at > now() - interval '1 hour';
    if recent >= 30 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  elsif tg_table_name = 'reports' then
    select count(*) into recent from public.reports where reporter_id = new.reporter_id and created_at > now() - interval '1 hour';
    if recent >= 20 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.community_rate_limit() from public, anon, authenticated;

drop trigger if exists friend_requests_rate on public.friend_requests;
create trigger friend_requests_rate before insert on public.friend_requests
  for each row execute function public.community_rate_limit();

-- ───────────────────────── Eventos de leitura (servidor) ─────────────────────────
create or replace function public.books_social_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles;
  old_p numeric := case when tg_op = 'UPDATE' then coalesce(old.progress, 0) else 0 end;
  new_p numeric := coalesce(new.progress, 0);
  cat uuid;
  m int;
  yr int;
  goal int;
  done int;
begin
  if new_p = old_p then return null; end if;
  select * into p from public.profiles where user_id = new.user_id;
  if not found or p.handle is null then return null; end if;
  select catalog_id into cat from public.book_links where book_id = new.id;

  if p.share_reading then
    if old_p = 0 and new_p > 0 then
      insert into public.community_posts (user_id, kind, body, book_id, book_title, book_author, catalog_id, milestone)
      values (new.user_id, 'started', '', new.id, new.title, new.author, cat, 0) on conflict do nothing;
    end if;
    if p.share_progress and new_p < 1 then
      foreach m in array array[25, 50, 75] loop
        if old_p * 100 < m and new_p * 100 >= m then
          insert into public.community_posts (user_id, kind, body, book_id, book_title, book_author, catalog_id, milestone)
          values (new.user_id, 'progress', '', new.id, new.title, new.author, cat, m) on conflict do nothing;
        end if;
      end loop;
    end if;
    if old_p < 1 and new_p >= 1 then
      insert into public.community_posts (user_id, kind, body, book_id, book_title, book_author, catalog_id, milestone)
      values (new.user_id, 'finished', '', new.id, new.title, new.author, cat, 0) on conflict do nothing;
    end if;
  end if;

  if p.share_goals and old_p < 1 and new_p >= 1 then
    yr := extract(year from now() at time zone 'America/Sao_Paulo')::int;
    select target into goal from public.reading_goals where user_id = new.user_id and year = yr;
    if goal is not null then
      select count(*) into done from public.books
        where user_id = new.user_id and finished_at is not null
          and extract(year from finished_at at time zone 'America/Sao_Paulo')::int = yr;
      if done >= goal then
        insert into public.community_posts (user_id, kind, body, milestone) values (new.user_id, 'goal', '', yr) on conflict do nothing;
      end if;
    end if;
  end if;
  return null;
end;
$$;
revoke all on function public.books_social_events() from public, anon, authenticated;
drop trigger if exists books_social_events on public.books;
create trigger books_social_events after insert or update of progress on public.books
  for each row execute function public.books_social_events();

-- Resenha publicada vira post (curtir e comentar reaproveitados). Privada some do feed.
create or replace function public.book_reviews_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.book_reviews_post() from public, anon, authenticated;
drop trigger if exists book_reviews_touch on public.book_reviews;
create trigger book_reviews_touch before update on public.book_reviews
  for each row execute function public.book_reviews_post();

create or replace function public.book_reviews_sync_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.visibility = 'private' then
    delete from public.community_posts where review_id = new.id;
    return null;
  end if;
  update public.community_posts
    set audience = case new.visibility when 'public' then 'public' when 'followers' then 'followers' else 'friends' end,
        catalog_id = new.catalog_id
    where review_id = new.id;
  if not found then
    insert into public.community_posts (user_id, kind, body, catalog_id, review_id, audience)
    values (new.user_id, 'review', '', new.catalog_id, new.id,
      case new.visibility when 'public' then 'public' when 'followers' then 'followers' else 'friends' end);
  end if;
  return null;
end;
$$;
revoke all on function public.book_reviews_sync_post() from public, anon, authenticated;
drop trigger if exists book_reviews_sync_post on public.book_reviews;
create trigger book_reviews_sync_post after insert or update on public.book_reviews
  for each row execute function public.book_reviews_sync_post();

-- ───────────────────────── Notificações ─────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  post_id uuid references public.community_posts(id) on delete cascade,
  comment_id uuid references public.post_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_type check (type in (
    'follow', 'follow_request', 'follow_accepted', 'friend_request', 'friend_accepted',
    'like', 'review_like', 'comment', 'reply'
  )),
  constraint notifications_not_self check (recipient_id <> actor_id)
);
create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create unique index if not exists notifications_dedupe_key on public.notifications (recipient_id, actor_id, type, post_id)
  where type in ('like', 'review_like');
create unique index if not exists notifications_relation_key on public.notifications (recipient_id, actor_id, type)
  where type in ('follow', 'follow_request', 'follow_accepted', 'friend_request', 'friend_accepted');
alter table public.notifications enable row level security;

drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select to authenticated using (recipient_id = auth.uid());
drop policy if exists notifications_mark on public.notifications;
create policy notifications_mark on public.notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete to authenticated using (recipient_id = auth.uid());

-- Marcar como lida muda só read_at.
create or replace function public.notifications_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.id := old.id; new.recipient_id := old.recipient_id; new.actor_id := old.actor_id; new.type := old.type;
    new.post_id := old.post_id; new.comment_id := old.comment_id; new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
revoke all on function public.notifications_guard() from public, anon, authenticated;
drop trigger if exists notifications_guard on public.notifications;
create trigger notifications_guard before update on public.notifications
  for each row execute function public.notifications_guard();

create or replace function public.notify(p_recipient uuid, p_actor uuid, p_type text, p_post uuid default null, p_comment uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_recipient is null or p_actor is null or p_recipient = p_actor then return; end if;
  if public.is_blocked_between(p_recipient, p_actor) then return; end if;
  insert into public.notifications (recipient_id, actor_id, type, post_id, comment_id)
  values (p_recipient, p_actor, p_type, p_post, p_comment)
  on conflict do nothing;
end;
$$;
revoke all on function public.notify(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;

create or replace function public.notify_follows()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.followee_id, new.follower_id, case when new.status = 'accepted' then 'follow' else 'follow_request' end);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    delete from public.notifications where recipient_id = new.followee_id and actor_id = new.follower_id and type = 'follow_request';
    perform public.notify(new.follower_id, new.followee_id, 'follow_accepted');
  elsif tg_op = 'DELETE' then
    delete from public.notifications where recipient_id = old.followee_id and actor_id = old.follower_id and type in ('follow', 'follow_request');
  end if;
  return null;
end;
$$;
revoke all on function public.notify_follows() from public, anon, authenticated;
drop trigger if exists notify_follows on public.follows;
create trigger notify_follows after insert or update or delete on public.follows
  for each row execute function public.notify_follows();

create or replace function public.notify_friends()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.addressee_id, new.requester_id, 'friend_request');
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    delete from public.notifications where recipient_id = new.addressee_id and actor_id = new.requester_id and type = 'friend_request';
    perform public.notify(new.requester_id, new.addressee_id, 'friend_accepted');
  elsif tg_op = 'DELETE' then
    delete from public.notifications
      where type in ('friend_request', 'friend_accepted')
        and ((recipient_id = old.addressee_id and actor_id = old.requester_id) or (recipient_id = old.requester_id and actor_id = old.addressee_id));
  end if;
  return null;
end;
$$;
revoke all on function public.notify_friends() from public, anon, authenticated;
drop trigger if exists notify_friends on public.friend_requests;
create trigger notify_friends after insert or update or delete on public.friend_requests
  for each row execute function public.notify_friends();

create or replace function public.notify_likes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  po public.community_posts;
begin
  if tg_op = 'INSERT' then
    select * into po from public.community_posts where id = new.post_id;
    if found then perform public.notify(po.user_id, new.user_id, case when po.kind = 'review' then 'review_like' else 'like' end, po.id); end if;
  else
    delete from public.notifications where actor_id = old.user_id and post_id = old.post_id and type in ('like', 'review_like');
  end if;
  return null;
end;
$$;
revoke all on function public.notify_likes() from public, anon, authenticated;
drop trigger if exists notify_likes on public.post_likes;
create trigger notify_likes after insert or delete on public.post_likes
  for each row execute function public.notify_likes();

create or replace function public.notify_comments()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  author uuid;
  parent_author uuid;
begin
  select user_id into author from public.community_posts where id = new.post_id;
  if new.parent_id is not null then
    select user_id into parent_author from public.post_comments where id = new.parent_id;
    perform public.notify(parent_author, new.user_id, 'reply', new.post_id, new.id);
  end if;
  if author is distinct from parent_author then
    perform public.notify(author, new.user_id, 'comment', new.post_id, new.id);
  end if;
  return null;
end;
$$;
revoke all on function public.notify_comments() from public, anon, authenticated;
drop trigger if exists notify_comments on public.post_comments;
create trigger notify_comments after insert on public.post_comments
  for each row execute function public.notify_comments();

-- ───────────────────────── Denúncias ─────────────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null,
  post_id uuid references public.community_posts(id) on delete cascade,
  comment_id uuid references public.post_comments(id) on delete cascade,
  profile_id uuid references auth.users(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  constraint reports_target check (
    (target_type = 'post' and post_id is not null)
    or (target_type = 'comment' and comment_id is not null)
    or (target_type = 'profile' and profile_id is not null)
  ),
  constraint reports_type check (target_type in ('post', 'comment', 'profile')),
  constraint reports_reason check (reason in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'copyright', 'other')),
  constraint reports_details_len check (details is null or char_length(details) <= 500),
  constraint reports_status check (status in ('open', 'dismissed', 'actioned'))
);
create unique index if not exists reports_once_key on public.reports (reporter_id, target_type, coalesce(post_id, comment_id, profile_id)) where status = 'open';
create index if not exists reports_status_idx on public.reports (status, created_at desc);
alter table public.reports enable row level security;

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open');
drop policy if exists reports_read on public.reports;
create policy reports_read on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_global_admin());
drop policy if exists reports_admin on public.reports;
create policy reports_admin on public.reports for update to authenticated
  using (public.is_global_admin()) with check (public.is_global_admin());

drop trigger if exists reports_rate on public.reports;
create trigger reports_rate before insert on public.reports
  for each row execute function public.community_rate_limit();

-- ───────────────────────── Capa no Storage (bucket avatars, pasta própria) ─────────────────────────
-- O bucket avatars já aceita só a pasta da própria pessoa (políticas de 20261110010000).

-- ───────────────────────── Funções de leitura ─────────────────────────
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

-- Relação entre quem vê e a pessoa vista.
create or replace function public.community_relation(viewer uuid, other uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'following', exists (select 1 from public.follows where follower_id = viewer and followee_id = other and status = 'accepted'),
    'follow_pending', exists (select 1 from public.follows where follower_id = viewer and followee_id = other and status = 'pending'),
    'follows_me', exists (select 1 from public.follows where follower_id = other and followee_id = viewer and status = 'accepted'),
    'friend', coalesce((
      select case when status = 'accepted' then 'friends' when requester_id = viewer then 'outgoing' else 'incoming' end
      from public.friend_requests
      where (requester_id = viewer and addressee_id = other) or (requester_id = other and addressee_id = viewer)
    ), 'none'),
    'blocked_by_me', exists (select 1 from public.blocks where blocker_id = viewer and blocked_id = other)
  );
$$;
revoke all on function public.community_relation(uuid, uuid) from public, anon, authenticated;

create or replace function public.community_post_item(p_post uuid, p_viewer uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'kind', po.kind, 'id', po.id, 'at', po.created_at, 'body', po.body, 'image_url', po.image_url,
    'audience', po.audience, 'edited_at', po.edited_at, 'milestone', po.milestone,
    'catalog_id', po.catalog_id, 'book_id', po.book_id,
    'book', case
      when c.id is not null then jsonb_build_object('title', c.title, 'author', c.author)
      when po.book_title is not null then jsonb_build_object('title', po.book_title, 'author', po.book_author)
    end,
    'review', case when r.id is not null then jsonb_build_object(
      'id', r.id, 'rating', r.rating, 'title', r.title, 'body', r.body, 'spoiler', r.spoiler, 'visibility', r.visibility
    ) end,
    'author', public.community_author(po.user_id),
    'likes', (select count(*) from public.post_likes l where l.post_id = po.id),
    'liked', exists (select 1 from public.post_likes l where l.post_id = po.id and l.user_id = p_viewer),
    'comments', (select count(*) from public.post_comments m where m.post_id = po.id
                  and not public.is_blocked_between(p_viewer, m.user_id)),
    'mine', po.user_id = p_viewer
  )
  from public.community_posts po
  left join public.catalog_books c on c.id = po.catalog_id
  left join public.book_reviews r on r.id = po.review_id
  where po.id = p_post;
$$;
revoke all on function public.community_post_item(uuid, uuid) from public, anon, authenticated;

-- Feed. p_scope: 'all' (geral), 'following', 'friends', 'user' (uma pessoa), 'post' (pelo link).
-- Paginação por cursor (p_before). Quem denunciou um post deixa de vê-lo.
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
begin
  if viewer is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(public.community_post_item(x.id, viewer) order by x.created_at desc)
    from (
      select po.id, po.created_at
      from public.community_posts po
      where po.created_at < before_ts
        and (
          (p_scope = 'all' and (po.audience = 'public' or po.user_id = viewer))
          or (p_scope = 'following' and (po.user_id = viewer or public.follows_accepted(viewer, po.user_id)))
          or (p_scope = 'friends' and (po.user_id = viewer or public.is_friend(viewer, po.user_id)))
          or (p_scope = 'user' and po.user_id = p_user)
          or (p_scope = 'post' and po.id = p_post)
        )
        and public.can_view_post(viewer, po.id)
        and not exists (select 1 from public.reports rp where rp.reporter_id = viewer and rp.post_id = po.id)
      order by po.created_at desc
      limit lim
    ) x
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.community_feed(text, uuid, timestamptz, int, uuid) from public, anon;
grant execute on function public.community_feed(text, uuid, timestamptz, int, uuid) to authenticated;

-- Comentários (com respostas de um nível) de uma publicação visível.
create or replace function public.community_comments(p_post uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'at', m.created_at, 'body', m.body, 'parent_id', m.parent_id,
    'author', public.community_author(m.user_id),
    'mine', m.user_id = auth.uid(),
    'can_delete', m.user_id = auth.uid() or po.user_id = auth.uid()
  ) order by m.created_at), '[]'::jsonb)
  from public.post_comments m
  join public.community_posts po on po.id = m.post_id
  where m.post_id = p_post
    and public.can_view_post(auth.uid(), p_post)
    and not public.is_blocked_between(auth.uid(), m.user_id);
$$;
revoke all on function public.community_comments(uuid) from public, anon;
grant execute on function public.community_comments(uuid) to authenticated;

-- Perfil. Fechado e sem permissão: só cartão (nome, foto, @, capa) e a relação, para pedir para seguir.
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
  allowed boolean;
  yr int := extract(year from now() at time zone 'America/Sao_Paulo')::int;
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
  if not is_owner and (p.handle is null or public.is_blocked_between(viewer, p.user_id)) then return null; end if;
  allowed := public.can_view_profile(viewer, p.user_id);

  result := jsonb_build_object(
    'user_id', p.user_id,
    'handle', p.handle,
    'name', p.username,
    'avatar_url', p.avatar_url,
    'cover_url', p.cover_url,
    'banner', p.banner,
    'level', coalesce(p.placement_level, 'A1'),
    'leveled', p.placement_level is not null,
    'is_public', p.is_public,
    'is_owner', is_owner,
    'restricted', not allowed,
    'relation', case when is_owner then null else public.community_relation(viewer, p.user_id) end,
    'followers', (select count(*) from public.follows f where f.followee_id = p.user_id and f.status = 'accepted'),
    'following', (select count(*) from public.follows f where f.follower_id = p.user_id and f.status = 'accepted'),
    'friends', (select count(*) from public.friend_requests fr where fr.status = 'accepted' and (fr.requester_id = p.user_id or fr.addressee_id = p.user_id)),
    'show_shelf', p.show_shelf,
    'show_stats', p.show_stats,
    'show_socials', p.show_socials,
    'show_studying', p.show_studying,
    'updated_at', p.updated_at
  );
  if not allowed then return result; end if;

  result := result || jsonb_build_object(
    'bio', p.bio,
    'goal', p.goal,
    'joined_at', (select created_at from auth.users where id = p.user_id),
    'posts', (select count(*) from public.community_posts c where c.user_id = p.user_id and c.kind = 'post' and c.hidden_at is null),
    'reviews', (select count(*) from public.book_reviews r where r.user_id = p.user_id and (r.visibility <> 'private' or is_owner)),
    'books_read', (select count(*) from public.books b where b.user_id = p.user_id and b.finished_at is not null),
    'books_reading', (select count(*) from public.books b where b.user_id = p.user_id and b.finished_at is null and b.progress > 0 and b.shelf_status is null),
    'books_want', (select count(*) from public.books b where b.user_id = p.user_id and coalesce(b.progress, 0) = 0 and b.finished_at is null and b.shelf_status is null),
    'reading_goal', (
      select jsonb_build_object('year', g.year, 'target', g.target, 'done', (
        select count(*) from public.books b
        where b.user_id = p.user_id and b.finished_at is not null
          and extract(year from b.finished_at at time zone 'America/Sao_Paulo')::int = g.year
      ))
      from public.reading_goals g where g.user_id = p.user_id and g.year = yr and (is_owner or p.show_stats)
    )
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
          'finished_at', b.finished_at,
          'status', b.shelf_status,
          'favorite', b.favorite,
          'catalog_id', l.catalog_id,
          'has_cover', coalesce(c.cover_data, b.cover_data) is not null
        ) as item
        from public.books b
        left join public.book_links l on l.book_id = b.id
        left join public.catalog_books c on c.id = l.catalog_id
        where b.user_id = p.user_id
        order by b.last_read desc nulls last
        limit 60
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
    and (b.user_id = auth.uid() or (p.show_shelf and public.can_view_profile(auth.uid(), b.user_id)));
$$;
revoke all on function public.shelf_cover(uuid) from public, anon;
grant execute on function public.shelf_cover(uuid) to authenticated;

-- Descoberta e busca. Mostra perfis abertos, e fechados só com quem já há relação.
-- "Livros em comum" conta livros da galeria nas duas estantes (dado real, nada inventado).
drop function if exists public.community_people();
create or replace function public.community_people(p_query text default null, p_before timestamptz default null, p_limit int default 40)
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
        'bio', case when public.can_view_profile(auth.uid(), p.user_id) then p.bio end,
        'is_public', p.is_public,
        'followers', (select count(*) from public.follows f where f.followee_id = p.user_id and f.status = 'accepted'),
        'relation', public.community_relation(auth.uid(), p.user_id),
        'is_me', p.user_id = auth.uid(),
        'common_books', (
          select count(distinct l1.catalog_id) from public.book_links l1
          join public.book_links l2 on l2.catalog_id = l1.catalog_id and l2.user_id = auth.uid()
          where l1.user_id = p.user_id and p.show_shelf and p.user_id <> auth.uid()
        ),
        'reading', case when p.show_shelf and public.can_view_profile(auth.uid(), p.user_id) then (
          select b.title from public.books b
          where b.user_id = p.user_id and b.progress > 0 and b.progress < 1
          order by b.last_read desc nulls last
          limit 1
        ) end
      ) as person
    from public.profiles p
    where auth.uid() is not null
      and p.handle is not null
      and not public.is_blocked_between(auth.uid(), p.user_id)
      and (p.is_public or p.user_id = auth.uid() or public.follows_accepted(auth.uid(), p.user_id) or public.is_friend(auth.uid(), p.user_id)
           or (p_query is not null and p.handle = lower(btrim(p_query, ' @'))))
      and (p_before is null or p.updated_at < p_before)
      and (
        p_query is null or btrim(p_query) = ''
        or p.handle ilike '%' || replace(replace(lower(btrim(p_query, ' @')), '%', ''), '_', '\_') || '%'
        or p.username ilike '%' || replace(replace(btrim(p_query), '%', ''), '_', '\_') || '%'
      )
    order by p.updated_at desc
    limit least(greatest(coalesce(p_limit, 40), 1), 60)
  ) people;
$$;
revoke all on function public.community_people(text, timestamptz, int) from public, anon;
grant execute on function public.community_people(text, timestamptz, int) to authenticated;

-- Seguidores, seguindo ou amigos de alguém (só se o perfil pode ser visto).
create or replace function public.community_connections(p_user uuid, p_kind text default 'followers')
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.community_author(x.person) || jsonb_build_object(
    'relation', public.community_relation(auth.uid(), x.person),
    'is_me', x.person = auth.uid()
  ) order by x.at desc), '[]'::jsonb)
  from (
    select f.follower_id as person, f.created_at as at from public.follows f
      where p_kind = 'followers' and f.followee_id = p_user and f.status = 'accepted'
    union all
    select f.followee_id, f.created_at from public.follows f
      where p_kind = 'following' and f.follower_id = p_user and f.status = 'accepted'
    union all
    select case when fr.requester_id = p_user then fr.addressee_id else fr.requester_id end, coalesce(fr.responded_at, fr.created_at)
      from public.friend_requests fr
      where p_kind = 'friends' and fr.status = 'accepted' and (fr.requester_id = p_user or fr.addressee_id = p_user)
  ) x
  where public.can_view_profile(auth.uid(), p_user)
    and public.has_handle(x.person)
    and not public.is_blocked_between(auth.uid(), x.person);
$$;
revoke all on function public.community_connections(uuid, text) from public, anon;
grant execute on function public.community_connections(uuid, text) to authenticated;

-- Pedidos pendentes da própria pessoa: seguir (recebidos) e amizade (recebidos e enviados).
create or replace function public.community_requests()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'follow_in', coalesce((select jsonb_agg(public.community_author(f.follower_id) || jsonb_build_object('at', f.created_at) order by f.created_at desc)
      from public.follows f where f.followee_id = auth.uid() and f.status = 'pending'), '[]'::jsonb),
    'friend_in', coalesce((select jsonb_agg(public.community_author(fr.requester_id) || jsonb_build_object('at', fr.created_at) order by fr.created_at desc)
      from public.friend_requests fr where fr.addressee_id = auth.uid() and fr.status = 'pending'), '[]'::jsonb),
    'friend_out', coalesce((select jsonb_agg(public.community_author(fr.addressee_id) || jsonb_build_object('at', fr.created_at) order by fr.created_at desc)
      from public.friend_requests fr where fr.requester_id = auth.uid() and fr.status = 'pending'), '[]'::jsonb)
  )
  where auth.uid() is not null;
$$;
revoke all on function public.community_requests() from public, anon;
grant execute on function public.community_requests() to authenticated;

-- Pessoas que eu bloqueei (para desbloquear em Configurações).
create or replace function public.community_blocked()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.community_author(b.blocked_id) order by b.created_at desc), '[]'::jsonb)
  from public.blocks b where b.blocker_id = auth.uid();
$$;
revoke all on function public.community_blocked() from public, anon;
grant execute on function public.community_blocked() to authenticated;

-- Notificações com quem fez e um trecho do conteúdo.
create or replace function public.community_notifications(p_before timestamptz default null, p_limit int default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(item order by created_at desc), '[]'::jsonb)
  from (
    select n.created_at, jsonb_build_object(
      'id', n.id, 'type', n.type, 'at', n.created_at, 'read', n.read_at is not null,
      'post_id', n.post_id, 'comment_id', n.comment_id,
      'actor', public.community_author(n.actor_id),
      'snippet', coalesce(left(m.body, 120), left(nullif(po.body, ''), 120), po.book_title, c.title)
    ) as item
    from public.notifications n
    left join public.community_posts po on po.id = n.post_id
    left join public.post_comments m on m.id = n.comment_id
    left join public.catalog_books c on c.id = po.catalog_id
    where n.recipient_id = auth.uid()
      and (p_before is null or n.created_at < p_before)
      and not public.is_blocked_between(auth.uid(), n.actor_id)
    order by n.created_at desc
    limit least(greatest(coalesce(p_limit, 30), 1), 50)
  ) x;
$$;
revoke all on function public.community_notifications(timestamptz, int) from public, anon;
grant execute on function public.community_notifications(timestamptz, int) to authenticated;

-- Avaliações de um livro da galeria: média (todas as notas, sem identidade), a minha e as resenhas visíveis.
create or replace function public.book_reviews_for(p_catalog uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'average', (select round(avg(rating), 2) from public.book_reviews where catalog_id = p_catalog),
    'count', (select count(*) from public.book_reviews where catalog_id = p_catalog),
    'mine', (select to_jsonb(r) - 'user_id' from public.book_reviews r where r.catalog_id = p_catalog and r.user_id = auth.uid()),
    'items', coalesce((
      select jsonb_agg(public.community_post_item(po.id, auth.uid()) order by po.created_at desc)
      from public.community_posts po
      where po.kind = 'review' and po.catalog_id = p_catalog
        and public.can_view_post(auth.uid(), po.id)
        and not exists (select 1 from public.reports rp where rp.reporter_id = auth.uid() and rp.post_id = po.id)
    ), '[]'::jsonb)
  )
  where auth.uid() is not null;
$$;
revoke all on function public.book_reviews_for(uuid) from public, anon;
grant execute on function public.book_reviews_for(uuid) to authenticated;

-- ───────────────────────── Admin: denúncias ─────────────────────────
create or replace function public.admin_reports(p_status text default 'open')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_global_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'at', r.created_at, 'type', r.target_type, 'reason', r.reason, 'details', r.details, 'status', r.status,
      'reporter', public.community_author(r.reporter_id),
      'post_id', r.post_id, 'comment_id', r.comment_id, 'profile_id', r.profile_id,
      'target_author', public.community_author(coalesce(po.user_id, m.user_id, r.profile_id)),
      'content', coalesce(m.body, nullif(po.body, ''), po.book_title, pr.bio),
      'image_url', po.image_url,
      'hidden', po.hidden_at is not null
    ) order by r.created_at desc)
    from public.reports r
    left join public.community_posts po on po.id = r.post_id
    left join public.post_comments m on m.id = r.comment_id
    left join public.profiles pr on pr.user_id = r.profile_id
    where r.status = p_status
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_reports(text) from public, anon;
grant execute on function public.admin_reports(text) to authenticated;

-- p_action: 'dismiss' (arquivar), 'hide' (ocultar post), 'delete' (apagar post ou comentário).
create or replace function public.admin_resolve_report(p_report uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reports;
begin
  if not public.is_global_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.reports where id = p_report;
  if not found then return; end if;
  if p_action = 'hide' and r.post_id is not null then
    update public.community_posts set hidden_at = now() where id = r.post_id;
  elsif p_action = 'delete' then
    if r.comment_id is not null then delete from public.post_comments where id = r.comment_id;
    elsif r.post_id is not null then delete from public.community_posts where id = r.post_id;
    end if;
  end if;
  update public.reports
    set status = case when p_action = 'dismiss' then 'dismissed' else 'actioned' end, resolved_at = now(), resolved_by = auth.uid()
    where id = p_report
       or (status = 'open' and r.post_id is not null and post_id = r.post_id and p_action <> 'dismiss')
       or (status = 'open' and r.comment_id is not null and comment_id = r.comment_id and p_action <> 'dismiss');
end;
$$;
revoke all on function public.admin_resolve_report(uuid, text) from public, anon;
grant execute on function public.admin_resolve_report(uuid, text) to authenticated;

-- Funções antigas que não têm mais uso.
drop function if exists public.is_open_profile(uuid) cascade;
