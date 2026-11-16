# Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** Luis Nuñez, Amand Herrera
**Semana:** 9
**Proyecto:** GeoCam sincronizada (TanStack Query + sincronización offline-first) – Taller Integrador 2
**Herramienta:** Claude Code

> Registros anteriores: [Semana 8](AI-LOG-semana-8.md) · [Semana 7](AI-LOG-semana-7.md) ·
> [Semana 6](AI-LOG-semana-6.md).

## 1. Prompts Utilizados

- Se le entregó a Claude Code `docs/SEMANA9.md`, un archivo de instrucciones por fases construido a partir de la
  guía de la Semana 9. Incluía el estado real del repositorio después de la Semana 8, el diseño "no negociable"
  (SQLite fuente de verdad, `clientId`, cursor con `server_updated_at`, gana el último cambio, bajar antes de
  subir) y el plan de migraciones `0005`/`0006`. El prompt fue: *"Lee docs/SEMANA9.md completo, AGENTS.md,
  docs/SEMANA8.md y el README de ../referencia-s9/geocam-sync. […] Ejecuta las fases en orden, una a la vez. Al
  terminar cada fase: corre `npx tsc --noEmit` y `npx expo lint`, restaura tsconfig.json si Expo lo reescribió,
  haz el commit indicado y DETENTE en cada 🛑. Solo el remoto `mio`, nunca `origin`."*
- Se usó como guía la solución del profesor (`../referencia-s9/geocam-sync`), pidiendo **adaptarla** (aquí hay
  `ownerId`, `StyleSheet` en vez de NativeWind y otra base local) y no copiar su `package.json` ni su base.
- Antes de empezar se pidió guardar la Semana 10 (a medias) en su rama y crear `semana-9-sync` desde `main`.
  Después se pidió sacar `docs/SEMANA10.md` de ese commit (contiene el texto "AIza" y haría fallar la auditoría
  de la Semana 10) y subir la rama a `mio` como respaldo.
- A mitad de semana Expo Go se actualizó y dejó de abrir SDK 57. Se pasó a Claude Code `docs/UPGRADE-SDK58.md`
  (actualizar `main` una sola vez y rebasar `semana-9-sync` encima). Ver la sección "Actualización a SDK 58".
- En los 🛑 se respondió tras ejecutar el SQL en Supabase (`semana9.sql`, `semana9-borrados.sql`) y probar en el
  teléfono. Cuando la sincronización "no sincronizaba" se pidió diagnosticar primero y se pegaron los registros
  de Metro (`[red]`, `[sync]`).
- Las pruebas con **dos teléfonos** (T7.2, T7.3 y el borrado en A → B) no se pudieron hacer: los teléfonos no
  estaban en la misma red y había que entregar. Se pidió omitirlas y seguir; quedan pendientes en la matriz.

## 2. Código Generado vs. Código Modificado

- **¿Qué generó la IA?:** toda la sincronización, adaptando la referencia del profesor:
  - `supabase/semana9.sql` (columna `server_updated_at`, trigger e índice) y `supabase/semana9-borrados.sql`
    (`deleted_at`).
  - `lib/queryClient.ts` (`QueryClient`, `onlineManager` con `expo-network`, `useAppFocusManager`, `useIsOnline` y
    la caché persistente con `expo-sqlite/kv-store`).
  - Migraciones `0005` (`sync_meta`) y `0006` (`photos.deleted_at`) con `npm run db:generate`;
    `db/repositories/syncMeta.ts` y los métodos nuevos de `photosRepo` (`findByClientId`, `insertFromRemote`,
    `applyRemote`, `markSynced` con la versión subida, `markDeleted`, `markAllDeleted`, `purge`).
  - `services/sync.ts` (`remoteWins` e `isPending` puras, `pull`, `push`, `syncAll`), `services/cloudStorage.ts`
    y `downloadPhotoFile` en `services/photoFiles.ts`.
  - `hooks/useSync.ts`, `components/SyncStatus.tsx`, la pantalla `app/sync.tsx`, el feed paginado de la Nube
    (`listRemotePage`, `hooks/useCloudPhotos.ts` con `useInfiniteQuery`, `hooks/useDebouncedValue.ts`).
