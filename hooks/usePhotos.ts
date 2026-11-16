import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo } from '@/db/repositories/photos';
import type { Photo } from '@/db/schema';
import { useAlbumsVersion } from '@/hooks/useAlbumsVersion';
import { useOwnerId } from '@/hooks/useOwnerId';
import { requestSync } from '@/hooks/useSync';
import { deletePhotoFile, persistPhoto } from '@/services/photoFiles';
import type { Coords, GeoPhoto, PhotoFilters } from '@/types/geo';

export interface NewPhotoInput {
  uri: string;
  source: GeoPhoto['source'];
  coords: Coords | null;
}

type PhotoRow = Photo & { albumName: string | null };

/** Fila plana de SQLite → objeto de dominio con coords anidadas. */
export function toGeoPhoto(row: PhotoRow): GeoPhoto {
  const createdAt = row.createdAt.getTime();
  const syncedAt = row.syncedAt?.getTime() ?? null;
  const updatedAt = row.updatedAt?.getTime() ?? null;
  const coords: Coords | null =
    row.latitude !== null && row.longitude !== null
      ? { latitude: row.latitude, longitude: row.longitude, accuracy: row.accuracy, timestamp: createdAt }
      : null;
  return {
    id: row.id,
    uri: row.uri,
    coords,
    source: row.source,
    createdAt,
    note: row.note,
    favorite: row.favorite,
    aiDescription: row.aiDescription,
    albumId: row.albumId,
    albumName: row.albumName,
    clientId: row.clientId,
    remotePath: row.remotePath,
    syncedAt,
    updatedAt,
    isSynced: syncedAt !== null && (updatedAt === null || syncedAt >= updatedAt),
  };
}

/**
 * Compartida con usePhoto para que borrar desde el detalle haga lo mismo que desde el mapa.
 * Semana 9 (C1): borrar = marcar (deletedAt). Funciona sin conexión; la sincronización le avisa
 * a la nube y después borra la fila y los archivos (local y del bucket). Reemplaza la regla de la
 * Semana 8 "sin red no se borra".
 */
export async function removePhotoById(id: number, ownerId: string): Promise<void> {
  photosRepo.markDeleted(id, ownerId);
  requestSync();
}

export function usePhotos({ search = '', albumId = null, onlyFavorites = false }: PhotoFilters = {}) {
  const ownerId = useOwnerId();
  const albumsVersion = useAlbumsVersion();
  // Las dependencias hacen que la consulta se reconstruya al cambiar un filtro o de cuenta
  const filtered = useLiveQuery(photosRepo.filteredQuery(ownerId, { search, albumId, onlyFavorites }), [
    ownerId,
    search,
    albumId,
    onlyFavorites,
    albumsVersion,
  ]);
  const located = useLiveQuery(photosRepo.withLocationQuery(ownerId), [ownerId, albumsVersion]);

  const photos = useMemo(() => filtered.data.map(toGeoPhoto), [filtered.data]);
  const photosWithLocation = useMemo(() => located.data.map(toGeoPhoto), [located.data]);

  const addPhoto = useCallback(async ({ uri, source, coords }: NewPhotoInput) => {
    const permanentUri = await persistPhoto(uri);
    try {
      await photosRepo.create(
        {
          uri: permanentUri,
          source,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          accuracy: coords?.accuracy ?? null,
        },
        ownerId
      );
    } catch (e) {
      // Sin registro el archivo quedaría huérfano
      deletePhotoFile(permanentUri);
      throw e;
    }
    // La foto ya está en SQLite (fuente de verdad); la nube se entera cuando haya red
    requestSync();
  }, [ownerId]);

  const removePhoto = useCallback((id: number) => removePhotoById(id, ownerId), [ownerId]);

  /** Shake → "borrar todo": el mismo borrado lógico que removePhotoById, para todas a la vez. */
  const clearAll = useCallback(async () => {
    photosRepo.markAllDeleted(ownerId);
    requestSync();
  }, [ownerId]);

  return {
    photos,
    photosWithLocation,
    addPhoto,
    removePhoto,
    clearAll,
    error: filtered.error ?? located.error ?? null,
  };
}
