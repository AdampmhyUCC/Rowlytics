import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../lib/auth';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootStack />
    </AuthProvider>
  );
}

function RootStack() {
  const { session, loading, role, consentPending, privacyNoticeDue } = useAuth();

  // Wait for the stored session so logged-in users don't flash the login screen,
  // and for the consent check so pending athletes don't flash the app
  if (loading || (session && consentPending === null)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // When a guard flips (log in / log out) the user is sent back to index,
  // which redirects to the right place
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />

      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" options={{ title: 'Log in' }} />
        <Stack.Screen name="sign-up" options={{ title: 'Sign up' }} />
        <Stack.Screen name="forgot-password" options={{ title: 'Forgot password' }} />
      </Stack.Protected>

      <Stack.Protected guard={!!session && !consentPending}>
        {/* Athlete screens. A null role (account check failed offline) falls
            back to these, as before coaches existed */}
        <Stack.Protected guard={role !== 'coach'}>
          {/* Athletes answer the privacy notice before the rest of the app opens,
              and can come back to it from their profile */}
          <Stack.Screen name="privacy-notice" options={{ title: 'Privacy and data sharing' }} />

          <Stack.Protected guard={!privacyNoticeDue}>
            {/* Tabs draw their own header (see (tabs)/_layout.js) */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home' }} />
            {/* One form for logging and editing a session (screens/SessionFormScreen.js) */}
            <Stack.Screen name="session/new" options={{ title: 'Log session', presentation: 'modal' }} />
            <Stack.Screen name="session/[id]" options={{ title: 'Edit session', presentation: 'modal' }} />
            <Stack.Screen name="join-squad" options={{ title: 'Join a squad', presentation: 'modal' }} />
          </Stack.Protected>
        </Stack.Protected>

        {/* Coach screens; coaches have no training log or privacy notice */}
        <Stack.Protected guard={role === 'coach'}>
          <Stack.Screen name="(coach)" options={{ headerShown: false, title: 'Home' }} />
          <Stack.Screen name="squad/new" options={{ title: 'New squad', presentation: 'modal' }} />
          <Stack.Screen name="squad/[id]" options={{ title: 'Squad' }} />
          {/* One form for adding and editing a planned session (screens/PlannedSessionFormScreen.js) */}
          <Stack.Screen name="plan/new" options={{ title: 'Plan session', presentation: 'modal' }} />
          <Stack.Screen name="plan/[id]" options={{ title: 'Edit planned session', presentation: 'modal' }} />
        </Stack.Protected>

        <Stack.Protected guard={!privacyNoticeDue}>
          <Stack.Screen name="profile" options={{ title: 'My profile' }} />
        </Stack.Protected>
      </Stack.Protected>

      {/* Under-16 athletes see only this screen until a parent approves */}
      <Stack.Protected guard={!!session && consentPending === true}>
        <Stack.Screen name="waiting-for-consent" options={{ title: 'Parental consent' }} />
      </Stack.Protected>

      {/* Opened from the reset email, before and after the link signs the user in */}
      <Stack.Screen name="reset-password" options={{ title: 'Set new password' }} />
      {/* Web page opened from the parent's consent email; the link signs the parent in */}
      <Stack.Screen name="parent-consent" options={{ title: 'Parental consent' }} />
    </Stack>
  );
}
