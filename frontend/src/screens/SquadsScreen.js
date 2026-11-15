import { Text } from 'react-native';
import { Screen, styles } from '../components/Form';

// Coach home. Placeholder until coaches can create squads (#32)
export default function SquadsScreen() {
  return (
    <Screen>
      <Text style={styles.heading}>Your squads</Text>
      <Text style={styles.subtle}>
        Soon you'll be able to create squads here. Each squad gets a code that you share with your
        athletes yourself, for example by text message. Athletes under 16 join through a parent.
      </Text>
      <Text style={styles.subtle}>
        You'll only see an athlete's training once they've joined one of your squads and chosen to
        share it with coaches.
      </Text>
    </Screen>
  );
}
