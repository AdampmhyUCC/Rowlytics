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

-- Columns from the first version of this file:
--   volume           -> distance_m (metres; "volume" will mean training load later)
--   duration_minutes -> duration_seconds (rowers time pieces to the second)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'completed_training' AND column_name = 'volume') THEN
    ALTER TABLE public.completed_training RENAME COLUMN volume TO distance_m;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'completed_training' AND column_name = 'duration_minutes') THEN
    ALTER TABLE public.completed_training DROP CONSTRAINT IF EXISTS completed_training_duration_range;
    ALTER TABLE public.completed_training RENAME COLUMN duration_minutes TO duration_seconds;
    UPDATE public.completed_training SET duration_seconds = duration_seconds * 60;
  END IF;
END $$;

-- Session type: erg, on the water, or anything else for now
UPDATE public.completed_training SET modality = 'erg' WHERE modality IS NULL;
ALTER TABLE public.completed_training
  ALTER COLUMN modality SET DEFAULT 'erg',
  ALTER COLUMN modality SET NOT NULL,
  ALTER COLUMN duration_seconds SET NOT NULL,
  ALTER COLUMN rpe SET NOT NULL;

-- If these fail, old test rows break the rules: delete them and run again.
-- Distance is optional only for "other" sessions (e.g. weights), where it means nothing.
ALTER TABLE public.completed_training
  DROP CONSTRAINT IF EXISTS completed_training_duration_range,
  DROP CONSTRAINT IF EXISTS completed_training_distance_range,
  DROP CONSTRAINT IF EXISTS completed_training_date_range,
  DROP CONSTRAINT IF EXISTS completed_training_modality_check,
  DROP CONSTRAINT IF EXISTS completed_training_distance_required,
  DROP CONSTRAINT IF EXISTS completed_training_notes_length;
ALTER TABLE public.completed_training
  ADD CONSTRAINT completed_training_duration_range CHECK (duration_seconds BETWEEN 1 AND 21600),
  ADD CONSTRAINT completed_training_distance_range CHECK (distance_m BETWEEN 1 AND 100000),
  ADD CONSTRAINT completed_training_date_range CHECK (session_date >= DATE '2000-01-01'),
  ADD CONSTRAINT completed_training_modality_check CHECK (modality IN ('erg', 'water', 'other')),
  ADD CONSTRAINT completed_training_distance_required CHECK (modality = 'other' OR distance_m IS NOT NULL),
  ADD CONSTRAINT completed_training_notes_length CHECK (char_length(notes) <= 500);

-- History is read per athlete, newest first
CREATE INDEX IF NOT EXISTS completed_training_athlete_date
  ON public.completed_training (athlete_id, session_date DESC, created_at DESC);

-- Column grants: athletes can't pick the athlete_id (it defaults to their own)
-- or mark a session as coach-verified (self_reported)
REVOKE ALL ON public.completed_training FROM anon, authenticated;
GRANT SELECT, DELETE ON public.completed_training TO authenticated;
GRANT INSERT (session_date, modality, distance_m, duration_seconds, rpe, notes),
      UPDATE (session_date, modality, distance_m, duration_seconds, rpe, notes)
  ON public.completed_training TO authenticated;
