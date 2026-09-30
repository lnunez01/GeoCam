import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { GeoPhoto } from '@/types/geo';

interface GeoPhotosContextValue {
  photos: GeoPhoto[];
  addPhoto: (photo: GeoPhoto) => void;
  removePhoto: (id: string) => void;
  clearAll: () => void;
}

const GeoPhotosContext = createContext<GeoPhotosContextValue | null>(null);

export function GeoPhotosProvider({ children }: { children: ReactNode }) {
  const [photos, setPhotos] = useState<GeoPhoto[]>([]);

  // Actualizaciones inmutables: siempre un arreglo nuevo
  const addPhoto = useCallback((photo: GeoPhoto) => {
    setPhotos((prev) => [photo, ...prev]);
  }, []);

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearAll = useCallback(() => setPhotos([]), []);

  const value = useMemo(
    () => ({ photos, addPhoto, removePhoto, clearAll }),
    [photos, addPhoto, removePhoto, clearAll]
  );

  return <GeoPhotosContext.Provider value={value}>{children}</GeoPhotosContext.Provider>;
}

export function useGeoPhotos(): GeoPhotosContextValue {
  const ctx = useContext(GeoPhotosContext);
  if (!ctx) throw new Error('useGeoPhotos debe usarse dentro de <GeoPhotosProvider>');
  return ctx;
}
