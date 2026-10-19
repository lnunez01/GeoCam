import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { syncPending } from '@/services/cloudPhotos';

/** Estado del botón "Sincronizar": progreso "3 de 7" y resumen al terminar (C1). */
export function useCloudSync() {
  const { session } = useAuth();
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const sync = useCallback(async () => {
    if (!session || progress) return;
    setProgress({ current: 0, total: 0 });
    try {
      const result = await syncPending(session.user.id, (current, total) => setProgress({ current, total }));

      if (result.total === 0) {
        Alert.alert('Todo al día', 'No hay fotos pendientes de subir.');
      } else if (result.failed === 0) {
        Alert.alert('Sincronización completa', `Se subieron ${result.uploaded} de ${result.total} fotos.`);
      } else {
        Alert.alert(
          'Sincronización incompleta',
          `Se subieron ${result.uploaded} de ${result.total}. Quedaron ${result.failed} pendientes.\n\n` +
            `Primer error: ${result.firstError}`
        );
      }
    } finally {
      setProgress(null);
    }
  }, [session, progress]);

  return { sync, isSyncing: progress !== null, progress };
}
