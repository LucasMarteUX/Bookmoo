-- Relatórios do /diagnostico-voz: o aluno logado envia o resultado dos testes de voz do próprio aparelho (só eventos e
-- medidas, sem áudio) para entendermos por que um tutor ficou mudo num celular de verdade. Só o próprio aluno insere;
-- ninguém lê pelo app (a leitura é pelo painel, com a chave de serviço).
create table if not exists public.voice_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  user_agent text,
  is_mobile boolean,
  summary text,
  report jsonb not null,
  constraint voice_reports_size check (pg_column_size(report) < 200000),
  constraint voice_reports_ua_len check (user_agent is null or char_length(user_agent) <= 512),
  constraint voice_reports_summary_len check (summary is null or char_length(summary) <= 2000)
);

create index if not exists voice_reports_user_id_idx on public.voice_reports (user_id);
create index if not exists voice_reports_created_at_idx on public.voice_reports (created_at desc);

alter table public.voice_reports enable row level security;

drop policy if exists "voice_reports_insert_own" on public.voice_reports;
create policy "voice_reports_insert_own" on public.voice_reports
  for insert to authenticated
  with check (user_id = (select auth.uid()));

revoke all on public.voice_reports from anon;
grant insert on public.voice_reports to authenticated;
