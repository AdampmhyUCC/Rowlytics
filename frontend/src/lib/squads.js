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

export async function fetchSquad(id) {
  return supabase.from('squads').select('squad_id, name, invite_code').eq('squad_id', id).maybeSingle();
}

export async function renameSquad(id, name) {
  return supabase.from('squads').update({ name: name.trim() }).eq('squad_id', id);
}

// Also removes everyone from it (squad_members cascades)
export async function deleteSquad(id) {
  return supabase.from('squads').delete().eq('squad_id', id);
}

// Name, joined_at and whether each athlete shares their training (get_squad_members in squads.sql)
export async function fetchSquadMembers(id) {
  return supabase.rpc('get_squad_members', { p_squad_id: id });
}

export async function removeSquadMember(squadId, athleteId) {
  return supabase.from('squad_members').delete().eq('squad_id', squadId).eq('athlete_id', athleteId);
}

// The old code stops working; returns the new one
export async function regenerateSquadCode(id) {
  return supabase.rpc('regenerate_squad_code', { p_squad_id: id });
}

// The text sent through the phone's share sheet. Under-16s can't join
// themselves, so the message tells them to pass it to a parent.
export function squadInviteMessage(squad) {
  return `Join my squad "${squad.name}" on Rowlytics with the code ${squad.invite_code}. `
    + 'If you are under 16, ask a parent to join for you.';
}

// Athletes' side (#33). Athletes can't read squads, so these go through the
// RPCs in squads.sql. athleteId is only passed by a parent acting for their
// under-16 child; leave it out for the signed-in athlete.
function forAthlete(athleteId) {
  return athleteId ? { p_athlete_id: athleteId } : {};
}

// Squad name, coach name and joined_at for each squad the athlete is in
export async function fetchJoinedSquads(athleteId) {
  return supabase.rpc('get_my_squads', forAthlete(athleteId));
}

// Returns { squad_name, coach_name, already_member }
export async function joinSquad(code, athleteId) {
  const { data, error } = await supabase.rpc('join_squad', { p_code: code, ...forAthlete(athleteId) });
  return { data: data?.[0], error };
}

export async function leaveSquad(squadId, athleteId) {
  return supabase.rpc('leave_squad', { p_squad_id: squadId, ...forAthlete(athleteId) });
}
