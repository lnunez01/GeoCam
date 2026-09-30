import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import { useShake } from '@/hooks/useShake';
import { StatusBanner } from '@/components/StatusBanner';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import { colors } from '@/constants/theme';
import { confirmClearAll } from '@/lib/photos';
import type { Coords, GeoPhoto } from '@/types/geo';

type LocatedPhoto = GeoPhoto & { coords: Coords };

const DELTA = { latitudeDelta: 0.02, longitudeDelta: 0.02 };
// Riohacha, La Guajira: solo como vista inicial si no hay ubicación ni fotos
const FALLBACK_REGION: Region = { latitude: 11.5444, longitude: -72.9072, latitudeDelta: 0.2, longitudeDelta: 0.2 };

function hasCoords(photo: GeoPhoto): photo is LocatedPhoto {
  return photo.coords !== null;
}

export default function MapaScreen() {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const geo = useGeoLocation({ watch: true, enabled: isFocused });
  const { photos, removePhoto, clearAll } = useGeoPhotos();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useShake(() => confirmClearAll(photos.length, clearAll), { enabled: isFocused });

  const located = useMemo(() => photos.filter(hasCoords), [photos]);
  const withoutLocation = useMemo(() => photos.filter((p) => p.coords === null), [photos]);
  const selected = photos.find((p) => p.id === selectedId) ?? null;

  // Centro: tu ubicación o, sin permiso, la última foto con coordenadas
  const center: Coords | null = geo.coords ?? located[0]?.coords ?? null;
  const centerLat = center?.latitude;
  const centerLng = center?.longitude;

  useEffect(() => {
    if (!isFocused || centerLat === undefined || centerLng === undefined) return;
    mapRef.current?.animateToRegion({ latitude: centerLat, longitude: centerLng, ...DELTA }, 500);
  }, [isFocused, centerLat, centerLng]);

  return (
    <View style={styles.fill}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={FALLBACK_REGION}
        showsUserLocation={geo.permission === 'granted'}
        onPress={() => setSelectedId(null)}
      >
        {located.map((photo) => (
          <Marker
            key={photo.id}
            coordinate={{ latitude: photo.coords.latitude, longitude: photo.coords.longitude }}
            pinColor={photo.source === 'gallery' ? colors.gallery : colors.accent}
            onPress={() => setSelectedId(photo.id)}
          />
        ))}
      </MapView>

      <View style={[styles.top, { top: insets.top + 12 }]}>
        {geo.permission === 'blocked' && (
          <StatusBanner
            message="Ubicación bloqueada: el mapa se centra en tu última foto."
            actionLabel="Abrir Ajustes"
            onPress={geo.openSettings}
          />
        )}
        {(geo.permission === 'undetermined' || geo.permission === 'denied') && (
          <StatusBanner
            message="Sin ubicación: el mapa se centra en tu última foto."
            actionLabel="Permitir ubicación"
            onPress={geo.requestPermission}
          />
        )}
        {geo.error && <StatusBanner tone="danger" message={`Ubicación: ${geo.error}`} />}
      </View>

      {selected && (
        <View style={styles.preview}>
          <Image source={{ uri: selected.uri }} style={styles.previewImage} />
          <View style={styles.previewInfo}>
            <Text style={styles.previewTitle}>
              {selected.source === 'gallery' ? '🖼️ Galería' : '📷 Cámara'}
            </Text>
            <Text style={styles.muted}>{new Date(selected.createdAt).toLocaleString()}</Text>
            {selected.coords && (
              <Text style={styles.mono}>
                {selected.coords.latitude.toFixed(5)}, {selected.coords.longitude.toFixed(5)}
              </Text>
            )}
            <Pressable
              onPress={() => {
                removePhoto(selected.id);
                setSelectedId(null);
              }}
            >
              <Text style={styles.delete}>Eliminar</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.list}>
        <Text style={styles.listTitle}>Sin ubicación ({withoutLocation.length})</Text>
        {withoutLocation.length === 0 ? (
          <Text style={styles.muted}>Todas tus fotos tienen coordenadas.</Text>
        ) : (
          <FlatList
            horizontal
            data={withoutLocation}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => setSelectedId(item.id)}>
                <Image
                  source={{ uri: item.uri }}
                  style={[
                    styles.listThumb,
                    { borderColor: item.source === 'gallery' ? colors.gallery : colors.text },
                  ]}
                />
              </Pressable>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  map: { flex: 1 },
  top: { position: 'absolute', left: 16, right: 16, gap: 8 },
  preview: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 132,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  previewImage: { width: 96, height: 96, borderRadius: 8 },
  previewInfo: { flex: 1, gap: 4 },
  previewTitle: { color: colors.text, fontWeight: '700' },
  mono: { color: '#6ee7b7', fontFamily: 'monospace', fontSize: 12 },
  delete: { color: colors.danger, fontWeight: '600', marginTop: 4 },
  list: { padding: 12, gap: 8, backgroundColor: colors.background, minHeight: 120 },
  listTitle: { color: colors.text, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 12 },
  listThumb: { width: 64, height: 64, borderRadius: 8, borderWidth: 2 },
});
