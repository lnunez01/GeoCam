# Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** Luis Nuñez, Amand Herrera
**Semana:** 8
**Proyecto:** GeoCam en la nube – Taller Integrador 2
**Herramienta:** Claude (claude.ai, con acceso al repositorio de GitHub)

> Registros anteriores: [Semana 6](docs/ai-log/AI-LOG-semana-6.md) · [Semana 7](docs/ai-log/AI-LOG-semana-7.md)

## 1. Prompts Utilizados

La clase no se dictó y el docente envió la guía en PDF. Se trabajó en una sola conversación, adjuntando la guía:

- *"Mi profesor me dio esta guía pero no entiendo qué hay que hacer … indícame qué me pide hacer mi profesor."*
  La IA separó el **taller en clase (T1–T6)** del **trabajo para la casa (C1–C7)** y aclaró que se entregan los dos.
- *"Dime qué hago primero, paso a paso."* A partir de aquí la IA trabajó por pasos: escribía el código de una
  tarea, lo subía al repositorio y daba instrucciones para probarlo en el iPhone. Ninguna tarea avanzaba sin la
  prueba en el teléfono de la anterior.
- Se le pidió traer la Semana 7 del repositorio del compañero (`Amand-H/GeoCam_amandH_luifer`) al repositorio
  propio (`lnunez01/geocam`). Se hizo con un *fast-forward* porque partía del mismo commit de la Semana 6.
- Durante las pruebas se le enviaron capturas: el panel de Supabase, la terminal de VS Code y dos errores en el
  teléfono (puntos 3.1 y 3.2).

## 2. Código Generado vs. Código Modificado

- **¿Qué generó la IA?:**
  - T1: `lib/secureStorage.ts` (sesión por fragmentos en SecureStore), `lib/supabase.ts`, `.env.example` y `.env`
    en `.gitignore`.
  - T2: `context/AuthContext.tsx`, `app/login.tsx`, `Stack.Protected` en `app/_layout.tsx`, redirección en
    `app/index.tsx` y botón **Salir** en la pestaña Fotos.
  - T4: columnas `clientId`, `updatedAt`, `remotePath`, `syncedAt` y los métodos `ensureSyncFields`, `markSynced`.
  - T5 y C1–C4: `services/cloudPhotos.ts`, `hooks/useCloudSync.ts`, `hooks/useCloudPhotos.ts`, `app/(tabs)/nube.tsx`.
  - C5: columna `ownerId`, filtro por usuario en todas las consultas de fotos y `claimUnowned`.
  - `supabase/schema.sql` con todo el SQL remoto, y este README / AI-LOG.
- **¿Qué hicimos nosotros?:** crear el proyecto de Supabase, el `.env`, ejecutar el SQL en el panel, instalar las
  librerías con `npx expo install`, **generar las migraciones con `npm run db:generate`** (la IA no podía instalar
  paquetes en su entorno) y todas las pruebas en el iPhone.
- **¿Qué se cambió respecto al código de la guía?:**
  - **Subida con `upsert` en lugar de `insert` (C2).** Con el `insert` de la guía, repetir la subida falla por
    `client_id` único. Se cambió a `upsert(..., { onConflict: 'client_id' })`: la primera vez inserta y las
    siguientes actualizan la misma fila (por ejemplo, una nota editada). Si el archivo ya existe en el bucket
    (`409` / *already exists*) se reutiliza. Si el archivo se subió en ese intento y la fila falla, se borra del
    bucket antes de reportar el error.
  - **Política `actualizar las mías`.** El SQL de la guía no tiene política `UPDATE` en `photos`, y sin ella el
    `upsert` falla por RLS. Se agregó en `supabase/schema.sql`.
  - **Pendiente incluye ediciones.** La guía define "pendiente" como `syncedAt` vacío o anterior a `updatedAt`;
    `pendingUploads()` usa esa misma regla, así que **Sincronizar** también sube notas y favoritas editadas.
    En el detalle el botón cambia a **"Subir cambios"**.
  - **UUID fuera de `schema.ts`.** La guía pone `$defaultFn(() => Crypto.randomUUID())` en el esquema. Como
    `drizzle-kit` lee `schema.ts` desde Node, se decidió no importar un módulo nativo de Expo ahí; el `clientId`
    lo genera `photosRepo.create`. Fue una precaución: no se probó la versión de la guía.
  - **Login con `StyleSheet`, no NativeWind.** El proyecto nunca usó NativeWind (todas las pantallas usan
    `StyleSheet` y `constants/theme.ts`); se mantuvo la consistencia en lugar de instalarlo solo para una pantalla.
  - **Errores de Auth en español** (`translateError` en `AuthContext`).

