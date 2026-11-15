import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { logError } from '../lib/log';
import { useAuth } from '../lib/auth';
import { confirm } from '../lib/confirm';
import { useRefreshKey } from '../lib/refresh';
import { fetchJoinedSquads, leaveSquad } from '../lib/squads';
import { formatSessionDate, localDateString } from '../lib/training';
import { Button, Footer, Message, styles } from '../components/Form';

// The squads an athlete is in (/my-squads). Athletes 16 and over join with a
// code; under-16s are added by a parent from the parent page.
export default function MySquadsScreen() {
  const refreshKey = useRefreshKey();
  const { under16 } = useAuth();
  const [squads, setSquads] = useState(null);
  const [message, setMessage] = useState('');
  const [pulling, setPulling] = useState(false);
  // squad_id being left
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await fetchJoinedSquads();
    logError('mySquads.load', error);
    setMessage(error ? `Could not load your squads: ${error.message}` : '');
    if (!error) setSquads(data);
  }, []);

  // Reload when the tab comes into view (e.g. after joining) and when the
  // header refresh button is pressed
  useFocusEffect(useCallback(() => { load(); }, [load, refreshKey]));

  async function pullToRefresh() {
    setPulling(true);
    await load();
    setPulling(false);
  }

  async function leave(squad) {
    const rejoin = under16 ? 'A parent can add you again with the code.' : 'You can join again with the code.';
    if (!(await confirm(`Leave ${squad.name}?`,
      `${squad.coach_name} will no longer see you in this squad. ${rejoin}`, 'Leave'))) return;
    setBusy(squad.squad_id);
    const { error } = await leaveSquad(squad.squad_id);
    setBusy(null);
    logError('mySquads.leave', error);
    if (error) return setMessage(`Could not leave ${squad.name}: ${error.message}`);
    setSquads((list) => list.filter((s) => s.squad_id !== squad.squad_id));
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={squads ?? []}
        keyExtractor={(squad) => squad.squad_id}
        renderItem={({ item }) => (
          <SquadRow squad={item} busy={busy === item.squad_id} onLeave={() => leave(item)} />
        )}
        contentContainerStyle={{ padding: 20, gap: 10, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={pullToRefresh} />}
        ListHeaderComponent={<Message text={message} />}
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
      <Footer inTabs>
        {under16
          ? <Text style={styles.subtle}>You're under 16, so a parent joins squads for you.</Text>
          : <Button title="Join a squad" onPress={() => router.push('/join-squad')} />}
      </Footer>
    </View>
  );
}

function EmptySquads({ under16 }) {
  return (
    <Text style={styles.subtle}>
      {under16
        ? 'You\'re not in any squads yet. When your coach sends you a squad code, pass it to the '
          + 'parent who approved your account. They can join for you from the link in their email.'
        : 'You\'re not in any squads yet. Ask your coach for their squad\'s code.'}
    </Text>
  );
}

function SquadRow({ squad, busy, onLeave }) {
  const joined = formatSessionDate(localDateString(new Date(squad.joined_at)));
  return (
    <View style={rowStyles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={rowStyles.name}>{squad.name}</Text>
        <Text style={styles.subtle}>Coach {squad.coach_name} · Joined {joined}</Text>
      </View>
      {busy ? <ActivityIndicator color="#dc2626" /> : (
        <Pressable
          onPress={onLeave}
          accessibilityRole="button"
          accessibilityLabel={`Leave ${squad.name}`}
          hitSlop={8}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <Text style={rowStyles.leave}>Leave</Text>
        </Pressable>
      )}
    </View>
  );
}

const rowStyles = {
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff',
  },
  name: { fontWeight: '600', fontSize: 16, color: '#0f172a' },
  leave: { color: '#dc2626', fontWeight: '600' },
};
