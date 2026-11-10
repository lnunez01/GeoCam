import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhotoImage } from '@/components/PhotoImage';
import { SyncIndicator } from '@/components/SyncIndicator';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useCloudFeed, useCloudRealtime } from '@/hooks/useCloudFeed';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useIsOnline } from '@/lib/queryClient';
import type { RemotePhotoWithUrl } from '@/services/cloudPhotos';

/**
 * Pestaña Nube (C2): lo que hay en Supabase, no en el teléfono.
 * Feed por cursor con infinite scroll, búsqueda en vivo por nota y los cuatro estados de UI.
 * La caché se persiste (C3): sin conexión se ven los últimos datos cargados.
 */
export default function NubeScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search); // una petición al dejar de escribir
  const isOnline = useIsOnline();
  const feed = useCloudFeed(debouncedSearch);
  useCloudRealtime();

  const renderItem = ({ item }: { item: RemotePhotoWithUrl }) => (
    <View style={styles.card}>
      <View>
        {item.url ? (
          <PhotoImage uri={item.url} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.missing]}>
            <Text style={styles.muted}>Sin archivo</Text>
          </View>
        )}
        <Text style={styles.badgeLeft}>{item.latitude !== null ? '📍' : '∅'}</Text>
        {item.favorite && <Text style={styles.badgeRight}>★</Text>}
      </View>
      <Text style={styles.date}>{new Date(item.taken_at).toLocaleDateString('es-CO')}</Text>
      {item.note && (
        <Text style={styles.note} numberOfLines={2}>
          {item.note}
        </Text>
      )}
    </View>
  );

  const emptyMessage = debouncedSearch.trim()
    ? `Ninguna nota contiene «${debouncedSearch.trim()}».`
    : 'Aún no hay fotos en la nube. Toma una en GeoCam: se sube sola.';

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Nube</Text>
          <Text style={styles.muted} numberOfLines={1}>
            {session?.user.email}
          </Text>
        </View>
        <SyncIndicator />
      </View>

      {/* Estado: sin conexión (la lista guardada sigue visible) */}
      {!isOnline && <Text style={styles.offline}>Sin conexión. Se muestran los datos guardados.</Text>}

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar en las notas de la nube…"
        placeholderTextColor={colors.textMuted}
        style={styles.search}
        clearButtonMode="while-editing"
      />

      {/* Estado: primera carga */}
      {feed.status === 'pending' && feed.fetchStatus === 'fetching' && (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} size="large" />
      )}

      {/* Estado: sin datos y sin red (nunca se pudo cargar) */}
      {feed.status === 'pending' && feed.fetchStatus === 'paused' && (
        <Text style={styles.empty}>Conéctate a internet para cargar tus fotos de la nube.</Text>
      )}

      {/* Estado: error, con opción de reintentar */}
      {feed.status === 'error' && (
        <View style={styles.center}>
          <Text style={styles.error}>No se pudo cargar la nube: {feed.error.message}</Text>
          <Pressable onPress={() => feed.refetch()} style={styles.retry}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      )}

      {feed.status === 'success' && (
        <FlatList
          data={feed.photos}
          keyExtractor={(item) => item.client_id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          renderItem={renderItem}
          // Estado: vacío (distinto según haya búsqueda o no)
          ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>}
          // Deslizar hacia abajo para refrescar
          refreshControl={
            <RefreshControl
              refreshing={feed.isRefetching && !feed.isFetchingNextPage}
              onRefresh={() => {
                feed.refetch();
              }}
              tintColor={colors.accent}
            />
          }
          // Infinite scroll: páginas de a 10
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
          }}
          ListFooterComponent={
            feed.isFetchingNextPage ? <ActivityIndicator style={{ margin: 16 }} color={colors.accent} /> : undefined
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 12 },
  offline: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.warning,
    color: '#171717',
    fontWeight: '600',
    textAlign: 'center',
  },
  search: {
    marginHorizontal: 16,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  center: { alignItems: 'center', gap: 12, padding: 24 },
  error: { color: colors.danger, textAlign: 'center' },
  retry: { borderWidth: 1, borderColor: colors.accent, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { color: colors.accent, fontWeight: '700' },
  grid: { padding: 16, gap: 12, flexGrow: 1 },
  row: { gap: 12 },
  card: {
    flex: 1,
    maxWidth: '50%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 8,
    gap: 4,
  },
  thumb: { width: '100%', aspectRatio: 1, borderRadius: 8 },
  missing: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  badgeLeft: { position: 'absolute', left: 6, top: 6, fontSize: 14 },
  badgeRight: { position: 'absolute', right: 6, top: 4, fontSize: 18, color: colors.warning },
  date: { color: colors.text, fontWeight: '600', fontSize: 13 },
  note: { color: colors.textMuted, fontSize: 12 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 48, paddingHorizontal: 24 },
});
