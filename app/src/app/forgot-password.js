import { useState } from 'react';
import { Text } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/log';
import { validateEmail } from '../lib/validation';
import { Button, Field, Message, Screen, styles } from '../components/Form';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState({ text: '', kind: 'error' });
  const [busy, setBusy] = useState(false);

  async function sendReset() {
    const invalid = validateEmail(email);
    if (invalid) return setMessage({ text: invalid, kind: 'error' });

    setBusy(true);
    // Supabase emails a link that opens the app on the reset-password screen
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL('/reset-password'),
    });
    setBusy(false);

    logError('forgotPassword', error);
    if (error) return setMessage({ text: error.message, kind: 'error' });
    setMessage({ text: 'If an account exists for that email, a reset link is on its way.', kind: 'success' });
  }

  return (
    <Screen footer={<>
      <Message text={message.text} kind={message.kind} />
      <Button title="Send reset link" onPress={sendReset} busy={busy} />
    </>}>
      <Text style={styles.subtle}>Enter your email and we'll send you a link to set a new password.</Text>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
    </Screen>
  );
}
