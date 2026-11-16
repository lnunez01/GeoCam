// Semana 9: sincronización en dos sentidos entre SQLite (fuente de verdad) y Supabase.
// Ciclo: 1) BAJAR lo que cambió en la nube, 2) SUBIR lo pendiente. Conflictos: gana el último cambio.
// Es la ÚNICA implementación de subida de la app (reemplaza a uploadPhoto de la Semana 8).
import { photosRepo } from '@/db/repositories/photos';
import { syncMetaRepo } from '@/db/repositories/syncMeta';
import { supabase } from '@/lib/supabase';
import { BUCKET, storagePathFor } from '@/services/cloudStorage';
import {
  deletePhotoFile,
  diagnosePhotoFile,
  downloadPhotoFile,
  photoFileExists,
  readPhotoBytes,
} from '@/services/photoFiles';

/** Fila de public.photos tal como la devuelve Supabase. */
interface RemotePhoto {
  client_id: string;
  storage_path: string;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  favorite: boolean;
  source: 'camera' | 'gallery';
  taken_at: string;
  updated_at: string; // reloj del teléfono: decide conflictos
  server_updated_at: string; // reloj del servidor: cursor de bajada
  deleted_at: string | null; // C1: borrado lógico ("lápida")
  ai_description: string | null; // Semana 10 (T5): descripción de IA
}

export interface SyncResult {
  /** Filas remotas aplicadas en local (nuevas o más recientes). */
  pulled: number;
  /** Fotos subidas con éxito. */
  pushed: number;
  /** Fotos que fallaron en la última vuelta: siguen pendientes para el próximo ciclo. */
  failed: number;
  /** Pendientes que nunca se subieron y cuyo archivo ya no está en el teléfono: no se intentan. */
  sinArchivo: number;
  /** Mensajes legibles de lo que falló en la última vuelta. */
  errors: string[];
  finishedAt: number;
}

const PULL_PAGE = 200;
const MAX_ROUNDS = 3;

const cursorKey = (userId: string) => `lastPulledAt:${userId}`;

