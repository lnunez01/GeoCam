import type { PermissionState } from '@/types/geo';

interface PermissionLike {
  status: 'granted' | 'denied' | 'undetermined';
  granted: boolean;
  canAskAgain: boolean;
}

/**
 * Traduce la respuesta unificada de Expo a la máquina de estados de la app.
 * `canAskAgain: false` significa que el sistema ya no mostrará el diálogo:
 * solo queda enviar al usuario a Ajustes.
 */
export function mapPermission(res: PermissionLike | null): PermissionState {
  if (!res) return 'checking';
  if (res.granted) return 'granted';
  if (!res.canAskAgain) return 'blocked';
  if (res.status === 'undetermined') return 'undetermined';
  return 'denied';
}
