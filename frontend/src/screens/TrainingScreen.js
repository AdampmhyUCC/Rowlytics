import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { logError } from '../lib/log';
import { useRefreshKey } from '../lib/refresh';
import { fetchSessions } from '../lib/training';
import { fetchMyPlannedSessions } from '../lib/program';
import { Button, Footer, Message, styles } from '../components/Form';
import { PlannedSessionCard } from '../components/PlannedSessionCard';
import { SessionCard } from '../components/SessionCard';

// The full training log, newest first, under the sessions coaches have
// planned for the athlete's squads that they haven't logged yet (#34)
export default function TrainingScreen() {
  const refreshKey = useRefreshKey();
  const [sessions, setSessions] = useState(null);
  const [plans, setPlans] = useState([]);
  const [message, setMessage] = useState('');
  const [pulling, setPulling] = useState(false);

  const load = useCallback(async () => {
    const [log, planned] = await Promise.all([fetchSessions(), fetchMyPlannedSessions()]);
    logError('training.load', log.error);
    logError('training.planned', planned.error);
    const error = log.error ?? planned.error;
    setMessage(error ? `Could not load your training: ${error.message}` : '');
    if (!log.error) setSessions(log.data);
    if (!planned.error) setPlans(planned.data);
  }, []);

  // Reload when the tab comes into view (e.g. after saving a session) and when
  // the header refresh button is pressed
  useFocusEffect(useCallback(() => { load(); }, [load, refreshKey]));

  async function pullToRefresh() {
    setPulling(true);
    await load();
    setPulling(false);
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={sessions ?? []}
        keyExtractor={(session) => session.completed_training_id}
        renderItem={({ item }) => <SessionCard session={item} />}
        contentContainerStyle={{ padding: 20, gap: 10, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={pullToRefresh} />}
        ListHeaderComponent={<>
          <Message text={message} />
          {plans.length ? <PlannedList plans={plans} /> : null}
        </>}
        ListEmptyComponent={sessions === null
          ? (message ? null : <ActivityIndicator />)
          : <Text style={styles.subtle}>No sessions yet. Log your first one after training.</Text>}
      />
      <Footer inTabs>
        <Button title="Log session" onPress={() => router.push('/session/new')} />
      </Footer>
    </View>
  );
}

// Tapping a planned session opens the log form filled in from it; saving
// ticks it off this list
function PlannedList({ plans }) {
  return (
    <View style={{ gap: 10, marginBottom: 10 }}>
      <Text style={styles.label}>Planned by your coach</Text>
      {plans.map((plan) => (
        <PlannedSessionCard key={plan.planned_session_id} plan={plan}
          onPress={() => router.push(`/session/new?planned=${plan.planned_session_id}`)}
          accessibilityHint="Opens the log form to record this session"
          action={<Text style={plannedStyles.log}>Log ›</Text>} />
      ))}
      <Text style={[styles.label, { marginTop: 8 }]}>Your log</Text>
    </View>
  );
}

const plannedStyles = {
  log: { color: '#0f4c81', fontWeight: '600' },
};
