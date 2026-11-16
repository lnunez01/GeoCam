import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo } from '@/db/repositories/photos';
import { useAlbumsVersion } from '@/hooks/useAlbumsVersion';
import { useOwnerId } from '@/hooks/useOwnerId';
import { removePhotoById, toGeoPhoto } from '@/hooks/usePhotos';
import { requestSync } from '@/hooks/useSync';
import type { GeoPhoto } from '@/types/geo';

/** Detalle reactivo de una foto. photo es null si no existe (p. ej. ya se borró). */
export function usePhoto(id: number) {
  const ownerId = useOwnerId();
  const albumsVersion = useAlbumsVersion();
  const { data, error, updatedAt } = useLiveQuery(photosRepo.detailQuery(id, ownerId), [
    id,
    ownerId,
    albumsVersion,
  ]);

  const photo: GeoPhoto | null = useMemo(() => (data[0] ? toGeoPhoto(data[0]) : null), [data]);
  const favorite = photo?.favorite ?? false;

  const updateNote = useCallback(
    async (note: string) => {
      const trimmed = note.trim();
      await photosRepo.update(id, ownerId, { note: trimmed === '' ? null : trimmed });
      requestSync();
    },
    [id, ownerId]
  );

  const toggleFavorite = useCallback(async () => {
    await photosRepo.update(id, ownerId, { favorite: !favorite });
    requestSync();
  }, [id, ownerId, favorite]);

  const moveToAlbum = useCallback(
    async (albumId: number | null) => {
      await photosRepo.update(id, ownerId, { albumId });
      requestSync();
    },
    [id, ownerId]
  );

  // Semana 10 (T5): guardar la descripción cambia updatedAt; la foto queda pendiente y se sube sola
  const updateDescription = useCallback(
    async (description: string | null) => {
      await photosRepo.setDescription(id, ownerId, description);
      requestSync();
    },
    [id, ownerId]
  );

  const remove = useCallback(() => removePhotoById(id, ownerId), [id, ownerId]);

  return {
    photo,
    // Mientras la primera consulta no responde, photo es null pero no significa "no existe"
    isLoading: updatedAt === undefined && !error,
    error: error ?? null,
    updateNote,
    toggleFavorite,
    moveToAlbum,
    updateDescription,
    remove,
  };
}