- **¿Qué tuvimos que corregir o cambiar respecto a la referencia o a la guía?:**
  - **No se creó la política `"editar las mías"`** que trae el SQL de la referencia: la política UPDATE ya
    existía desde la Semana 8 como `"actualizar las mías"`. Se comprobó en `supabase/schema.sql` y se dejó un
    comentario en `semana9.sql`.
  - **Una sola subida.** La subida de la Semana 8 (`uploadPhoto` + `useCloudSync`) se unificó en `push()`. Se
    mantuvo la lectura con `File` + `ArrayBuffer` y el criterio de "sin archivo" de la Semana 8; el botón
    **Sincronizar (N)** se reemplazó por el indicador `SyncStatus` y se borró `useCloudSync`.
  - **Se quitó el borrado "compensatorio"** de la Semana 8 (borrar el archivo si fallaba la fila): con la bajada,
    ese archivo puede pertenecer a una fila que ya existe en la nube. La ruta es fija y el reintento lo reemplaza.
  - **Un error al bajar no bloquea la subida**: se anota y `push` corre igual (lo local no espera a la nube).
  - **El cursor se guarda como el texto exacto de Postgres** (microsegundos); pasarlo por `Date` lo truncaría.
  - **Borrado sin conexión.** La regla de la Semana 8 "sin red no se borra" se reemplazó por el borrado lógico:
    borrar marca `deletedAt`, la foto desaparece de la UI y la sincronización avisa a la nube y luego borra el
    archivo del bucket, el archivo local y la fila.
  - **El borrado gana siempre** (sin comparar fechas), a diferencia de "gana el último cambio" para las
    ediciones: quien borra también quita el archivo del bucket, así que dejar ganar una edición posterior
    reviviría una fila sin imagen. El escenario de la guía (editar en A y después borrar en B) da lo mismo.
  - `isOnline()` puntual (Semana 8) se retiró con el borrado físico: la única regla de "hay red" es
    `isOnlineState()`, que usa `onlineManager`.

## 3. Alucinaciones o Errores Detectados

- **`markSynced` nunca se ejecutaba (error de Claude Code en la Fase 4).** Al pasar la subida a `services/sync.ts`
  se perdió el `await`: en Drizzle un `update()` es una `QueryPromise` perezosa que solo corre dentro de `then()`
  (se comprobó en `node_modules/drizzle-orm/query-promise.js`). Síntoma en el teléfono: el indicador seguía en
  "2 pendientes". Se agregaron registros `[red]`/`[sync]` (solo en desarrollo) antes de cambiar nada y Metro
  mostró `{"pushed":6,"failed":0,"sinArchivo":3}` en cada ciclo: 2 fotos × 3 vueltas, siempre las mismas.
  **Corrección:** `markSynced` termina en `.run()` dentro del repositorio. Las subidas repetidas no duplicaron
  nada (ruta fija + `upsert` por `client_id`), lo que de paso confirmó la idempotencia. Después: `"pushed":0`.
- **Hueco en el primer diseño del borrado (detectado en la revisión antes del commit).** `pushDeletion` usaba la
  subida normal, que llama a `markSynced`; si después fallaba el borrado del archivo en el bucket, la foto ya no
  quedaba pendiente y el archivo nunca se reintentaba. Se agregó `pushOne(..., markAsSynced = false)`.
- **Comando destructivo agregado por error.** Al escribir el AI-LOG de SDK 58, Claude Code agregó al final de un
  comando un `git checkout -- .` que habría descartado todos los cambios sin commit. El clasificador de permisos
  de Claude Code lo bloqueó y no se ejecutó; se repitió solo la parte correcta.
- **`docs/SEMANA10.md` entró en el commit de respaldo de la Semana 10** con el texto "AIza". Lo detectó ING; se
  quitó con `git rm --cached` + `git commit --amend` antes de subir la rama.
- **OneDrive dejó `node_modules` "solo en la nube".** Después de instalar los paquetes de la Fase 9, Metro falló
  con `Unable to resolve "@expo/metro-runtime"` aunque el archivo aparecía en la carpeta. Tenía el atributo
  `ReparsePoint`: 24.357 de 40.816 archivos de `node_modules` estaban liberados por OneDrive. Se marcaron como
  "siempre en este dispositivo" con `attrib +P -U /S /D node_modules\*`. No fue un error del código.
- **URLs firmadas en la caché persistente (C3).** Duran 1 h; al restaurar la caché pueden haber vencido. No se
  agregó código: `PhotoImage` ya muestra un placeholder si la imagen falla y la consulta `['nube']` se refresca
  al volver la red (`refetchOnReconnect`), con URLs nuevas.
- **Errores típicos de la tabla de la guía:** no aparecieron. Desde el principio se usó la forma con objeto de
  `useQuery`, `gcTime`, `initialPageParam` tipado, paginación por cursor (`lt('taken_at', cursor)`),
  `onlineManager` con `expo-network`, bajar antes de subir, `upsert` con `onConflict: 'client_id'`,
  `syncedAt` = versión subida, cursor con `server_updated_at` y borrado lógico.
