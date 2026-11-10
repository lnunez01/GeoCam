import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { colors } from '@/constants/theme';
import { useSync } from '@/hooks/useSync';

const headerOptions = {
  headerShown: true,
  title: 'Sincronización',
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  contentStyle: { backgroundColor: colors.background },
} as const;

function formatDate(ms: number) {
  return new Date(ms).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

/** C4. Pantalla de estado: pendientes, última sincronización, resultado, último error y "Sincronizar ahora". */
export default function SincronizacionScreen() {
  const { status, isOnline, pendingCount, isSyncing, lastResult, error, syncNow } = useSync();
  const lastError = error ?? lastResult?.lastError ?? null;

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={headerOptions} />

      <Row label="Conexión" value={isOnline ? '🟢 En línea' : '📴 Sin conexión'} />
      <Row
        label="Fotos pendientes"
        value={String(pendingCount)}
        tone={pendingCount > 0 ? colors.warning : colors.accent}
      />
      <Row
        label="Última sincronización"
        value={lastResult && lastResult.finishedAt > 0 ? formatDate(lastResult.finishedAt) : 'Nunca'}
      />
      <Row
        label="Resultado"
        value={
          lastResult && lastResult.finishedAt > 0
            ? `${lastResult.pushed} subidas · ${lastResult.pulled} bajadas` +
              (lastResult.failed > 0 ? ` · ${lastResult.failed} con error` : '')
            : '—'
        }
      />
      <Row label="Último error" value={lastError ?? 'Ninguno'} tone={lastError ? colors.danger : colors.textMuted} />

      <Pressable
        onPress={syncNow}
        disabled={isSyncing}
        style={({ pressed }) => [styles.button, (pressed || isSyncing) && { opacity: 0.7 }]}
        accessibilityRole="button"
      >
        {isSyncing ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.buttonText}>☁️ Sincronizar ahora</Text>
        )}
      </Pressable>

      <Text style={styles.hint}>
        {status === 'offline'
          ? 'Sin conexión: los cambios se guardan en el teléfono y se suben solos cuando vuelva la red.'
          : 'La sincronización también se ejecuta sola al abrir la app, al recuperar la red y después de cada cambio.'}
      </Text>
    </ScrollView>
  );
}

function Row({ label, value, tone = colors.text }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: tone }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12 },
  row: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 4 },
  label: { color: colors.textMuted, fontSize: 12 },
  value: { fontSize: 16, fontWeight: '600' },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 16 },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});
