import { useCallback, useState } from 'react';
import { perfilRepo } from '@/db/repositories/chat';
import { useOwnerId } from '@/hooks/useOwnerId';
import type { Perfil } from '@/types/ai';

/** C2: perfil del estudiante para el Tutor IA. */
export function usePerfil() {
  const ownerId = useOwnerId();
  const [perfil, setPerfil] = useState<Perfil>(() => perfilRepo.get(ownerId));

  const save = useCallback(
    (next: Perfil) => {
      const clean = { ...next, nombre: next.nombre.trim() };
      perfilRepo.set(ownerId, clean);
      setPerfil(clean);
    },
    [ownerId]
  );

  return { perfil, save };
}
