-- Execute no Supabase SQL Editor para habilitar os novos recursos de vocabulário.
alter table public.vocabulary
  add column if not exists grammar_examples jsonb not null default '[]'::jsonb,
  add column if not exists usage_note text,
  add column if not exists variant_story text;
