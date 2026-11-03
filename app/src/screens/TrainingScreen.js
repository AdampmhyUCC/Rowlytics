import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { logError } from '../lib/log';
import { useRefreshKey } from '../lib/refresh';
import { fetchSessions } from '../lib/training';
import { Button, Footer, Message, styles } from '../components/Form';
import { SessionCard } from '../components/SessionCard';

// The full training log, newest first. Planned (future) sessions come later.
export default function TrainingScreen() {
  const refreshKey = useRefreshKey();
  const [sessions, setSessions] = useState(null);
  const [message, setMessage] = useState('');
  const [pulling, setPulling] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await fetchSessions();
    logError('training.load', error);
    setMessage(error ? `Could not load your training: ${error.message}` : '');
    if (!error) setSessions(data);
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
        ListHeaderComponent={<Message text={message} />}
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
