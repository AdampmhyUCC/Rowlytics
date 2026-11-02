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

-- Link each athlete record to the account that owns it.
-- Nullable so existing test athletes (with no account) are kept.
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS profile_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Remove the old open dev access: signed-out users can't touch athlete data.
DROP POLICY IF EXISTS "temp_dev_access" ON public.athletes;
DROP POLICY IF EXISTS "temp_dev_access" ON public.completed_training;

-- A signed-in athlete can only see their own athlete record.
DROP POLICY IF EXISTS "athletes_select_own" ON public.athletes;
CREATE POLICY "athletes_select_own" ON public.athletes
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = profile_id);

-- Create the profile and athlete record when someone signs up, using the name
-- and dob the app sends as sign-up metadata. Role is never taken from the client.
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

  INSERT INTO public.profiles (id, name, dob)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'name',
    (NEW.raw_user_meta_data ->> 'dob')::date
  );
  -- Everyone who signs up is an athlete for now. When coaches/parents can
  -- sign up, only do this for role = 'athlete'.
  INSERT INTO public.athletes (profile_id, name, dob)
  SELECT id, name, dob FROM public.profiles WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Keep the athlete's name and dob in step when they edit their profile.
CREATE OR REPLACE FUNCTION public.sync_athlete_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.athletes
  SET name = NEW.name, dob = NEW.dob
  WHERE profile_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated
  AFTER UPDATE OF name, dob ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_athlete_from_profile();

-- Give athlete accounts created before this change their athlete record.
INSERT INTO public.athletes (profile_id, name, dob)
SELECT p.id, p.name, p.dob
FROM public.profiles p
WHERE p.role = 'athlete'
  AND NOT EXISTS (SELECT 1 FROM public.athletes a WHERE a.profile_id = p.id);
