import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useAuth } from '@/context/AuthContext';
import { photosRepo } from '@/db/repositories/photos';
import type { Photo } from '@/db/schema';
import { useAlbumsVersion } from '@/hooks/useAlbumsVersion';
import { deleteRemotePhoto } from '@/services/cloudPhotos';
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
    albumId: row.albumId,
    albumName: row.albumName,
    remotePath: row.remotePath,
    // Pendiente de subir: syncedAt vacío o anterior a la última edición del usuario
    synced:
      row.syncedAt !== null &&
      row.syncedAt.getTime() >= (row.updatedAt ?? row.createdAt).getTime(),
  };
}

/**
 * Compartida con usePhoto para que borrar desde el detalle haga lo mismo que desde el mapa:
 * primero el registro y luego el archivo.
 */
export async function removePhotoById(id: number): Promise<void> {
  const row = photosRepo.findById(id);
  // C3: si la foto está en la nube, se borra allá primero. Si falla (p. ej. sin internet),
  // deleteRemotePhoto lanza el error y la copia local se conserva: nada queda a medias.
  if (row?.remotePath && row.clientId) {
    await deleteRemotePhoto(row.clientId, row.remotePath);
  }
  await photosRepo.remove(id);
  if (row) deletePhotoFile(row.uri);
}

export function usePhotos({ search = '', albumId = null, onlyFavorites = false }: PhotoFilters = {}) {
  const albumsVersion = useAlbumsVersion();
  // Las pestañas solo existen con sesión (Stack.Protected), así que siempre hay un usuario
  const ownerId = useAuth().session?.user.id ?? '';
  // Las dependencias hacen que la consulta se reconstruya al cambiar un filtro o de usuario
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
      await photosRepo.create({
        ownerId,
        uri: permanentUri,
        source,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        accuracy: coords?.accuracy ?? null,
      });
    } catch (e) {
      // Sin registro el archivo quedaría huérfano
      deletePhotoFile(permanentUri);
      throw e;
    }
  }, [ownerId]);

  const removePhoto = useCallback((id: number) => removePhotoById(id), []);

  /** Borra del teléfono solo las fotos del usuario de la sesión (la copia en la nube se conserva). */
  const clearAll = useCallback(async () => {
    const uris = photosRepo.allUris(ownerId);
    await photosRepo.clearAll(ownerId);
    uris.forEach(({ uri }) => deletePhotoFile(uri));
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
