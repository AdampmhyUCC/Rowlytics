import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { logError } from '../lib/log';
import { fetchSquadProgram } from '../lib/program';
import { Button, Message, styles } from './Form';
import { PlannedSessionCard } from './PlannedSessionCard';

// Long programs show this many until expanded, so the rest of the squad
// screen stays in reach
const PLANS_SHOWN = 5;

// On a coach's squad screen: the squad's planned sessions from this week on,
// with a button to add one (#34)
export function SquadProgram({ squadId }) {
  const [plans, setPlans] = useState(null);
  const [message, setMessage] = useState('');
  const [showAll, setShowAll] = useState(false);

  // Reloads when the squad screen comes back into view, e.g. after saving a session
  useFocusEffect(useCallback(() => {
    let current = true;
    fetchSquadProgram(squadId).then(({ data, error }) => {
      if (!current) return;
      logError('squadProgram.load', error);
      setMessage(error ? `Could not load the program: ${error.message}` : '');
      if (!error) setPlans(data);
    });
    return () => { current = false; };
  }, [squadId]));

  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.label} accessibilityRole="header">Training program</Text>
      <Message text={message} />
      {plans === null && !message ? <ActivityIndicator /> : null}
      {plans?.length === 0 ? (
        <Text style={styles.subtle}>
          No sessions planned from this week on. Sessions you add appear in each athlete's training log.
        </Text>
      ) : null}
      {plans?.slice(0, showAll ? undefined : PLANS_SHOWN).map((plan) => (
        <PlannedSessionCard key={plan.planned_session_id} plan={plan} detailLines={2}
          onPress={() => router.push(`/plan/${plan.planned_session_id}`)}
          accessibilityHint="Opens the planned session to edit or delete it" />
      ))}
      {!showAll && plans?.length > PLANS_SHOWN ? (
        <Pressable onPress={() => setShowAll(true)} accessibilityRole="button"
          style={({ pressed }) => [{ minHeight: 44, justifyContent: 'center' }, pressed && { opacity: 0.6 }]}>
          <Text style={styles.link}>Show all {plans.length} sessions</Text>
        </Pressable>
      ) : null}
      <Button title="Plan a session" variant="secondary" onPress={() => router.push(`/plan/new?squadId=${squadId}`)} />
    </View>
  );
}
