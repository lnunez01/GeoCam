import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhotoImage } from '@/components/PhotoImage';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useCloudPhotos } from '@/hooks/useCloudPhotos';
import type { RemotePhotoWithUrl } from '@/services/cloudPhotos';

/**
 * Pestaña Nube (C4): lo que hay en Supabase, no en el teléfono.
 * Al iniciar sesión en otro teléfono, aquí aparecen las mismas fotos.
 */
export default function NubeScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { photos, isLoading, error, reload } = useCloudPhotos();

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

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Nube</Text>
          <Text style={styles.muted} numberOfLines={1}>
            {session?.user.email} · {photos.length} {photos.length === 1 ? 'foto' : 'fotos'}
          </Text>
        </View>
        <Pressable onPress={reload} style={styles.reloadButton} hitSlop={8}>
          <Text style={styles.reloadText}>↻</Text>
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={photos}
        keyExtractor={(item) => item.client_id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={reload} tintColor={colors.accent} />}
        ListEmptyComponent={
          isLoading ? null : (
            <Text style={styles.empty}>
              Aún no hay fotos en la nube. Súbelas desde la pestaña Fotos con «☁️ Sincronizar».
            </Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 12 },
  reloadButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reloadText: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  error: { color: colors.danger, paddingHorizontal: 16, paddingTop: 8 },
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
