-- Complemento de 20261123000000: no community_profile o nível e o "leveled" ficam em linhas separadas, então a troca
-- anterior não casou. Aplica as duas partes separadamente (só se ainda não aplicado).
do $$
declare
  def text;
begin
  select pg_get_functiondef('public.community_profile(text, uuid)'::regprocedure) into def;
  if def not like '%show_level%' then
    def := replace(def,
      $r$'leveled', p.placement_level is not null,$r$,
      $r$'leveled', p.placement_level is not null and p.level_state = 'verified' and (p.show_level or p.user_id = auth.uid()),
    'emblems', case when p.show_level or p.user_id = auth.uid() then p.level_emblems else '{}'::text[] end,$r$);
    def := replace(def,
      $r$'level', coalesce(p.placement_level, 'A1'),$r$,
      $r$'level', case when p.show_level or p.user_id = auth.uid() then coalesce(p.placement_level, p.declared_level, 'A1') end,$r$);
    execute def;
  end if;
end $$;
