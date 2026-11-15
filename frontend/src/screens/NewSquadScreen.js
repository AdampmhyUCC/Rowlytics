import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { logError } from '../lib/log';
import { createSquad } from '../lib/squads';
import { validateSquadName } from '../lib/validation';
import { Button, Field, Message, Screen, styles } from '../components/Form';

// Coach creates a squad (/squad/new). The invite code is made by the database.
export default function NewSquadScreen() {
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Modals opened from a link (e.g. on web) have nothing to go back to
  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/squads');
  }

  async function save() {
    const nameError = validateSquadName(name);
    setError(nameError);
    if (nameError) return;

    setBusy(true);
    setMessage('');
    const { error: saveError } = await createSquad(name);
    setBusy(false);

    logError('newSquad.save', saveError);
    if (saveError) return setMessage(`Could not create squad: ${saveError.message}`);
    close();
  }

  return (
    <Screen footer={<>
      <Message text={message} />
      <Button title="Create squad" onPress={save} busy={busy} />
      <Button title="Cancel" variant="secondary" onPress={close} />
    </>}>
      <Field label="Squad name" value={name} onChangeText={setName} error={error}
        placeholder="e.g. Senior men" maxLength={60} autoFocus returnKeyType="done" onSubmitEditing={save} />
      <Text style={styles.subtle}>
        The squad gets an invite code. Share it with your athletes yourself, for example by text message.
      </Text>
    </Screen>
  );
}
