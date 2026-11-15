import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { logError } from '../lib/log';
import { fetchSquadProgram } from '../lib/program';
import { Button, Message, styles } from './Form';
import { PlannedSessionCard } from './PlannedSessionCard';

// On a coach's squad screen: the squad's planned sessions from this week on,
// with a button to add one (#34)
export function SquadProgram({ squadId }) {
  const [plans, setPlans] = useState(null);
  const [message, setMessage] = useState('');

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
      <Text style={styles.label}>Training program</Text>
      <Message text={message} />
      {plans === null && !message ? <ActivityIndicator /> : null}
      {plans?.length === 0 ? (
        <Text style={styles.subtle}>
          No sessions planned from this week on. Sessions you add appear in each athlete's training log.
        </Text>
      ) : null}
      {plans?.map((plan) => (
        <PlannedSessionCard key={plan.planned_session_id} plan={plan}
          onPress={() => router.push(`/plan/${plan.planned_session_id}`)}
          accessibilityHint="Opens the planned session to edit or delete it" />
      ))}
      <Button title="Plan a session" variant="secondary" onPress={() => router.push(`/plan/new?squadId=${squadId}`)} />
    </View>
  );
}
