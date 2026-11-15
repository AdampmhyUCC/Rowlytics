import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { logError } from '../lib/log';
import { joinSquad } from '../lib/squads';
import { validateSquadCode } from '../lib/validation';
import { Button, Field, Message, Screen, styles } from '../components/Form';

// An athlete 16 or over joins a squad with the code their coach sent them
// (/join-squad). The database refuses under-16s and pending athletes.
export default function JoinSquadScreen() {
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState({ text: '', kind: 'error' });
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);

  // Modals opened from a link (e.g. on web) have nothing to go back to
  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/my-squads');
  }

  async function join() {
    const codeError = validateSquadCode(code);
    setError(codeError);
    if (codeError) return;

    setBusy(true);
    setMessage({ text: '' });
    const { data, error: joinError } = await joinSquad(code);
    setBusy(false);

    logError('joinSquad.join', joinError);
    if (joinError) return setMessage({ text: joinError.message, kind: 'error' });
    // Shows who the code belongs to, so a wrong code is easy to spot and leave
    setJoined(true);
    setMessage({
      text: data.already_member
        ? `You're already in ${data.squad_name} (coach ${data.coach_name}).`
        : `You've joined ${data.squad_name} (coach ${data.coach_name}).`,
      kind: 'success',
    });
  }

  return (
    <Screen footer={<>
      <Message text={message.text} kind={message.kind} />
      {joined ? <Button title="Done" onPress={close} /> : <>
        <Button title="Join squad" onPress={join} busy={busy} />
        <Button title="Cancel" variant="secondary" onPress={close} />
      </>}
    </>}>
      <Field label="Squad code" value={code} onChangeText={setCode} error={error}
        placeholder="e.g. ABCD2345" maxLength={12} autoCapitalize="characters" autoCorrect={false}
        autoComplete="off" autoFocus={!joined} editable={!joined} returnKeyType="join" onSubmitEditing={join} />
      <Text style={styles.subtle}>
        Your coach sends the code, for example by text message. Joining shows your name to the
        squad's coach. They only see your training if you share it with coaches.
      </Text>
    </Screen>
  );
}
