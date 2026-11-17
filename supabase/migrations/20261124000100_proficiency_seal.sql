-- Selo CEFR da prova de proficiência no perfil (docs/PROVA-DE-PROFICIENCIA.md, seção 7.1).
-- O nível da pessoa no Bookmoo tem nomes próprios (Iniciante … Lenda); o código CEFR (A1 … C2) só aparece como selo depois de
-- uma prova de proficiência concluída. Só a função `proficiency` grava estes campos.

alter table public.profiles
  add column if not exists proficiency_cefr text check (proficiency_cefr in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  add column if not exists proficiency_band numeric,
  add column if not exists proficiency_at timestamptz;

create or replace function public.profiles_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  new.handle := nullif(lower(btrim(new.handle)), '');
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.placement_level := null;
      new.level_state := 'pending';
      new.level_emblems := '{}';
      new.level_verified_at := null;
      new.proficiency_cefr := null;
      new.proficiency_band := null;
      new.proficiency_at := null;
    else
      new.placement_level := old.placement_level;
      new.level_state := old.level_state;
      new.level_emblems := old.level_emblems;
      new.level_verified_at := old.level_verified_at;
      new.proficiency_cefr := old.proficiency_cefr;
      new.proficiency_band := old.proficiency_band;
      new.proficiency_at := old.proficiency_at;
    end if;
  end if;
  return new;
end;
$$;

-- Comunidade: o selo segue a mesma privacidade do nível (show_level).
do $$
declare
  def text;
begin
  select pg_get_functiondef('public.community_profile(text, uuid)'::regprocedure) into def;
  if def not like '%proficiency_cefr%' then
    def := replace(def,
      $r$'emblems', case when p.show_level or p.user_id = auth.uid() then p.level_emblems else '{}'::text[] end,$r$,
      $r$'emblems', case when p.show_level or p.user_id = auth.uid() then p.level_emblems else '{}'::text[] end,
    'proficiency', case when p.show_level or p.user_id = auth.uid() then p.proficiency_cefr end,$r$);
    execute def;
  end if;
end $$;
