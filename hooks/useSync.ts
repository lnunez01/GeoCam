import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useAuth } from '@/context/AuthContext';
import { photosRepo } from '@/db/repositories/photos';
import { syncMetaRepo } from '@/db/repositories/syncMeta';
import { useIsOnline } from '@/lib/queryClient';
import { lastResultKey, syncAll, type SyncResult } from '@/services/sync';

export type SyncStatus = 'offline' | 'syncing' | 'pending' | 'error' | 'synced';

/**
 * La sincronización como consulta: TanStack Query la dispara al iniciar sesión, al recuperar
 * la red y al volver a primer plano, y la reintenta si falla. Después de cada cambio local
 * se pide otra con requestSync() (lib/queryClient.ts).
 */
export function useSync() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const isOnline = useIsOnline();

  const { data: pending } = useLiveQuery(photosRepo.pendingQuery(userId), [userId]);
  // Último resultado guardado en SQLite: sobrevive al cierre de la app (pantalla de estado, C4)
  const { data: lastRow } = useLiveQuery(syncMetaRepo.valueQuery(lastResultKey(userId)), [userId]);
  const lastResult = useMemo<SyncResult | null>(
    () => (lastRow[0] ? (JSON.parse(lastRow[0].value) as SyncResult) : null),
    [lastRow]
  );

  const sync = useQuery({
    queryKey: ['sync', userId],
    queryFn: () => syncAll(userId),
    enabled: !!userId,
    staleTime: 0,
    retry: 2,
    refetchOnReconnect: 'always', // volvió la red
    refetchOnWindowFocus: 'always', // la app volvió a primer plano
  });

  const pendingCount = pending.length;
  const isSyncing = sync.fetchStatus === 'fetching';
  const error = sync.error ? sync.error.message : null;

  let status: SyncStatus = 'synced';
  if (!isOnline) status = 'offline';
  else if (isSyncing) status = 'syncing';
  else if (error) status = 'error';
  else if (pendingCount > 0) status = 'pending';

  return {
    status,
    isOnline,
    pendingCount,
    isSyncing,
    lastResult,
    error,
    syncNow: () => {
      sync.refetch();
    },
  };
}
