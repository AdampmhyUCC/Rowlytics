import { supabase } from './supabase';

// Session types, matching the completed_training_modality_check constraint
export const MODALITIES = [
  { value: 'erg', label: 'Erg' },
  { value: 'water', label: 'Water' },
  { value: 'other', label: 'Other' },
];

export function modalityLabel(value) {
  return MODALITIES.find((m) => m.value === value)?.label ?? 'Other';
}

// Foster's session-RPE scale (Foster et al., 2001). 6, 8 and 9 have no words
// on the original scale; they sit between the anchors either side.
export const RPE_LABELS = {
  1: 'Very, very easy',
  2: 'Easy',
  3: 'Moderate',
  4: 'Somewhat hard',
  5: 'Hard',
  6: '',
  7: 'Very hard',
  8: '',
  9: '',
  10: 'Maximal',
};

const SESSION_COLUMNS = 'completed_training_id, session_date, modality, distance_m, duration_seconds, rpe, notes';

// RLS only returns the signed-in athlete's own sessions. Newest first; sessions
// on the same day are ordered by when they were logged.
export async function fetchSessions({ limit } = {}) {
  let query = supabase
    .from('completed_training')
    .select(SESSION_COLUMNS)
    .order('session_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (limit) query = query.limit(limit);
  return query;
}

// Total metres and seconds for the current week (Monday to Sunday)
export async function fetchWeekTotals() {
  const { data, error } = await supabase
    .from('completed_training')
    .select('distance_m, duration_seconds')
    .gte('session_date', weekStartString())
    .lte('session_date', weekEndString());
  if (error) return { error };
  return {
    totals: {
      metres: data.reduce((sum, s) => sum + (s.distance_m ?? 0), 0),
      seconds: data.reduce((sum, s) => sum + s.duration_seconds, 0),
    },
  };
}

export async function fetchSession(id) {
  return supabase
    .from('completed_training')
    .select(SESSION_COLUMNS)
    .eq('completed_training_id', id)
    .maybeSingle();
}

const pad = (n) => String(n).padStart(2, '0');

// 1450 -> "24:10", 4530 -> "1:15:30"
export function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// Average time per 500 m, the standard rowing pace: 1450 s over 6000 m -> "2:00.8"
export function formatSplit(totalSeconds, distanceM) {
  if (!distanceM) return null;
  const tenths = Math.round((totalSeconds / distanceM) * 500 * 10);
  const m = Math.floor(tenths / 600);
  const s = Math.floor((tenths % 600) / 10);
  return `${m}:${pad(s)}.${tenths % 10}`;
}

// 6000 -> "6,000 m" (built by hand so phones and web format it the same)
export function formatDistance(distanceM) {
  return `${String(distanceM).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} m`;
}

// The phone's own calendar date as YYYY-MM-DD. toISOString() would use UTC,
// which is the previous day for late-night sessions in summer time.
export function localDateString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayString() {
  return localDateString(new Date());
}

export function yesterdayString() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return localDateString(date);
}

// Monday and Sunday of the week containing date (weeks run Monday to Sunday)
export function weekStartString(date = new Date()) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return localDateString(monday);
}

export function weekEndString(date = new Date()) {
  const sunday = parseDateString(weekStartString(date));
  sunday.setDate(sunday.getDate() + 6);
  return localDateString(sunday);
}

// Weekly total: 12300 -> "3h 25m", 2700 -> "45m"
export function formatTotalTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

// "2026-11-03" -> Date at local midnight (new Date('2026-11-03') would be UTC)
export function parseDateString(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-11-03" -> "Mon 3 Nov", with the year added if it isn't this year
export function formatSessionDate(dateString) {
  const date = parseDateString(dateString);
  const text = `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === new Date().getFullYear() ? text : `${text} ${date.getFullYear()}`;
}
