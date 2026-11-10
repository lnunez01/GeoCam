import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import * as Network from 'expo-network';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
// Almacenamiento llave/valor de expo-sqlite con la misma API que AsyncStorage (sin instalar otro paquete)
import kvStore from 'expo-sqlite/kv-store';

const ONE_WEEK = 1000 * 60 * 60 * 24 * 7;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // durante 30 s no se repite una consulta que ya está en caché
      gcTime: ONE_WEEK, // la caché persistida (C3) no sirve si se descarta antes
      retry: 2,
    },
  },
});

// 1. TanStack Query se entera del estado de la red.
//    En React Native no existe window 'online': sin esto nunca detectaría el modo avión.
onlineManager.setEventListener((setOnline) => {
  let initialised = false;
  const subscription = Network.addNetworkStateListener((state) => {
    initialised = true;
    setOnline(!!state.isConnected);
  });
  Network.getNetworkStateAsync()
    .then((state) => {
      if (!initialised) setOnline(!!state.isConnected);
    })
    .catch(() => {});
  return () => subscription.remove();
});

// 2. TanStack Query se entera de cuándo la app vuelve a primer plano
export function useAppFocusManager() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
    });
    return () => subscription.remove();
  }, []);
}

// 3. Hook para que la UI muestre si hay conexión
export function useIsOnline() {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline()
  );
}

/**
 * C3. Caché que sobrevive al cierre: se guarda en SQLite (kv-store) y se restaura al abrir.
 * Solo se persiste el feed de la Nube; la sincronización siempre se vuelve a ejecutar.
 */
export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: createAsyncStoragePersister({ storage: kvStore, key: 'geocam-query-cache' }),
  maxAge: ONE_WEEK,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.queryKey[0] === 'cloud' && query.state.status === 'success',
  },
};

/** Pide un ciclo de sincronización. Si no hay red, TanStack Query lo deja en pausa y lo reanuda al reconectar. */
export function requestSync() {
  queryClient.invalidateQueries({ queryKey: ['sync'] });
}
