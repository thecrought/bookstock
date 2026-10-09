-- Run once in Supabase SQL Editor before deploying the ISBN branch.
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS isbn text;
CREATE UNIQUE INDEX IF NOT EXISTS books_owner_isbn_unique ON public.books (user_id, isbn) WHERE isbn IS NOT NULL;
