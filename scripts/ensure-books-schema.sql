-- Garante que a tabela books tem todas as colunas usadas pelo app (texto das páginas, quadrinhos, metadados).
-- Execute no Supabase Dashboard → SQL Editor uma vez. Idempotente (ADD COLUMN IF NOT EXISTS).

-- Texto das páginas (array de strings, uma por página)
ALTER TABLE books ADD COLUMN IF NOT EXISTS pages jsonb DEFAULT '[]'::jsonb;

-- Metadados do livro
ALTER TABLE books ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE books ADD COLUMN IF NOT EXISTS total_pages integer;
ALTER TABLE books ADD COLUMN IF NOT EXISTS author text;
ALTER TABLE books ADD COLUMN IF NOT EXISTS context text;
ALTER TABLE books ADD COLUMN IF NOT EXISTS language_code text DEFAULT 'en';
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_data text;

-- Quadrinhos: URLs (Storage) ou base64; estilo e personagens para consistência
ALTER TABLE books ADD COLUMN IF NOT EXISTS comic_pages jsonb;
ALTER TABLE books ADD COLUMN IF NOT EXISTS comic_style_doc jsonb;
ALTER TABLE books ADD COLUMN IF NOT EXISTS comic_characters jsonb;

-- Vocabulário fixado na sidebar
ALTER TABLE books ADD COLUMN IF NOT EXISTS pinned_vocab_ids jsonb DEFAULT '[]'::jsonb;
