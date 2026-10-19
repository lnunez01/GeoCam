// Única capa que conoce Supabase para las fotos (igual que los repositorios de la Semana 7).
import { supabase } from '@/lib/supabase';
import { photosRepo } from '@/db/repositories/photos';
import type { Photo } from '@/db/schema';

const BUCKET = 'geocam';

/** Ruta del archivo en el bucket: carpeta = id del usuario (lo exige la política RLS). */
export const storagePathFor = (userId: string, clientId: string) => `${userId}/${clientId}.jpg`;

/**
 * Sube una foto: archivo al bucket, fila remota con los metadatos y marca local de sincronizada.
 * Orden: primero el archivo, después la fila (si la fila falla queda un archivo huérfano;
 * eso se resuelve en el trabajo para la casa, tarea C2).
 */
export async function uploadPhoto(photo: Photo, userId: string) {
  if (!photo.clientId) throw new Error('La foto no tiene clientId: ejecuta ensureSyncFields()');

  // 1. Archivo local -> ArrayBuffer (un Blob o FormData produce archivos de 0 bytes en React Native)
  const arrayBuffer = await fetch(photo.uri).then((res) => res.arrayBuffer());
  if (arrayBuffer.byteLength === 0) throw new Error('El archivo de la foto está vacío o ya no existe.');

  // 2. Subir a la carpeta del usuario. El nombre es el clientId: la misma foto siempre va a la misma ruta.
  const path = storagePathFor(userId, photo.clientId);
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType: 'image/jpeg' });
  if (uploadError) throw uploadError;

  // 3. Fila remota con los metadatos (user_id lo pone la base a partir del token)
  const { error: insertError } = await supabase.from('photos').insert({
    client_id: photo.clientId,
    storage_path: path,
    latitude: photo.latitude,
    longitude: photo.longitude,
    note: photo.note,
    favorite: photo.favorite,
    source: photo.source,
    taken_at: photo.createdAt.toISOString(),
    updated_at: (photo.updatedAt ?? photo.createdAt).toISOString(),
  });
  if (insertError) throw insertError;

  // 4. Marcar la foto local como sincronizada (sin tocar updatedAt)
  await photosRepo.markSynced(photo.id, path);
}

/** Sube una foto por su id local, leyendo la fila completa de SQLite. */
export async function uploadPhotoById(id: number, userId: string) {
  const row = photosRepo.findById(id);
  if (!row) throw new Error('La foto ya no existe en el teléfono.');
  await uploadPhoto(row, userId);
}

/** URL temporal (1 hora) para ver un archivo de un bucket privado. */
export async function signedUrl(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
