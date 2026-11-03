import { Text } from 'react-native';
import { router } from 'expo-router';
import { Button, Screen, styles } from '../components/Form';

// Placeholder until the training log list is built (issue #6, checkpoint 4)
export default function TrainingScreen() {
  return (
    <Screen footer={<Button title="Log session" onPress={() => router.push('/session/new')} />}>
      <Text style={styles.heading}>Training</Text>
      <Text style={styles.subtle}>Your full training log will appear here.</Text>
    </Screen>
  );
}
