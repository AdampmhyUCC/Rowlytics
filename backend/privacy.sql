-- Privacy notice and sharing training data with coaches (issue #30). Safe to re-run.
-- Run after training.sql.
--
-- Active athletes see the privacy notice once (and again when its version goes
-- up in the app) and choose whether coaches can see their training. Sharing is
-- optional: athletes who say no keep using their own training log.
-- Coach access policies (#31, #33) must only show athletes with coach_sharing_at set.

-- privacy_notice_version: the newest notice the athlete has answered (null = never)
-- coach_sharing_at: when they agreed to share (null = not sharing)
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS privacy_notice_version SMALLINT,
  ADD COLUMN IF NOT EXISTS coach_sharing_at TIMESTAMPTZ;

-- Every choice is kept, so we can show when consent was given or withdrawn
-- and which version of the notice the athlete was shown (GDPR Article 7).
CREATE TABLE IF NOT EXISTS public.data_sharing_choices (
  choice_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id         UUID NOT NULL REFERENCES public.athletes(athlete_id) ON DELETE CASCADE,
  notice_version     SMALLINT NOT NULL CHECK (notice_version > 0),
  share_with_coaches BOOLEAN NOT NULL,
  chosen_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS data_sharing_choices_athlete
  ON public.data_sharing_choices (athlete_id, chosen_at DESC);

ALTER TABLE public.data_sharing_choices ENABLE ROW LEVEL SECURITY;

-- Read-only to clients; choices are saved through set_coach_sharing below
REVOKE ALL ON public.data_sharing_choices FROM anon, authenticated;
GRANT SELECT ON public.data_sharing_choices TO authenticated;

DROP POLICY IF EXISTS "data_sharing_choices_select_own" ON public.data_sharing_choices;
CREATE POLICY "data_sharing_choices_select_own" ON public.data_sharing_choices
  FOR SELECT TO authenticated
  USING (athlete_id IN (
    SELECT athlete_id FROM public.athletes WHERE profile_id = (SELECT auth.uid())
  ));

-- Called from the privacy notice screen. Saves the athlete's choice and the
-- notice version they saw, and records it in data_sharing_choices.
CREATE OR REPLACE FUNCTION public.set_coach_sharing(p_share BOOLEAN, p_notice_version INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_athlete_id UUID;
BEGIN
  SELECT athlete_id INTO v_athlete_id FROM public.athletes WHERE profile_id = (SELECT auth.uid());
  IF NOT FOUND OR NOT public.is_active_athlete() THEN
    RAISE EXCEPTION 'Only athletes using the app can choose how their data is shared';
  END IF;
  IF p_share IS NULL OR p_notice_version IS NULL OR p_notice_version < 1 THEN
    RAISE EXCEPTION 'Choose whether to share your training with coaches';
  END IF;

  UPDATE public.athletes
  SET privacy_notice_version = greatest(coalesce(privacy_notice_version, 0), p_notice_version),
      coach_sharing_at = CASE WHEN p_share THEN now() END
  WHERE athlete_id = v_athlete_id;

  INSERT INTO public.data_sharing_choices (athlete_id, notice_version, share_with_coaches)
  VALUES (v_athlete_id, p_notice_version, p_share);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_coach_sharing(BOOLEAN, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_coach_sharing(BOOLEAN, INT) TO authenticated;
