import { useState } from 'react';
import { Text } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/log';
import { Button, Field, Message, Screen, styles } from '../components/Form';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function logIn() {
    if (!email.trim() || !password) return setError('Enter your email and password');
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    // On success the root layout sees the new session and moves to the home screen
    logError('login', error);
    if (error) setError(error.message);
  }

  return (
    <Screen footer={<>
      <Message text={error} />
      <Button title="Log in" onPress={logIn} busy={busy} />
    </>}>
      <Text style={styles.heading}>Rowlytics</Text>
      <Text style={styles.subtle}>Log in to record your training.</Text>

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
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={logIn}
      />

      <Link href="/forgot-password" style={styles.link}>Forgot password?</Link>
      <Link href="/sign-up" style={styles.link}>New to Rowlytics? Create an account</Link>
    </Screen>
  );
}
