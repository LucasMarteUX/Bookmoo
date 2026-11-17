-- Nível declarado no primeiro acesso (A1 a C2, escolhido com a explicação de cada nível) e o estado dele até o teste.
-- O nível que vale no app: placement_level (do teste, só o servidor grava) ou, sem teste, declared_level.
-- Ver docs/TESTE-DE-NIVEL.md.

alter table public.profiles
  add column if not exists declared_level text,
  add column if not exists level_state text not null default 'pending';

alter table public.profiles drop constraint if exists profiles_declared_level_check;
alter table public.profiles
  add constraint profiles_declared_level_check
  check (declared_level is null or declared_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

alter table public.profiles drop constraint if exists profiles_level_state_check;
alter table public.profiles
  add constraint profiles_level_state_check
  check (level_state in ('pending', 'verified', 'review'));

-- O estado do nível também só muda pelo servidor (teste). O nível declarado a pessoa pode trocar.
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
      new.level_state := 'pending';
    else
      new.placement_level := old.placement_level;
      new.level_state := old.level_state;
    end if;
  end if;
  return new;
end;
$$;

-- Questionário: a pergunta de nível passa a responder A1..C2 e grava o nível declarado no perfil.
create or replace function public.save_survey(p_answers jsonb, p_skip boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_clean jsonb := '{}'::jsonb;
  k text;
  v_level text;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if not p_skip and p_answers is not null and jsonb_typeof(p_answers) = 'object' then
    foreach k in array array['reason', 'self_level', 'difficulty', 'tried_books', 'topics', 'daily_minutes', 'how_found', 'goal_text'] loop
      if p_answers ? k then
        if jsonb_typeof(p_answers->k) = 'array' then
          v_clean := v_clean || jsonb_build_object(k, (select coalesce(jsonb_agg(left(x, 40)), '[]'::jsonb) from (select jsonb_array_elements_text(p_answers->k) x limit 12) t));
        else
          v_clean := v_clean || jsonb_build_object(k, left(p_answers->>k, 200));
        end if;
      end if;
    end loop;
  end if;
  insert into public.user_surveys (user_id, answers, skipped) values (auth.uid(), v_clean, p_skip)
  on conflict (user_id) do update set answers = excluded.answers, skipped = excluded.skipped, completed_at = now();
  v_level := v_clean->>'self_level';
  if v_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2') then
    insert into public.profiles (user_id, declared_level) values (auth.uid(), v_level)
    on conflict (user_id) do update set declared_level = excluded.declared_level, updated_at = now();
  end if;
  update public.user_accounts set onboarding_step = 'plans', updated_at = now() where user_id = auth.uid() and onboarding_step = 'survey';
end;
$$;
revoke all on function public.save_survey(jsonb, boolean) from public, anon;
grant execute on function public.save_survey(jsonb, boolean) to authenticated;
