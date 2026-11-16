export type PermissionState =
  | 'checking'
  | 'undetermined'
  | 'granted'
  | 'denied'
  | 'blocked';

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

/** Tipo de dominio que usan las pantallas: no depende de Drizzle. */
export interface GeoPhoto {
  id: number;
  uri: string;
  coords: Coords | null; // null si el usuario negó la ubicación
  source: 'camera' | 'gallery';
  createdAt: number; // ms
  note: string | null;
  favorite: boolean;
  /** Semana 10: descripción sugerida por la IA (editable). */
  aiDescription: string | null;
  albumId: number | null;
  albumName: string | null;
  /** UUID que identifica la misma foto en el teléfono y en la nube. */
  clientId: string | null;
  /** Ruta del archivo en el bucket; null si nunca se subió. */
  remotePath: string | null;
  syncedAt: number | null; // ms
  updatedAt: number | null; // ms
  /** Subida y sin cambios posteriores a la última sincronización. */
  isSynced: boolean;
}

/** Foto leída de Supabase (pestaña Nube). No depende de que exista en este teléfono. */
export interface CloudPhoto {
  clientId: string;
  storagePath: string;
  /** URL firmada temporal; null si no se pudo firmar. */
  url: string | null;
  coords: { latitude: number; longitude: number } | null;
  note: string | null;
  favorite: boolean;
  source: 'camera' | 'gallery';
  takenAt: number; // ms
}

export interface Album {
  id: number;
  name: string;
  createdAt: number; // ms
}

/** null = todos los álbumes, 'none' = solo fotos sin álbum. */
export type AlbumFilter = number | 'none' | null;

export interface PhotoFilters {
  search?: string;
  albumId?: AlbumFilter;
  onlyFavorites?: boolean;
}
