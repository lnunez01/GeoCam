import { useEffect, useState } from 'react';

/** Búsqueda en vivo sin una petición por cada tecla: espera a que el usuario deje de escribir. */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
