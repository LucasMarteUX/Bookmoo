-- Perfil da comunidade, versão 2.
-- * @ único (handle), obrigatório para abrir o perfil.
-- * A pessoa escolhe quais blocos mostrar: estante, resultados, redes e o que está estudando.
-- * Nível de inglês vem do teste de nivelamento (placement_level). Até o teste existir, todos são A1.
-- * Outras pessoas não leem a linha crua: só passam pelas funções abaixo, que respeitam as escolhas.
-- * Resultados e estante saem das tabelas reais (xp_events, vocabulary, study_days, books), sem foto parada.

alter table public.profiles
  add column if not exists handle text,
  add column if not exists avatar_url text,
  add column if not exists goal text,
  add column if not exists placement_level text,
  add column if not exists show_shelf boolean not null default true,
  add column if not exists show_stats boolean not null default true,
  add column if not exists show_socials boolean not null default true,
  add column if not exists show_studying boolean not null default false;

alter table public.profiles drop constraint if exists profiles_handle_format;
alter table public.profiles
  add constraint profiles_handle_format
  check (handle is null or handle ~ '^[a-z0-9_.]{3,20}$');

alter table public.profiles drop constraint if exists profiles_placement_level_check;
alter table public.profiles
  add constraint profiles_placement_level_check
  check (placement_level is null or placement_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

-- Perfis públicos antigos não têm @. "not valid" não quebra essas linhas,
-- mas a próxima vez que a pessoa salvar, o @ passa a ser exigido.
alter table public.profiles drop constraint if exists profiles_public_needs_handle;
alter table public.profiles
  add constraint profiles_public_needs_handle
  check (not is_public or handle is not null) not valid;

create unique index if not exists profiles_handle_key on public.profiles (handle) where handle is not null;

-- O nível só muda pelo teste (função do servidor). A pessoa não consegue gravar o próprio nível.
create or replace function public.profiles_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.handle := nullif(lower(btrim(new.handle)), '');
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.placement_level := null;
    else
      new.placement_level := old.placement_level;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function public.profiles_guard();

revoke all on function public.profiles_guard() from public, anon, authenticated;

-- A linha crua agora é só da própria pessoa.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated
  using (user_id = auth.uid());

-- Resultados calculados na hora. Interna: não é chamada direto pelo app.
-- Dias contados no fuso de São Paulo, como o app mostra para a maioria dos alunos.
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
        where user_id = p_user and created_at >= now() - interval '120 days'
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

  -- Sequência: dias seguidos com atividade, terminando hoje (ou ontem, se hoje ainda não estudou).
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

-- O Supabase dá execute ao anon em funções novas: "from public" não basta.
revoke all on function public.profile_stats(uuid) from public, anon;
revoke all on function public.profile_stats(uuid) from authenticated;

-- Perfil como a outra pessoa pode ver. A dona vê tudo (e a tela de edição mostra a prévia como visitante).
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
    'level', coalesce(p.placement_level, 'A1'),
    'leveled', p.placement_level is not null,
    'is_public', p.is_public,
    'is_owner', is_owner,
    'show_shelf', p.show_shelf,
    'show_stats', p.show_stats,
    'show_socials', p.show_socials,
    'show_studying', p.show_studying,
    'updated_at', p.updated_at
  );

  if is_owner or p.show_socials then
    result := result || jsonb_build_object('socials', p.socials);
  end if;

  if is_owner or p.show_stats then
    result := result || jsonb_build_object('stats', public.profile_stats(p.user_id));
  end if;

  if is_owner or p.show_shelf then
    -- Capa só de livro da galeria: o EPUB enviado pela pessoa mostra título e autor.
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
          'cover', c.cover_data
        ) as item
        from public.books b
        left join public.book_links l on l.book_id = b.id
        left join public.catalog_books c on c.id = l.catalog_id
        where b.user_id = p.user_id
        order by b.last_read desc nulls last
        limit 24
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

-- Pessoas com perfil aberto, para a página Comunidade.
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
      jsonb_build_object(
        'user_id', p.user_id,
        'handle', p.handle,
        'name', p.username,
        'bio', p.bio,
        'avatar_url', p.avatar_url,
        'level', coalesce(p.placement_level, 'A1'),
        'updated_at', p.updated_at,
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
    limit 60
  ) people;
$$;

revoke all on function public.community_people() from public, anon;
grant execute on function public.community_people() to authenticated;
