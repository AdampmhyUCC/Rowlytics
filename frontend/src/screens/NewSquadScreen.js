import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { logError } from '../lib/log';
import { createSquad } from '../lib/squads';
import { validateSquadDescription, validateSquadName } from '../lib/validation';
import { Button, Field, Message, Screen, styles } from '../components/Form';

// Coach creates a squad (/squad/new), then lands on it with its invite code
// ready to share. The code is made by the database.
export default function NewSquadScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Modals opened from a link (e.g. on web) have nothing to go back to
  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/squads');
  }

  async function save() {
    const newErrors = { name: validateSquadName(name), description: validateSquadDescription(description) };
    setErrors(newErrors);
    if (newErrors.name || newErrors.description) return;

    setBusy(true);
    setMessage('');
    const { data, error: saveError } = await createSquad({ name, description });
    setBusy(false);

    logError('newSquad.save', saveError);
    if (saveError) return setMessage(`Could not create squad: ${saveError.message}`);
    router.replace(`/squad/${data.squad_id}`);
  }

  return (
    <Screen footer={<>
      <Message text={message} />
      <Button title="Create squad" onPress={save} busy={busy} />
      <Button title="Cancel" variant="secondary" onPress={close} />
    </>}>
      <Field label="Squad name" value={name} onChangeText={setName} error={errors.name}
        placeholder="e.g. Senior men" maxLength={60} autoFocus />
      <Field label="Description, optional" value={description} onChangeText={setDescription} error={errors.description}
        hint="Your athletes see this on the squad's page."
        placeholder="e.g. Training times, where you meet, what the squad is working towards" multiline maxLength={500}
        style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }, errors.description && styles.inputError]} />
      <Text style={styles.subtle}>
        You'll get an invite code to send to your athletes, for example by text message. Under-16s join through a parent.
      </Text>
    </Screen>
  );
}
