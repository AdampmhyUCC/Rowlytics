import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/log';
import { useAuth } from '../lib/auth';
import { validatePassword } from '../lib/validation';
import { Button, Field, Message, Screen, styles } from '../components/Form';

export default function ResetPassword() {
  const { session, linkError } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // The reset link signs the user in (see AuthProvider); without that we can't change anything
  if (!session) {
    return (
      <Screen footer={<Button title="Back to log in" variant="secondary" onPress={() => router.replace('/login')} />}>
        <Message text={linkError ?? 'Open the password reset link from your email on this device.'} />
      </Screen>
    );
  }

  async function savePassword() {
    const invalid = validatePassword(password);
    if (invalid) return setError(invalid);
    if (password !== confirm) return setError('Passwords do not match');

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    logError('resetPassword', error);
    if (error) return setError(error.message);
    router.replace('/profile');
  }

  return (
    <Screen footer={<>
      <Message text={error} />
      <Button title="Save new password" onPress={savePassword} busy={busy} />
    </>}>
      <Text style={styles.subtle}>Choose a new password for {session.user.email}.</Text>
      <Field label="New password" value={password} onChangeText={setPassword}
        secureTextEntry autoComplete="new-password" textContentType="newPassword" />
      <Field label="Confirm new password" value={confirm} onChangeText={setConfirm}
        secureTextEntry autoComplete="new-password" textContentType="newPassword" />
    </Screen>
  );
}
