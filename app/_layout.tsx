import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useClaimUnowned, useDatabase } from '@/hooks/useDatabase';
import { persistOptions, queryClient, useAppFocusManager } from '@/lib/queryClient';

function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} size="large" />
      <StatusBar style="light" />
    </View>
  );
}

// Sin sesión, las pantallas privadas no existen para el navegador y el usuario cae en el login
function RootNavigator() {
  const { session, isLoading } = useAuth();
  const claimed = useClaimUnowned(session?.user.id);

  // Mientras se lee la sesión guardada en SecureStore (o se asignan las fotos sin dueño)
  if (isLoading || !claimed) return <Loading />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="foto/[id]" />
        <Stack.Screen name="sincronizacion" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  useAppFocusManager(); // TanStack Query se entera de cuándo la app vuelve a primer plano
  // Primero las migraciones locales, después la autenticación
  const { isReady, error } = useDatabase();

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Error al preparar la base de datos: {error.message}</Text>
        {/* Drizzle envuelve el error real de SQLite en error.cause */}
        {error.cause instanceof Error && <Text style={styles.cause}>{error.cause.message}</Text>}
        <StatusBar style="light" />
      </View>
    );
  }

  if (!isReady) return <Loading />;

  return (
    // C3: la caché de TanStack Query se guarda en SQLite y se restaura al abrir la app
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
      <StatusBar style="light" />
    </PersistQueryClientProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  error: { color: colors.danger, textAlign: 'center' },
  cause: { color: colors.textMuted, textAlign: 'center', fontSize: 12, marginTop: 8 },
});
