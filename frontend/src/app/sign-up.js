import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/log';
import { rememberAccountUsed } from '../lib/auth';
import { validateDob, validateEmail, validateName, validatePassword } from '../lib/validation';
import { Button, Field, Message, Screen, styles } from '../components/Form';

const EMAIL_REDIRECT = `${process.env.EXPO_PUBLIC_WEB_URL}/open-app.html`;

export default function SignUp() {
  const [form, setForm] = useState({ name: '', dob: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState({ text: '', kind: 'error' });
  const [busy, setBusy] = useState(false);
  // Set once the confirmation email has been sent
  const [sentTo, setSentTo] = useState(null);

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
        // The link confirms the email, then a web page sends them back to the app
        emailRedirectTo: EMAIL_REDIRECT,
      },
    });
    setBusy(false);

    logError('signUp', error);
    if (error) return setMessage({ text: error.message, kind: 'error' });
    // They'll come back to log in after confirming, so stop opening on sign up
    rememberAccountUsed();
    // With email confirmation on, Supabase returns no session until the link is tapped
    if (!data.session) setSentTo(form.email.trim());
  }

  if (sentTo) return <CheckEmail email={sentTo} password={form.password} />;

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

// Shown after sign up until the athlete has tapped the link in the email. They
// come back here and log in with the details they just typed.
function CheckEmail({ email, password }) {
  const [message, setMessage] = useState({ text: '', kind: 'error' });
  const [busy, setBusy] = useState(null);

  async function continueToApp() {
    setBusy('continue');
    setMessage({ text: '' });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(null);
    if (error?.code === 'email_not_confirmed') {
      return setMessage({ text: "Your email isn't confirmed yet. Tap the link in the email first.", kind: 'error' });
    }
    logError('signUp.continue', error);
    if (error) return setMessage({ text: error.message, kind: 'error' });
    // The root layout sees the new session and moves on to the app
    Alert.alert('Account verified', 'Welcome to Rowlytics!');
  }

  async function resend() {
    setBusy('resend');
    setMessage({ text: '' });
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: EMAIL_REDIRECT },
    });
    setBusy(null);
    logError('signUp.resend', error);
    if (error) return setMessage({ text: error.message, kind: 'error' });
    setMessage({ text: 'Email sent again.', kind: 'success' });
  }

  return (
    <Screen footer={<>
      <Message text={message.text} kind={message.kind} />
      <Button title="I've confirmed my email" onPress={continueToApp} busy={busy === 'continue'} />
      <Button title="Resend email" variant="secondary" onPress={resend} busy={busy === 'resend'} />
    </>}>
      <Text style={styles.heading}>Check your email</Text>
      <Text style={styles.subtle}>We've sent a link to {email}.</Text>
      <Text style={styles.subtle}>
        Tap the link to confirm your account, then come back here. It can take a few minutes,
        and may be in your spam folder.
      </Text>
    </Screen>
  );
}
