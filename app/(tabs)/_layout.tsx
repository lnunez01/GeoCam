import { Text } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { GeoPhotosProvider } from '@/context/GeoPhotosContext';
import { colors } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <GeoPhotosProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        }}
      >
        <Tabs.Screen
          name="geocam"
          options={{
            title: 'GeoCam',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📷</Text>,
          }}
        />
        <Tabs.Screen
          name="mapa"
          options={{
            title: 'Mapa',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🗺️</Text>,
          }}
        />
      </Tabs>
    </GeoPhotosProvider>
  );
}
