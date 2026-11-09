-- Listas de palavras por resultado (certas, quase, erradas, puladas) de cada prática.
alter table public.practice_sessions add column if not exists words jsonb not null default '{}'::jsonb;
