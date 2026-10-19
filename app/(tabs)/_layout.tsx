import { Text } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { colors } from '@/constants/theme';

export default function TabsLayout() {
  return (
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
      <Tabs.Screen
        name="fotos"
        options={{
          title: 'Fotos',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🗂️</Text>,
        }}
      />
      <Tabs.Screen
        name="nube"
        options={{
          title: 'Nube',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>☁️</Text>,
        }}
      />
    </Tabs>
  );
}
