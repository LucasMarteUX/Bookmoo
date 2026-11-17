-- English Proficiency Test (docs/PROVA-DE-PROFICIENCIA.md).
-- Prova completa das 4 habilidades, inspirada no formato público do TOEFL iBT 2026 (não oficial, sem vínculo com a ETS).
-- Tudo o que é gabarito, roteiro de áudio, nota e avaliação fica só no servidor: as tabelas não têm escrita pelo cliente e
-- o aluno lê apenas as próprias sessões e resultados (sem colunas sensíveis). O admin opera pela Edge Function
-- `proficiency` (service role), que confere `is_admin`.

-- ---------------------------------------------------------------------------------------------------------------------
-- Versões da prova (banco de questões congelado ao publicar). Só uma publicada por vez.
create table if not exists public.prof_versions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  blueprint_version text not null default 'bp-2026.1',
  difficulty_model text not null default 'pdm-1',
  rubric_version text not null default 'rub-1',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create unique index if not exists prof_versions_one_published on public.prof_versions ((status)) where status = 'published';

-- Questões. `content` é o que o aluno vê; `answer` (gabarito) e `script` (texto falado nos áudios) nunca saem do servidor.
-- Uma "questão" é uma unidade (um texto com 10 lacunas, uma conversa com 2 perguntas…); `points` diz quantos itens
-- pontuados ela vale na contagem da prova.
create table if not exists public.prof_items (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.prof_versions(id) on delete cascade,
  section text not null check (section in ('reading', 'listening', 'writing', 'speaking')),
  task_type text not null check (task_type in (
    'complete_words', 'daily_life', 'academic_passage',
    'choose_response', 'conversation', 'announcement', 'academic_talk',
    'build_sentence', 'write_email', 'academic_discussion',
    'listen_repeat', 'interview')),
  stage text not null default 'any' check (stage in ('router', 'easy', 'hard', 'any')),
  difficulty numeric not null default 3 check (difficulty between 1 and 6),
  cefr text check (cefr in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  points int not null default 1 check (points between 1 and 20),
  content jsonb not null,
  answer jsonb not null default '{}'::jsonb,
  script jsonb,
  rubric text,
  status text not null default 'review' check (status in ('draft', 'review', 'approved', 'rejected', 'retired')),
  source text not null default 'ai' check (source in ('ai', 'manual')),
  generation_id uuid,
  validation jsonb,                 -- resultado da validação automática e da revisão por IA
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists prof_items_pool on public.prof_items (version_id, task_type, stage, status);

-- Áudios pré-gerados (bucket privado `proficiency-audio`). Nada é gerado durante a prova.
create table if not exists public.prof_assets (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.prof_items(id) on delete cascade,
  key text not null,                -- 'main' (estímulo) ou o id da pergunta da entrevista
  storage_path text not null,
  mime text not null default 'audio/wav',
  voice text,
  duration_ms int,
  script_hash text,                 -- hash do roteiro: se o texto mudar, o áudio fica desatualizado
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (item_id, key)
);

-- Lotes de geração por IA (registro e custo).
create table if not exists public.prof_generations (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.prof_versions(id) on delete cascade,
  task_type text not null,
  stage text not null,
  requested int not null,
  created int not null default 0,
  rejected int not null default 0,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  error text,
  cost_usd numeric not null default 0,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Sessões de prova. `path` registra o caminho adaptativo (nota do router, limiar, módulo escolhido e versão do modelo).
create table if not exists public.prof_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version_id uuid not null references public.prof_versions(id),
  status text not null default 'active' check (status in ('active', 'scoring', 'scored', 'inconclusive', 'abandoned', 'failed')),
  section text not null default 'reading' check (section in ('reading', 'listening', 'writing', 'speaking', 'done')),
  module text not null default 'router' check (module in ('router', 'easy', 'hard', 'fixed', 'done')),
  section_started_at timestamptz not null default now(),
  section_deadline timestamptz not null,
  path jsonb not null default '{}'::jsonb,
  consent_at timestamptz not null,
  checks jsonb not null default '{}'::jsonb,   -- microfone e áudio testados antes de começar
  client jsonb,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  scoring_started_at timestamptz,
  scored_at timestamptz,
  scoring_attempts int not null default 0,
  error text
);
create index if not exists prof_sessions_user on public.prof_sessions (user_id, started_at desc);
create unique index if not exists prof_sessions_one_active on public.prof_sessions (user_id) where status = 'active';

-- Questões servidas em cada sessão (ordem, módulo, cronômetro por tarefa e reproduções de áudio).
create table if not exists public.prof_session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.prof_sessions(id) on delete cascade,
  item_id uuid not null references public.prof_items(id),
  section text not null,
  module text not null,
  position int not null,
  opened_at timestamptz,
  deadline_at timestamptz,
  plays jsonb not null default '{}'::jsonb,
  unique (session_id, section, module, position)
);
create index if not exists prof_session_items_session on public.prof_session_items (session_id);

-- Respostas (salvamento automático). `part` = id da lacuna/pergunta/gravação dentro da questão.
create table if not exists public.prof_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.prof_sessions(id) on delete cascade,
  session_item_id uuid not null references public.prof_session_items(id) on delete cascade,
  part text not null,
  response jsonb not null,
  audio_path text,                  -- gravação da fala (bucket privado `proficiency-recordings`)
  transcript text,                  -- transcrição feita no servidor na hora da correção
  auto_score numeric,               -- 0..1 para itens objetivos
  saved_at timestamptz not null default now(),
  unique (session_item_id, part)
);
create index if not exists prof_responses_session on public.prof_responses (session_id);

