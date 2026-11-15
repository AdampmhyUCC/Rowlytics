import { useState } from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { ProfileButton, RefreshButton } from '../../components/AppHeader';
import { TabIcon } from '../../components/TabIcon';
import { RefreshContext } from '../../lib/refresh';

// Bottom tab bar for coaches, with the same header as the athlete tabs
export default function CoachTabsLayout() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <RefreshContext.Provider value={refreshKey}>
      <Tabs
        screenOptions={{
          headerTitleAlign: 'center',
          headerLeft: () => <RefreshButton onPress={() => setRefreshKey((k) => k + 1)} />,
          headerTitle: () => <ProfileButton />,
          tabBarActiveTintColor: '#0f4c81',
          tabBarInactiveTintColor: '#64748b',
        }}
      >
        {/* Not "home": that URL is the athlete tab */}
        <Tabs.Screen
          name="coach-home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <TabIcon ios="house.fill" material="home" color={color} />,
          }}
        />
        <Tabs.Screen
          name="squads"
          options={{
            title: 'Squads',
            tabBarIcon: ({ color }) => <TabIcon ios="person.3.fill" material="groups" color={color} />,
          }}
        />
      </Tabs>
    </RefreshContext.Provider>
  );
}
