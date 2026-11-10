// Sincronización en dos sentidos entre SQLite (fuente de verdad) y Supabase (respaldo).
// TanStack Query solo decide CUÁNDO se ejecuta (hooks/useSync.ts); el QUÉ es diseño propio y vive aquí.
import { supabase } from '@/lib/supabase';
import { photosRepo } from '@/db/repositories/photos';
import { syncMetaRepo } from '@/db/repositories/syncMeta';
import type { Photo } from '@/db/schema';
import {
  BUCKET,
  isAlreadyExists,
  isNetworkError,
  signedUrl,
  storagePathFor,
  type RemotePhoto,
} from '@/services/cloudPhotos';
import { deletePhotoFile, downloadPhotoFile } from '@/services/photoFiles';

const PULL_LIMIT = 200;

/**
 * Regla de conflicto: gana el último cambio. Función pura, sin base de datos ni red.
 * Con fechas iguales no gana nadie: ya están sincronizados.
 */
export function remoteWins(localUpdatedAt: Date | null, remoteUpdatedAt: string): boolean {
  return new Date(remoteUpdatedAt).getTime() > (localUpdatedAt?.getTime() ?? 0);
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  /** Fotos que fallaron al subir: quedan pendientes y se reintentan en el siguiente ciclo (C5). */
  failed: number;
  lastError: string | null;
  finishedAt: number;
}

const cursorKey = (userId: string) => `lastPulledAt:${userId}`;
export const lastResultKey = (userId: string) => `lastSync:${userId}`;

function messageOf(e: unknown) {
  return e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e);
}

// ---------------------------------------------------------------------------
// 1. Bajar: solo lo que llegó al servidor después del cursor
// ---------------------------------------------------------------------------
/** Aplica en SQLite una fila que bajó de la nube. Devuelve true si cambió algo en el teléfono. */
async function applyRemoteRow(remote: RemotePhoto, userId: string): Promise<boolean> {
  const local = photosRepo.findByClientId(remote.client_id);
  const remoteUpdatedAt = new Date(remote.updated_at);
  const remoteDeletedAt = remote.deleted_at ? new Date(remote.deleted_at) : null;

  if (!local) {
    // Foto creada en otro teléfono. Si ya viene borrada, no hay nada que mostrar ni descargar.
    if (remoteDeletedAt) return false;
    const uri = await downloadPhotoFile(await signedUrl(remote.storage_path), remote.client_id);
    photosRepo.insertFromRemote({
      ownerId: userId, // C5 de la Semana 8: los datos locales son por usuario
      clientId: remote.client_id,
      uri,
      latitude: remote.latitude,
      longitude: remote.longitude,
      note: remote.note,
      favorite: remote.favorite,
      source: remote.source,
      createdAt: new Date(remote.taken_at),
      updatedAt: remoteUpdatedAt,
      remotePath: remote.storage_path,
      syncedAt: remoteUpdatedAt, // nace sincronizada
      deletedAt: null,
    });
    return true;
  }

  // Si la versión local es más nueva (o igual) no se toca: push la subirá enseguida
  if (!remoteWins(local.updatedAt, remote.updated_at)) return false;

  // La versión de la nube es más nueva: se aplica en local (incluida una marca de borrado).
  // Caso raro: la foto estaba borrada aquí y otro teléfono la editó después; vuelve, con su archivo.
  const uri =
    !remoteDeletedAt && !local.uri
      ? await downloadPhotoFile(await signedUrl(remote.storage_path), remote.client_id)
      : undefined;
  photosRepo.applyRemote(local.id, {
    note: remote.note,
    favorite: remote.favorite,
    deletedAt: remoteDeletedAt,
    updatedAt: remoteUpdatedAt,
    syncedAt: remoteUpdatedAt,
    uri,
  });
  // Borrada en otro teléfono: el archivo local ya no hace falta
  if (remoteDeletedAt && local.uri) {
    deletePhotoFile(local.uri);
    photosRepo.markPurged(local.id);
  }
  return true;
}

async function pull(userId: string): Promise<number> {
  const since = (await syncMetaRepo.get(cursorKey(userId))) ?? '1970-01-01T00:00:00Z';

  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('user_id', userId)
    .gt('server_updated_at', since)
    .order('server_updated_at', { ascending: true })
    .limit(PULL_LIMIT); // con más cambios, el resto llega en el siguiente ciclo
  if (error) throw error;

  let applied = 0;
  for (const remote of (data ?? []) as RemotePhoto[]) {
    try {
      if (await applyRemoteRow(remote, userId)) applied++;
    } catch (e) {
      // Sin red: se corta y el siguiente ciclo continúa desde el cursor (no se pierde nada).
      // Otro error (p. ej. el archivo ya no está en el bucket): se salta esa fila para no
      // trabar la sincronización para siempre.
      if (isNetworkError(messageOf(e))) throw e;
      if (__DEV__) console.warn(`[sync] no se pudo aplicar ${remote.client_id}`, e);
    }
    // El cursor avanza fila por fila: si algo falla, el siguiente intento continúa desde aquí
    await syncMetaRepo.set(cursorKey(userId), remote.server_updated_at);
  }
  return applied;
}

