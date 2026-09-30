import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import * as Location from 'expo-location';
import { mapPermission } from '@/lib/permissions';
import type { Coords, PermissionState } from '@/types/geo';

interface Options {
  /** Seguimiento continuo con watchPositionAsync. */
  watch?: boolean;
  /**
   * Si es false no hay ninguna suscripción activa. Las pantallas pasan
   * `useIsFocused()` para que el GPS se apague al salir de la pestaña.
   */
  enabled?: boolean;
}

interface GeoLocationState {
  permission: PermissionState;
  coords: Coords | null;
  error: string | null;
}

export interface UseGeoLocationResult extends GeoLocationState {
  /** true si el usuario concedió solo ubicación aproximada (precisión > 1 km). */
  isApproximate: boolean;
  requestPermission: () => Promise<boolean>;
  getCurrent: () => Promise<Coords | null>;
  openSettings: () => Promise<void>;
}

const APPROXIMATE_THRESHOLD_M = 1000;

function toCoords(loc: Location.LocationObject): Coords {
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy,
    timestamp: loc.timestamp,
  };
}

function toMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export function useGeoLocation({ watch = false, enabled = true }: Options = {}): UseGeoLocationResult {
  const [state, setState] = useState<GeoLocationState>({
    permission: 'checking',
    coords: null,
    error: null,
  });

  // 1. Al montar (y al volver de Ajustes): solo CONSULTAR el permiso, nunca pedirlo
  useEffect(() => {
    let cancelled = false;

    const check = () => {
      Location.getForegroundPermissionsAsync()
        .then((res) => {
          if (!cancelled) setState((s) => ({ ...s, permission: mapPermission(res) }));
        })
        .catch((e: unknown) => {
          if (!cancelled) {
            setState((s) => ({
              ...s,
              permission: 'denied',
              error: toMessage(e, 'No se pudo consultar el permiso de ubicación'),
            }));
          }
        });
    };

    check();
    // El usuario pudo activar el permiso en Ajustes: re-consultar al volver a la app
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') check();
    });

    return () => {
      cancelled = true;
      appStateSub.remove();
    };
  }, []);

  // 2. Solicitar permiso por acción explícita del usuario
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const res = await Location.requestForegroundPermissionsAsync();
      setState((s) => ({ ...s, permission: mapPermission(res), error: null }));
      return res.granted;
    } catch (e) {
      setState((s) => ({ ...s, error: toMessage(e, 'No se pudo solicitar la ubicación') }));
      return false;
    }
  }, []);

  // 3. Lectura única, útil justo antes de tomar la foto
  const getCurrent = useCallback(async (): Promise<Coords | null> => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = toCoords(loc);
      setState((s) => ({ ...s, coords, error: null }));
      return coords;
    } catch (e) {
      setState((s) => ({ ...s, error: toMessage(e, 'No se pudo obtener la ubicación') }));
      return null;
    }
  }, []);

  // 4. Seguimiento continuo con limpieza segura ante desmontaje temprano
  useEffect(() => {
    if (!watch || !enabled || state.permission !== 'granted') return;

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
      (loc) => setState((s) => ({ ...s, coords: toCoords(loc), error: null }))
    )
      .then((sub) => {
        if (cancelled) sub.remove(); // se desmontó antes de resolver
        else subscription = sub;
      })
      .catch((e: unknown) => {
        if (!cancelled) setState((s) => ({ ...s, error: toMessage(e, 'Error de GPS') }));
      });

    return () => {
      cancelled = true;
      subscription?.remove();
      if (__DEV__) console.log('[useGeoLocation] cleanup: GPS detenido');
    };
  }, [watch, enabled, state.permission]);

  const openSettings = useCallback(() => Linking.openSettings(), []);

  const isApproximate =
    state.coords?.accuracy != null && state.coords.accuracy > APPROXIMATE_THRESHOLD_M;

  return { ...state, isApproximate, requestPermission, getCurrent, openSettings };
}