- **`tsconfig.json`.** Ver la sección siguiente: en la actualización a SDK 58 se dejó de restaurar.

---

## Actualización a SDK 58

Expo Go del teléfono se actualizó y dejó de abrir proyectos SDK 57 (*"Project is incompatible with this version
of Expo Go"*). Se subió el proyecto **una sola vez sobre `main`**, en la rama `upgrade-sdk58`, siguiendo
`docs/UPGRADE-SDK58.md`. Claude Code leyó primero las fuentes oficiales (blog de actualización, changelog de
SDK 58 y la guía de Expo Router 57 → 58). El changelog es muy largo y no se leyó completo; lo que no se leyó
se tomó de un resumen.

**Versiones:** `expo` 57.0.30 → 58.0.23 · `react-native` 0.86.3 → 0.88.1 · `react`/`react-dom` 19.2.3 → 19.3.0 ·
`@types/react` 19.2 → 19.3 · `expo-router` 57.0.28 → 58.0.30 · `react-native-maps` 1.27.2 → 1.29.11 ·
`react-native-screens` 4.26 → 4.30.1 · `react-native-safe-area-context` 5.7 → 5.11.1 · todos los `expo-*` a 58.0.x.
`typescript` (6.0.3), `drizzle-orm`, `drizzle-kit` y `@supabase/supabase-js` quedaron igual. `npx expo-doctor`:
20/20 sin problemas.

Qué rompió y cómo se arregló (errores reales):

- **`npm install` falló con `ERESOLVE`.** `expo-router@58.0.30` declara `@expo/ui@^58.0.27` como dependencia
  *peer opcional* y npm no la resolvía. Se creó `.npmrc` con `legacy-peer-deps=true` (lo que indica la guía
  para este caso) y se repitió. `@expo/ui` no se instala: solo hace falta para `Stack.Toolbar` en Android.
- **`npx expo install expo@^58.0.0` dejó `"expo": "^58.0.0"`** en `package.json`, a diferencia del `~` que
  usan los demás paquetes de Expo. Se fijó en `~58.0.23` (la versión instalada).
- **Un error de tipos por la API estricta de React Native 0.88**, que ahora viene activada por defecto:
  `app/(tabs)/nube.tsx` → `TS2322: Type 'Element | null' is not assignable to type 'Element | ComponentType<any>
  | undefined'` en `ListEmptyComponent`. Se cambió `null` por `undefined`. No hubo imports profundos de
  `react-native/Libraries/*` ni `ref` con tipos viejos que fallaran.
- **Revisado y cambiado sin que fallara (preventivo, según la guía de Expo Router 58):**
  - El `router` de módulo en `fotos.tsx`, `mapa.tsx` y `foto/[id].tsx` pasó a `useRouter()`. En SDK 58, el
    `router` de módulo lanza un error si se usa antes del primer render. Aquí solo se usaba en `onPress`, pero
    la guía recomienda el hook.
  - `headerTransparent: false` en el detalle de la foto. En iOS 26+ el header pasa a ser transparente por
    defecto y el contenido quedaría debajo del header oscuro del tema. En Android no cambia nada.
- **Revisado sin cambios:** las 4 pestañas de `expo-router/js-tabs` están declaradas en el layout (SDK 58 oculta
  las que no lo estén); no se usa `initialRouteName`, `redirect`/`initialParams` en `Screen`, `freezeOnBlur`,
  `InteractionManager`, `Modal animated`, props eliminadas de `StatusBar`, `ImageBackground`, `Touchable`,
  `useNavigation`, `Linking.parse` ni `File.write()`. `Stack.Protected` sigue igual (`redirectTo` es opcional).
- **`tsconfig.json`: esta vez se aceptó el cambio en lugar de restaurarlo.** Se leyó el código de la CLI
  (`@expo/cli/.../type-generation`): cuando `app.json` no activa `experiments.typedRoutes`, `expo start` quita
  `.expo/types/**/*.ts` y `expo-env.d.ts` del `include` y borra `expo-env.d.ts`; si estuviera activo, los
  agregaría. Por eso se reescribía en cada arranque (también en las semanas 7 y 8). El changelog no lo
  menciona, pero es el comportamiento intencional de la CLI para un proyecto sin rutas tipadas. Restaurarlo
  dejaba el archivo modificado en cada `expo start`. Con el `include` nuevo, `npx tsc --noEmit` pasa.
- `drizzle/` no se tocó y no se regeneró ninguna migración; la base local del teléfono no cambia.
