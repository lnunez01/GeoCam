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
  albumId: number | null;
  albumName: string | null;
  /** Ruta en el bucket de Supabase; null si nunca se ha subido. */
  remotePath: string | null;
  /** true si la última versión de la foto ya está en la nube (syncedAt >= updatedAt). */
  synced: boolean;
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
