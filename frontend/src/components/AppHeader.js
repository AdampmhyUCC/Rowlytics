import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { TabIcon } from './TabIcon';

// Header shared by the tab screens: refresh on the left, profile in the middle
const BRAND = '#0f4c81';

export function RefreshButton({ onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Refresh"
      hitSlop={8}
      style={({ pressed }) => [{ paddingHorizontal: 16 }, pressed && { opacity: 0.5 }]}
    >
      <TabIcon ios="arrow.clockwise" material="refresh" color={BRAND} size={22} />
    </Pressable>
  );
}

// Becomes the profile photo once photo upload is added
export function ProfileButton() {
  return (
    <Pressable
      onPress={() => router.push('/profile')}
      accessibilityRole="button"
      style={({ pressed }) => [
        { borderWidth: 1, borderColor: BRAND, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
        pressed && { opacity: 0.5 },
      ]}
    >
      <Text style={{ color: BRAND, fontWeight: '600' }}>Edit profile</Text>
    </Pressable>
  );
}
