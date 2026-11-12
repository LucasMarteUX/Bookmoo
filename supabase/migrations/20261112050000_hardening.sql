-- Endurecimento antes do lançamento.
-- 1) Funções de admin não ficam executáveis por visitante (já recusavam com "forbidden", agora nem chegam a rodar).
-- 2) Avatares: só imagem e até 2 MB (o bucket aceitava qualquer tipo e tamanho, por URL pública).
begin;

revoke execute on function public.admin_overview() from public, anon;
revoke execute on function public.is_global_admin() from public, anon;

update storage.buckets
  set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'], file_size_limit = 2097152
  where id = 'avatars';

do $$ begin
  if has_function_privilege('anon', 'public.admin_overview()', 'execute') then raise exception 'admin_overview ainda aberto'; end if;
end $$;

commit;
