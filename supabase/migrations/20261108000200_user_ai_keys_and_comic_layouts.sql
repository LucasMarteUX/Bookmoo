-- Chaves de IA por usuário (OpenAI / Gemini) guardadas cifradas no Supabase Vault,
-- e layout dos balões dos quadrinhos (texto real por cima da imagem).

create table if not exists public.user_ai_keys (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('openai', 'gemini')),
  vault_secret_id uuid not null,
  key_hint text not null,            -- só os 4 últimos caracteres, para exibição
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

-- RLS ligado e SEM policies: nenhum cliente (anon/authenticated) lê ou escreve.
-- Todo acesso passa pela Edge Function ai-keys com service role.
alter table public.user_ai_keys enable row level security;
revoke all on public.user_ai_keys from anon, authenticated;

create or replace function public.ai_key_upsert(p_user uuid, p_provider text, p_key text, p_hint text)
returns void
language plpgsql security definer set search_path = public, vault as $$
declare
  v_id uuid;
begin
  select vault_secret_id into v_id from public.user_ai_keys where user_id = p_user and provider = p_provider;
  if v_id is null then
    v_id := vault.create_secret(p_key, 'ai_key_' || p_provider || '_' || p_user::text, 'Bookmoo AI key');
    insert into public.user_ai_keys (user_id, provider, vault_secret_id, key_hint, verified_at)
    values (p_user, p_provider, v_id, p_hint, now());
  else
    perform vault.update_secret(v_id, p_key);
    update public.user_ai_keys set key_hint = p_hint, verified_at = now(), updated_at = now()
     where user_id = p_user and provider = p_provider;
  end if;
end $$;

create or replace function public.ai_key_get(p_user uuid, p_provider text)
returns text
language sql security definer set search_path = public, vault stable as $$
  select s.decrypted_secret
    from public.user_ai_keys k
    join vault.decrypted_secrets s on s.id = k.vault_secret_id
   where k.user_id = p_user and k.provider = p_provider;
$$;

create or replace function public.ai_key_delete(p_user uuid, p_provider text)
returns void
language plpgsql security definer set search_path = public, vault as $$
declare
  v_id uuid;
begin
  delete from public.user_ai_keys where user_id = p_user and provider = p_provider
  returning vault_secret_id into v_id;
  if v_id is not null then
    delete from vault.secrets where id = v_id;
  end if;
end $$;

revoke all on function public.ai_key_upsert(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.ai_key_get(uuid, text) from public, anon, authenticated;
revoke all on function public.ai_key_delete(uuid, text) from public, anon, authenticated;
grant execute on function public.ai_key_upsert(uuid, text, text, text) to service_role;
grant execute on function public.ai_key_get(uuid, text) to service_role;
grant execute on function public.ai_key_delete(uuid, text) to service_role;

-- Layout dos balões por página: { "<page>": { v: 1, balloons: [{ x, y, w, h, charStart, charEnd, kind }] } }
alter table public.books add column if not exists comic_layouts jsonb not null default '{}'::jsonb;

-- Chave Gemini em texto puro que existia em reader_settings (nunca escrita pelo app; 0 linhas).
alter table public.reader_settings drop column if exists gemini_api_key;
