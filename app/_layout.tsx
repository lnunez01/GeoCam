import '../polyfills'; // Semana 10: debe ser la PRIMERA línea (AI SDK necesita structuredClone y streams de texto)
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { db, resetLocalDatabaseForDev } from '@/db/client';
import migrations from '@/drizzle/migrations';
import { colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { persistOptions, queryClient, useAppFocusManager } from '@/lib/queryClient';
import { useClaimOrphans } from '@/hooks/useClaimOrphans';
import { useSyncBootstrap } from '@/hooks/useSyncBootstrap';

/** Decide qué pantallas existen según la sesión. Sin router.replace: Stack.Protected redirige solo. */
function RootNavigator() {
  const { session, userId, isLoading } = useAuth();
  // Fotos y álbumes anteriores a la migración 0004: el primer usuario de este teléfono se queda con ellos
  useClaimOrphans(userId);

  // Mientras se lee la sesión de SecureStore no se muestra nada para no parpadear el login
  if (isLoading) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        {/* El detalle completa sus opciones de cabecera (colores del tema) con su propio <Stack.Screen> */}
        <Stack.Screen name="foto/[id]" options={{ headerShown: true, title: 'Foto' }} />
        {/* Semana 9 (C4): estado de la sincronización, se abre desde el indicador */}
        <Stack.Screen
          name="sync"
          options={{
            headerShown: true,
            title: 'Sincronización',
            headerTransparent: false, // SDK 58: en iOS 26+ sería transparente por defecto
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        />
        {/* Semana 10 (C2): perfil del Tutor IA */}
        <Stack.Screen name="perfil" options={{ headerShown: true, title: 'Perfil del tutor' }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // TanStack Query se entera de cuándo la app vuelve a primer plano (antes de cualquier return)
  useAppFocusManager();
  // Única excepción a las capas: aplicar las migraciones antes de montar cualquier pantalla
  const { success, error } = useMigrations(db, migrations);
  // Fotos anteriores a la migración 0003: reciben clientId y updatedAt
  useSyncBootstrap(success);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Error al preparar la base de datos: {error.message}</Text>
        {/* Drizzle envuelve el error real de SQLite en error.cause */}
        {error.cause instanceof Error && <Text style={styles.cause}>{error.cause.message}</Text>}
        {/* Solo en desarrollo: una base creada con migraciones de otra rama no se puede migrar */}
        {__DEV__ && (
          <Pressable
            onPress={() =>
              Alert.alert(
                '¿Borrar la base local?',
                'Se borran los datos de este teléfono. Las fotos ya subidas vuelven a bajar de la nube al sincronizar; las que nunca se subieron y los álbumes se pierden.',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Borrar y reiniciar', style: 'destructive', onPress: resetLocalDatabaseForDev },
                ]
              )
            }
            style={styles.resetButton}
          >
            <Text style={styles.resetText}>Borrar base local y reiniciar (desarrollo)</Text>
          </Pressable>
        )}
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
  resetButton: { marginTop: 24, borderWidth: 1, borderColor: colors.danger, borderRadius: 10, padding: 12 },
  resetText: { color: colors.danger, fontWeight: '700' },
  cause: { color: colors.textMuted, textAlign: 'center', fontSize: 12, marginTop: 8 },
});
