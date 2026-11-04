import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';

export default function Index() {
  const { session, accountUsed, role, consentPending } = useAuth();
  // First open on this device goes to sign up; after that, log in
  if (!session) return <Redirect href={accountUsed ? '/login' : '/sign-up'} />;
  // Parents only use the app to give consent
  if (role === 'parent') return <Redirect href="/parent-consent" />;
  return <Redirect href={consentPending ? '/waiting-for-consent' : '/home'} />;
}
