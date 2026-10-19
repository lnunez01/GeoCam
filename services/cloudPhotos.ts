// Única capa que conoce Supabase para las fotos (igual que los repositorios de la Semana 7).
import { supabase } from '@/lib/supabase';
import { photosRepo } from '@/db/repositories/photos';
import type { Photo } from '@/db/schema';

const BUCKET = 'geocam';

/** Ruta del archivo en el bucket: carpeta = id del usuario (lo exige la política RLS). */
export const storagePathFor = (userId: string, clientId: string) => `${userId}/${clientId}.jpg`;

/** Storage responde así cuando la ruta ya tiene un archivo (subida repetida). */
function isAlreadyExists(error: { message?: string; statusCode?: string | number }) {
  const msg = (error.message ?? '').toLowerCase();
  return String(error.statusCode) === '409' || msg.includes('already exists') || msg.includes('duplicate');
}

/**
 * Sube una foto sin duplicados ni huérfanos (C2):
 * 1. El archivo va a <userId>/<clientId>.jpg. Como el nombre es el clientId, repetir la subida
 *    apunta a la misma ruta; si el archivo ya estaba, se reutiliza en vez de crear otro.
 * 2. La fila se hace con upsert por client_id: la primera vez inserta y las siguientes
 *    actualizan la misma fila (por ejemplo, una nota editada), nunca crean una nueva.
 * 3. Si el archivo se subió en ESTE intento y la fila falla, se borra el archivo antes de
 *    reportar el error, para no dejar un archivo huérfano en el bucket.
 */
export async function uploadPhoto(photo: Photo, userId: string) {
  if (!photo.clientId) throw new Error('La foto no tiene clientId: ejecuta ensureSyncFields()');
  const path = storagePathFor(userId, photo.clientId);

  // 1. Archivo (solo si la foto nunca se subió: las ediciones solo cambian los metadatos)
  let uploadedNow = false;
  if (!photo.remotePath) {
    // Archivo local -> ArrayBuffer (un Blob o FormData produce archivos de 0 bytes en React Native)
    const arrayBuffer = await fetch(photo.uri).then((res) => res.arrayBuffer());
    if (arrayBuffer.byteLength === 0) throw new Error('El archivo de la foto está vacío o ya no existe.');

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType: 'image/jpeg' });
    if (uploadError && !isAlreadyExists(uploadError)) throw uploadError;
    uploadedNow = !uploadError;
  }

  // 2. Fila remota con los metadatos (user_id lo pone la base a partir del token)
  const { error: rowError } = await supabase.from('photos').upsert(
    {
      client_id: photo.clientId,
      storage_path: path,
      latitude: photo.latitude,
      longitude: photo.longitude,
      note: photo.note,
      favorite: photo.favorite,
      source: photo.source,
      taken_at: photo.createdAt.toISOString(),
      updated_at: (photo.updatedAt ?? photo.createdAt).toISOString(),
    },
    { onConflict: 'client_id' }
  );

  if (rowError) {
    // 3. Sin fila no hay foto en la nube: el archivo recién subido se borra para no dejarlo huérfano
    if (uploadedNow) await supabase.storage.from(BUCKET).remove([path]);
    throw rowError;
  }

  // 4. Marcar la foto local como sincronizada (sin tocar updatedAt)
  await photosRepo.markSynced(photo.id, path);
}

/** Sube una foto por su id local, leyendo la fila completa de SQLite. */
export async function uploadPhotoById(id: number, userId: string) {
  const row = photosRepo.findById(id);
  if (!row) throw new Error('La foto ya no existe en el teléfono.');
  await uploadPhoto(row, userId);
}

export interface SyncResult {
  total: number;
  uploaded: number;
  failed: number;
  firstError: string | null;
}

/**
 * Sube todas las fotos pendientes, una por una (C1). Si una falla, las demás continúan.
 * onProgress recibe (actual, total) para mostrar "3 de 7".
 */
export async function syncPending(
  userId: string,
  onProgress?: (current: number, total: number) => void
): Promise<SyncResult> {
  const pending = photosRepo.pendingUploads();
  const result: SyncResult = { total: pending.length, uploaded: 0, failed: 0, firstError: null };

  for (let i = 0; i < pending.length; i++) {
    onProgress?.(i + 1, pending.length);
    try {
      await uploadPhoto(pending[i], userId);
      result.uploaded++;
    } catch (e) {
      result.failed++;
      result.firstError ??= e instanceof Error ? e.message : String(e);
      if (__DEV__) console.warn(`[sync] foto ${pending[i].id} falló`, e);
    }
  }
  return result;
}

/** URL temporal (1 hora) para ver un archivo de un bucket privado. */
export async function signedUrl(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
