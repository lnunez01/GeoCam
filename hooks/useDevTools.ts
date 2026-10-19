import { useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { clearFakePhotos, measureList, seedFakePhotos } from '@/db/devSeed';

/** Herramientas de rendimiento (Fase 10). La pantalla solo las muestra en __DEV__. */
export function useDevTools() {
  const ownerId = useAuth().session?.user.id ?? '';
  const openMenu = useCallback(() => {
    Alert.alert('Herramientas de desarrollo', 'Medición de la lista de fotos', [
      {
        text: 'Insertar 1000 fotos de prueba',
        onPress: () => {
          seedFakePhotos(ownerId, 1000);
          Alert.alert('Listo', 'Se insertaron 1000 fotos de prueba.');
        },
      },
      {
        text: 'Medir lista',
        onPress: async () => {
          const { rows, avgMs } = await measureList(ownerId);
          Alert.alert('Medición', `${rows} filas · promedio de 5 consultas: ${avgMs.toFixed(1)} ms`);
        },
      },
      {
        text: 'Borrar datos de prueba',
        style: 'destructive',
        onPress: () => {
          clearFakePhotos();
          Alert.alert('Listo', 'Se borraron las fotos de prueba.');
        },
      },
      // Android muestra máximo 3 botones: allí se cierra tocando fuera del diálogo
      ...(Platform.OS === 'ios' ? [{ text: 'Cerrar', style: 'cancel' as const }] : []),
    ], { cancelable: true });
  }, [ownerId]);

  return { openMenu };
}
