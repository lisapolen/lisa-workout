-- ============================================================
-- Multi-user migration
-- Run this entire script in the Supabase SQL Editor
-- ============================================================

-- 1. Create users table
CREATE TABLE public.users (
  id         serial PRIMARY KEY,
  name       text NOT NULL,
  color      text NOT NULL DEFAULT '#C4714A',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON public.users FOR ALL TO anon USING (true) WITH CHECK (true);

-- 2. Seed users
INSERT INTO public.users (id, name, color) VALUES
  (1, 'Lisa', '#C4714A'),
  (2, 'David', '#6B9E8F');

-- Reset sequence so next INSERT gets id=3
SELECT setval('public.users_id_seq', 2);

-- 3. Add user_id to sessions
ALTER TABLE public.sessions ADD COLUMN user_id integer REFERENCES public.users(id);
UPDATE public.sessions SET user_id = 1 WHERE user_id IS NULL;

-- 4. Add user_id to cardio_log
ALTER TABLE public.cardio_log ADD COLUMN user_id integer REFERENCES public.users(id);
UPDATE public.cardio_log SET user_id = 1 WHERE user_id IS NULL;

-- 5. Add user_id to walks_log
ALTER TABLE public.walks_log ADD COLUMN user_id integer REFERENCES public.users(id);
UPDATE public.walks_log SET user_id = 1 WHERE user_id IS NULL;

-- 6. Add user_id to vo2max_log
ALTER TABLE public.vo2max_log ADD COLUMN user_id integer REFERENCES public.users(id);
UPDATE public.vo2max_log SET user_id = 1 WHERE user_id IS NULL;

-- 7. Add user_id to plans
ALTER TABLE public.plans ADD COLUMN user_id integer REFERENCES public.users(id);
UPDATE public.plans SET user_id = 1 WHERE user_id IS NULL;
