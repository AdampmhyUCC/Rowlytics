import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';

export default function Index() {
  const { session, consentPending } = useAuth();
  if (!session) return <Redirect href="/login" />;
  return <Redirect href={consentPending ? '/waiting-for-consent' : '/profile'} />;
}
