import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { logError } from '../lib/log';
import { useAuth } from '../lib/auth';
import { useRefreshKey } from '../lib/refresh';
import { fetchJoinedSquads } from '../lib/squads';
import { formatSessionDate, localDateString } from '../lib/training';
import { Button, Footer, Message, styles } from '../components/Form';
import { TabIcon } from '../components/TabIcon';

// The squads an athlete is in (/my-squads). Tap one for its page (description,
// program, leave). Athletes 16 and over join with a code; under-16s are added
// by a parent from the parent page.
export default function MySquadsScreen() {
  const refreshKey = useRefreshKey();
  const { under16 } = useAuth();
  const [squads, setSquads] = useState(null);
  const [message, setMessage] = useState('');
  const [pulling, setPulling] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await fetchJoinedSquads();
    logError('mySquads.load', error);
    setMessage(error ? `Could not load your squads: ${error.message}` : '');
    if (!error) setSquads(data);
  }, []);

  // Reload when the tab comes into view (e.g. after joining or leaving) and
  // when the header refresh button is pressed
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
        renderItem={({ item }) => <SquadRow squad={item} />}
        contentContainerStyle={{ padding: 20, gap: 10, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={pullToRefresh} />}
        ListHeaderComponent={<>
          <Message text={message} />
          {under16 ? (
            <Text style={[styles.info, { marginBottom: 10 }]}>
              You're under 16, so a parent joins squads for you. Send them your coach's squad code.
            </Text>
          ) : null}
        </>}
        ListEmptyComponent={squads === null
          ? (message ? null : <ActivityIndicator />)
          : <EmptySquads under16={under16} />}
        ListFooterComponent={squads?.length ? (
          <Text style={styles.subtle}>
            Coaches see your name in their squads. They only see your training if you share it
            with coaches (Privacy and data sharing, in your profile).
          </Text>
        ) : null}
      />
      {under16 ? null : (
        <Footer inTabs>
          <Button title="Join a squad" onPress={() => router.push('/join-squad')} />
        </Footer>
      )}
    </View>
  );
}

function EmptySquads({ under16 }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={[styles.label, { fontSize: 18 }]}>No squads yet</Text>
      <Text style={styles.subtle}>
        {under16
          ? 'When your coach sends you a squad code, pass it to the '
            + 'parent who approved your account. They can join for you from the link in their email.'
          : 'Ask your coach for their squad\'s code, then tap Join a squad.'}
      </Text>
    </View>
  );
}

// Tap to open the squad (screens/AthleteSquadScreen.js)
function SquadRow({ squad }) {
  const joined = formatSessionDate(localDateString(new Date(squad.joined_at)));
  return (
    <Pressable
      onPress={() => router.push(`/my-squad/${squad.squad_id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${squad.name}, coach ${squad.coach_name}, joined ${joined}`}
      accessibilityHint="Opens the squad"
      style={({ pressed }) => [rowStyles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={rowStyles.name}>{squad.name}</Text>
        <Text style={rowStyles.details}>Coach {squad.coach_name} · Joined {joined}</Text>
      </View>
      <TabIcon ios="chevron.right" material="chevron_right" color="#94a3b8" size={16} />
    </Pressable>
  );
}

const rowStyles = {
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff',
  },
  name: { fontWeight: '600', fontSize: 16, color: '#0f172a' },
  details: { color: '#64748b' },
};
