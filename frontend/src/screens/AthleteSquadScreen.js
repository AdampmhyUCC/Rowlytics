import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { logError } from '../lib/log';
import { useAuth } from '../lib/auth';
import { confirm } from '../lib/confirm';
import { fetchJoinedSquad, formatAthleteCount, leaveSquad } from '../lib/squads';
import { fetchMyPlannedSessions } from '../lib/program';
import { formatSessionDate, localDateString } from '../lib/training';
import { backFallback } from '../components/AppHeader';
import { Button, Message, Screen, styles } from '../components/Form';
import { PlannedSessionCard } from '../components/PlannedSessionCard';
import { SectionHeading } from '../components/SectionHeading';

// A squad the athlete is in (/my-squad/<id>): what it's for, who coaches it,
// how many athletes it has (a count only, never their names), the sessions
// still to log from its program, and leaving it
export default function AthleteSquadScreen() {
  const { id } = useLocalSearchParams();
  const { under16 } = useAuth();
  // null until loaded, false if the athlete isn't in this squad
  const [squad, setSquad] = useState(null);
  const [plans, setPlans] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Reloads when the screen comes back into view, e.g. after logging a session
  useFocusEffect(useCallback(() => {
    let current = true;
    Promise.all([fetchJoinedSquad(id), fetchMyPlannedSessions()]).then(([squadResult, plansResult]) => {
      if (!current) return;
      logError('athleteSquad.load', squadResult.error);
      logError('athleteSquad.plans', plansResult.error);
      const error = squadResult.error ?? plansResult.error;
      setMessage(error ? `Could not load the squad: ${error.message}` : '');
      if (!squadResult.error) setSquad(squadResult.data ?? false);
      if (!plansResult.error) setPlans(plansResult.data.filter((plan) => plan.squad_id === id));
    });
    return () => { current = false; };
  }, [id]));

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/my-squads');
  }

  async function leave() {
    const rejoin = under16 ? 'A parent can add you again with the code.' : 'You can join again with the code.';
    if (!(await confirm(`Leave ${squad.name}?`,
      `${squad.coach_name} will no longer see you in this squad, and its planned sessions will leave your training log. `
      + `Sessions you've already logged stay. ${rejoin}`,
      'Leave'))) return;
    setBusy(true);
    const { error } = await leaveSquad(id);
    setBusy(false);
    logError('athleteSquad.leave', error);
    if (error) return setMessage(`Could not leave ${squad.name}: ${error.message}`);
    close();
  }

  if (!squad) {
    return (
      <Screen footer={<Button title="Back" variant="secondary" onPress={close} />}>
        <Stack.Screen options={backFallback('/my-squads', 'Squads')} />
        {squad === false
          ? <Message text="You're not in this squad, or it was deleted." />
          : message ? <Message text={message} /> : <ActivityIndicator />}
      </Screen>
    );
  }

  const joined = formatSessionDate(localDateString(new Date(squad.joined_at)));

  return (
    <Screen footer={<>
      <Message text={message} />
      <Button title="Leave squad" variant="danger" onPress={leave} busy={busy} />
    </>}>
      <Stack.Screen options={{ title: squad.name, ...backFallback('/my-squads', 'Squads') }} />

      <View style={squadStyles.card}>
        <Text style={squadStyles.coachLabel}>Coach</Text>
        <Text style={squadStyles.coach}>{squad.coach_name}</Text>
        <Text style={styles.subtle}>{formatAthleteCount(squad.members)} · You joined {joined}</Text>
      </View>

      <SectionHeading title="About this squad" />
      <Text style={squad.description ? squadStyles.description : styles.subtle}>
        {squad.description ?? 'Your coach hasn\'t added a description yet.'}
      </Text>

      <SectionHeading title="Coming up" />
      {plans.length === 0 ? (
        <Text style={styles.subtle}>Nothing to log from this squad's program right now.</Text>
      ) : plans.map((plan) => (
        <PlannedSessionCard key={plan.planned_session_id} plan={{ ...plan, squadName: null }} detailLines={2}
          onPress={() => router.push(`/session/new?planned=${plan.planned_session_id}`)}
          accessibilityHint="Opens the log form to record this session"
          action={<Text style={squadStyles.log}>Log ›</Text>} />
      ))}

      <Text style={[styles.subtle, { marginTop: 8 }]}>
        Your coach sees your name in this squad. They only see your training if you share it with coaches
        (Privacy and data sharing, in your profile).
      </Text>
    </Screen>
  );
}

const squadStyles = {
  card: { gap: 4, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  coachLabel: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  coach: { fontWeight: '600', fontSize: 18, color: '#0f172a' },
  description: { color: '#0f172a', lineHeight: 22 },
  log: { color: '#0f4c81', fontWeight: '600' },
};
