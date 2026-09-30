import { useCallback } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCamera } from '@/hooks/useCamera';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import { useShake } from '@/hooks/useShake';
import { PermissionPrimer } from '@/components/PermissionPrimer';
import { StatusBanner } from '@/components/StatusBanner';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import { colors } from '@/constants/theme';
import { confirmClearAll, createGeoPhoto, pickImageFromGallery } from '@/lib/photos';
import type { Coords, GeoPhoto } from '@/types/geo';

export default function GeoCamScreen() {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const {
    cameraRef,
    permissionState: cameraPermission,
    requestPermission: requestCamera,
    openSettings: openCameraSettings,
    facing,
    toggleFacing,
    isReady,
    onCameraReady,
    takePhoto,
    isCapturing,
    error: cameraError,
    clearError: clearCameraError,
  } = useCamera({ active: isFocused });
  // El GPS solo corre mientras esta pestaña tiene el foco
  const geo = useGeoLocation({ watch: true, enabled: isFocused });
  const { photos, addPhoto, clearAll } = useGeoPhotos();

  useShake(() => confirmClearAll(photos.length, clearAll), { enabled: isFocused });

  // Degradación elegante: sin permiso de ubicación, coords queda en null
  const resolveCoords = useCallback(async (): Promise<Coords | null> => {
    if (geo.permission !== 'granted') return null;
    return geo.coords ?? (await geo.getCurrent());
  }, [geo]);

  const handleImport = useCallback(async () => {
    const uri = await pickImageFromGallery();
    if (!uri) return;
    addPhoto(createGeoPhoto(uri, 'gallery', await resolveCoords()));
  }, [addPhoto, resolveCoords]);

  const handleCapture = async () => {
    const photo = await takePhoto();
    if (!photo) return;
    addPhoto(createGeoPhoto(photo.uri, 'camera', await resolveCoords()));
  };

  if (cameraPermission === 'checking') {
    return <View style={styles.fill} />;
  }

  if (cameraPermission !== 'granted') {
    return (
      <PermissionPrimer
        title="GeoCam necesita tu cámara"
        description="La usamos solo para tomar fotos que tú decidas guardar."
        state={cameraPermission}
        onRequest={requestCamera}
        onOpenSettings={openCameraSettings}
        secondaryAction={{ label: '🖼️ Importar desde galería', onPress: handleImport }}
      />
    );
  }

  const lastPhoto: GeoPhoto | undefined = photos[0];

  return (
    <View style={styles.fill}>
      {/* CameraView sin hijos: se desmonta al salir de la pestaña y los controles van como hermanos absolutos */}
      {isFocused && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          onCameraReady={onCameraReady}
        />
      )}

      <View style={[styles.top, { top: insets.top + 12 }]}>
        {/* Banner de ubicación: pedir en contexto sin bloquear la cámara */}
        {(geo.permission === 'undetermined' || geo.permission === 'denied') && (
          <StatusBanner
            message={
              geo.permission === 'denied'
                ? 'Sin ubicación: tus fotos se guardarán sin coordenadas.'
                : 'Activa la ubicación para etiquetar tus fotos.'
            }
            actionLabel="Permitir ubicación"
            onPress={geo.requestPermission}
          />
        )}
        {geo.permission === 'blocked' && (
          <StatusBanner
            message="La ubicación está bloqueada: tus fotos se guardarán sin coordenadas."
            actionLabel="Abrir Ajustes"
            onPress={geo.openSettings}
          />
        )}
        {geo.isApproximate && (
          <StatusBanner message="Concediste ubicación aproximada: las coordenadas pueden desviarse más de 1 km." />
        )}
        {geo.error && <StatusBanner tone="danger" message={`Ubicación: ${geo.error}`} />}
        {cameraError && (
          <StatusBanner
            tone="danger"
            message={`Cámara: ${cameraError}`}
            actionLabel="Cerrar"
            onPress={clearCameraError}
          />
        )}

        {/* Coordenadas en vivo */}
        {geo.permission === 'granted' && (
          <View style={styles.coords}>
            {geo.coords ? (
              <>
                <Text style={styles.coordsText}>
                  {geo.coords.latitude.toFixed(5)}, {geo.coords.longitude.toFixed(5)}
                </Text>
                <Text style={styles.coordsMuted}>±{Math.round(geo.coords.accuracy ?? 0)} m</Text>
              </>
            ) : (
              <Text style={styles.coordsMuted}>Buscando GPS…</Text>
            )}
          </View>
        )}
      </View>

      {/* Controles inferiores */}
      <View style={styles.controls}>
        <View style={styles.side}>
          {lastPhoto ? (
            <View>
              <Image
                source={{ uri: lastPhoto.uri }}
                style={[
                  styles.thumb,
                  { borderColor: lastPhoto.source === 'gallery' ? colors.gallery : colors.text },
                ]}
              />
              <Text style={styles.thumbBadge}>{lastPhoto.coords ? '📍' : '∅'}</Text>
            </View>
          ) : null}
          <Pressable onPress={handleImport} style={styles.smallButton} accessibilityLabel="Importar desde galería">
            <Text style={styles.smallButtonText}>🖼️</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={handleCapture}
          disabled={isCapturing || !isReady}
          style={({ pressed }) => [styles.shutter, pressed && { opacity: 0.7 }]}
          accessibilityLabel="Tomar foto"
        >
          <View
            style={[
              styles.shutterInner,
              { backgroundColor: isCapturing || !isReady ? '#a3a3a3' : colors.text },
            ]}
          />
        </Pressable>

        <View style={styles.side}>
          <Pressable onPress={toggleFacing} style={styles.smallButton} accessibilityLabel="Cambiar cámara">
            <Text style={styles.smallButtonText}>↻</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  top: { position: 'absolute', left: 16, right: 16, gap: 8 },
  coords: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  coordsText: { color: '#6ee7b7', fontFamily: 'monospace', fontSize: 12 },
  coordsMuted: { color: colors.textMuted, fontFamily: 'monospace', fontSize: 12 },
  controls: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  side: { width: 120, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 8, borderWidth: 2 },
  thumbBadge: { position: 'absolute', right: -6, top: -6, fontSize: 14 },
  smallButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: { color: colors.text, fontSize: 22 },
  shutter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 64, height: 64, borderRadius: 32 },
});
