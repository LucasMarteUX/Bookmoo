-- Menções (@handle) em publicações e comentários: quem é marcado recebe a notificação "mencionou você".
-- Só avisa quem pode ver a publicação e não está bloqueado (notify já confere bloqueio). Máximo 10 por texto.
begin;

alter table public.notifications drop constraint if exists notifications_type;
alter table public.notifications add constraint notifications_type check (type in (
  'follow', 'follow_request', 'follow_accepted', 'friend_request', 'friend_accepted',
  'like', 'review_like', 'comment', 'reply', 'mention'
));
-- Uma notificação de menção por texto (editar o post não repete o aviso).
create unique index if not exists notifications_mention_key on public.notifications
  (recipient_id, actor_id, post_id, coalesce(comment_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where type = 'mention';

create or replace function public.mentioned_users(p_body text)
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct p.user_id
  from (
    select lower(m[1]) as handle
    from regexp_matches(coalesce(p_body, ''), '(?:^|[^a-z0-9_.@])@([a-z0-9_.]{3,20})', 'gi') as m
    limit 20
  ) x
  join public.profiles p on p.handle = x.handle
  limit 10
$$;
revoke all on function public.mentioned_users(text) from public, anon, authenticated;

create or replace function public.notify_post_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid;
begin
  for target in select * from public.mentioned_users(new.body) loop
    if target <> new.user_id and public.can_view_post(target, new.id) then
      perform public.notify(target, new.user_id, 'mention', new.id, null);
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function public.notify_post_mentions() from public, anon, authenticated;
drop trigger if exists notify_post_mentions on public.community_posts;
create trigger notify_post_mentions after insert or update of body on public.community_posts
  for each row execute function public.notify_post_mentions();

create or replace function public.notify_comment_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid;
  author uuid;
  parent_author uuid;
begin
  select user_id into author from public.community_posts where id = new.post_id;
  if new.parent_id is not null then
    select user_id into parent_author from public.post_comments where id = new.parent_id;
  end if;
  for target in select * from public.mentioned_users(new.body) loop
    -- Autor do post e de quem foi respondido já recebem "comentou"/"respondeu".
    if target <> new.user_id and target is distinct from author and target is distinct from parent_author
       and public.can_view_post(target, new.post_id) then
      perform public.notify(target, new.user_id, 'mention', new.post_id, new.id);
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function public.notify_comment_mentions() from public, anon, authenticated;
drop trigger if exists notify_comment_mentions on public.post_comments;
create trigger notify_comment_mentions after insert on public.post_comments
  for each row execute function public.notify_comment_mentions();

-- Sino em tempo real: novas notificações chegam pelo Realtime (RLS limita cada pessoa às suas).
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

commit;
