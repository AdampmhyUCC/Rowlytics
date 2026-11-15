import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/log';
import { useAuth } from '../lib/auth';
import { validateEmail, validateName } from '../lib/validation';
import { Button, Field, Message, Screen, styles } from '../components/Form';
import { ChildSquads } from '../components/ChildSquads';

// Web page a parent opens from the consent email. The magic link signs them in
// (see AuthProvider), which proves they own the email the athlete gave.
// Parents also come back here to join squads for their under-16 children (#33).
export default function ParentConsent() {
  const { session, linkError } = useAuth();
  const userId = session?.user.id;
  const [requests, setRequests] = useState(null);
  // Under-16 children whose consent this parent gave
  const [children, setChildren] = useState(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState(null);
  const [message, setMessage] = useState({ text: '', kind: 'error' });
  // consent_id of the request being approved
  const [busy, setBusy] = useState(null);

  // Only returns requests sent to the signed-in parent's email
  async function loadRequests() {
    const { data, error } = await supabase.rpc('get_my_consent_requests');
    logError('parentConsent.load', error);
    if (error) return setMessage({ text: `Could not load requests: ${error.message}`, kind: 'error' });
    setRequests(data);
  }

  async function loadChildren() {
    const { data, error } = await supabase.rpc('get_my_children');
    logError('parentConsent.children', error);
    if (error) return setMessage({ text: `Could not load your children's squads: ${error.message}`, kind: 'error' });
    setChildren(data);
  }

  useEffect(() => {
    if (!userId) return;
    loadRequests();
    loadChildren();
  }, [userId]);

  async function approve(request) {
    const error = validateName(name);
    setNameError(error);
    if (error) return;

    setBusy(request.consent_id);
    setMessage({ text: '' });
    const { error: rpcError } = await supabase.rpc('approve_parental_consent', {
      p_consent_id: request.consent_id,
      p_parent_name: name.trim(),
    });
    setBusy(null);

    logError('parentConsent.approve', rpcError);
    if (rpcError) return setMessage({ text: rpcError.message, kind: 'error' });
    setMessage({ text: `Thank you. ${request.athlete_name} can now use Rowlytics.`, kind: 'success' });
    loadRequests();
    loadChildren();
  }

  async function logOut() {
    const { error } = await supabase.auth.signOut();
    logError('parentConsent.logOut', error);
    if (error) setMessage({ text: `Log out failed: ${error.message}`, kind: 'error' });
  }

  if (!session) {
    return (
      <Page>
        <Text style={styles.heading}>Parental consent</Text>
        {linkError ? (
          <>
            <Message text={linkError} />
            <Text style={styles.subtle}>
              Links can only be used once and expire after a while. You can get a new one below.
            </Text>
          </>
        ) : (
          <Text style={styles.subtle}>Open this page from the link in your email.</Text>
        )}
        <SignInLink />
      </Page>
    );
  }

  return (
    <Page>
      <Text style={styles.heading}>Parental consent</Text>
      <Text style={styles.subtle}>Signed in as {session.user.email}</Text>

      {requests === null ? <ActivityIndicator /> : null}

      {requests?.length === 0 ? (
        <Text style={styles.subtle}>There are no requests waiting for your approval.</Text>
      ) : null}

      {requests?.length > 0 ? (
        <>
          <Text style={styles.subtle}>
            Rowlytics is a training log for rowers. Athletes under 16 need a parent or
            guardian's consent before they can use it.
          </Text>
          <Field label="Your full name" value={name} onChangeText={setName} error={nameError}
            autoComplete="name" textContentType="name" />

          {requests.map((request) => (
            <View key={request.consent_id} style={cardStyle}>
              <Text style={styles.label}>{request.athlete_name}, age {request.athlete_age}</Text>
              <Text style={styles.subtle}>
                I am {request.athlete_name}'s parent or guardian and I consent to them using
                Rowlytics to log their training.
              </Text>
              <Button title={`Approve ${request.athlete_name}`} onPress={() => approve(request)}
                busy={busy === request.consent_id} />
            </View>
          ))}
        </>
      ) : null}

      <Message text={message.text} kind={message.kind} />

      {children?.length > 0 ? (
        <>
          <Text style={[styles.heading, { marginTop: 10 }]}>Squads</Text>
          <Text style={styles.subtle}>
            Athletes under 16 can't join a coach's squad themselves. You join for them with the
            code the coach sends.
          </Text>
          {children.map((child) => <ChildSquads key={child.athlete_id} child={child} />)}
        </>
      ) : null}

      <View style={{ flex: 1 }} />
      <Button title="Log out" variant="secondary" onPress={logOut} />
    </Page>
  );
}

// For parents coming back later (e.g. to join a squad). Only emails existing
// accounts, and says the same either way so it doesn't reveal who has one.
function SignInLink() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send() {
    const error = validateEmail(email);
    setEmailError(error);
    if (error) return;

    setBusy(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${process.env.EXPO_PUBLIC_WEB_URL}/parent-consent`,
      },
    });
    setBusy(false);
    // Unknown emails fail here too; don't show that
    logError('parentConsent.signInLink', otpError);
    setSent(true);
  }

  return (
    <>
      <Text style={styles.subtle}>
        Already approved an athlete? Enter your email and we'll send you a new sign-in link.
      </Text>
      <Field label="Your email" value={email} onChangeText={setEmail} error={emailError}
        placeholder="parent@example.com" autoCapitalize="none" autoComplete="email"
        keyboardType="email-address" textContentType="emailAddress" />
      <Message text={sent ? `If ${email.trim()} has a parent account, we've emailed it a link.` : ''} kind="success" />
      <Button title="Email me a sign-in link" onPress={send} busy={busy} />
    </>
  );
}

// Keeps the page a readable width on desktop browsers
function Page({ children }) {
  return (
    <Screen>
      <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', gap: 14, flexGrow: 1 }}>
        {children}
      </View>
    </Screen>
  );
}

const cardStyle = { gap: 10, padding: 14, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, backgroundColor: '#fff' };
