-- Run in Supabase Dashboard → SQL Editor if your books table doesn't have description and total_pages yet.
-- Adds columns for book description and total pages (for progress bar).

ALTER TABLE books ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE books ADD COLUMN IF NOT EXISTS total_pages integer;
