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
  const { session, loading } = useAuth();

  // Wait for the stored session so logged-in users don't flash the login screen
  if (loading) {
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

      <Stack.Protected guard={!!session}>
        <Stack.Screen name="profile" options={{ title: 'My profile' }} />
      </Stack.Protected>

      {/* Opened from the reset email, before and after the link signs the user in */}
      <Stack.Screen name="reset-password" options={{ title: 'Set new password' }} />
    </Stack>
  );
}
