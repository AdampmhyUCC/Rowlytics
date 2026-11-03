import { useState } from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { ProfileButton, RefreshButton } from '../../components/AppHeader';
import { TabIcon } from '../../components/TabIcon';
import { RefreshContext } from '../../lib/refresh';

// Bottom tab bar for active athletes; each tab takes an equal share of the width
export default function TabsLayout() {
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
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <TabIcon ios="house.fill" material="home" color={color} />,
          }}
        />
        <Tabs.Screen
          name="training"
          options={{
            title: 'Training',
            tabBarIcon: ({ color }) => <TabIcon ios="figure.rower" material="rowing" color={color} />,
          }}
        />
      </Tabs>
    </RefreshContext.Provider>
  );
}
