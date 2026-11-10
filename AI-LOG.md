# Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** Luis Nuñez, Amand Herrera
**Semana:** 9
**Proyecto:** GeoCam sincronizada – Taller Integrador 2
**Herramienta:** Claude Code (asistente de programación con IA, con acceso al repositorio)

> Registros anteriores: [Semana 6](docs/ai-log/AI-LOG-semana-6.md) · [Semana 7](docs/ai-log/AI-LOG-semana-7.md) ·
> [Semana 8](docs/ai-log/AI-LOG-semana-8.md)

## 1. Prompts Utilizados

- *"Sigamos con la semana 9, dime qué necesito o tú puedes hacer todo"*, adjuntando la guía en PDF.
  La IA escribió el código del taller (T1–T6) y del trabajo para la casa (C1–C5, C7). Las pruebas en los dos
  teléfonos, el GIF y la matriz de pruebas (C6) quedaron para el equipo.
- Antes se le pidió verificar la Semana 8 contra su guía; de esa revisión salieron dos arreglos que se
  hicieron al empezar la Semana 9 (lockfile desincronizado y errores de lint en `app/_layout.tsx`).

## 2. Código Generado vs. Código Modificado

- **¿Qué generó la IA?:** `services/sync.ts` (pull, push, `remoteWins`, purga de borrados), `lib/queryClient.ts`,
  `hooks/useSync.ts`, `hooks/useCloudFeed.ts`, la pestaña Nube con `useInfiniteQuery`, la pantalla
  `app/sincronizacion.tsx`, la migración 0005 y el SQL de Supabase.
- **¿Qué se cambió respecto al código de apoyo de la guía?:**
  - **Dos ciclos de sincronización a la vez.** `invalidateQueries` cancela la consulta en curso y lanza otra, pero
    la función de sincronización no se puede abortar: podían correr dos `push` al mismo tiempo. `syncAll` ahora
    devuelve el ciclo que ya está en marcha en vez de empezar otro.
  - **Una fila que no se puede bajar trababa todo.** En el código de la guía, si el archivo de una foto no está en el
    bucket, `pull` lanza el error, el cursor no avanza y cada ciclo falla en la misma fila. Ahora: sin red se corta
    y se reintenta; otro error se registra y esa fila se salta.
  - **C5 (errores por foto):** el `push` de la guía se detiene en la primera foto que falla. Ahora cada foto va en su
    propio `try/catch`, la que falla sigue pendiente y el resultado cuenta cuántas fallaron. Sin red sí se corta,
    porque las demás también fallarían.
  - **Huérfanos (C2 de la Semana 8):** si el archivo sube y el `upsert` falla, se borra el archivo recién subido.
  - **Borrado lógico (C1):** una foto que nunca llegó a la nube se borra de verdad (nadie más la conoce); las demás
    se marcan con `deletedAt` + `updatedAt`. Los archivos se borran solo cuando la marca ya está sincronizada, y la
    fila local queda como lápida (`uri` vacía) para que no vuelva a bajar.
  - **La caché persistida (C3) usa `expo-sqlite/kv-store`** en vez de instalar AsyncStorage: tiene la misma API y
    el proyecto ya usa expo-sqlite. Solo se persiste el feed de la Nube, no la consulta de sincronización.
  - **URLs firmadas de 7 días** en el feed: con 1 hora, la caché persistida mostraba imágenes rotas sin conexión.
  - **Las pantallas ya no importan Drizzle:** las migraciones pasaron a `hooks/useDatabase.ts`. De paso se
    corrigieron los dos errores de lint (`setState` síncrono dentro de un efecto).
  - **Se actualizó a Expo SDK 58**, porque Expo Go de iOS ya no abría el SDK 57.

## 3. Alucinaciones o Errores Detectados

- **"TanStack Query sincroniza la base de datos offline":** no lo hace. Solo decide cuándo ejecutar `syncAll`
  (al reconectar, al volver a primer plano, al invalidar) y la reintenta; el qué (cursor, comparación, upsert,
  borrados) es diseño propio en `services/sync.ts`.
- **API de la versión 5:** se usó `useQuery({ queryKey, queryFn })`, `gcTime` (no `cacheTime`),
  `status === 'pending'` (no `'loading'`) e `initialPageParam` en `useInfiniteQuery`, que es obligatorio.
- **`window.addEventListener('online')`** no existe en React Native: la red se detecta con
  `onlineManager.setEventListener` y `expo-network`.
- **La política de update del T1** ya existía desde la Semana 8 con otro nombre ("actualizar las mías"). Volver a
  crearla con el SQL de la guía habría fallado o dejado dos políticas iguales; el SQL del repositorio la omite.
- **`refetch()` en `onRefresh`:** TypeScript rechazó pasar `() => feed.refetch()` a `RefreshControl` porque
  devuelve una promesa con datos; se envolvió en una función que no devuelve nada.

## 4. Verificación

- `npx tsc --noEmit` y `npx expo lint`: sin errores.
- `npm run db:generate`: migración `drizzle/0005_*.sql` con `sync_meta` y `deleted_at`.
- `npx expo export --platform ios`: el bundle compila.
- Pruebas en dos teléfonos: ver la matriz de pruebas en el README. _Completar con los resultados obtenidos._