## 3. Alucinaciones o Errores Detectados

1. **`JSON Parse error: Unexpected character: <` al iniciar sesión.** La app recibía una página HTML en lugar de
   JSON: la URL del `.env` no era la de la API del proyecto. La IA la había transcrito de una captura de
   pantalla, y por eso recomendó copiarla con el botón **Copy** del panel. Tras corregirla y reiniciar con
   `npx expo start -c`, funcionó. Lección: una llave o URL nunca se copia "a ojo".
2. **"Correo o contraseña incorrectos" al crear la cuenta.** Ese mensaje solo lo produce `signInWithPassword`:
   se estaba tocando el botón verde **Iniciar sesión** en vez del texto **Crear cuenta**. Se verificó en
   *Authentication → Users* que la lista estaba vacía y el registro funcionó con el botón correcto.
3. **Realtime con filtro `user_id=eq.…` no avisa de los borrados.** La primera versión de `useCloudPhotos`
   filtraba el canal por `user_id`, pero Supabase no permite filtrar eventos `DELETE` (solo traen la llave
   primaria), así que la pestaña Nube no se habría enterado de una foto borrada. Se quitó el filtro: RLS aplica
   al canal y la consulta de recarga solo devuelve las filas propias.
4. **Borrado a medias (C3).** Borrar primero la copia local y luego la remota deja la foto en la nube si no hay
   internet. Se invirtió el orden: comprobar conexión → borrar fila remota → borrar archivo del bucket → borrar
   la copia local. Si cualquier paso remoto falla, se lanza el error y la foto local se conserva.
5. **`markSynced` no debe tocar `updatedAt`** (lo advierte la guía): si lo hiciera, la foto quedaría pendiente
   para siempre. Al contrario, `photosRepo.update` ahora siempre escribe `updatedAt`.
6. **Fotos sin dueño tras la migración `0004` (C5).** Las fotos viejas quedan con `owner_id` vacío y, con el
   filtro nuevo, habrían desaparecido. `claimUnowned` las asigna al iniciar sesión: las ya subidas al usuario
   de su carpeta en el bucket (`<userId>/…`) y el resto a quien inicia sesión.
7. **`npm` sin red en el entorno de la IA.** No pudo ejecutar `npx tsc --noEmit` ni `npm run db:generate`;
   por eso las migraciones `0003` y `0004` las generamos nosotros y toda la verificación se hizo en el teléfono.
8. **`npx expo start` volvió a reescribir `tsconfig.json`** (igual que en la Semana 7). Se revirtió con
   `git restore tsconfig.json` y no entró en ningún commit.
9. **Errores típicos de la tabla de la guía:** no apareció ninguno (secret key en la app, variables sin
   `EXPO_PUBLIC_`, `AsyncStorage`, `detectSessionInUrl: true`, API v1, `router.replace` tras el login, `Blob` o
   `FormData`, `using (true)` en escrituras, desactivar RLS, canal sin `removeChannel`, paquetes de Next.js).
   Se revisó con `git grep` sobre el código.

## 4. Verificación (iPhone con Expo Go)

- T2: sin sesión abre el login; registro, cierre de la app con la sesión intacta, **Salir** vuelve al login.
- T5/T6: foto subida a `geocam/<userId>/<clientId>.jpg` (peso mayor a 0 bytes) y su fila en `photos`.
- C1/C2: **Sincronizar** muestra el avance; al repetirlo dice "Todo al día"; 4 filas con `client_id` distintos;
  la nota editada ("Pc") actualizó la misma fila.
- C3: la foto borrada desaparece de la tabla y del bucket.
- C4: la pestaña Nube muestra las fotos con URL firmada; al cambiar `favorite` en el panel aparece la ★ sola.
- C5: con una segunda cuenta en el mismo teléfono, Fotos, Mapa y Nube aparecen vacías; al volver a la cuenta
  principal sus fotos siguen ahí y la de la segunda cuenta no.
- C6: ver la sección "Auditoría de credenciales" del [README](README.md).
