import { useEffect, useRef, useState } from 'react';
import { Accelerometer } from 'expo-sensors';

interface ShakeOptions {
  /** Magnitud en g a partir de la cual se considera agitado (en reposo ≈ 1 g). */
  threshold?: number;
  /** Tiempo mínimo entre dos disparos, para no repetir por un solo agitado. */
  cooldownMs?: number;
  /** false = sin suscripción (p. ej. cuando la pantalla no tiene el foco). */
  enabled?: boolean;
}

interface ShakeResult {
  isAvailable: boolean | null;
  error: string | null;
}

const UPDATE_INTERVAL_MS = 100;

export function useShake(
  onShake: () => void,
  { threshold = 1.8, cooldownMs = 1000, enabled = true }: ShakeOptions = {}
): ShakeResult {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // El callback vive en una ref para no reiniciar la suscripción en cada render
  const onShakeRef = useRef(onShake);
  useEffect(() => {
    onShakeRef.current = onShake;
  }, [onShake]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;
    let lastShake = 0;

    Accelerometer.isAvailableAsync()
      .then((available) => {
        if (cancelled) return;
        setIsAvailable(available);
        if (!available) return;

        Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
        subscription = Accelerometer.addListener(({ x, y, z }) => {
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          const now = Date.now();
          if (magnitude > threshold && now - lastShake > cooldownMs) {
            lastShake = now;
            onShakeRef.current();
          }
        });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setIsAvailable(false);
        setError(e instanceof Error ? e.message : 'Acelerómetro no disponible');
      });

    return () => {
      cancelled = true;
      subscription?.remove();
      if (__DEV__) console.log('[useShake] cleanup: acelerómetro detenido');
    };
  }, [enabled, threshold, cooldownMs]);

  return { isAvailable, error };
}