-- Avaliações por IA (Writing e Speaking), com rubrica versionada e justificativa.
create table if not exists public.prof_evaluations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.prof_sessions(id) on delete cascade,
  session_item_id uuid references public.prof_session_items(id) on delete cascade,
  section text not null,
  task_type text not null,
  rubric_version text not null,
  provider text,
  model text,
  score numeric,                    -- 0..5
  criteria jsonb,
  rationale text,
  evidence jsonb,
  status text not null default 'ok' check (status in ('ok', 'insufficient', 'failed')),
  created_at timestamptz not null default now()
);
create index if not exists prof_evaluations_session on public.prof_evaluations (session_id);

-- Resultado final (escala 1–6 com CEFR aproximado; nunca equivalência oficial).
create table if not exists public.prof_results (
  session_id uuid primary key references public.prof_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('final', 'inconclusive')),
  overall numeric,
  cefr text,
  sections jsonb not null,
  report jsonb not null default '{}'::jsonb,
  scoring_version text not null,
  rubric_version text not null,
  created_at timestamptz not null default now()
);
create index if not exists prof_results_user on public.prof_results (user_id, created_at desc);

-- ---------------------------------------------------------------------------------------------------------------------
-- RLS: escrita só pelo servidor. O aluno lê as próprias sessões e resultados (colunas sem dados sensíveis).
alter table public.prof_versions enable row level security;
alter table public.prof_items enable row level security;
alter table public.prof_assets enable row level security;
alter table public.prof_generations enable row level security;
alter table public.prof_sessions enable row level security;
alter table public.prof_session_items enable row level security;
alter table public.prof_responses enable row level security;
alter table public.prof_evaluations enable row level security;
alter table public.prof_results enable row level security;

revoke all on public.prof_versions, public.prof_items, public.prof_assets, public.prof_generations,
  public.prof_session_items, public.prof_responses, public.prof_evaluations from anon, authenticated;
revoke all on public.prof_sessions, public.prof_results from anon, authenticated;

grant select (id, user_id, version_id, status, section, module, started_at, submitted_at, scored_at) on public.prof_sessions to authenticated;
drop policy if exists prof_sessions_read on public.prof_sessions;
create policy prof_sessions_read on public.prof_sessions for select to authenticated using (user_id = auth.uid());

grant select (session_id, user_id, status, overall, cefr, sections, report, scoring_version, rubric_version, created_at) on public.prof_results to authenticated;
drop policy if exists prof_results_read on public.prof_results;
create policy prof_results_read on public.prof_results for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------------------------------
-- Armazenamento privado: áudios das questões e gravações da fala. Sem políticas para o cliente: o acesso é por URL
-- assinada e de curta duração, criada pela função depois de conferir a sessão.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('proficiency-audio', 'proficiency-audio', false, 20971520, array['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/webm', 'audio/ogg', 'audio/mp4']),
  ('proficiency-recordings', 'proficiency-recordings', false, 5242880, array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav'])
on conflict (id) do nothing;

-- Limite de preço por tipo de plano (premium = Pro por padrão; o admin pode trocar em app_settings).
insert into public.app_settings (key, value)
values ('proficiency_min_plan_rank', '3'::jsonb)
on conflict (key) do nothing;
