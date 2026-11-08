-- Bookmoo × VoiceStudio TTS — catálogo, preferências, cache e fila de geração.
-- Idempotente onde possível. Não altera tabelas existentes (reader_settings continua igual).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Catálogo de vozes (somente admins/service role escrevem)
-- ---------------------------------------------------------------------------
create table if not exists public.tts_voices (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'voicestudio',
  provider_voice_id text not null,
  model_id text not null,
  model_version text not null default 'unknown',
  name text not null,
  language text,            -- só preenchido quando o backend informa
  accent text,              -- idem; nunca inventado
  description text,
  preview_audio_path text,
  is_active boolean not null default false,  -- ativação é decisão administrativa
  is_default boolean not null default false,
  commercial_use_verified boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, model_id, provider_voice_id)
);
create unique index if not exists tts_voices_one_default on public.tts_voices (is_default) where is_default;

-- ---------------------------------------------------------------------------
-- Preferências do aluno
-- ---------------------------------------------------------------------------
create table if not exists public.user_voice_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_voice_id uuid references public.tts_voices(id) on delete set null,
  playback_speed numeric(3,2) not null default 1.0 check (playback_speed between 0.5 and 1.5),
  auto_play boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Cache de áudio. scope_user_id NULL = cache compartilhado (conteúdo padronizado);
-- preenchido = conteúdo privado do aluno, isolado e incluído no hash.
-- ---------------------------------------------------------------------------
create table if not exists public.tts_audio_cache (
  id uuid primary key default gen_random_uuid(),
  content_hash text not null unique,
  scope_user_id uuid references auth.users(id) on delete cascade,
  normalized_text text not null,
  language text not null,
  voice_id uuid not null references public.tts_voices(id) on delete cascade,
  model_id text not null,
  model_version text not null,
  generation_settings jsonb not null default '{}'::jsonb,
  format text not null default 'mp3',
  storage_path text not null,
  size_bytes integer,
  duration_ms integer,
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz not null default now()
);
create index if not exists tts_audio_cache_last_access on public.tts_audio_cache (last_accessed_at);
create index if not exists tts_audio_cache_scope on public.tts_audio_cache (scope_user_id);

-- ---------------------------------------------------------------------------
-- Fila de geração
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.tts_job_status as enum ('pending','processing','completed','failed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.tts_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  voice_id uuid not null references public.tts_voices(id) on delete cascade,
  content_hash text not null,
  scope_user_id uuid references auth.users(id) on delete cascade,
  normalized_text text not null,
  language text not null,
  model_id text not null,
  model_version text not null,
  generation_settings jsonb not null default '{}'::jsonb,
  format text not null default 'mp3',
  status public.tts_job_status not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  error_message text,
  locked_by text,
  locked_until timestamptz,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
-- Prevenção de duplicatas: no máximo um job ativo por hash.
create unique index if not exists tts_jobs_active_hash
  on public.tts_generation_jobs (content_hash) where status in ('pending','processing');
create index if not exists tts_jobs_claim on public.tts_generation_jobs (status, run_after);
create index if not exists tts_jobs_user_created on public.tts_generation_jobs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.tts_voices enable row level security;
alter table public.user_voice_preferences enable row level security;
alter table public.tts_audio_cache enable row level security;
alter table public.tts_generation_jobs enable row level security;

drop policy if exists "tts_voices read active" on public.tts_voices;
create policy "tts_voices read active" on public.tts_voices
  for select to authenticated using (is_active);

drop policy if exists "prefs own select" on public.user_voice_preferences;
create policy "prefs own select" on public.user_voice_preferences
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "prefs own upsert" on public.user_voice_preferences;
create policy "prefs own upsert" on public.user_voice_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "prefs own update" on public.user_voice_preferences;
create policy "prefs own update" on public.user_voice_preferences
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Cache: o aluno vê o compartilhado e o próprio. Escrita só via service role.
drop policy if exists "cache read shared or own" on public.tts_audio_cache;
create policy "cache read shared or own" on public.tts_audio_cache
  for select to authenticated using (scope_user_id is null or scope_user_id = (select auth.uid()));

drop policy if exists "jobs own select" on public.tts_generation_jobs;
create policy "jobs own select" on public.tts_generation_jobs
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Funções da fila (somente service role)
-- ---------------------------------------------------------------------------
-- Reivindica até p_limit jobs com SKIP LOCKED; também recupera jobs cujo lease expirou.
create or replace function public.tts_claim_jobs(p_worker text, p_limit int default 1, p_lease_seconds int default 120)
returns setof public.tts_generation_jobs
language plpgsql security definer set search_path = public as $$
begin
  return query
  with c as (
    select id from public.tts_generation_jobs
    where (status = 'pending' and run_after <= now())
       or (status = 'processing' and locked_until < now())
    order by created_at
    limit p_limit
    for update skip locked
  )
  update public.tts_generation_jobs j
     set status = 'processing', attempts = j.attempts + 1, locked_by = p_worker,
         locked_until = now() + make_interval(secs => p_lease_seconds),
         started_at = coalesce(j.started_at, now())
    from c where j.id = c.id
  returning j.*;
end $$;

-- Falha: reagenda com backoff exponencial ou marca como failed.
create or replace function public.tts_fail_job(p_job uuid, p_error text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.tts_generation_jobs
     set status = case when attempts >= max_attempts then 'failed'::tts_job_status else 'pending'::tts_job_status end,
         error_message = left(p_error, 1000), locked_by = null, locked_until = null,
         run_after = now() + make_interval(secs => least(300, 5 * power(2, attempts)::int)),
         completed_at = case when attempts >= max_attempts then now() else null end
   where id = p_job and status = 'processing';
end $$;

revoke all on function public.tts_claim_jobs(text,int,int) from public, anon, authenticated;
revoke all on function public.tts_fail_job(uuid,text) from public, anon, authenticated;
grant execute on function public.tts_claim_jobs(text,int,int) to service_role;
grant execute on function public.tts_fail_job(uuid,text) to service_role;

-- ---------------------------------------------------------------------------
-- Storage: bucket privado; acesso apenas por URL assinada emitida pelas Edge Functions.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tts-audio', 'tts-audio', false, 10485760, array['audio/mpeg'])
on conflict (id) do nothing;
-- Sem policies em storage.objects para este bucket => anon/authenticated não leem nem escrevem diretamente.

-- ---------------------------------------------------------------------------
-- Limpeza: áudios privados não acessados há 30 dias e compartilhados há 180 dias.
-- Retorna os paths para o worker remover do Storage (remoção via API de Storage, não SQL).
-- ---------------------------------------------------------------------------
create or replace function public.tts_expire_cache(p_limit int default 500)
returns table(storage_path text)
language sql security definer set search_path = public as $$
  delete from public.tts_audio_cache
   where id in (
     select id from public.tts_audio_cache
      where (scope_user_id is not null and last_accessed_at < now() - interval '30 days')
         or (scope_user_id is null and last_accessed_at < now() - interval '180 days')
      limit p_limit)
  returning storage_path;
$$;
revoke all on function public.tts_expire_cache(int) from public, anon, authenticated;
grant execute on function public.tts_expire_cache(int) to service_role;
