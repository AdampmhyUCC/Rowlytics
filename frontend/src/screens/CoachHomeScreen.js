import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { logError } from '../lib/log';
import { useRefreshKey } from '../lib/refresh';
import { formatAthleteCount } from '../lib/squads';
import { completionRate, fetchCoachWeekStats, fetchRecentPlans } from '../lib/program';
import { formatSessionDate, formatWeekRange, localDateString, parseDateString, weekStartString } from '../lib/training';
import { Button, Footer, Message, Screen, styles } from '../components/Form';
import { ChipGroup } from '../components/ChipGroup';
import { PlannedSessionCard } from '../components/PlannedSessionCard';
import { SectionHeading } from '../components/SectionHeading';

// Squads shown under "Most active squads"; the rest are on the Squads tab
const SQUADS_SHOWN = 3;

// Below this many sharing athletes, one athlete moves the rate a lot
const SMALL_GROUP = 3;

// Coach landing page (#39): how a squad is getting on with this week's
// program (or what's planned for next week), the busiest squads and the
// sessions the coach planned last. Completion figures only count athletes who
// share their training, and always say how many that is.
export default function CoachHomeScreen() {
  const refreshKey = useRefreshKey();
  // Squad stats for this week and next, from get_coach_week_stats
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState(null);
  const [message, setMessage] = useState('');
  const [week, setWeek] = useState('this');
  const [squadId, setSquadId] = useState(null);

  const thisMonday = weekStartString();
  const nextMondayDate = parseDateString(thisMonday);
  nextMondayDate.setDate(nextMondayDate.getDate() + 7);
  const nextMonday = localDateString(nextMondayDate);

  // Reloads when the tab comes into view (e.g. after planning a session) and
  // when the header refresh button is pressed
  useFocusEffect(useCallback(() => {
    let current = true;
    Promise.all([
      fetchCoachWeekStats(thisMonday),
      fetchCoachWeekStats(nextMonday),
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
  }, [refreshKey, thisMonday, nextMonday]));

  if (!stats) {
    return <Screen>{message ? <Message text={message} /> : <ActivityIndicator />}</Screen>;
  }

  if (stats.this.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <Screen>
          <Message text={message} />
          <Text style={[styles.label, { fontSize: 18 }]} accessibilityRole="header">Welcome to Rowlytics</Text>
          <Text style={styles.subtle}>
            Create a squad and send its invite code to your athletes. Once they join, plan their
            training and see how they're getting on here.
          </Text>
        </Screen>
        <Footer inTabs>
          <Button title="Create a squad" onPress={() => router.push('/squad/new')} />
        </Footer>
      </View>
    );
  }

  // Chips stay in name order so they don't move as athletes log sessions;
  // the most active squad is picked first
  const squadOptions = [...stats.this]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({ value: s.squad_id, label: s.name }));
  const selectedId = squadId ?? stats.this[0].squad_id;
  const selected = stats[week].find((s) => s.squad_id === selectedId) ?? stats[week][0];
  const weekOptions = [
    { value: 'this', label: `This week · ${formatWeekRange(thisMonday)}` },
    { value: 'next', label: `Next · ${formatWeekRange(nextMonday)}` },
  ];

  return (
    <Screen>
      <Message text={message} />

      <SectionHeading title="Weekly completion" first />
      {squadOptions.length > 1
        ? <ChipGroup a11yLabel="Squad" layout="scroll" options={squadOptions} value={selected.squad_id} onChange={setSquadId} />
        : null}
      <ChipGroup a11yLabel="Week" layout="segmented" options={weekOptions} value={week} onChange={setWeek} />
      {week === 'this'
        ? <ThisWeekCard squad={selected} showName={squadOptions.length === 1} />
        : <NextWeekCard squad={selected} monday={nextMonday} showName={squadOptions.length === 1} />}

      <SectionHeading title="Most active squads" link={{ label: 'All squads', href: '/squads' }} />
      <Text style={styles.subtle}>Planned sessions logged this week by athletes who share their training</Text>
      {stats.this.slice(0, SQUADS_SHOWN).map((squad) => <SquadRow key={squad.squad_id} squad={squad} />)}

      <SectionHeading title="Recently planned" />
      {recent?.length === 0 ? (
        <Text style={styles.subtle}>
          No sessions planned yet. Open a squad and tap "Plan a session" to start its program.
        </Text>
      ) : null}
      {recent?.map((plan) => (
        <PlannedSessionCard key={plan.planned_session_id} plan={plan} detailLines={1}
          onPress={() => router.push(`/plan/${plan.planned_session_id}`)}
          accessibilityHint="Opens the session to edit or delete it" />
      ))}
    </Screen>
  );
}

