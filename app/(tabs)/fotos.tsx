import { useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlbumNameModal } from '@/components/AlbumNameModal';
import { Chip } from '@/components/Chip';
import { PhotoImage } from '@/components/PhotoImage';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useAlbums } from '@/hooks/useAlbums';
import { useDevTools } from '@/hooks/useDevTools';
import { usePhotos } from '@/hooks/usePhotos';
import type { Album, AlbumFilter, GeoPhoto } from '@/types/geo';

type AlbumModal = { mode: 'create' } | { mode: 'rename'; album: Album } | null;

function notePreview(note: string | null): string | null {
  if (!note) return null;
  const words = note.split(/\s+/);
  return words.length > 6 ? `${words.slice(0, 6).join(' ')}…` : note;
}

export default function FotosScreen() {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const [search, setSearch] = useState('');
  const [albumFilter, setAlbumFilter] = useState<AlbumFilter>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [modal, setModal] = useState<AlbumModal>(null);

  const { photos } = usePhotos({ search, albumId: albumFilter, onlyFavorites });
  const { albums, createAlbum, renameAlbum, removeAlbum } = useAlbums();
  const devTools = useDevTools();

  const confirmRemoveAlbum = (album: Album) => {
    Alert.alert(`¿Eliminar "${album.name}"?`, 'Las fotos quedarán sin álbum, no se borran.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const error = await removeAlbum(album.id);
          if (error) Alert.alert('No se pudo eliminar', error);
          else if (albumFilter === album.id) setAlbumFilter(null);
        },
      },
    ]);
  };

  const handleAlbumLongPress = (album: Album) => {
    Alert.alert(album.name, '¿Qué quieres hacer con este álbum?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Renombrar', onPress: () => setModal({ mode: 'rename', album }) },
      { text: 'Eliminar', style: 'destructive', onPress: () => confirmRemoveAlbum(album) },
    ]);
  };

  const term = search.trim();
  let emptyMessage = 'Aún no tienes fotos. Toma una desde la pestaña GeoCam.';
  if (term) emptyMessage = `Ninguna nota contiene «${term}».`;
  else if (onlyFavorites) emptyMessage = 'No hay favoritas con este filtro. Marca una foto con ★ desde su detalle.';
  else if (albumFilter === 'none') emptyMessage = 'Todas tus fotos están en algún álbum.';
  else if (albumFilter !== null) emptyMessage = 'Este álbum está vacío. Asigna fotos desde su detalle.';

  const renderItem = ({ item }: { item: GeoPhoto }) => {
    const preview = notePreview(item.note);
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
        onPress={() => router.push({ pathname: '/foto/[id]', params: { id: String(item.id) } })}
      >
        <View>
          <PhotoImage uri={item.uri} style={styles.thumb} />
          <Text style={styles.badgeLeft}>{item.coords ? '📍' : '∅'}</Text>
          {item.favorite && <Text style={styles.badgeRight}>★</Text>}
          {item.remotePath && <Text style={styles.badgeCloud}>☁️</Text>}
        </View>
        <Text style={styles.album} numberOfLines={1}>
          {item.albumName ?? 'Sin álbum'}
        </Text>
        {preview && (
          <Text style={styles.note} numberOfLines={2}>
            {preview}
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Fotos</Text>
        <View style={styles.headerActions}>
          {/* Herramientas de rendimiento: solo existen en desarrollo */}
          {__DEV__ && (
            <Pressable onPress={devTools.openMenu} style={styles.devButton} hitSlop={8}>
              <Text style={styles.devText}>⚙️ Dev</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() =>
              Alert.alert('Cerrar sesión', session?.user.email ?? undefined, [
                { text: 'Cancelar', style: 'cancel' },
                // Al cerrar sesión, Stack.Protected lleva al login sin navegar a mano
                { text: 'Cerrar sesión', style: 'destructive', onPress: signOut },
              ])
            }
            style={styles.devButton}
            hitSlop={8}
          >
            <Text style={styles.devText}>Salir</Text>
          </Pressable>
        </View>
      </View>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar en las notas…"
        placeholderTextColor={colors.textMuted}
        style={styles.search}
        clearButtonMode="while-editing"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}
        keyboardShouldPersistTaps="handled"
      >
        <Chip
          label="★ Favoritas"
          tone="warning"
          active={onlyFavorites}
          onPress={() => setOnlyFavorites((v) => !v)}
        />
        <Chip label="Todos" active={albumFilter === null} onPress={() => setAlbumFilter(null)} />
        <Chip label="Sin álbum" active={albumFilter === 'none'} onPress={() => setAlbumFilter('none')} />
        {albums.map((album) => (
          <Chip
            key={album.id}
            label={album.name}
            active={albumFilter === album.id}
            onPress={() => setAlbumFilter(album.id)}
            onLongPress={() => handleAlbumLongPress(album)}
          />
        ))}
        <Chip label="+ Álbum" onPress={() => setModal({ mode: 'create' })} />
      </ScrollView>
      {albums.length > 0 && (
        <Text style={styles.hint}>Mantén presionado un álbum para renombrarlo o eliminarlo.</Text>
      )}

      <FlatList
        data={photos}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>}
      />

      <AlbumNameModal
        visible={modal !== null}
        title={modal?.mode === 'rename' ? 'Renombrar álbum' : 'Nuevo álbum'}
        initialValue={modal?.mode === 'rename' ? modal.album.name : ''}
        onSubmit={(name) =>
          modal?.mode === 'rename' ? renameAlbum(modal.album.id, name) : createAlbum(name)
        }
        onClose={() => setModal(null)}
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
    marginBottom: 12,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  headerActions: { flexDirection: 'row', gap: 8 },
  devButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  devText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  search: {
    marginHorizontal: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipsScroll: { flexGrow: 0, marginTop: 12 },
  chips: { paddingHorizontal: 16, gap: 8 },
  hint: { color: colors.textMuted, fontSize: 11, paddingHorizontal: 16, marginTop: 6 },
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
  badgeLeft: { position: 'absolute', left: 6, top: 6, fontSize: 14 },
  badgeRight: { position: 'absolute', right: 6, top: 4, fontSize: 18, color: colors.warning },
  badgeCloud: { position: 'absolute', right: 6, bottom: 6, fontSize: 14 },
  album: { color: colors.text, fontWeight: '600', fontSize: 13 },
  note: { color: colors.textMuted, fontSize: 12 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 48, paddingHorizontal: 24 },
});
