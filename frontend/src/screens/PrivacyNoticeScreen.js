import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/log';
import { useAuth } from '../lib/auth';
import { PRIVACY_NOTICE, PRIVACY_NOTICE_VERSION } from '../lib/privacyNotice';
import { Button, Message, Screen, styles } from '../components/Form';

// Shown once after login (and again when the notice changes) before the rest
// of the app, and opened from the profile to change the choice later
export default function PrivacyNoticeScreen() {
  const { privacyNoticeDue, refreshConsent } = useAuth();
  // null until loaded
  const [sharing, setSharing] = useState(null);
  const [message, setMessage] = useState({ text: '', kind: 'error' });
  // Which button is working: 'share' or 'stop'
  const [busy, setBusy] = useState(null);

  // RLS only returns the athlete's own row
  async function loadChoice() {
    const { data, error } = await supabase
      .from('athletes')
      .select('coach_sharing_at')
      .single();
    logError('privacyNotice.load', error);
    if (error) return setMessage({ text: `Could not load your choice: ${error.message}`, kind: 'error' });
    setSharing(data.coach_sharing_at !== null);
  }

  useEffect(() => { loadChoice(); }, []);

  async function choose(share) {
    setBusy(share ? 'share' : 'stop');
    setMessage({ text: '' });
    const { error } = await supabase.rpc('set_coach_sharing', {
      p_share: share,
      p_notice_version: PRIVACY_NOTICE_VERSION,
    });
    logError('privacyNotice.choose', error);
    if (error) {
      setBusy(null);
      return setMessage({ text: `Could not save your choice: ${error.message}`, kind: 'error' });
    }
    setSharing(share);
    const firstTime = privacyNoticeDue;
    // Lets the root layout open the rest of the app
    await refreshConsent();
    setBusy(null);
    if (firstTime) return router.replace('/home');
    setMessage({
      text: share ? 'Your coaches can now see your training' : 'Your coaches can no longer see your training',
      kind: 'success',
    });
  }

  let buttons = null;
  if (privacyNoticeDue) {
    buttons = <>
      <Button title="Share with my coach" onPress={() => choose(true)} busy={busy === 'share'} />
      <Button title="Not now" variant="secondary" onPress={() => choose(false)} busy={busy === 'stop'} />
    </>;
  } else if (sharing === true) {
    buttons = <Button title="Stop sharing" variant="danger" onPress={() => choose(false)} busy={busy === 'stop'} />;
  } else if (sharing === false) {
    buttons = <Button title="Share with my coach" onPress={() => choose(true)} busy={busy === 'share'} />;
  }

  return (
    <Screen footer={<>
      <Message text={message.text} kind={message.kind} />
      {buttons}
    </>}>
      <Text style={styles.heading}>Your data and your coach</Text>
      <Text style={styles.subtle}>
        Before you share your training with a coach, here's what Rowlytics keeps and who can see it.
      </Text>

      {PRIVACY_NOTICE.map(({ heading, body }) => (
        <View key={heading} style={{ gap: 4 }}>
          <Text style={styles.label}>{heading}</Text>
          <Text style={styles.subtle}>{body}</Text>
        </View>
      ))}

      {privacyNoticeDue ? null : sharing === null ? <ActivityIndicator /> : (
        <Text style={styles.label}>
          {sharing ? 'You are sharing your training with your coaches.' : 'You are not sharing your training with coaches.'}
        </Text>
      )}
    </Screen>
  );
}
