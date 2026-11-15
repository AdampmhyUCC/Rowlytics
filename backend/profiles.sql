-- Rowlytics user profiles (story #4: athlete profile creation)
-- Non-destructive and safe to re-run. Run in the Supabase SQL Editor after schema.sql.

-- One profile per Supabase Auth user. Deleting the auth user deletes the profile.
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       VARCHAR(20) NOT NULL DEFAULT 'athlete'
             CHECK (role IN ('athlete', 'coach', 'parent')),
  name       VARCHAR(100) NOT NULL CHECK (length(trim(name)) > 0),
  dob        DATE NOT NULL CHECK (dob <= CURRENT_DATE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- A signed-in user can only see and edit their own row.
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- No INSERT/DELETE policies: rows are created by the trigger below and
-- removed by the auth.users cascade.
-- Column grants stop users promoting themselves (e.g. role = 'coach').
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (name, dob) ON public.profiles TO authenticated;

-- Coaches (issue #31). Anyone can sign up as a coach, but the role on its own
-- shows them no athlete data: that only comes from athletes joining their
-- squads and choosing to share (#33). Coaches must be 18 or over and agree to
-- the safeguarding statement when they sign up.
-- safeguarding_agreed_at: when they agreed (set by the sign-up trigger only)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS safeguarding_agreed_at TIMESTAMPTZ;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_coach_safeguarding;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_coach_safeguarding CHECK (role <> 'coach' OR safeguarding_agreed_at IS NOT NULL);

-- Checked on sign-up and whenever a coach edits their date of birth
CREATE OR REPLACE FUNCTION public.check_coach_age()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.role = 'coach' AND (NEW.dob IS NULL OR NEW.dob > (CURRENT_DATE - INTERVAL '18 years')::date) THEN
    RAISE EXCEPTION 'Coaches must be 18 or over';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_check_coach_age ON public.profiles;
CREATE TRIGGER profiles_check_coach_age
  BEFORE INSERT OR UPDATE OF dob, role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_coach_age();

-- Link each athlete record to the account that owns it.
-- Nullable so existing test athletes (with no account) are kept.
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS profile_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Name and dob now live only in profiles. Older databases still have the
-- athletes copies; stop requiring them here so sign-up keeps working, and
-- consent.sql drops them once nothing reads them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'athletes' AND column_name = 'name') THEN
    ALTER TABLE public.athletes ALTER COLUMN name DROP NOT NULL;
    ALTER TABLE public.athletes ALTER COLUMN dob DROP NOT NULL;
  END IF;
END $$;

-- Remove the old open dev access: signed-out users can't touch athlete data.
DROP POLICY IF EXISTS "temp_dev_access" ON public.athletes;
DROP POLICY IF EXISTS "temp_dev_access" ON public.completed_training;

-- A signed-in athlete can only see their own athlete record.
DROP POLICY IF EXISTS "athletes_select_own" ON public.athletes;
CREATE POLICY "athletes_select_own" ON public.athletes
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = profile_id);

-- Create the profile and athlete record when someone signs up, using the name
-- and dob the app sends as sign-up metadata. The metadata can only ask to be a
-- coach; any other role in it is ignored and the user becomes an athlete.
-- Needs the parental_consents table from consent.sql.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- A parent opening a consent link signs in for the first time with only an
  -- email. They become a parent only if an athlete has an open request for it.
  IF NOT coalesce(NEW.raw_user_meta_data ? 'dob', false) AND EXISTS (
    SELECT 1 FROM public.parental_consents c
    WHERE c.parent_email = lower(NEW.email) AND c.approved_at IS NULL
  ) THEN
    -- Placeholder name until they enter theirs on the consent page
    INSERT INTO public.profiles (id, role, name)
    VALUES (NEW.id, 'parent', left(split_part(NEW.email, '@', 1), 100));
    RETURN NEW;
  END IF;

  -- Coaches get no athlete record, so they have no training log. Without the
  -- safeguarding agreement (or under 18) the checks above fail the sign-up.
  IF NEW.raw_user_meta_data ->> 'role' = 'coach' THEN
    INSERT INTO public.profiles (id, role, name, dob, safeguarding_agreed_at)
    VALUES (
      NEW.id,
      'coach',
      NEW.raw_user_meta_data ->> 'name',
      (NEW.raw_user_meta_data ->> 'dob')::date,
      CASE WHEN NEW.raw_user_meta_data ->> 'safeguarding_agreed' = 'true' THEN now() END
    );
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, name, dob)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'name',
    (NEW.raw_user_meta_data ->> 'dob')::date
  );
  INSERT INTO public.athletes (profile_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- athletes no longer copies name and dob, so nothing needs syncing
DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_athlete_from_profile();

-- Give athlete accounts created before this change their athlete record.
INSERT INTO public.athletes (profile_id)
SELECT p.id
FROM public.profiles p
WHERE p.role = 'athlete'
  AND NOT EXISTS (SELECT 1 FROM public.athletes a WHERE a.profile_id = p.id);
