-- Comic style and character documentation for consistent comic generation.
-- Run in Supabase Dashboard → SQL Editor.

ALTER TABLE books ADD COLUMN IF NOT EXISTS comic_style_doc jsonb;
ALTER TABLE books ADD COLUMN IF NOT EXISTS comic_characters jsonb;
