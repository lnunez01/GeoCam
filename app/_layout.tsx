import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from '@/db/client';
import migrations from '@/drizzle/migrations';
import { colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/context/AuthContext';

// Sin sesión, las pantallas privadas no existen para el navegador y el usuario cae en el login
function RootNavigator() {
  const { session, isLoading } = useAuth();

  // Mientras se lee la sesión guardada en SecureStore
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="foto/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // Primero las migraciones locales, después la autenticación.
  // Única excepción a las capas: aplicar las migraciones antes de montar cualquier pantalla
  const { success, error } = useMigrations(db, migrations);

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

  if (!success) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
      <StatusBar style="light" />
    </>
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
