# Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** Luis Nuñez, Amand Herrera
**Semana:** 10
**Proyecto:** GeoCam con Asistente IA (Gemini detrás de Supabase Edge Functions) – Taller Integrador 2
**Herramienta:** Claude Code (asistente de programación con IA, con acceso al repositorio)

> Registros anteriores: [Semana 9](docs/ai-log/AI-LOG-semana-9.md) · [Semana 8](docs/ai-log/AI-LOG-semana-8.md) ·
> [Semana 7](docs/ai-log/AI-LOG-semana-7.md) · [Semana 6](docs/ai-log/AI-LOG-semana-6.md).

## 1. Prompts Utilizados

- *"Amand hizo ya la semana 9, este es el link de su repositorio … ahora a mí me toca hacer la semana 10, ayúdame"*,
  adjuntando la guía en PDF. La IA escribió el taller (T1–T6) y el trabajo para la casa (C1–C5); las pruebas en el
  teléfono, las capturas y el despliegue con la key de Gemini quedaron para el equipo.

## 2. Código Generado vs. Código Modificado

- **¿Qué generó la IA?:** las Edge Functions `tutor`, `describir-foto` y `tarjetas`; `services/vision.ts`,
  `services/tarjetas.ts`, `services/aiErrors.ts`; la pestaña **Tutor IA**, la pantalla de perfil, el modal de
  tarjetas, el bloque **✨ Describir con IA** del detalle; la migración `0007` y `supabase/semana10.sql`.
- **¿Qué se reutilizó?:** del avance de Amand (rama `semana-10-ia`) se tomaron `polyfills.ts`,
  `lib/chatTransport.ts`, `lib/foto.ts` y la primera versión de la función `tutor`.
- **¿Qué se cambió respecto al código de apoyo de la guía?:**
  - **Límite diario (C5) en las tres funciones**, contado e insertado en `uso_ia` con `ctx.supabase` (el cliente del
    usuario, con RLS). Sin políticas de `update` ni `delete`: nadie puede borrar su uso para saltarse el límite.
  - **Perfil validado con zod (C2):** cada campo tiene `.catch()` con un valor seguro; el nombre además solo acepta
    letras, espacios, punto, apóstrofo y guion, para que no se pueda inyectar texto en las instrucciones.
  - **Funciones autocontenidas** (sin carpeta `_shared/`): así cada una también se puede desplegar pegándola en el
    editor del Dashboard, como permite la guía si no hay CLI.
  - **`describir-foto` valida la entrada:** exige el prefijo `data:image/jpeg;base64,` y rechaza más de ~1,5 MB.
  - **Tarjetas (C3):** se envía solo el texto de la conversación (sin las fotos en base64) para no gastar tokens otra vez.
  - **La descripción es una sugerencia (T6):** la respuesta de la IA llena un editor y solo se guarda cuando el
    usuario pulsa *Guardar descripción*; guardar pasa por `update()`, que cambia `updatedAt` (T5).
  - **Errores (C4):** `services/aiErrors.ts` clasifica en sesión, límite, cuota, red u otro. Con sesión vencida se
    cierra la sesión (Stack.Protected lleva al login); con límite no se ofrece Reintentar.

## 3. Alucinaciones o Errores Detectados

- **La rama `semana-10-ia` partía de la Semana 8.** El avance anterior hecho con IA se creó desde la rama de la
  Semana 8, antes de la Semana 9. Fusionarla tal cual habría **borrado toda la sincronización de la Semana 9**
  (`services/sync.ts`, `sync_meta`, borrado lógico) y vuelto al SDK 57; `git diff --stat` mostraba 4095 líneas
  borradas. Se partió de `main` (Semana 9) y solo se copiaron los archivos nuevos.
- **El polyfill no compilaba en TypeScript estricto:** `@ungap/structured-clone` no trae tipos (error TS7016). Se
  declaró el módulo en `types/polyfills.d.ts`.
- **API de la versión 7 (verificada en `node_modules/ai/dist/index.d.ts`):** el prompt de sistema es
  `instructions` (no `system`) y `generateObject` no existe: se usa `generateText` con `output: Output.object(...)`.
  Los tutoriales viejos y varias respuestas de IA proponen la forma de las versiones 4 y 5.
- **La guía pide Expo Go con SDK 57**, pero el proyecto ya está en SDK 58 (Expo Go de iOS solo abre la última). Se
  instaló `expo-image-manipulator@~58` y no la versión 57 del ejemplo.
- **Error real al probar: el modelo de la guía estaba saturado.** La primera pregunta al tutor falló con
  *"El tutor no pudo responder"*. En *Edge Functions → tutor → Logs* el error real era
  `AI_RetryError … AI_APICallError: This model is currently experiencing high demand` (HTTP 503) con
  `gemini-3.8-flash`. No era un error del código ni de la key: Google estaba saturado. Se cambió el modelo con
  `npx supabase secrets set GEMINI_MODEL=gemini-3.5-flash-lite` (sin tocar el código) y se agregó un mensaje
  propio para el 503 en las tres funciones, porque el genérico no le decía al usuario que era temporal.
- _Agregar aquí los errores que aparezcan al probar en el teléfono (al menos 2 son obligatorios en C6)._

## 4. Verificación

- `npx tsc --noEmit` y `npx expo lint`: sin errores.
- `deno check` de las tres Edge Functions con `npm:ai@7`, `npm:@ai-sdk/google@4` y `npm:@supabase/server@1`: sin errores.
- `npm run db:generate`: la migración `0007` es un `ALTER TABLE` + `CREATE TABLE chat_messages`; no se borró `drizzle/`.
- `npx expo export --platform ios` y búsqueda de `AIza` en el bundle: **0 resultados**.
- Pruebas en el teléfono: ver [`PRUEBAS.md`](PRUEBAS.md).
