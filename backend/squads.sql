-- Training squads (issue #32). Safe to re-run. Run after privacy.sql.
--
-- A coach creates squads and shares each squad's invite code with athletes
-- themselves (e.g. by text message). Athletes join with the code in #33.
-- Being a coach shows no athlete data on its own: a coach only sees athletes
-- in their own squads, and only their names here. Training is shown later
-- (#34) and only for athletes with coach_sharing_at set.

-- Invite codes avoid letters and digits that look alike (0/O, 1/I/L), so they
-- can be read out or typed from a text message. 8 characters from 31 gives
-- about 850 billion codes, so they can't be guessed.
CREATE OR REPLACE FUNCTION public.new_squad_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SET search_path = ''
AS $$
DECLARE
  v_alphabet CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes BYTEA := extensions.gen_random_bytes(8);
  v_code TEXT := '';
BEGIN
  FOR i IN 0..7 LOOP
    v_code := v_code || substr(v_alphabet, get_byte(v_bytes, i) % length(v_alphabet) + 1, 1);
  END LOOP;
  RETURN v_code;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.new_squad_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.new_squad_code() TO authenticated;

-- kind: 'coach' squads are made by coaches. 'friends' is kept for squads
-- athletes make among themselves later (Iteration 3); nobody can create one yet.
CREATE TABLE IF NOT EXISTS public.squads (
  squad_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind        VARCHAR(20) NOT NULL DEFAULT 'coach' CHECK (kind IN ('coach', 'friends')),
  name        VARCHAR(60) NOT NULL CHECK (length(trim(name)) > 0),
  invite_code CHAR(8) NOT NULL UNIQUE DEFAULT public.new_squad_code(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS squads_owner ON public.squads (owner_id, created_at);

-- Athletes in each squad. Leaving or being removed deletes the row.
CREATE TABLE IF NOT EXISTS public.squad_members (
  squad_id   UUID NOT NULL REFERENCES public.squads(squad_id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES public.athletes(athlete_id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (squad_id, athlete_id)
);

-- The primary key covers lookups by squad; this one is for "my squads" (#33)
CREATE INDEX IF NOT EXISTS squad_members_athlete ON public.squad_members (athlete_id);

ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;

-- Owners see and manage their own squads. Only coaches can create coach squads.
DROP POLICY IF EXISTS "squads_select_own" ON public.squads;
CREATE POLICY "squads_select_own" ON public.squads
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "squads_insert_coach" ON public.squads;
CREATE POLICY "squads_insert_coach" ON public.squads
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND kind = 'coach'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'coach')
  );

DROP POLICY IF EXISTS "squads_update_own" ON public.squads;
CREATE POLICY "squads_update_own" ON public.squads
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "squads_delete_own" ON public.squads;
CREATE POLICY "squads_delete_own" ON public.squads
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()));

-- Column grants: the app only sends the name. Owner, kind and invite code are
-- set by the defaults above; codes change only through regenerate_squad_code.
REVOKE ALL ON public.squads FROM anon, authenticated;
GRANT SELECT, DELETE ON public.squads TO authenticated;
GRANT INSERT (name), UPDATE (name) ON public.squads TO authenticated;

-- Owners see who is in their squads and can remove people (e.g. after a code
-- leaks). Joining is through an RPC in #33, so there's no INSERT here.
DROP POLICY IF EXISTS "squad_members_select_owner" ON public.squad_members;
CREATE POLICY "squad_members_select_owner" ON public.squad_members
  FOR SELECT TO authenticated
  USING (squad_id IN (SELECT squad_id FROM public.squads WHERE owner_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "squad_members_delete_owner" ON public.squad_members;
CREATE POLICY "squad_members_delete_owner" ON public.squad_members
  FOR DELETE TO authenticated
  USING (squad_id IN (SELECT squad_id FROM public.squads WHERE owner_id = (SELECT auth.uid())));

REVOKE ALL ON public.squad_members FROM anon, authenticated;
GRANT SELECT, DELETE ON public.squad_members TO authenticated;

-- The athletes in one of the caller's squads. Coaches can't read profiles or
-- athletes directly, so this returns only the name, when they joined and
-- whether they share their training with coaches (#30). Nothing for a squad
-- the caller doesn't own.
CREATE OR REPLACE FUNCTION public.get_squad_members(p_squad_id UUID)
RETURNS TABLE (athlete_id UUID, name VARCHAR, joined_at TIMESTAMPTZ, sharing BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.athlete_id, p.name, m.joined_at, a.coach_sharing_at IS NOT NULL
  FROM public.squad_members m
  JOIN public.squads s ON s.squad_id = m.squad_id
  JOIN public.athletes a ON a.athlete_id = m.athlete_id
  JOIN public.profiles p ON p.id = a.profile_id
  WHERE m.squad_id = p_squad_id
    AND s.owner_id = (SELECT auth.uid())
  ORDER BY p.name;
$$;

-- Gives a squad a new invite code, so the old one stops working. Athletes
-- already in the squad stay in it.
CREATE OR REPLACE FUNCTION public.regenerate_squad_code(p_squad_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code TEXT;
BEGIN
  -- Try again on the very rare clash with another squad's code
  FOR attempt IN 1..5 LOOP
    BEGIN
      UPDATE public.squads SET invite_code = public.new_squad_code()
      WHERE squad_id = p_squad_id AND owner_id = (SELECT auth.uid())
      RETURNING invite_code INTO v_code;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Squad not found';
      END IF;
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      -- loop and try a different code
    END;
  END LOOP;
  RAISE EXCEPTION 'Could not make a new code, try again';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_squad_members(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.regenerate_squad_code(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_squad_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_squad_code(UUID) TO authenticated;
