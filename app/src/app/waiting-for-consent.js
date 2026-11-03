import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/log';
import { useAuth } from '../lib/auth';
import { validateEmail } from '../lib/validation';
import { Button, Field, Message, Screen, styles } from '../components/Form';

// Shown instead of the rest of the app to athletes under 16 until a parent approves
export default function WaitingForConsent() {
  const { refreshConsent } = useAuth();
  const [sentTo, setSentTo] = useState(null);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(null);
  const [message, setMessage] = useState({ text: '', kind: 'error' });
  // Which button is working: 'send' or 'check'
  const [busy, setBusy] = useState(null);

  // RLS only returns this athlete's own requests, and there's at most one open
  async function loadRequest() {
    const { data, error } = await supabase
      .from('parental_consents')
      .select('parent_email')
      .is('approved_at', null)
      .maybeSingle();
    logError('waitingForConsent.load', error);
    if (error) return setMessage({ text: `Could not load your request: ${error.message}`, kind: 'error' });
    if (data) {
      setSentTo(data.parent_email);
      setEmail(data.parent_email);
    }
  }

  useEffect(() => { loadRequest(); }, []);

  async function sendRequest() {
    const error = validateEmail(email);
    setEmailError(error);
    if (error) return;

    const parentEmail = email.trim().toLowerCase();
    setBusy('send');
    setMessage({ text: '' });
    // Replaces any earlier request, so a mistyped email can be corrected
    const { error: rpcError } = await supabase.rpc('request_parental_consent', {
      p_parent_email: parentEmail,
    });
    logError('waitingForConsent.request', rpcError);
    if (rpcError) {
      setBusy(null);
      return setMessage({ text: rpcError.message, kind: 'error' });
    }
    setSentTo(parentEmail);

    // Email the parent a sign-in link to the consent page. This must come after
    // the request is saved: the open request is what makes the email a parent account.
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: parentEmail,
      options: {
        emailRedirectTo: `${process.env.EXPO_PUBLIC_WEB_URL}/parent-consent`,
        // Only picks the consent wording in the email template; the role comes from the request
        data: { parental_consent: true },
      },
    });
    setBusy(null);

    if (otpError) return setMessage({ text: `Could not send the email: ${otpError.message}`, kind: 'error' });
    setMessage({ text: `We've emailed ${parentEmail} a link to approve your account.`, kind: 'success' });
  }

  async function checkAgain() {
    setBusy('check');
    setMessage({ text: '' });
    const pending = await refreshConsent();
    setBusy(null);
    // Once approved, the root layout moves the athlete on to the app
    if (pending) setMessage({ text: 'Not approved yet', kind: 'error' });
  }

  async function logOut() {
    const { error } = await supabase.auth.signOut();
    logError('waitingForConsent.logOut', error);
    if (error) setMessage({ text: `Log out failed: ${error.message}`, kind: 'error' });
  }

  return (
    <Screen>
      <Text style={styles.heading}>Waiting for your parent</Text>
      <Text style={styles.subtle}>
        Because you're under 16, a parent or guardian needs to approve your account
        before you can use Rowlytics.
      </Text>

      {sentTo ? (
        <Text style={styles.subtle}>
          We've asked <Text style={{ fontWeight: '600' }}>{sentTo}</Text> to approve your
          account. Ask them to check their inbox and spam folder.
        </Text>
      ) : (
        <Text style={styles.subtle}>
          Enter their email and we'll send them a link to approve your account.
        </Text>
      )}

      <Field label="Parent or guardian's email" value={email} onChangeText={setEmail} error={emailError}
        placeholder="parent@example.com" autoCapitalize="none" autoComplete="email"
        keyboardType="email-address" textContentType="emailAddress" />

      <Message text={message.text} kind={message.kind} />
      <Button title={sentTo ? 'Send again' : 'Send request'} onPress={sendRequest} busy={busy === 'send'} />
      {sentTo ? (
        <Button title="My parent has approved" variant="secondary" onPress={checkAgain} busy={busy === 'check'} />
      ) : null}

      <View style={{ flex: 1 }} />
      <Button title="Log out" variant="secondary" onPress={logOut} />
    </Screen>
  );
}