// This week's completion rate for the selected squad, with the counts behind
// it. Instead of a misleading 0%, says why there's no figure.
function ThisWeekCard({ squad, showName }) {
  const rate = completionRate(squad);
  let reason = null;
  if (!squad.planned) reason = 'No sessions planned for this week.';
  else if (!squad.members) reason = 'No athletes have joined this squad yet. Share its invite code from the squad page.';
  else if (!squad.sharing) {
    reason = 'None of this squad\'s athletes share their training with coaches yet. They can turn it on in their profile.';
  }

  if (reason) {
    return (
      // Read as one item, except when it holds the Plan a session button
      <View style={homeStyles.card} accessible={!!squad.planned}>
        {showName ? <Text style={homeStyles.cardName}>{squad.name}</Text> : null}
        <Text style={homeStyles.big}>–</Text>
        <Text style={homeStyles.note}>{reason}</Text>
        {!squad.planned ? <CardButton title="Plan a session" onPress={() => router.push(`/squad/${squad.squad_id}`)} /> : null}
      </View>
    );
  }

  const expected = squad.planned * squad.sharing;
  const spoken = `${squad.name}, this week: ${rate}% completed. ${squad.completed} of ${expected} planned sessions logged. `
    + `Based on ${squad.sharing} of ${formatAthleteCount(squad.members)}.`;
  return (
    <View style={homeStyles.card} accessible accessibilityLabel={spoken}>
      {showName ? <Text style={homeStyles.cardName}>{squad.name}</Text> : null}
      <Text style={homeStyles.big}>{rate}%</Text>
      <View style={homeStyles.track} importantForAccessibility="no">
        <View style={[homeStyles.fill, { width: `${Math.min(rate, 100)}%` }]} />
      </View>
      <Text style={homeStyles.counts}>{squad.completed} of {expected} planned sessions logged</Text>
      <Text style={homeStyles.note}>
        Based on {squad.sharing} of {formatAthleteCount(squad.members)}. Only athletes who share their
        training are counted.
      </Text>
      {squad.sharing < SMALL_GROUP ? (
        <Text style={homeStyles.note}>Small group: one athlete changes this a lot.</Text>
      ) : null}
    </View>
  );
}

// Next week hasn't happened, so show what's planned rather than a 0% rate
function NextWeekCard({ squad, monday, showName }) {
  const planned = squad.planned === 1 ? '1 session planned' : `${squad.planned} sessions planned`;
  return (
    <View style={homeStyles.card}>
      {showName ? <Text style={homeStyles.cardName}>{squad.name}</Text> : null}
      <Text style={homeStyles.big}>{squad.planned ? planned : 'Nothing planned yet'}</Text>
      <Text style={homeStyles.note}>
        Starts {formatSessionDate(monday)} · {squad.sharing} of {formatAthleteCount(squad.members)} will be counted
      </Text>
      <CardButton title="Plan a session" onPress={() => router.push(`/squad/${squad.squad_id}`)} />
    </View>
  );
}

// White outlined button for use on the blue card
function CardButton({ title, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [homeStyles.cardButton, pressed && { opacity: 0.7 }]}>
      <Text style={homeStyles.cardButtonText}>{title}</Text>
    </Pressable>
  );
}

// Higher rates in green, middling in amber; never red, since a low figure
// mid-week is normal. The % is always shown, so colour isn't the only signal.
function rateColour(rate) {
  if (rate >= 75) return '#15803d';
  if (rate >= 40) return '#b45309';
  return '#475569';
}

function SquadRow({ squad }) {
  const rate = completionRate(squad);
  const done = rate === null ? (squad.planned ? 'no one sharing' : 'nothing planned') : `${rate}% done`;
  return (
    <Pressable
      onPress={() => router.push(`/squad/${squad.squad_id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${squad.name}, ${squad.completed} planned sessions logged this week, `
        + `${formatAthleteCount(squad.members)}, ${squad.sharing} sharing, ${done}`}
      style={({ pressed }) => [homeStyles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={homeStyles.rowTitle}>{squad.name}</Text>
        <Text style={styles.subtle}>
          {formatAthleteCount(squad.members)} · {squad.sharing} sharing ·{' '}
          <Text style={rate === null ? null : { color: rateColour(rate), fontWeight: '600' }}>{done}</Text>
        </Text>
      </View>
      <View style={{ alignItems: 'center' }}>
        <Text style={homeStyles.rowCount}>{squad.completed}</Text>
        <Text style={homeStyles.rowUnit}>logged</Text>
      </View>
    </Pressable>
  );
}

const homeStyles = {
  card: { gap: 8, padding: 16, borderRadius: 12, backgroundColor: '#0f4c81' },
  cardName: { color: '#cbd5e1', fontWeight: '600' },
  big: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#fff' },
  counts: { color: '#fff', fontWeight: '600' },
  note: { color: '#cbd5e1' },
  cardButton: {
    minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: '#fff', alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  cardButtonText: { color: '#fff', fontWeight: '600' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff',
  },
  rowTitle: { fontWeight: '600', fontSize: 16, color: '#0f172a' },
  rowCount: { fontSize: 20, fontWeight: 'bold', color: '#0f4c81' },
  rowUnit: { fontSize: 12, color: '#64748b' },
};
