import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { colors } from '@/constants/theme';
import { useSync, type SyncStatus } from '@/hooks/useSync';

const LABEL: Record<SyncStatus, (pending: number) => string> = {
  offline: (n) => (n > 0 ? `📴 Sin conexión · ${n} pendiente${n === 1 ? '' : 's'}` : '📴 Sin conexión'),
  syncing: () => 'Sincronizando…',
  pending: (n) => `⏳ ${n} pendiente${n === 1 ? '' : 's'}`,
  error: (n) => `⚠️ Error al sincronizar${n > 0 ? ` · ${n} pendiente${n === 1 ? '' : 's'}` : ''}`,
  synced: () => '☁️ Al día',
};

const TONE: Record<SyncStatus, string> = {
  offline: colors.warning,
  syncing: colors.textMuted,
  pending: colors.warning,
  error: colors.danger,
  synced: colors.accent,
};

/** T6. Indicador de sincronización: sin conexión, N pendientes, sincronizando o al día. Abre la pantalla de estado. */
export function SyncIndicator() {
  const { status, pendingCount } = useSync();
  return (
    <Pressable
      onPress={() => router.push('/sincronizacion')}
      style={[styles.pill, { borderColor: TONE[status] }]}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Estado de la sincronización"
    >
      {status === 'syncing' && <ActivityIndicator size="small" color={TONE[status]} />}
      <Text style={[styles.text, { color: TONE[status] }]}>{LABEL[status](pendingCount)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: { fontSize: 12, fontWeight: '600' },
});
