import { supabase } from './supabase';
import { fetchJoinedSquads } from './squads';
import { localDateString, weekStartString } from './training';

// Squad training programs (#34, program.sql). RLS lets a coach manage their
// own squads' planned sessions and lets athletes read their squads' ones.

const PLAN_COLUMNS = 'planned_session_id, squad_id, session_date, modality, title, details';

// A squad's program from the start of this week, soonest first
export async function fetchSquadProgram(squadId) {
  return supabase
    .from('planned_sessions')
    .select(PLAN_COLUMNS)
    .eq('squad_id', squadId)
    .gte('session_date', weekStartString())
    .order('session_date')
    .order('created_at');
}

export async function fetchPlannedSession(id) {
  return supabase.from('planned_sessions').select(PLAN_COLUMNS).eq('planned_session_id', id).maybeSingle();
}

// form: { date, modality, title, details } from the planned session form
function planRow(form) {
  return {
    session_date: form.date,
    modality: form.modality,
    title: form.title.trim(),
    details: form.details.trim() || null,
  };
}

export async function createPlannedSession(squadId, form) {
  return supabase.from('planned_sessions').insert({ squad_id: squadId, ...planRow(form) });
}

export async function updatePlannedSession(id, form) {
  return supabase.from('planned_sessions').update(planRow(form)).eq('planned_session_id', id);
}

// Athletes' sessions logged against it stay in their logs, unlinked
export async function deletePlannedSession(id) {
  return supabase.from('planned_sessions').delete().eq('planned_session_id', id);
}

// Athletes: planned sessions from their squads that they haven't logged yet,
// from a week ago on (so a missed one stays for a few days), soonest first.
// Each comes with its squad's name, which athletes can only get from get_my_squads.
export async function fetchMyPlannedSessions() {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const [plans, logged, squads] = await Promise.all([
    supabase
      .from('planned_sessions')
      .select(PLAN_COLUMNS)
      .gte('session_date', localDateString(since))
      .order('session_date')
      .order('created_at'),
    supabase.from('completed_training').select('planned_session_id').not('planned_session_id', 'is', null),
    fetchJoinedSquads(),
  ]);
  const error = plans.error ?? logged.error ?? squads.error;
  if (error) return { error };
  const done = new Set(logged.data.map((s) => s.planned_session_id));
  const squadNames = new Map(squads.data.map((s) => [s.squad_id, s.name]));
  return {
    data: plans.data
      .filter((plan) => !done.has(plan.planned_session_id))
      .map((plan) => ({ ...plan, squadName: squadNames.get(plan.squad_id) })),
  };
}
