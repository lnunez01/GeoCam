import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useAuth } from '@/context/AuthContext';
import { photosRepo } from '@/db/repositories/photos';
import { useAlbumsVersion } from '@/hooks/useAlbumsVersion';
import { removePhotoById, toGeoPhoto } from '@/hooks/usePhotos';
import type { GeoPhoto } from '@/types/geo';

/** Detalle reactivo de una foto. photo es null si no existe (p. ej. ya se borró). */
export function usePhoto(id: number) {
  const albumsVersion = useAlbumsVersion();
  const ownerId = useAuth().session?.user.id ?? '';
  const { data, error, updatedAt } = useLiveQuery(photosRepo.detailQuery(ownerId, id), [
    ownerId,
    id,
    albumsVersion,
  ]);

  const photo: GeoPhoto | null = useMemo(() => (data[0] ? toGeoPhoto(data[0]) : null), [data]);
  const favorite = photo?.favorite ?? false;

  const updateNote = useCallback(
    async (note: string) => {
      const trimmed = note.trim();
      await photosRepo.update(id, { note: trimmed === '' ? null : trimmed });
    },
    [id]
  );

  const toggleFavorite = useCallback(async () => {
    await photosRepo.update(id, { favorite: !favorite });
  }, [id, favorite]);

  const moveToAlbum = useCallback(
    async (albumId: number | null) => {
      await photosRepo.update(id, { albumId });
    },
    [id]
  );

  const remove = useCallback(() => removePhotoById(id), [id]);

  return {
    photo,
    // Mientras la primera consulta no responde, photo es null pero no significa "no existe"
    isLoading: updatedAt === undefined && !error,
    error: error ?? null,
    updateNote,
    toggleFavorite,
    moveToAlbum,
    remove,
  };
}
