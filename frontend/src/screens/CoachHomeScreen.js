import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Link, router, useFocusEffect } from 'expo-router';
import { logError } from '../lib/log';
import { useRefreshKey } from '../lib/refresh';
import { formatAthleteCount } from '../lib/squads';
import { completionRate, fetchCoachWeekStats, fetchRecentPlans } from '../lib/program';
import { localDateString, parseDateString, weekStartString } from '../lib/training';
import { Button, Message, Screen, styles } from '../components/Form';
import { ChipGroup } from '../components/ChipGroup';
import { PlannedSessionCard } from '../components/PlannedSessionCard';

const WEEKS = [
  { value: 'this', label: 'This week' },
  { value: 'next', label: 'Next week' },
];

// Squads shown under "Most active squads"; the rest are on the Squads tab
const SQUADS_SHOWN = 3;

// Coach landing page (#39): how a squad is getting on with this or next
// week's program, the busiest squads and the sessions the coach planned last.
// Completion figures only count athletes who share their training.
export default function CoachHomeScreen() {
  const refreshKey = useRefreshKey();
  // Squad stats for this week and next, from get_coach_week_stats
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState(null);
  const [message, setMessage] = useState('');
  const [week, setWeek] = useState('this');
  const [squadId, setSquadId] = useState(null);

  // Reloads when the tab comes into view (e.g. after planning a session) and
  // when the header refresh button is pressed
  useFocusEffect(useCallback(() => {
    let current = true;
    const thisWeek = weekStartString();
    const nextMonday = parseDateString(thisWeek);
    nextMonday.setDate(nextMonday.getDate() + 7);
    Promise.all([
      fetchCoachWeekStats(thisWeek),
      fetchCoachWeekStats(localDateString(nextMonday)),
      fetchRecentPlans(),
    ]).then(([thisResult, nextResult, plansResult]) => {
      if (!current) return;
      logError('coachHome.thisWeek', thisResult.error);
      logError('coachHome.nextWeek', nextResult.error);
      logError('coachHome.recentPlans', plansResult.error);
      const error = thisResult.error ?? nextResult.error ?? plansResult.error;
      setMessage(error ? `Could not load your squads: ${error.message}` : '');
      if (!thisResult.error && !nextResult.error) setStats({ this: thisResult.data, next: nextResult.data });
      if (!plansResult.error) setRecent(plansResult.data);
    });
    return () => { current = false; };
  }, [refreshKey]));

  if (!stats) {
    return <Screen>{message ? <Message text={message} /> : <ActivityIndicator />}</Screen>;
  }

  if (stats.this.length === 0) {
    return (
      <Screen>
        <Message text={message} />
        <Text style={styles.label}>Welcome to Rowlytics</Text>
        <Text style={styles.subtle}>
          Create a squad and share its code with your athletes. Once they join, plan their training
          here and see how they're getting on.
        </Text>
        <Button title="Create a squad" onPress={() => router.push('/squad/new')} />
      </Screen>
    );
  }

  // Most active first (the database orders by sessions completed this week)
  const selectedId = squadId ?? stats.this[0].squad_id;
  const selected = stats[week].find((s) => s.squad_id === selectedId) ?? stats[week][0];

  return (
    <Screen>
      <Message text={message} />

      <Text style={styles.label}>Weekly completion</Text>
      <ChipGroup options={stats.this.map((s) => ({ value: s.squad_id, label: s.name }))}
        value={selected.squad_id} onChange={setSquadId} />
      <ChipGroup options={WEEKS} value={week} onChange={setWeek} />
      <CompletionCard squad={selected} week={week} />

      <Text style={[styles.label, { marginTop: 8 }]}>Most active squads</Text>
      <Text style={styles.subtle}>Planned sessions completed this week</Text>
      {stats.this.slice(0, SQUADS_SHOWN).map((squad) => <SquadRow key={squad.squad_id} squad={squad} />)}
      {stats.this.length > SQUADS_SHOWN
        ? <Link href="/squads" style={styles.link}>See all {stats.this.length} squads</Link>
        : null}

      <Text style={[styles.label, { marginTop: 8 }]}>Recently planned</Text>
      {recent?.length === 0 ? (
        <Text style={styles.subtle}>
          No sessions planned yet. Open a squad and tap "Plan a session" to start its program.
        </Text>
      ) : null}
      {recent?.map((plan) => (
        <PlannedSessionCard key={plan.planned_session_id} plan={plan}
          onPress={() => router.push(`/plan/${plan.planned_session_id}`)}
          accessibilityHint="Opens the planned session to edit or delete it" />
      ))}
    </Screen>
  );
}

// The selected squad's completion rate, and who it's based on
function CompletionCard({ squad, week }) {
  const rate = completionRate(squad);
  const when = week === 'this' ? 'this week' : 'next week';
  let note;
  if (!squad.planned) note = `No sessions planned for ${when}.`;
  else if (!squad.members) note = 'No athletes have joined this squad yet.';
  else if (!squad.sharing) note = 'None of this squad\'s athletes share their training with coaches yet.';
  else {
    note = `${squad.completed} of ${squad.planned * squad.sharing} planned sessions logged. `
      + `Based on ${squad.sharing} of ${formatAthleteCount(squad.members)} who share their training.`;
  }

  return (
    <View style={homeStyles.card} accessible
      accessibilityLabel={`${squad.name}, ${when}: ${rate === null ? 'no completion rate' : `${rate}% completed`}. ${note}`}>
      <Text style={homeStyles.rate}>{rate === null ? '–' : `${rate}%`}</Text>
      <Text style={homeStyles.note}>{note}</Text>
    </View>
  );
}

function SquadRow({ squad }) {
  return (
    <Pressable
      onPress={() => router.push(`/squad/${squad.squad_id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${squad.name}, ${squad.completed} sessions completed this week, ${formatAthleteCount(squad.members)}`}
      style={({ pressed }) => [homeStyles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={homeStyles.rowTitle}>{squad.name}</Text>
        <Text style={styles.subtle}>{formatAthleteCount(squad.members)} · {squad.sharing} sharing</Text>
      </View>
      <Text style={homeStyles.rowCount}>{squad.completed}</Text>
    </Pressable>
  );
}

const homeStyles = {
  card: { gap: 4, padding: 16, borderRadius: 12, backgroundColor: '#0f4c81' },
  rate: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  note: { color: '#cbd5e1' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff',
  },
  rowTitle: { fontWeight: '600', fontSize: 16, color: '#0f172a' },
  rowCount: { fontSize: 20, fontWeight: 'bold', color: '#0f4c81' },
};
