import { Text } from 'react-native';
import { Screen, styles } from '../components/Form';

// Placeholder until the training history is built (issue #6)
export default function HomeScreen() {
  return (
    <Screen>
      <Text style={styles.heading}>Home</Text>
      <Text style={styles.subtle}>Your training history will appear here.</Text>
    </Screen>
  );
}
