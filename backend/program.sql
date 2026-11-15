-- Squad training programs (issue #34). Safe to re-run. Run after squads.sql.
--
-- A coach plans sessions for one of their squads. Everyone in the squad sees
-- them in their training log and completes one by logging it as a normal
-- session linked to the plan (completed_training.planned_session_id).
-- Coaches only see completions as totals (get_coach_week_stats, #39), and only for
-- athletes who share their training with coaches.

CREATE TABLE IF NOT EXISTS public.planned_sessions (
  planned_session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id     UUID NOT NULL REFERENCES public.squads(squad_id) ON DELETE CASCADE,
  session_date DATE NOT NULL CHECK (session_date >= DATE '2000-01-01'),
  modality     VARCHAR(30) NOT NULL DEFAULT 'erg' CHECK (modality IN ('erg', 'water', 'other')),
  title        VARCHAR(80) NOT NULL CHECK (length(trim(title)) > 0),
  details      VARCHAR(500),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A squad's program is read by date
CREATE INDEX IF NOT EXISTS planned_sessions_squad_date ON public.planned_sessions (squad_id, session_date);

ALTER TABLE public.planned_sessions ENABLE ROW LEVEL SECURITY;

-- The squads the signed-in athlete is in. Athletes can't read squad_members
-- (squads.sql), so policies use this instead.
CREATE OR REPLACE FUNCTION public.my_squad_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.squad_id
  FROM public.squad_members m
  JOIN public.athletes a ON a.athlete_id = m.athlete_id
  WHERE a.profile_id = (SELECT auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.my_squad_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_squad_ids() TO authenticated;

-- The squad's owner manages its program. RLS on squads only shows the coach
-- their own squads, so the subquery is limited to those.
DROP POLICY IF EXISTS "planned_sessions_owner" ON public.planned_sessions;
CREATE POLICY "planned_sessions_owner" ON public.planned_sessions
  FOR ALL TO authenticated
  USING (squad_id IN (SELECT squad_id FROM public.squads WHERE owner_id = (SELECT auth.uid())))
  WITH CHECK (squad_id IN (SELECT squad_id FROM public.squads WHERE owner_id = (SELECT auth.uid())));

-- Active athletes see the programs of squads they're in
DROP POLICY IF EXISTS "planned_sessions_select_member" ON public.planned_sessions;
CREATE POLICY "planned_sessions_select_member" ON public.planned_sessions
  FOR SELECT TO authenticated
  USING ((SELECT public.is_active_athlete()) AND squad_id IN (SELECT public.my_squad_ids()));

-- Column grants: a session can't be moved to another squad once planned
REVOKE ALL ON public.planned_sessions FROM anon, authenticated;
GRANT SELECT, DELETE ON public.planned_sessions TO authenticated;
GRANT INSERT (squad_id, session_date, modality, title, details),
      UPDATE (session_date, modality, title, details)
  ON public.planned_sessions TO authenticated;

-- Which planned session a logged session completes (null for the athlete's
-- own sessions). Deleting the plan keeps the athlete's session in their log.
ALTER TABLE public.completed_training
  ADD COLUMN IF NOT EXISTS planned_session_id UUID
  REFERENCES public.planned_sessions(planned_session_id) ON DELETE SET NULL;

-- Each athlete completes a planned session once
CREATE UNIQUE INDEX IF NOT EXISTS completed_training_planned_once
  ON public.completed_training (athlete_id, planned_session_id);

-- Set only when the session is logged; editing it later keeps the link
GRANT INSERT (planned_session_id) ON public.completed_training TO authenticated;

-- An athlete can only link a session to a plan they can see, i.e. one from a
-- squad they're in. Restrictive, so it applies on top of
-- completed_training_own_active (consent.sql).
DROP POLICY IF EXISTS "completed_training_plan_visible" ON public.completed_training;
CREATE POLICY "completed_training_plan_visible" ON public.completed_training
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    planned_session_id IS NULL
    OR planned_session_id IN (SELECT planned_session_id FROM public.planned_sessions)
  );

-- Coach home page (issue #39): how each of the coach's squads is getting on
-- with one week of its program (p_week_start is the Monday). Only athletes who
-- share their training with coaches (coach_sharing_at, #30) are counted, and
-- only as totals, so the coach still can't see anyone else's training.
--   members:   athletes in the squad now
--   sharing:   of those, how many share their training (the ones counted)
--   planned:   the squad's planned sessions that week
--   completed: how many of those sessions the sharing athletes have logged
-- Busiest squads (most completed) first.
CREATE OR REPLACE FUNCTION public.get_coach_week_stats(p_week_start DATE)
RETURNS TABLE (squad_id UUID, name VARCHAR, members INT, sharing INT, planned INT, completed INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    s.squad_id,
    s.name,
    (SELECT count(*) FROM public.squad_members m WHERE m.squad_id = s.squad_id)::INT,
    (SELECT count(*) FROM public.squad_members m
     JOIN public.athletes a ON a.athlete_id = m.athlete_id
     WHERE m.squad_id = s.squad_id AND a.coach_sharing_at IS NOT NULL)::INT,
    (SELECT count(*) FROM public.planned_sessions ps
     WHERE ps.squad_id = s.squad_id
       AND ps.session_date BETWEEN p_week_start AND p_week_start + 6)::INT,
    (SELECT count(*) FROM public.completed_training ct
     JOIN public.planned_sessions ps ON ps.planned_session_id = ct.planned_session_id
     JOIN public.squad_members m ON m.squad_id = ps.squad_id AND m.athlete_id = ct.athlete_id
     JOIN public.athletes a ON a.athlete_id = ct.athlete_id
     WHERE ps.squad_id = s.squad_id
       AND ps.session_date BETWEEN p_week_start AND p_week_start + 6
       AND a.coach_sharing_at IS NOT NULL)::INT AS completed
  FROM public.squads s
  WHERE s.owner_id = (SELECT auth.uid())
  ORDER BY completed DESC, s.created_at;
$$;

REVOKE EXECUTE ON FUNCTION public.get_coach_week_stats(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_coach_week_stats(DATE) TO authenticated;
