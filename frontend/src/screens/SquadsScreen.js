import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { logError } from '../lib/log';
import { useRefreshKey } from '../lib/refresh';
import { fetchMySquads, formatAthleteCount } from '../lib/squads';
import { Button, Footer, Message, styles } from '../components/Form';

// Coach home: the coach's squads, each with its invite code
export default function SquadsScreen() {
  const refreshKey = useRefreshKey();
  const [squads, setSquads] = useState(null);
  const [message, setMessage] = useState('');
  const [pulling, setPulling] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await fetchMySquads();
    logError('squads.load', error);
    setMessage(error ? `Could not load your squads: ${error.message}` : '');
    if (!error) setSquads(data);
  }, []);

  // Reload when the tab comes into view (e.g. after creating a squad) and when
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
        data={squads ?? []}
        keyExtractor={(squad) => squad.squad_id}
        renderItem={({ item }) => <SquadCard squad={item} />}
        contentContainerStyle={{ padding: 20, gap: 10, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={pullToRefresh} />}
        ListHeaderComponent={<Message text={message} />}
        ListEmptyComponent={squads === null
          ? (message ? null : <ActivityIndicator />)
          : <EmptySquads />}
      />
      <Footer inTabs>
        <Button title="New squad" onPress={() => router.push('/squad/new')} />
      </Footer>
    </View>
  );
}

function EmptySquads() {
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.subtle}>
        No squads yet. Each squad gets a code that you share with your athletes yourself, for
        example by text message. Athletes under 16 join through a parent.
      </Text>
      <Text style={styles.subtle}>
        You'll only see an athlete's training once they've joined one of your squads and chosen to
        share it with coaches.
      </Text>
    </View>
  );
}

function SquadCard({ squad }) {
  return (
    <View
      accessible
      accessibilityLabel={`${squad.name}, ${formatAthleteCount(squad.memberCount)}, invite code ${squad.invite_code.split('').join(' ')}`}
      style={cardStyles.card}
    >
      <Text style={cardStyles.title}>{squad.name}</Text>
      <Text style={cardStyles.details}>
        {formatAthleteCount(squad.memberCount)} · Code <Text style={cardStyles.code}>{squad.invite_code}</Text>
      </Text>
    </View>
  );
}

const cardStyles = {
  card: { gap: 2, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  title: { fontWeight: '600', fontSize: 16, color: '#0f172a' },
  details: { color: '#475569' },
  code: { fontWeight: '600', letterSpacing: 1, color: '#0f172a' },
};
