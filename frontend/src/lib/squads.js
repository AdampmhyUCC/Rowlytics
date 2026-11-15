import { supabase } from './supabase';

// RLS only returns the signed-in coach's own squads. Oldest first, so the
// list doesn't reorder as squads are added.
export async function fetchMySquads() {
  const { data, error } = await supabase
    .from('squads')
    .select('squad_id, name, invite_code, created_at, squad_members(count)')
    .order('created_at');
  if (error) return { error };
  // squad_members(count) comes back as [{ count: n }]
  return {
    data: data.map(({ squad_members, ...squad }) => ({ ...squad, memberCount: squad_members[0]?.count ?? 0 })),
  };
}

// The owner, kind and invite code are filled in by the database (squads.sql)
export async function createSquad(name) {
  return supabase.from('squads').insert({ name: name.trim() }).select('squad_id').single();
}

// 1 -> "1 athlete", 3 -> "3 athletes"
export function formatAthleteCount(count) {
  return `${count} ${count === 1 ? 'athlete' : 'athletes'}`;
}
