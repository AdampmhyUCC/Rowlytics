-- Training log (issue #6). Safe to re-run.
-- Run after profiles.sql and consent.sql. Access to completed_training is the
-- completed_training_own_active policy in consent.sql: only active athletes
-- (16+ or parent approved) can see or change their own sessions.

-- The signed-in user's athlete record, so the app doesn't have to send it
CREATE OR REPLACE FUNCTION public.my_athlete_id()
RETURNS UUID
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT athlete_id FROM public.athletes WHERE profile_id = (SELECT auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.my_athlete_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_athlete_id() TO authenticated;

ALTER TABLE public.completed_training
  ALTER COLUMN athlete_id SET DEFAULT public.my_athlete_id();

-- Orders sessions logged on the same day, newest first
ALTER TABLE public.completed_training
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Every session needs a duration and RPE; distance is optional (e.g. weights).
-- volume is the distance in metres.
-- If these fail, old test rows break the rules: delete them and run again.
ALTER TABLE public.completed_training
  ALTER COLUMN duration_minutes SET NOT NULL,
  ALTER COLUMN rpe SET NOT NULL;

ALTER TABLE public.completed_training
  DROP CONSTRAINT IF EXISTS completed_training_duration_range,
  DROP CONSTRAINT IF EXISTS completed_training_distance_range,
  DROP CONSTRAINT IF EXISTS completed_training_date_range;
ALTER TABLE public.completed_training
  ADD CONSTRAINT completed_training_duration_range CHECK (duration_minutes BETWEEN 1 AND 600),
  ADD CONSTRAINT completed_training_distance_range CHECK (volume BETWEEN 0 AND 100000),
  ADD CONSTRAINT completed_training_date_range CHECK (session_date >= DATE '2000-01-01');

-- History is read per athlete, newest first
CREATE INDEX IF NOT EXISTS completed_training_athlete_date
  ON public.completed_training (athlete_id, session_date DESC, created_at DESC);

-- Column grants: athletes can't pick the athlete_id (it defaults to their own)
-- or mark a session as coach-verified (self_reported)
REVOKE ALL ON public.completed_training FROM anon, authenticated;
GRANT SELECT, DELETE ON public.completed_training TO authenticated;
GRANT INSERT (session_date, volume, duration_minutes, rpe, notes),
      UPDATE (session_date, volume, duration_minutes, rpe, notes)
  ON public.completed_training TO authenticated;