// ---------------------------------------------------------------------------
// 2. Subir: todo lo pendiente, de forma que repetirlo no duplique nada (idempotente)
// ---------------------------------------------------------------------------
async function pushOne(photo: Photo, userId: string): Promise<void> {
  if (!photo.clientId) return; // ensureSyncFields() debió rellenarlo
  const path = photo.remotePath ?? storagePathFor(userId, photo.clientId);
  const updatedAt = photo.updatedAt ?? photo.createdAt;

  // 1. El archivo solo se sube la primera vez (y nunca para una marca de borrado)
  let uploadedNow = false;
  if (!photo.remotePath && !photo.deletedAt) {
    // ArrayBuffer: un Blob o FormData produce archivos de 0 bytes en React Native
    const arrayBuffer = await fetch(photo.uri).then((res) => res.arrayBuffer());
    if (arrayBuffer.byteLength === 0) throw new Error('El archivo de la foto está vacío o ya no existe.');
    const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, { contentType: 'image/jpeg' });
    // "ya existe": un intento anterior subió el archivo pero no alcanzó a guardar la fila
    if (error && !isAlreadyExists(error)) throw error;
    uploadedNow = !error;
  }

  // 2. upsert por client_id: crea la fila o la actualiza, nunca la duplica
  const { error } = await supabase.from('photos').upsert(
    {
      client_id: photo.clientId,
      storage_path: path,
      latitude: photo.latitude,
      longitude: photo.longitude,
      note: photo.note,
      favorite: photo.favorite,
      source: photo.source,
      taken_at: photo.createdAt.toISOString(),
      updated_at: updatedAt.toISOString(),
      deleted_at: photo.deletedAt ? photo.deletedAt.toISOString() : null,
    },
    { onConflict: 'client_id' }
  );
  if (error) {
    // Sin fila no hay foto en la nube: el archivo recién subido se borra para no dejarlo huérfano
    if (uploadedNow) await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }

  // 3. syncedAt = la versión que se subió, no "ahora"
  photosRepo.markSynced(photo.id, path, updatedAt);
}

async function push(userId: string): Promise<{ pushed: number; failed: number; lastError: string | null }> {
  const pending = photosRepo.listPending(userId);
  let pushed = 0;
  let failed = 0;
  let lastError: string | null = null;

  for (const photo of pending) {
    try {
      await pushOne(photo, userId);
      pushed++;
    } catch (e) {
      // C5: si una foto falla, las demás continúan. La que falló sigue pendiente.
      failed++;
      lastError = messageOf(e);
      if (__DEV__) console.warn(`[sync] foto ${photo.id} no se pudo subir`, e);
      // Sin red no tiene sentido seguir intentando con las demás: el próximo ciclo continúa
      if (isNetworkError(lastError)) break;
    }
  }
  return { pushed, failed, lastError };
}

// ---------------------------------------------------------------------------
// 3. Limpieza (C1): cuando la marca de borrado ya está en la nube, se borran los archivos
// ---------------------------------------------------------------------------
async function purgeDeleted(userId: string): Promise<void> {
  for (const photo of photosRepo.listDeletedToPurge(userId)) {
    if (photo.remotePath) {
      const { error } = await supabase.storage.from(BUCKET).remove([photo.remotePath]);
      if (error) continue; // se reintenta en el siguiente ciclo
    }
    deletePhotoFile(photo.uri);
    photosRepo.markPurged(photo.id); // la fila queda como lápida
  }
}

// ---------------------------------------------------------------------------
// Un ciclo completo. Primero bajar, después subir.
// ---------------------------------------------------------------------------
let running: Promise<SyncResult> | null = null;

/**
 * Se baja antes de subir: si se subiera primero, un cambio local viejo podría pisar un cambio
 * remoto más nuevo antes de compararlos.
 * Si ya hay un ciclo en curso se devuelve ese mismo (TanStack Query puede pedir otro al
 * invalidar la consulta mientras la anterior sigue corriendo).
 */
export function syncAll(userId: string): Promise<SyncResult> {
  running ??= (async () => {
    try {
      const pulled = await pull(userId);
      const { pushed, failed, lastError } = await push(userId);
      await purgeDeleted(userId);
      const result: SyncResult = { pulled, pushed, failed, lastError, finishedAt: Date.now() };
      await syncMetaRepo.set(lastResultKey(userId), JSON.stringify(result));
      return result;
    } catch (e) {
      // Falló el ciclo completo (p. ej. sin red al bajar): se guarda para la pantalla de estado
      const previous = await syncMetaRepo.get(lastResultKey(userId));
      const base: SyncResult = previous ? JSON.parse(previous) : { pulled: 0, pushed: 0, failed: 0, finishedAt: 0 };
      await syncMetaRepo.set(lastResultKey(userId), JSON.stringify({ ...base, lastError: messageOf(e) }));
      throw e;
    } finally {
      running = null;
    }
  })();
  return running;
}
