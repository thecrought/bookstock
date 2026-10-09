-- Run once in Supabase SQL Editor before merging the ISBN feature.
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS isbn text;
