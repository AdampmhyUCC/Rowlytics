import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';

export default function Index() {
  const { session, role, consentPending } = useAuth();
  if (!session) return <Redirect href="/login" />;
  // Parents only use the app to give consent
  if (role === 'parent') return <Redirect href="/parent-consent" />;
  return <Redirect href={consentPending ? '/waiting-for-consent' : '/profile'} />;
}
