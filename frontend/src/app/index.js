import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';

export default function Index() {
  const { session, accountUsed, role, consentPending, privacyNoticeDue } = useAuth();
  // First open on this device goes to sign up; after that, log in
  if (!session) return <Redirect href={accountUsed ? '/login' : '/sign-up'} />;
  // Still checking the account (see _layout.js)
  if (consentPending === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  // Parents only use the app to give consent
  if (role === 'parent') return <Redirect href="/parent-consent" />;
  if (role === 'coach') return <Redirect href="/coach-home" />;
  if (consentPending) return <Redirect href="/waiting-for-consent" />;
  return <Redirect href={privacyNoticeDue ? '/privacy-notice' : '/home'} />;
}
