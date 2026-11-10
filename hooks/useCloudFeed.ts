import { useEffect, useMemo } from 'react';
import { keepPreviousData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { listCloudPage, subscribeToCloudChanges } from '@/services/cloudPhotos';

/** C2. Feed de la nube con paginación por cursor y búsqueda por nota. */
export function useCloudFeed(search: string) {
  const userId = useAuth().session?.user.id ?? '';
  const query = useInfiniteQuery({
    queryKey: ['cloud', userId, { search }], // cada búsqueda tiene su propia caché
    queryFn: ({ pageParam }) => listCloudPage({ cursor: pageParam, search }),
    initialPageParam: null as string | null, // obligatorio en la versión 5
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData, // al escribir, se conserva la lista anterior en vez de parpadear
    enabled: !!userId,
  });

  // Las páginas se aplanan en una sola lista para FlatList
  const photos = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  return { ...query, photos };
}

/** Tiempo real: no recarga a mano, solo le avisa a la caché que quedó desactualizada. */
export function useCloudRealtime() {
  const queryClient = useQueryClient();
  const userId = useAuth().session?.user.id;
  useEffect(() => {
    if (!userId) return;
    // Toda suscripción se limpia (regla de la Semana 6)
    return subscribeToCloudChanges(userId, () => {
      queryClient.invalidateQueries({ queryKey: ['cloud'] });
    });
  }, [queryClient, userId]);
}
