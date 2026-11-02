import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { validateName } from '../lib/validation';
import { Button, Field, Message, Screen, styles } from '../components/Form';

// Web page a parent opens from the consent email. The magic link signs them in
// (see AuthProvider), which proves they own the email the athlete gave.
export default function ParentConsent() {
  const { session, linkError } = useAuth();
  const userId = session?.user.id;
  const [requests, setRequests] = useState(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState(null);
  const [message, setMessage] = useState({ text: '', kind: 'error' });
  // consent_id of the request being approved
  const [busy, setBusy] = useState(null);

  // Only returns requests sent to the signed-in parent's email
  async function loadRequests() {
    const { data, error } = await supabase.rpc('get_my_consent_requests');
    if (error) return setMessage({ text: `Could not load requests: ${error.message}`, kind: 'error' });
    setRequests(data);
  }

  useEffect(() => { if (userId) loadRequests(); }, [userId]);

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

    if (rpcError) return setMessage({ text: rpcError.message, kind: 'error' });
    setMessage({ text: `Thank you. ${request.athlete_name} can now use Rowlytics.`, kind: 'success' });
    loadRequests();
  }

  async function logOut() {
    const { error } = await supabase.auth.signOut();
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
              Links can only be used once and expire after a while. Ask the athlete to tap
              "Send again" in the Rowlytics app to get a new one.
            </Text>
          </>
        ) : (
          <Text style={styles.subtle}>Open this page from the link in your email.</Text>
        )}
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

      <View style={{ flex: 1 }} />
      <Button title="Log out" variant="secondary" onPress={logOut} />
    </Page>
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
