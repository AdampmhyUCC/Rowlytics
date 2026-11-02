-- Rowlytics parental consent (story #5)
-- Non-destructive and safe to re-run. Run in the Supabase SQL Editor after profiles.sql.
--
-- Athletes under 16 need a parent's consent before they can use the app.
-- Whether an athlete is pending is worked out from their data, not stored,
-- so an athlete who turns 16 is let in automatically:
--   pending = under 16 and athletes.parental_consent_at is not set
--   active  = everyone else

-- Emails can be up to 254 characters
ALTER TABLE public.athletes ALTER COLUMN parental_consent_by TYPE VARCHAR(254);

-- Parents get an account (role 'parent') when they first open the consent
-- link. They have no date of birth, so dob is only required for athletes.
ALTER TABLE public.profiles ALTER COLUMN dob DROP NOT NULL;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_athlete_dob;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_athlete_dob CHECK (role <> 'athlete' OR dob IS NOT NULL);

-- One row per consent request: who was asked, for which athlete, and when they
-- approved. parent_email and parent_name are kept even if the parent's account
-- is deleted, so the record of who consented survives.
CREATE TABLE IF NOT EXISTS public.parental_consents (
  consent_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id   UUID NOT NULL REFERENCES public.athletes(athlete_id) ON DELETE CASCADE,
  parent_email VARCHAR(254) NOT NULL CHECK (parent_email = lower(trim(parent_email))),
  parent_name  VARCHAR(100),
  parent_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at  TIMESTAMPTZ,
  CHECK (approved_at IS NULL OR parent_name IS NOT NULL)
);

-- An athlete has at most one open request; sending a new one replaces it
CREATE UNIQUE INDEX IF NOT EXISTS parental_consents_one_open
  ON public.parental_consents (athlete_id) WHERE approved_at IS NULL;
CREATE INDEX IF NOT EXISTS parental_consents_open_by_email
  ON public.parental_consents (parent_email) WHERE approved_at IS NULL;

ALTER TABLE public.parental_consents ENABLE ROW LEVEL SECURITY;

-- Read-only to clients; requests and approvals go through the functions below
REVOKE ALL ON public.parental_consents FROM anon, authenticated;
GRANT SELECT ON public.parental_consents TO authenticated;

-- An athlete can see their own requests (the waiting screen shows where it was sent)
DROP POLICY IF EXISTS "parental_consents_select_athlete" ON public.parental_consents;
CREATE POLICY "parental_consents_select_athlete" ON public.parental_consents
  FOR SELECT TO authenticated
  USING (athlete_id IN (
    SELECT athlete_id FROM public.athletes WHERE profile_id = (SELECT auth.uid())
  ));

-- The single rule for who is waiting on consent
CREATE OR REPLACE FUNCTION public.needs_parental_consent(dob DATE, consent_at TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT consent_at IS NULL AND dob > CURRENT_DATE - INTERVAL '16 years';
$$;

-- True when the signed-in user is an athlete allowed to use the app.
-- Every table holding athlete activity must use this in its RLS policies,
-- so pending athletes are blocked by the database, not just the UI.
CREATE OR REPLACE FUNCTION public.is_active_athlete()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.athletes a
    WHERE a.profile_id = (SELECT auth.uid())
      AND NOT public.needs_parental_consent(a.dob, a.parental_consent_at)
  );
$$;

-- Training data: an active athlete can manage only their own sessions
DROP POLICY IF EXISTS "completed_training_own_active" ON public.completed_training;
CREATE POLICY "completed_training_own_active" ON public.completed_training
  FOR ALL TO authenticated
  USING (
    (SELECT public.is_active_athlete())
    AND athlete_id IN (SELECT athlete_id FROM public.athletes WHERE profile_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    (SELECT public.is_active_athlete())
    AND athlete_id IN (SELECT athlete_id FROM public.athletes WHERE profile_id = (SELECT auth.uid()))
  );

-- Stop a pending athlete editing their date of birth to 16+ to skip consent.
-- Profile edits reach athletes through sync_athlete_from_profile, so raising
-- here rolls back the profile update too.
CREATE OR REPLACE FUNCTION public.lock_dob_while_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.dob IS DISTINCT FROM OLD.dob
     AND public.needs_parental_consent(OLD.dob, OLD.parental_consent_at) THEN
    RAISE EXCEPTION 'Date of birth can''t be changed while waiting for parental consent';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS athletes_lock_dob_while_pending ON public.athletes;
CREATE TRIGGER athletes_lock_dob_while_pending
  BEFORE UPDATE OF dob ON public.athletes
  FOR EACH ROW EXECUTE FUNCTION public.lock_dob_while_pending();

-- Called by a pending athlete before the app emails their parent a sign-in link.
-- The open request is what lets that email address sign up as a parent.
CREATE OR REPLACE FUNCTION public.request_parental_consent(p_parent_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_athlete public.athletes;
  v_email TEXT := lower(trim(p_parent_email));
BEGIN
  SELECT * INTO v_athlete FROM public.athletes WHERE profile_id = (SELECT auth.uid());
  IF NOT FOUND OR NOT public.needs_parental_consent(v_athlete.dob, v_athlete.parental_consent_at) THEN
    RAISE EXCEPTION 'Only athletes waiting for parental consent can send a request';
  END IF;
  IF v_email IS NULL OR v_email !~ '^\S+@\S+\.\S+$' OR length(v_email) > 254 THEN
    RAISE EXCEPTION 'Enter a valid email address for your parent';
  END IF;
  IF v_email = (SELECT lower(email) FROM auth.users WHERE id = (SELECT auth.uid())) THEN
    RAISE EXCEPTION 'Enter your parent''s email address, not your own';
  END IF;

  -- Replace any earlier request, e.g. one sent to a mistyped email
  DELETE FROM public.parental_consents
  WHERE athlete_id = v_athlete.athlete_id AND approved_at IS NULL;
  INSERT INTO public.parental_consents (athlete_id, parent_email)
  VALUES (v_athlete.athlete_id, v_email);
END;
$$;

-- Called from the parent confirmation page by the signed-in parent.
-- Saves who consented and when, which activates the athlete.
CREATE OR REPLACE FUNCTION public.approve_parental_consent(p_consent_id UUID, p_parent_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email TEXT;
  v_name TEXT := trim(p_parent_name);
  v_consent public.parental_consents;
BEGIN
  -- Only a confirmed email proves the caller has access to the parent's inbox
  SELECT lower(email) INTO v_email FROM auth.users
  WHERE id = (SELECT auth.uid()) AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Open the link in your email before giving consent';
  END IF;
  IF v_name IS NULL OR v_name = '' OR length(v_name) > 100 THEN
    RAISE EXCEPTION 'Enter your full name';
  END IF;

  SELECT * INTO v_consent FROM public.parental_consents
  WHERE consent_id = p_consent_id AND parent_email = v_email AND approved_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This consent request was not found or has already been approved';
  END IF;

  UPDATE public.parental_consents
  SET approved_at = now(), parent_id = (SELECT auth.uid()), parent_name = v_name
  WHERE consent_id = p_consent_id;

  UPDATE public.athletes
  SET parental_consent_at = now(), parental_consent_by = v_email
  WHERE athlete_id = v_consent.athlete_id;

  -- Replace the placeholder name the parent's account was created with
  UPDATE public.profiles SET name = v_name
  WHERE id = (SELECT auth.uid()) AND role = 'parent';
END;
$$;

-- Only signed-in users can call the consent functions
REVOKE EXECUTE ON FUNCTION public.is_active_athlete() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_parental_consent(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_parental_consent(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_athlete() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_parental_consent(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_parental_consent(UUID, TEXT) TO authenticated;
