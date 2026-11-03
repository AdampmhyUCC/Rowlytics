import { useState } from 'react';
import { Text } from 'react-native';
import { Link } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/log';
import { validateDob, validateEmail, validateName, validatePassword } from '../lib/validation';
import { Button, Field, Message, Screen, styles } from '../components/Form';

export default function SignUp() {
  const [form, setForm] = useState({ name: '', dob: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState({ text: '', kind: 'error' });
  const [busy, setBusy] = useState(false);

  const update = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  async function signUp() {
    const newErrors = {
      name: validateName(form.name),
      dob: validateDob(form.dob),
      email: validateEmail(form.email),
      password: validatePassword(form.password),
    };
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    setBusy(true);
    setMessage({ text: '' });
    // name and dob go in user metadata; a database trigger copies them into profiles
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { name: form.name.trim(), dob: form.dob },
        emailRedirectTo: Linking.createURL('/'),
      },
    });
    setBusy(false);

    logError('signUp', error);
    if (error) return setMessage({ text: error.message, kind: 'error' });
    // With email confirmation on, Supabase returns no session until the link is tapped
    if (!data.session) {
      setMessage({ text: 'Check your email and tap the link to confirm your account, then log in.', kind: 'success' });
    }
  }

  return (
    <Screen footer={<>
      <Message text={message.text} kind={message.kind} />
      <Button title="Sign up" onPress={signUp} busy={busy} />
    </>}>
      <Text style={styles.heading}>Create your profile</Text>

      <Field label="Full name" value={form.name} onChangeText={update('name')} error={errors.name}
        autoComplete="name" textContentType="name" />
      <Field label="Date of birth" value={form.dob} onChangeText={update('dob')} error={errors.dob}
        placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" autoComplete="birthdate-full" />
      <Field label="Email" value={form.email} onChangeText={update('email')} error={errors.email}
        placeholder="you@example.com" autoCapitalize="none" autoComplete="email"
        keyboardType="email-address" textContentType="emailAddress" />
      <Field label="Password" value={form.password} onChangeText={update('password')} error={errors.password}
        secureTextEntry autoComplete="new-password" textContentType="newPassword" />

      <Link href="/login" style={styles.link}>Already have an account? Log in</Link>
    </Screen>
  );
}