function messageOf(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/** Gana el último cambio. Con fechas iguales no gana nadie: ya están sincronizados. */
export function remoteWins(localUpdatedAt: Date | null, remoteUpdatedAt: string): boolean {
  return new Date(remoteUpdatedAt).getTime() > (localUpdatedAt?.getTime() ?? 0);
}

/** Una foto está pendiente si nunca se subió o si se editó después de la última subida. */
export function isPending(photo: { syncedAt: Date | null; updatedAt: Date | null }): boolean {
  if (!photo.syncedAt) return true;
  return (photo.updatedAt?.getTime() ?? 0) > photo.syncedAt.getTime();
}

/**
 * Sin archivo local solo importa si la foto aún no está en el bucket (fotos guardadas en caché
 * antes de la C5 de la Semana 7). Una foto ya subida que perdió el archivo puede seguir
 * actualizando su metadata.
 */
export function canUpload(photo: { uri: string; remotePath: string | null }): boolean {
  return photo.remotePath !== null || photoFileExists(photo.uri);
}

// ---------------------------------------------------------------- BAJAR

/** C1: borra de verdad la copia local (fila + archivo). Solo cuando la nube ya conoce el borrado. */
function purgeLocal(photo: { id: number; uri: string }, userId: string) {
  photosRepo.purge(photo.id, userId);
  deletePhotoFile(photo.uri);
}

/**
 * Aplica en local una fila remota. Devuelve true si cambió algo en SQLite.
 * C1 – el borrado gana siempre (sin comparar fechas): quien borra también quita el archivo del
 * bucket, así que dejar ganar una edición posterior reviviría una fila sin imagen.
 */
async function applyRemoteRow(remote: RemotePhoto, userId: string): Promise<boolean> {
  const local = photosRepo.findByClientId(remote.client_id, userId);
  const remoteUpdatedAt = new Date(remote.updated_at);

  if (remote.deleted_at) {
    // Lápida: si existe aquí se borra; si no existe, no se descarga
    if (!local) return false;
    purgeLocal(local, userId);
    return true;
  }

  // Borrada aquí y aún sin avisar: no se aplica la edición remota; push sube la lápida enseguida
  if (local?.deletedAt) return false;

  if (!local) {
    // Foto creada en otro teléfono: se descarga el archivo y se crea la fila local ya sincronizada
    const uri = await downloadPhotoFile(remote.storage_path, remote.client_id);
    photosRepo.insertFromRemote(
      {
        clientId: remote.client_id,
        uri,
        latitude: remote.latitude,
        longitude: remote.longitude,
        note: remote.note,
        favorite: remote.favorite,
        aiDescription: remote.ai_description,
        source: remote.source,
        createdAt: new Date(remote.taken_at),
        updatedAt: remoteUpdatedAt,
        remotePath: remote.storage_path,
        syncedAt: remoteUpdatedAt, // nace sincronizada: syncedAt = la versión recibida
      },
      userId
    );
    return true;
  }

  if (remoteWins(local.updatedAt, remote.updated_at)) {
    // La versión de la nube es más nueva: se aplica en local (sin usar la hora actual)
    photosRepo.applyRemote(local.id, userId, {
      note: remote.note,
      favorite: remote.favorite,
      aiDescription: remote.ai_description,
      updatedAt: remoteUpdatedAt,
      syncedAt: remoteUpdatedAt,
    });
    return true;
  }

  // La versión local es más nueva (o igual): no se toca; push la sube enseguida
  return false;
}

/**
 * Bajar: solo lo que llegó al servidor después del cursor (server_updated_at, reloj del servidor).
 * El cursor avanza fila por fila: si algo falla, el siguiente intento continúa desde ahí.
 * Se guarda el texto exacto de Postgres (microsegundos): pasarlo por Date lo truncaría a milisegundos.
 */
export async function pull(userId: string): Promise<number> {
  let applied = 0;
  for (;;) {
    const since = syncMetaRepo.get(cursorKey(userId)) ?? '1970-01-01T00:00:00Z';
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .eq('user_id', userId)
      .gt('server_updated_at', since)
      .order('server_updated_at', { ascending: true })
      .limit(PULL_PAGE)
      .returns<RemotePhoto[]>();
    if (error) throw new Error(`No se pudieron bajar los cambios: ${error.message}`);

    for (const remote of data) {
      if (await applyRemoteRow(remote, userId)) applied++;
      syncMetaRepo.set(cursorKey(userId), remote.server_updated_at);
    }
    if (data.length < PULL_PAGE) return applied;
  }
}

// ---------------------------------------------------------------- SUBIR

type PendingRow = ReturnType<typeof photosRepo.pendingForUpload>[number];

/**
 * Sube una foto. Se puede repetir sin duplicar nada:
 * 1. El archivo solo se sube si la foto no tiene remotePath. La ruta depende del clientId y se sube
 *    con upsert, así que un reintento reemplaza el mismo archivo ("ya existe" también se tolera).
 * 2. La fila se escribe con upsert por client_id: crea o actualiza, nunca duplica.
 * 3. markSynced con el updatedAt subido (nunca "ahora"): si el usuario editó mientras se subía,
 *    su updatedAt es posterior y la foto sigue pendiente.
 * No hay "compensación" (borrar el archivo si falla la fila): con la bajada, ese archivo puede
 * pertenecer a una fila que ya existe en la nube. Un archivo sin fila se reemplaza en el reintento.
 */
async function pushOne(photo: PendingRow, userId: string, markAsSynced = true): Promise<void> {
  if (!photo.clientId) throw new Error('La foto aún no tiene identificador de sincronización');
  const path = photo.remotePath ?? storagePathFor(userId, photo.clientId);
  const uploadedVersion = photo.updatedAt ?? photo.createdAt;

  if (!photo.remotePath) {
    // ArrayBuffer (no Blob/FormData): en React Native esos dos suben archivos de 0 bytes
    const { bytes, contentType } = await readPhotoBytes(photo.uri);
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
    if (error && !/exists/i.test(error.message)) {
      throw new Error(`No se pudo subir el archivo: ${error.message}`);
    }
  }

  // user_id no se envía: la columna toma auth.uid() por defecto y RLS comprueba que coincida
  const { error: rowError } = await supabase.from('photos').upsert(
    {
      client_id: photo.clientId,
      storage_path: path,
      latitude: photo.latitude,
      longitude: photo.longitude,
      note: photo.note,
      favorite: photo.favorite,
      ai_description: photo.aiDescription, // Semana 10 (T5)
      source: photo.source,
      taken_at: photo.createdAt.toISOString(),
      updated_at: uploadedVersion.toISOString(),
      deleted_at: photo.deletedAt?.toISOString() ?? null, // C1: la lápida viaja en el mismo upsert
    },
    { onConflict: 'client_id' }
  );
  if (rowError) throw new Error(`No se pudo guardar la foto en la nube: ${rowError.message}`);

  if (markAsSynced) photosRepo.markSynced(photo.id, userId, path, uploadedVersion);
}

/**
 * C1: sube un borrado. La lápida (deleted_at) se escribe con el mismo upsert para que los demás
 * teléfonos se enteren por el cursor; después se borra el archivo del bucket y la copia local.
 * Si el archivo del bucket no se puede borrar se lanza el error y la foto sigue pendiente (reintento).
 * Si la foto nunca se subió (sin remotePath), la nube no la conoce: se borra solo en local.
 */
async function pushDeletion(photo: PendingRow, userId: string): Promise<void> {
  if (photo.remotePath) {
    // Sin markSynced: si falla el borrado del archivo, la foto debe seguir pendiente para reintentarlo
    await pushOne(photo, userId, false);
    const { error } = await supabase.storage.from(BUCKET).remove([photo.remotePath]);
    if (error) throw new Error(`No se pudo borrar el archivo de la nube: ${error.message}`);
  }
  purgeLocal(photo, userId);
}

/** Lo que push puede procesar: borrados (siempre) y fotos con archivo o ya subidas. */
function isWorkable(photo: PendingRow): boolean {
  return photo.deletedAt !== null || canUpload(photo);
}

interface PushResult {
  pushed: number;
  failed: number;
  sinArchivo: number;
  errors: string[];
}

/**
 * Subir todo lo pendiente, una por una (no Promise.all: una conexión móvil lenta se satura).
 * C5: si una foto falla se anota el error y se sigue con las demás; queda pendiente para el próximo ciclo.
 */
export async function push(userId: string): Promise<PushResult> {
  const all = photosRepo.pendingForUpload(userId);
  // Los borrados se procesan aunque no tengan archivo: no hay nada que subir, solo avisar
  const pending = all.filter(isWorkable);
  const result: PushResult = { pushed: 0, failed: 0, sinArchivo: all.length - pending.length, errors: [] };

  for (const photo of pending) {
    try {
      if (photo.deletedAt) await pushDeletion(photo, userId);
      else await pushOne(photo, userId);
      result.pushed++;
    } catch (e) {
      result.failed++;
      result.errors.push(messageOf(e, 'No se pudo subir la foto'));
      if (__DEV__) console.log('[sync] falló la foto', photo.id, await diagnosePhotoFile(photo.uri));
    }
  }
  return result;
}

// ---------------------------------------------------------------- CICLO

async function runSync(userId: string): Promise<SyncResult> {
  if (__DEV__) console.log('[sync] inicia ciclo', userId);
  let pulled = 0;
  let pushed = 0;
  let last: PushResult = { pushed: 0, failed: 0, sinArchivo: 0, errors: [] };
  let pullError: string | null = null;

  // Si hubo ediciones durante el ciclo, se repite (máximo 3 vueltas) para no dejarlas esperando
  for (let round = 0; round < MAX_ROUNDS; round++) {
    // 1. Primero BAJAR. Si falla, se anota y se sube igual: lo local no debe esperar a la nube
    try {
      pulled += await pull(userId);
      pullError = null;
    } catch (e) {
      pullError = messageOf(e, 'No se pudieron bajar los cambios');
    }

    // 2. Después SUBIR
    last = await push(userId);
    pushed += last.pushed;

    // Otra vuelta solo si quedó algo subible que no sea lo que acaba de fallar (= se editó durante el ciclo)
    const remaining = photosRepo.pendingForUpload(userId).filter(isWorkable).length;
    if (last.pushed === 0 || remaining <= last.failed) break;
  }

  const result: SyncResult = {
    pulled,
    pushed,
    failed: last.failed,
    sinArchivo: last.sinArchivo,
    errors: pullError ? [pullError, ...last.errors] : last.errors,
    finishedAt: Date.now(),
  };
  if (__DEV__) console.log('[sync] ciclo terminado', JSON.stringify(result));
  return result;
}

// Un solo ciclo a la vez: si llega otra petición mientras hay uno en curso, se reutiliza su promesa
let running: { userId: string; promise: Promise<SyncResult> } | null = null;

/** Un ciclo completo de sincronización (bajar → subir). Seguro de llamar varias veces seguidas. */
export function syncAll(userId: string): Promise<SyncResult> {
  if (running?.userId === userId) return running.promise;
  const promise = (running?.promise.catch(() => undefined) ?? Promise.resolve())
    .then(() => runSync(userId))
    .finally(() => {
      if (running?.promise === promise) running = null;
    });
  running = { userId, promise };
  return promise;
}
