import { useEffect, useState } from 'react';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from '@/db/client';
import { photosRepo } from '@/db/repositories/photos';
import migrations from '@/drizzle/migrations';

/**
 * Prepara SQLite antes de montar cualquier pantalla: aplica las migraciones de drizzle/ y
 * después da clientId y updatedAt a las fotos anteriores a la Semana 8.
 * Así las pantallas (incluido el layout) no importan Drizzle.
 */
export function useDatabase() {
  const { success, error } = useMigrations(db, migrations);
  const [syncFieldsReady, setSyncFieldsReady] = useState(false);

  useEffect(() => {
    if (!success) return;
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        const filled = photosRepo.ensureSyncFields();
        if (__DEV__ && filled > 0) console.log(`[db] ${filled} fotos recibieron clientId`);
      })
      .catch((e: unknown) => {
        if (__DEV__) console.warn('[db] ensureSyncFields falló', e);
      })
      .finally(() => {
        if (!cancelled) setSyncFieldsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [success]);

  return { isReady: success && syncFieldsReady, error: error ?? null };
}

/** C5 (Semana 8): al iniciar sesión, las fotos viejas sin dueño se asignan antes de mostrar las pestañas. */
export function useClaimUnowned(userId: string | undefined) {
  const [claimedFor, setClaimedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.resolve()
      .then(() => photosRepo.claimUnowned(userId))
      .catch((e: unknown) => {
        if (__DEV__) console.warn('[db] claimUnowned falló', e);
      })
      .finally(() => {
        if (!cancelled) setClaimedFor(userId);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return !userId || claimedFor === userId;
}
