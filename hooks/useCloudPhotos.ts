import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { listRemotePhotos, type RemotePhotoWithUrl } from '@/services/cloudPhotos';

/** Fotos del usuario en Supabase, actualizadas en tiempo real (C4). */
export function useCloudPhotos() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [photos, setPhotos] = useState<RemotePhotoWithUrl[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      setPhotos(await listRemotePhotos());
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(
        message.toLowerCase().includes('network')
          ? 'Sin conexión. Desliza hacia abajo para reintentar.'
          : `No se pudo cargar la nube: ${message}`
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    reload();

    // Tiempo real: ante cualquier cambio en la tabla (desde este u otro teléfono) se vuelve a consultar.
    // Sin filtro por user_id: Supabase no permite filtrar los eventos DELETE. No hace falta,
    // porque RLS aplica al canal y la consulta de reload() solo devuelve mis filas.
    const channel = supabase
      .channel(`nube-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, () => {
        reload();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel); // misma regla de la Semana 6: toda suscripción se limpia
    };
  }, [userId, reload]);

  return { photos, isLoading, error, reload };
}
