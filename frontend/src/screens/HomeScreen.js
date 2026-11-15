import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Link, router, useFocusEffect } from 'expo-router';
import { logError } from '../lib/log';
import { useRefreshKey } from '../lib/refresh';
import { fetchSessions, fetchWeekTotals, formatDistance, formatTotalTime } from '../lib/training';
import { fetchMyPlannedSessions } from '../lib/program';
import { Button, Message, Screen, styles } from '../components/Form';
import { PlannedSessionCard } from '../components/PlannedSessionCard';
import { SessionCard } from '../components/SessionCard';
import { SectionHeading } from '../components/SectionHeading';
import { TabIcon } from '../components/TabIcon';

// Quick pick-up page: this week's totals, the next sessions coaches have
// planned (#34) and the last few sessions. The full log is on the Training tab.
export default function HomeScreen() {
  const refreshKey = useRefreshKey();
  const [totals, setTotals] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [plans, setPlans] = useState([]);
  const [message, setMessage] = useState('');

  // Reloads when the tab comes into view (e.g. after saving a session) and
  // when the header refresh button is pressed
  useFocusEffect(useCallback(() => {
    let current = true;
    Promise.all([fetchWeekTotals(), fetchSessions({ limit: 3 }), fetchMyPlannedSessions()]).then(([week, recent, planned]) => {
      if (!current) return;
      logError('home.weekTotals', week.error);
      logError('home.recentSessions', recent.error);
      logError('home.planned', planned.error);
      const error = week.error ?? recent.error ?? planned.error;
      setMessage(error ? `Could not load your training: ${error.message}` : '');
      if (!week.error) setTotals(week.totals);
      if (!recent.error) setSessions(recent.data);
      if (!planned.error) setPlans(planned.data);
    });
    return () => { current = false; };
  }, [refreshKey]));

  return (
    <Screen>
      <SectionHeading title="This week" first />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <StatBox label="Metres" value={totals ? formatDistance(totals.metres) : message ? '–' : null} />
        <StatBox label="Time" value={totals ? formatTotalTime(totals.seconds) : message ? '–' : null} />
      </View>

      {plans.length ? (
        <>
          <SectionHeading title="Planned by your coach"
            link={plans.length > PLANS_SHOWN ? { label: `All ${plans.length}`, href: '/training' } : null} />
          {plans.slice(0, PLANS_SHOWN).map((plan) => (
            <PlannedSessionCard key={plan.planned_session_id} plan={plan}
              onPress={() => router.push(`/session/new?planned=${plan.planned_session_id}`)}
              accessibilityHint="Opens the log form to record this session"
              action={<Text style={homeStyles.log}>Log ›</Text>} />
          ))}
        </>
      ) : null}

      <SectionHeading title="Recent sessions" action={
        <Pressable
          onPress={() => router.push('/session/new')}
          accessibilityRole="button"
          accessibilityLabel="Log session"
          hitSlop={8}
          style={({ pressed }) => [homeStyles.addButton, pressed && { opacity: 0.6 }]}
        >
          <TabIcon ios="plus" material="add" color="#fff" size={20} />
        </Pressable>
      } />

      <Message text={message} />
      {sessions === null && !message ? <ActivityIndicator /> : null}

      {sessions?.length === 0 ? (
        <View style={{ gap: 10 }}>
          <Text style={styles.subtle}>No sessions yet. Log your first one after training.</Text>
          <Button title="Log your first session" onPress={() => router.push('/session/new')} />
        </View>
      ) : null}

      {sessions?.map((session) => (
        <SessionCard key={session.completed_training_id} session={session} compact />
      ))}

      {sessions?.length > 0 ? <Link href="/training" style={styles.link}>See all training ›</Link> : null}
    </Screen>
  );
}

function StatBox({ label, value }) {
  return (
    <View style={homeStyles.box} accessible accessibilityLabel={`${label} this week: ${value ?? 'loading'}`}>
      <Text style={homeStyles.boxLabel}>{label}</Text>
      {value === null ? <ActivityIndicator /> : <Text style={homeStyles.boxValue}>{value}</Text>}
    </View>
  );
}

// The rest are on the Training tab
const PLANS_SHOWN = 2;

const homeStyles = {
  box: {
    flex: 1, gap: 4, padding: 16, borderRadius: 12, backgroundColor: '#0f4c81',
  },
  boxLabel: { color: '#cbd5e1', fontWeight: '600' },
  boxValue: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  log: { color: '#0f4c81', fontWeight: '600' },
  addButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#0f4c81', alignItems: 'center', justifyContent: 'center',
  },
};
