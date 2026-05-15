-- ============================================================
-- Lisa Workout Tracker — Database Schema
-- Paste this entire file into the Supabase SQL Editor and run it.
-- ============================================================

-- Tables
CREATE TABLE public.blocks (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('strength', 'cardio', 'core', 'recovery')),
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE public.exercises (
  id SERIAL PRIMARY KEY,
  block_id INTEGER NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sets INTEGER,
  reps TEXT,
  starting_weight TEXT,
  notes TEXT,
  neck_flag BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE public.sessions (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  block_id INTEGER REFERENCES public.blocks(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.sets_log (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES public.exercises(id),
  set_number INTEGER NOT NULL,
  weight NUMERIC,
  reps INTEGER,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.cardio_log (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  session_id INTEGER REFERENCES public.sessions(id),
  type TEXT NOT NULL CHECK (type IN ('interval_run', 'sustained_run', 'zone2')),
  subtype TEXT CHECK (subtype IN ('treadmill', 'peloton')),
  duration_minutes INTEGER,
  avg_hr INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.vo2max_log (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  value NUMERIC NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('manual', 'apple_watch')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: enable + permissive anon policy on all tables
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON public.blocks FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON public.exercises FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON public.sessions FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE public.sets_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON public.sets_log FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE public.cardio_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON public.cardio_log FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE public.vo2max_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON public.vo2max_log FOR ALL TO anon USING (true) WITH CHECK (true);

-- Seed: Blocks
INSERT INTO public.blocks (name, type, description, sort_order) VALUES
  ('Lower Body',  'strength', 'Leg press, curls, deadlifts, extensions, abduction/adduction, calf raises', 1),
  ('Upper Body',  'strength', 'Chest press, lat pulldown, rows, curls, pushdowns, face pulls', 2),
  ('Cardio',      'cardio',   'Interval run, sustained run, or Zone 2 session', 3),
  ('Core',        'core',     'Dead bug, plank, side plank, Pallof press, woodchop, bird dog, rollout', 4),
  ('Recovery',    'recovery', 'Easy Peloton ride, long dog walk, or stretching', 5);

-- Seed: Block 1 — Lower Body
INSERT INTO public.exercises (block_id, name, sets, reps, starting_weight, neck_flag, sort_order) VALUES
  (1, 'Seated Leg Press',    3, '10-12',       '120 lbs',         false, 1),
  (1, 'Leg Curl',            3, '12',          '25 lbs',          false, 2),
  (1, 'Romanian Deadlift',   3, '10',          '17.5 lbs (DBs)',  false, 3),
  (1, 'Leg Extension',       2, '15',          '37.5 lbs',        false, 4),
  (1, 'Hip Abduction',       2, '15',          null,              false, 5),
  (1, 'Hip Adduction',       2, '15',          null,              false, 6),
  (1, 'Calf Raise',          2, '20',          '12.5 lbs (DBs)',  false, 7);

-- Seed: Block 2 — Upper Body
INSERT INTO public.exercises (block_id, name, sets, reps, starting_weight, neck_flag, sort_order) VALUES
  (2, 'Chest Press',         3, '10-12',  '25 lbs',  false, 1),
  (2, 'Lat Pulldown',        3, '10-12',  null,      false, 2),
  (2, 'Seated Cable Row',    3, '12',     null,      false, 3),
  (2, 'Arm Curl',            2, '12',     null,      false, 4),
  (2, 'Tricep Pushdown',     2, '12',     null,      false, 5),
  (2, 'Face Pull',           2, '15',     null,      true,  6);

-- Seed: Block 4 — Core
INSERT INTO public.exercises (block_id, name, sets, reps, starting_weight, neck_flag, sort_order) VALUES
  (4, 'Dead Bug',                3, '10 each side',  'Bodyweight',  false, 1),
  (4, 'Plank',                   3, '30-45 sec',     'Bodyweight',  false, 2),
  (4, 'Side Plank with Dips',    3, '12 each side',  'Bodyweight',  false, 3),
  (4, 'Pallof Press',            3, '10 each side',  null,          false, 4),
  (4, 'Cable Woodchop',          2, '12 each side',  null,          false, 5),
  (4, 'Bird Dog',                2, '10 each side',  'Bodyweight',  false, 6),
  (4, 'Stability Ball Rollout',  2, '10',            'Bodyweight',  false, 7);

-- Seed: VO2max baseline
INSERT INTO public.vo2max_log (date, value, source) VALUES
  (CURRENT_DATE, 29, 'manual');
