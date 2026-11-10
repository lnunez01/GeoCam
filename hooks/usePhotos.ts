import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useAuth } from '@/context/AuthContext';
import { photosRepo } from '@/db/repositories/photos';
import type { Photo } from '@/db/schema';
import { useAlbumsVersion } from '@/hooks/useAlbumsVersion';
import { requestSync } from '@/lib/queryClient';
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
 * Borra una foto (C1 de la Semana 9). Compartida con usePhoto para que borrar desde el detalle
 * haga lo mismo que desde el mapa.
 * - Si nunca llegó a la nube, nadie más la conoce: se borra de verdad, fila y archivo.
 * - Si ya está en la nube, se marca con deletedAt: push sube la marca, pull la aplica en los
 *   demás teléfonos y los archivos se eliminan cuando la marca ya está sincronizada.
 * Funciona igual sin conexión: la marca espera en SQLite hasta que vuelva la red.
 */
export function removePhotoById(id: number): void {
  const row = photosRepo.findById(id);
  if (!row) return;
  if (row.remotePath) {
    photosRepo.markDeleted(id);
    requestSync();
  } else {
    photosRepo.hardDelete(id);
    deletePhotoFile(row.uri);
  }
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
      requestSync(); // se sube sola si hay red; si no, cuando vuelva
    } catch (e) {
      // Sin registro el archivo quedaría huérfano
      deletePhotoFile(permanentUri);
      throw e;
    }
  }, [ownerId]);

  const removePhoto = useCallback(async (id: number) => removePhotoById(id), []);

  /** Borra todas las fotos del usuario de la sesión (al agitar el teléfono), con la misma regla que removePhoto. */
  const clearAll = useCallback(async () => {
    for (const row of photosRepo.listVisible(ownerId)) removePhotoById(row.id);
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
