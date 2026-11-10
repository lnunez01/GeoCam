// Única capa que conoce el bucket y la tabla photos de Supabase (igual que los repositorios de la Semana 7).
import { supabase } from '@/lib/supabase';

export const BUCKET = 'geocam';

/** Ruta del archivo en el bucket: carpeta = id del usuario (lo exige la política RLS). */
export const storagePathFor = (userId: string, clientId: string) => `${userId}/${clientId}.jpg`;

/** Storage responde así cuando la ruta ya tiene un archivo (subida repetida). */
export function isAlreadyExists(error: { message?: string; statusCode?: string | number }) {
  const msg = (error.message ?? '').toLowerCase();
  return String(error.statusCode) === '409' || msg.includes('already exists') || msg.includes('duplicate');
}

/** Error de red de fetch/supabase-js: el teléfono no tiene conexión o el servidor no responde. */
export function isNetworkError(message: string) {
  const m = message.toLowerCase();
  return m.includes('network request failed') || m.includes('failed to fetch') || m.includes('network');
}

/** Fila de la tabla photos de Supabase. */
export interface RemotePhoto {
  id: number;
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
  deleted_at: string | null; // borrado lógico (C1)
  created_at: string;
}

export interface RemotePhotoWithUrl extends RemotePhoto {
  /** URL firmada temporal; null si no se pudo generar (p. ej. el archivo ya no existe). */
  url: string | null;
}

/** URL temporal para ver un archivo de un bucket privado. */
export async function signedUrl(path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

// ---------------------------------------------------------------------------
// C2. Feed de la pestaña Nube: paginación por cursor con búsqueda por nota
// ---------------------------------------------------------------------------

export const CLOUD_PAGE_SIZE = 10;

export interface CloudPage {
  items: RemotePhotoWithUrl[];
  /** created_at de la última foto de la página; null si no hay más. */
  nextCursor: string | null;
}

/**
 * Una página de fotos de la nube, de la más nueva a la más antigua.
 * Paginación por cursor ("las 10 anteriores a esta"), no por posición: si llega una foto
 * nueva por tiempo real, la lista no se corre ni aparecen repetidas.
 * RLS ya filtra por dueño; las marcadas como borradas no se muestran.
 */
export async function listCloudPage(params: { cursor: string | null; search: string }): Promise<CloudPage> {
  let query = supabase
    .from('photos')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(CLOUD_PAGE_SIZE);

  if (params.cursor) query = query.lt('created_at', params.cursor);
  const term = params.search.trim();
  if (term) query = query.ilike('note', `%${term}%`);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as RemotePhoto[];
  if (rows.length === 0) return { items: [], nextCursor: null };

  // Una sola petición para las URLs firmadas de la página (el bucket es privado).
  // Duran 7 días para que la caché persistida (C3) siga mostrando imágenes sin conexión.
  const { data: signed, error: signError } = await supabase.storage.from(BUCKET).createSignedUrls(
    rows.map((r) => r.storage_path),
    60 * 60 * 24 * 7
  );
  if (signError) throw signError;
  const urlByPath = new Map(signed.map((s) => [s.path, s.error ? null : s.signedUrl]));

  return {
    items: rows.map((r) => ({ ...r, url: urlByPath.get(r.storage_path) ?? null })),
    nextCursor: rows.length === CLOUD_PAGE_SIZE ? rows[rows.length - 1].created_at : null,
  };
}

/** Avisa cada vez que cambia la tabla photos (de este u otro teléfono). Devuelve cómo cancelar. */
export function subscribeToCloudChanges(userId: string, onChange: () => void): () => void {
  // Sin filtro por user_id: Supabase no permite filtrar los eventos DELETE. No hace falta,
  // porque RLS aplica también a lo que llega por el canal.
  const channel = supabase
    .channel(`nube-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
