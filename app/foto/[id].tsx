import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Chip } from '@/components/Chip';
import { PhotoImage } from '@/components/PhotoImage';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useAlbums } from '@/hooks/useAlbums';
import { usePhoto } from '@/hooks/usePhoto';
import { uploadPhotoById } from '@/services/cloudPhotos';

const headerOptions = {
  headerShown: true,
  title: 'Foto',
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  contentStyle: { backgroundColor: colors.background },
} as const;

export default function FotoDetalleScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const { photo, isLoading, updateNote, toggleFavorite, moveToAlbum, remove } = usePhoto(id);
  const { albums } = useAlbums();
  const { session } = useAuth();
  const [uploading, setUploading] = useState(false);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={headerOptions} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!photo) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={headerOptions} />
        <Text style={styles.muted}>Esta foto ya no existe.</Text>
        <Pressable onPress={() => router.back()} style={styles.button}>
          <Text style={styles.buttonText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  const handleUpload = async () => {
    if (!session) return;
    setUploading(true);
    try {
      await uploadPhotoById(photo.id, session.user.id);
      Alert.alert('Listo', 'La foto quedó guardada en la nube.');
    } catch (e) {
      Alert.alert('No se pudo subir', e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('¿Eliminar esta foto?', 'No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await remove();
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={headerOptions} />
      <PhotoImage uri={photo.uri} style={styles.image} />

      <View style={styles.section}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>{photo.source === 'gallery' ? '🖼️ Galería' : '📷 Cámara'}</Text>
          <Pressable onPress={toggleFavorite} hitSlop={12} accessibilityLabel="Marcar como favorita">
            <Text style={[styles.star, { color: photo.favorite ? colors.warning : colors.textMuted }]}>
              {photo.favorite ? '★' : '☆'}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.muted}>{new Date(photo.createdAt).toLocaleString('es-CO')}</Text>
        {photo.coords ? (
          <Text style={styles.mono}>
            📍 {photo.coords.latitude.toFixed(5)}, {photo.coords.longitude.toFixed(5)}
            {photo.coords.accuracy !== null ? `  ±${Math.round(photo.coords.accuracy)} m` : ''}
          </Text>
        ) : (
          <Text style={styles.muted}>∅ Sin ubicación</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Nota</Text>
        {/* key: si la nota cambia desde la base, el editor se reinicia con el valor nuevo */}
        <NoteEditor key={photo.note ?? ''} initialNote={photo.note ?? ''} onSave={updateNote} />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Álbum</Text>
        <View style={styles.chips}>
          <Chip label="Sin álbum" active={photo.albumId === null} onPress={() => moveToAlbum(null)} />
          {albums.map((album) => (
            <Chip
              key={album.id}
              label={album.name}
              active={photo.albumId === album.id}
              onPress={() => moveToAlbum(album.id)}
            />
          ))}
        </View>
        {albums.length === 0 && (
          <Text style={styles.muted}>Crea álbumes desde la pestaña Fotos con «+ Álbum».</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Nube</Text>
        {photo.remotePath ? (
          <Text style={styles.cloudOk}>
            ☁️ Subida a la nube{photo.synced ? '' : ' · tiene cambios sin subir'}
          </Text>
        ) : (
          <Pressable
            onPress={handleUpload}
            disabled={uploading}
            style={[styles.button, styles.cloudButton, uploading && { opacity: 0.6 }]}
          >
            {uploading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.buttonText}>☁️ Subir a la nube</Text>
            )}
          </Pressable>
        )}
      </View>

      <Pressable onPress={handleDelete} style={[styles.button, styles.deleteButton]}>
        <Text style={styles.deleteText}>Eliminar foto</Text>
      </Pressable>
    </ScrollView>
  );
}

function NoteEditor({ initialNote, onSave }: { initialNote: string; onSave: (note: string) => Promise<void> }) {
  const [note, setNote] = useState(initialNote);
  const dirty = note.trim() !== initialNote.trim();

  return (
    <>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Escribe algo sobre esta foto…"
        placeholderTextColor={colors.textMuted}
        style={styles.noteInput}
        multiline
        maxLength={500}
      />
      <Pressable
        onPress={() => onSave(note)}
        disabled={!dirty}
        style={[styles.button, !dirty && { opacity: 0.4 }]}
      >
        <Text style={styles.buttonText}>{dirty ? 'Guardar nota' : 'Guardada'}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 20, paddingBottom: 48 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: colors.background,
  },
  image: { width: '100%', aspectRatio: 3 / 4, borderRadius: 16 },
  section: { gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  star: { fontSize: 32 },
  label: { color: colors.text, fontWeight: '700', fontSize: 15 },
  muted: { color: colors.textMuted, fontSize: 13 },
  mono: { color: '#6ee7b7', fontFamily: 'monospace', fontSize: 12 },
  noteInput: {
    minHeight: 96,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    textAlignVertical: 'top',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: { color: '#0a0a0a', fontWeight: '700' },
  cloudButton: { alignSelf: 'stretch', alignItems: 'center' },
  cloudOk: { color: colors.accent, fontWeight: '600' },
  deleteButton: { alignSelf: 'stretch', alignItems: 'center', backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
  deleteText: { color: colors.danger, fontWeight: '700' },
});
